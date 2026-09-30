"""
Isaac Burner: the Answers column.

Picks a question operators are actually searching for, finds the episodes in
The Dime's own catalogue that answer it, has Claude write a short opinionated
answer grounded in that material, and writes it to
app/content/answers/<slug>.md for the site to render at /answers/<slug>.

Opened as a pull request, never pushed to main. See
.github/workflows/isaac-blogger.yml. The transcript pipeline commits straight
to main because a transcript is a mechanical rendering of audio that already
exists. A column post is an opinion published under the show's name, and that
gets a human gate.

Question sources, in order:

  1. Search Console. Question shaped queries where the site already gets
     impressions but does not hold a top position. This is the whole point:
     the question is demand that exists and is currently going to somebody
     else's page.
  2. The episode catalogue. FAQ pairs from transcripts of episodes the column
     has not cited yet. Used when Search Console is unavailable or has
     nothing new, so a run still produces something rather than failing.

A candidate question is only used if the catalogue can actually answer it.
Without that check the column would drift into writing generic cannabis
content on whatever happened to be searched, which is worth nothing to this
site and is exactly the failure mode Google's scaled content abuse policy
describes.

A written post then has to clear, in order:

  1. validate_post(): structure, taxonomy, citations, length.
  2. unverified_quotes(): every quotation found word for word in a cited
     transcript. Deterministic, and free.
  3. stale_reason(): a post the writer marked time sensitive is rejected
     when its newest cited episode is past ISAAC_MAX_SOURCE_AGE_MONTHS.
  4. The fact check: a second Claude call reads the full transcripts of the
     cited episodes and gives every claim a verdict. One unsupported,
     misattributed or stale claim rejects the post.

All four exist because the first batch of posts (Sep 30, 2026) had every
one of those faults, and a reviewer reading for voice missed them.
"""

import json
import math
import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import yaml

import simplecast_feed
from config import config
from isaac_claude_client import IsaacClaudeClient
from isaac_prompts import MAX_WORDS, MIN_WORDS
from transcript_prompts import CANONICAL_TOPICS

REPO_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_DIR = REPO_ROOT / "app" / "content" / "answers"
TRANSCRIPT_DIR = REPO_ROOT / "app" / "content" / "transcripts"

EM_DASH = chr(0x2014)

# Queries about the show itself. The site already wins these and an answer
# post would compete with its own episode and guest pages for them.
BRAND_TERMS = ("dime podcast", "the dime", "bryan fields", "kellan finney", "8th revolution")

QUESTION_STARTERS = (
    "what", "why", "how", "when", "where", "who", "which", "is", "are",
    "does", "do", "can", "should", "will", "did", "was", "were", "has", "have",
)

# Dropped before scoring a question against the catalogue. Without this every
# question matches every transcript on "the" and "in" and the relevance floor
# stops meaning anything.
STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "did", "do",
    "does", "for", "from", "get", "had", "has", "have", "how", "i", "if", "in",
    "into", "is", "it", "its", "my", "of", "on", "or", "should", "so", "than",
    "that", "the", "their", "them", "then", "there", "they", "this", "to", "up",
    "was", "we", "were", "what", "when", "where", "which", "who", "why", "will",
    "with", "you", "your",
}


def normalize_question(text: str) -> str:
    """Comparison key for deduping questions. Mirrors getAnsweredQuestions()
    in app/lib/answers.ts, so the bot and the site agree on what counts as
    the same question."""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def strip_em_dashes(text: str) -> str:
    """House style: no em dashes anywhere. The prompt says so and Claude
    still slips one in occasionally, usually inside a quoted phrase. Replace
    rather than reject the whole post, and log it so a prompt that starts
    slipping often is visible."""
    if EM_DASH not in text:
        return text
    out = re.sub(r"\s*" + EM_DASH + r"\s*", ", ", text)
    out = re.sub(r",\s*([.,;:!?])", r"\1", out)
    out = re.sub(r",\s*,", ",", out)
    return out


def tokenize(text: str) -> set[str]:
    return {w for w in re.findall(r"[a-z0-9]+", text.lower()) if w not in STOPWORDS and len(w) > 2}


def word_seq(text: str) -> str:
    """Lowercase words only, single spaced. The comparison form for quotes:
    the transcript uses em dashes and curly quotes, a post uses neither, and
    neither difference changes what was said."""
    return " ".join(re.findall(r"[a-z0-9]+", text.lower()))


# --- Existing posts ----------------------------------------------------------


def load_existing_posts() -> list[dict]:
    """Front matter of every published post. Tolerant by design: a file the
    bot cannot parse is skipped rather than failing the run, because the only
    thing this data is used for is avoiding repeats, and losing one entry
    costs a near duplicate post, not a broken site."""
    posts = []
    if not OUTPUT_DIR.exists():
        return posts
    for path in sorted(OUTPUT_DIR.glob("*.md")):
        try:
            raw = path.read_text(encoding="utf-8")
            if not raw.startswith("---"):
                continue
            _, front, _ = raw.split("---", 2)
            data = yaml.safe_load(front) or {}
            posts.append(
                {
                    "slug": str(data.get("slug") or path.stem),
                    "title": str(data.get("title") or ""),
                    "episodes": [str(s) for s in (data.get("episodes") or [])],
                    "faq": [
                        str(pair.get("question", ""))
                        for pair in (data.get("faq") or [])
                        if isinstance(pair, dict)
                    ],
                }
            )
        except Exception as e:
            print(f"  ! could not read {path.name}: {e}")
    return posts


def answered_questions(posts: list[dict]) -> list[str]:
    out = []
    for post in posts:
        out.append(post["title"])
        out.extend(post["faq"])
    return [q for q in out if q]


# --- Catalogue ---------------------------------------------------------------


def feed_date(pub_date: str) -> str:
    """ISO date from the feed's RFC 822 pubDate, "" when there is none."""
    if not pub_date:
        return ""
    try:
        return parsedate_to_datetime(pub_date).date().isoformat()
    except (TypeError, ValueError):
        return ""


def load_catalogue() -> list[dict]:
    """Every transcribed episode, with its grounding fields.

    The cleaned transcript is kept in memory but never sent whole to the
    writer: a 60 minute episode is 30,000 characters, and three of them
    would be most of the input budget. The writer gets excerpts
    (transcript_passages), ranking uses the term counts, and the fact check
    gets the whole thing on a cheaper model. raw_captions_srt is dropped.

    Only quotes found word for word in the cleaned transcript are kept. The
    transcript pipeline's "quotes" field is labelled verbatim, but on Sep 30,
    2026 only 242 of 725 matched the transcript; the rest were paraphrases.
    """
    episodes_by_slug = {}
    try:
        for episode in simplecast_feed.fetch_episodes():
            episodes_by_slug[episode["slug"]] = episode
    except Exception as e:
        print(f"  ! could not fetch the Simplecast feed, titles and guests will be missing: {e}")

    catalogue = []
    if not TRANSCRIPT_DIR.exists():
        return catalogue

    for path in sorted(TRANSCRIPT_DIR.glob("*.json")):
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  ! could not read {path.name}: {e}")
            continue
        slug = str(data.get("slug") or path.stem)
        episode = episodes_by_slug.get(slug, {})
        transcript = str(data.get("cleaned_transcript") or "")
        transcript_words = word_seq(transcript)
        words = transcript_words.split()
        catalogue.append(
            {
                "slug": slug,
                "title": episode.get("title") or slug.replace("-", " "),
                "guest": episode.get("guest") or "",
                "pubDate": episode.get("pubDate") or "",
                "published": feed_date(episode.get("pubDate") or ""),
                "summary": str(data.get("summary") or ""),
                "takeaways": [str(t) for t in (data.get("takeaways") or [])],
                "faq": [p for p in (data.get("faq") or []) if isinstance(p, dict)],
                "quotes": [
                    q
                    for q in (data.get("quotes") or [])
                    if isinstance(q, dict) and word_seq(str(q.get("quote") or "")) in transcript_words
                ],
                "topics": [str(t) for t in (data.get("topics") or [])],
                "transcript": transcript,
                "transcript_words": transcript_words,
                "term_counts": Counter(words),
                "length": len(words),
            }
        )
    return catalogue


def published_at(entry: dict) -> float:
    """Unix timestamp of an episode's publication, 0 when the feed gave no
    usable date (which sorts it last rather than dropping it)."""
    raw = entry.get("pubDate") or ""
    if not raw:
        return 0.0
    try:
        return parsedate_to_datetime(raw).timestamp()
    except (TypeError, ValueError):
        return 0.0


def haystack(entry: dict) -> tuple[set[str], set[str]]:
    """(weighted terms, all terms) for one episode. Title and topics are the
    weighted set: a question matching an episode's title is a far stronger
    signal than the same word appearing once in an eight item takeaway list."""
    weighted = tokenize(entry["title"] + " " + " ".join(entry["topics"]) + " " + entry["guest"])
    body = [entry["summary"], " ".join(entry["takeaways"])]
    for pair in entry["faq"]:
        body.append(pair.get("question", ""))
        body.append(pair.get("answer", ""))
    return weighted, weighted | tokenize(" ".join(body))


def transcript_scores(terms: set[str], catalogue: list[dict]) -> dict[str, float]:
    """BM25 of `terms` against each episode's full transcript, by slug.

    The summary level match alone ranked on what the episode notes happened
    to mention: for "how does 280E hurt cannabis companies" it picked
    episodes that name 280E once over the ones that spend ten minutes on
    it. BM25 rewards an episode that keeps coming back to the question's
    rare terms, and discounts long episodes that mention everything once.
    """
    entries = [e for e in catalogue if e.get("length")]
    if not entries:
        return {}
    n = len(entries)
    avg_len = sum(e["length"] for e in entries) / n
    k1, b = 1.2, 0.75
    doc_freq = {t: sum(1 for e in entries if e["term_counts"][t]) for t in terms}

    scores = {}
    for entry in entries:
        score = 0.0
        for term in terms:
            tf = entry["term_counts"][term]
            if not tf:
                continue
            idf = math.log(1 + (n - doc_freq[term] + 0.5) / (doc_freq[term] + 0.5))
            score += idf * tf * (k1 + 1) / (tf + k1 * (1 - b + b * entry["length"] / avg_len))
        scores[entry["slug"]] = score
    return scores


def rank_sources(question: str, catalogue: list[dict], limit: int) -> list[dict]:
    """The episodes best able to answer `question`, best first.

    Plain term overlap, no embeddings. The catalogue is 143 transcripts of a
    single subject, so the discriminating terms in a cannabis business
    question are nouns that either appear in an episode or do not, and an
    embedding index would be a service to run and keep in sync for a ranking
    this coarse. If the column ever needs to answer questions the catalogue
    covers only obliquely, revisit it.

    The floor is on the episode notes (an episode has to be about the
    question, not just mention its words somewhere in an hour), and the
    order adds transcript BM25 to the notes' score.
    """
    terms = tokenize(question)
    if not terms:
        return []

    bm25 = transcript_scores(terms, catalogue)
    scored = []
    for entry in catalogue:
        weighted, all_terms = haystack(entry)
        hits = terms & all_terms
        if not hits:
            continue
        score = len(hits) + len(terms & weighted) + bm25.get(entry["slug"], 0.0)
        scored.append((score, len(hits), entry))

    # Two floors, both on raw hits rather than the weighted score: at least
    # two distinct question terms, and at least 40% of them. One shared noun
    # is a coincidence, and a question the catalogue covers on one word is a
    # question this column should not be answering.
    min_hits = max(2, math.ceil(len(terms) * 0.4))
    qualified = [s for s in scored if s[1] >= min_hits]
    qualified.sort(key=lambda s: (-s[0], -s[1]))
    return [entry for _, _, entry in qualified[:limit]]


SPEAKER_RE = re.compile(r"^([A-Z][A-Za-z.'\- ]{1,40}(?:\([^)]{1,40}\))?):\s")


def split_passages(transcript: str, max_chars: int) -> list[str]:
    """The transcript cut into speaker labelled chunks of about max_chars.

    Turns are separated by blank lines and open with "Name: ". A long turn
    is split at sentence ends, and every piece after the first gets the
    speaker's label back, so an excerpt never loses who is talking. Losing
    it is how a host's line ends up credited to a guest.
    """
    passages = []
    for turn in re.split(r"\n\s*\n", transcript):
        turn = " ".join(turn.split())
        if not turn:
            continue
        match = SPEAKER_RE.match(turn)
        label = match.group(1) if match else ""
        text = turn[match.end():] if match else turn
        sentences = re.split(r"(?<=[.!?])\s+", text)
        chunk = ""
        for sentence in sentences:
            if chunk and len(chunk) + len(sentence) + 1 > max_chars:
                passages.append(f"{label}: {chunk}" if label else chunk)
                chunk = sentence
            else:
                chunk = f"{chunk} {sentence}".strip()
        if chunk:
            passages.append(f"{label}: {chunk}" if label else chunk)
    return passages


def transcript_passages(entry: dict, question: str, limit: int, max_chars: int) -> list[str]:
    """The `limit` excerpts of one transcript that best match the question,
    in episode order. Scored by distinct question terms, weighted toward
    rare ones within this transcript, so a chunk that says "280E" beats one
    that says "cannabis" four times."""
    terms = tokenize(question)
    passages = split_passages(entry.get("transcript", ""), max_chars)
    if not terms or not passages:
        return []
    counts = entry.get("term_counts") or Counter()

    scored = []
    for index, passage in enumerate(passages):
        words = set(re.findall(r"[a-z0-9]+", passage.lower()))
        score = sum(1.0 / math.log(2 + counts[t]) for t in terms & words)
        if score:
            scored.append((score, index))
    best = sorted(scored, key=lambda s: -s[0])[:limit]
    return [passages[i] for _, i in sorted(best, key=lambda s: s[1])]


def prepare_sources(question: str, sources: list[dict]) -> list[dict]:
    """Attach the writer's excerpts to each ranked source."""
    return [
        {
            **s,
            "passages": transcript_passages(
                s, question, config.ISAAC_PASSAGES_PER_SOURCE, config.ISAAC_PASSAGE_CHARS
            ),
        }
        for s in sources
    ]


# --- Question sources --------------------------------------------------------


def is_question_shaped(query: str) -> bool:
    text = query.strip().lower()
    if len(text) < 12 or len(text) > 120:
        return False
    if any(term in text for term in BRAND_TERMS):
        return False
    words = text.split()
    if words and words[0] in QUESTION_STARTERS:
        return True
    # Not every searched question is phrased as one. A long noun phrase
    # ("280e deduction rules for dispensaries") is a question in intent, and
    # those are the majority of what this site gets impressions for.
    return len(words) >= 4


def search_console_questions(seen: set[str]) -> list[dict]:
    """Question shaped queries the site is seen for but does not win.

    Returns [] on any failure. Search Console is an optional input: no
    credentials in the environment, an expired key or an API outage should
    fall the run through to the catalogue, not end it.
    """
    if not config.GSC_SERVICE_ACCOUNT_JSON:
        print("  Search Console not configured, using the catalogue instead")
        return []

    try:
        from gsc_client import SearchConsoleClient

        client = SearchConsoleClient()
        end = date.today() - timedelta(days=3)
        start = end - timedelta(days=config.ISAAC_QUERY_DAYS)
        rows = client.query(start, end, "query", row_limit=500)
    except Exception as e:
        print(f"  ! Search Console query failed, using the catalogue instead: {e}")
        return []

    candidates = []
    for row in rows:
        query = str(row.get("key") or "").strip()
        if not is_question_shaped(query):
            continue
        if row.get("impressions", 0) < config.ISAAC_MIN_IMPRESSIONS:
            continue
        if row.get("position", 0) < config.ISAAC_MIN_POSITION:
            continue
        if normalize_question(query) in seen:
            continue
        candidates.append(
            {
                "question": query,
                "origin": (
                    f"a Google search query. {int(row['impressions'])} impressions in the last "
                    f"{config.ISAAC_QUERY_DAYS} days at an average position of {row['position']:.1f}, "
                    "so people are asking it and this site is not the answer they get."
                ),
                "sourceQuery": query,
                "impressions": row.get("impressions", 0),
            }
        )

    candidates.sort(key=lambda c: -c["impressions"])
    print(f"  {len(candidates)} question shaped queries with a gap, from {len(rows)} rows")
    return candidates


def catalogue_questions(catalogue: list[dict], posts: list[dict], seen: set[str]) -> list[dict]:
    """FAQ pairs from transcripts, preferring episodes the column has never
    cited. Ordered so the column spreads across the catalogue instead of
    circling the same few episodes."""
    cited = {slug for post in posts for slug in post["episodes"]}
    # Uncited episodes first, then newest first within each group. pubDate is
    # an RFC 822 string off the RSS feed, so it has to be parsed: sorting the
    # raw strings orders the catalogue by the name of the day of the week.
    ordered = sorted(catalogue, key=lambda e: (e["slug"] in cited, -published_at(e)))

    candidates = []
    for entry in ordered:
        for pair in entry["faq"]:
            question = str(pair.get("question") or "").strip()
            if not question or normalize_question(question) in seen:
                continue
            candidates.append(
                {
                    "question": question,
                    "origin": (
                        f"the episode catalogue. It is a question the show already answers on "
                        f"\"{entry['title']}\", and no post in this column has answered it yet."
                    ),
                    "sourceQuery": f"episode:{entry['slug']}",
                    "impressions": 0,
                }
            )
    return candidates


# --- Validation --------------------------------------------------------------


SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def validate_post(data: dict, source_slugs: set[str], existing_slugs: set[str]) -> tuple[bool, str]:
    """Everything that would publish a broken or off-contract page.

    Checked here rather than left to the reviewer because the reviewer is
    reading for voice and accuracy, which is the part a person is good at.
    A missing question mark or a hallucinated episode slug is the part a
    person skims past.
    """
    title = str(data.get("title") or "").strip()
    slug = str(data.get("slug") or "").strip()
    summary = str(data.get("summary") or "").strip()
    body = str(data.get("body") or "").strip()
    topics = [str(t).strip() for t in (data.get("topics") or [])]
    episodes = [str(e).strip() for e in (data.get("episodes") or [])]
    faq = [p for p in (data.get("faq") or []) if isinstance(p, dict)]

    if not title or not slug or not summary or not body:
        return False, "missing title, slug, summary or body"
    if not title.endswith("?"):
        return False, f"title is not a question: {title!r}"
    if not SLUG_RE.match(slug):
        return False, f"slug is not url safe: {slug!r}"
    if len(slug) > 70:
        return False, f"slug is {len(slug)} characters, over the 70 character limit"
    if slug in existing_slugs:
        return False, f"slug {slug!r} already exists"
    if len(summary) > 400:
        return False, f"summary is {len(summary)} characters, too long to work as a standfirst"

    words = len(body.split())
    if words < MIN_WORDS or words > MAX_WORDS:
        return False, f"body is {words} words, outside the {MIN_WORDS} to {MAX_WORDS} band"

    if not episodes:
        return False, "no episodes cited"
    unknown = [s for s in episodes if s not in source_slugs]
    if unknown:
        return False, f"cited episodes that were not in the source material: {unknown}"
    # The frontmatter list and the body have to agree. A post that lists an
    # episode it never links renders a "where this comes from" block citing
    # an episode the reader cannot find in the text.
    unlinked = [s for s in episodes if f"/episodes/{s}" not in body]
    if unlinked:
        return False, f"episodes listed in frontmatter but not linked in the body: {unlinked}"

    if not 2 <= len(faq) <= 4:
        return False, f"{len(faq)} faq pairs, expected 2 to 4"
    for pair in faq:
        question = str(pair.get("question") or "").strip()
        answer = str(pair.get("answer") or "").strip()
        if not question or not answer:
            return False, "an faq pair is missing its question or answer"
        if len(answer) > 500:
            return False, f"an faq answer is {len(answer)} characters, too long for a Question node"

    if not 2 <= len(topics) <= 4:
        return False, f"{len(topics)} topics, expected 2 to 4"
    off_taxonomy = [t for t in topics if t not in CANONICAL_TOPICS]
    if off_taxonomy:
        # Not a warning. A freelanced tag creates a topic hub page with one
        # post on it, or silently fails to match any hub at all.
        return False, f"topics outside the fixed taxonomy: {off_taxonomy}"

    if "# " in body.split("\n")[0]:
        return False, "body starts with a heading; the page renders the title itself"

    return True, ""


QUOTE_RE = re.compile(r"[\"“]([^\"“”]{2,600})[\"”]")


def post_text(data: dict) -> str:
    """Every reader facing sentence of a post: summary, body and FAQ answers."""
    faq = " ".join(str(p.get("answer") or "") for p in (data.get("faq") or []) if isinstance(p, dict))
    return "\n".join([str(data.get("summary") or ""), str(data.get("body") or ""), faq])


def cited_sources(data: dict, sources: list[dict]) -> list[dict]:
    cited = {str(s) for s in (data.get("episodes") or [])}
    return [s for s in sources if s["slug"] in cited]


def unverified_quotes(data: dict, sources: list[dict]) -> list[str]:
    """Quotations in the post that are not word for word in a cited
    transcript. Two word spans are skipped: in this column those are terms
    ("total THC") rather than quotations, and the fact check still reads
    them. Punctuation and case are ignored, since the post drops the
    transcript's em dashes by house rule."""
    haystacks = [s.get("transcript_words", "") for s in cited_sources(data, sources)]
    bad = []
    for match in QUOTE_RE.finditer(post_text(data)):
        quoted = word_seq(match.group(1))
        if len(quoted.split()) < 3:
            continue
        if not any(quoted in h for h in haystacks):
            bad.append(match.group(1))
    return bad


def months_between(earlier: str, later: str) -> float:
    return (date.fromisoformat(later) - date.fromisoformat(earlier)).days / 30.4


def stale_reason(data: dict, sources: list[dict], today: str) -> str:
    """Why a time sensitive post is too old to publish, "" when it is not.

    Keyed on the newest cited episode: a post leaning on a 2023 episode for
    background and a last month one for the current state is fine, and the
    fact check catches a sentence that presents the 2023 material as now.
    """
    if not data.get("timeSensitive"):
        return ""
    cited = cited_sources(data, sources)
    dates = [s.get("published") or "" for s in cited]
    if not dates or not all(dates):
        return "time sensitive, and a cited episode has no publication date to judge it by"
    newest = max(dates)
    age = months_between(newest, today)
    if age > config.ISAAC_MAX_SOURCE_AGE_MONTHS:
        return (
            f"time sensitive, and the newest cited episode is from {newest}, "
            f"{age:.0f} months old (limit {config.ISAAC_MAX_SOURCE_AGE_MONTHS})"
        )
    return ""


def fact_check_failures(claims: list[dict]) -> list[dict]:
    """Claims that block publication. An unknown verdict blocks too: a
    checker that answers off script has not checked the claim."""
    return [c for c in claims if str(c.get("verdict") or "").strip().lower() not in ("supported", "opinion")]


# --- Output ------------------------------------------------------------------


def write_post(data: dict, source_query: str) -> Path:
    """Write content/answers/<slug>.md.

    Front matter is emitted through yaml.safe_dump rather than an f-string so
    a title containing a colon or a quote cannot produce a file that
    gray-matter fails to parse on the site side, which would drop the post
    silently at build time.
    """
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    slug = data["slug"]

    front = {
        "title": strip_em_dashes(data["title"]),
        "metaTitle": strip_em_dashes(str(data.get("metaTitle") or data["title"])),
        "slug": slug,
        "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "description": strip_em_dashes(str(data.get("description") or "")),
        "summary": strip_em_dashes(data["summary"]),
        "episodes": data["episodes"],
        "topics": data["topics"],
        "faq": [
            {
                "question": strip_em_dashes(str(p["question"]).strip()),
                "answer": strip_em_dashes(str(p["answer"]).strip()),
            }
            for p in data["faq"]
        ],
        "sourceQuery": source_query,
    }

    body = strip_em_dashes(data["body"]).strip()
    rendered = yaml.safe_dump(front, sort_keys=False, allow_unicode=True, width=10000)

    path = OUTPUT_DIR / f"{slug}.md"
    path.write_text(f"---\n{rendered}---\n\n{body}\n", encoding="utf-8")
    return path


def display_path(path: Path) -> str:
    """Repo relative when it can be, absolute otherwise. Path.relative_to
    raises rather than returning the absolute path, and a raise here would
    throw away a post that is already written to disk."""
    try:
        return str(path.relative_to(REPO_ROOT))
    except ValueError:
        return str(path)


def emit_output(name: str, value: str) -> None:
    """Hand a value to the workflow for the pull request title and body."""
    target = os.getenv("GITHUB_OUTPUT")
    if not target:
        return
    with open(target, "a", encoding="utf-8") as f:
        f.write(f"{name}={value}\n")


# --- Main --------------------------------------------------------------------


def main() -> int:
    print("=" * 80)
    print("THE DIME PODCAST - ISAAC BURNER, THE ANSWERS COLUMN")
    print("=" * 80)

    is_valid, missing = config.validate_isaac_config()
    if not is_valid:
        print("\nERROR: Missing required environment variables:")
        for var in missing:
            print(f"  - {var}")
        return 1

    posts = load_existing_posts()
    existing_slugs = {p["slug"] for p in posts}
    answered = answered_questions(posts)
    seen = {normalize_question(q) for q in answered}
    print(f"\n{len(posts)} published post(s), {len(answered)} question(s) already answered")

    print("\nLoading the episode catalogue...")
    catalogue = load_catalogue()
    print(f"  {len(catalogue)} transcribed episodes available as source material")
    if not catalogue:
        print("\nERROR: no transcripts found. Run the transcript pipeline first.")
        return 1

    print("\nLooking for questions...")
    if config.ISAAC_FORCE_QUESTION:
        forced = config.ISAAC_FORCE_QUESTION.strip()
        print(f"  forced question: {forced}")
        candidates = [
            {
                "question": forced,
                "origin": "a direct request from the show's host, not from search data.",
                "sourceQuery": f"manual:{forced}",
                "impressions": 0,
            }
        ]
        fallback = []
    else:
        candidates = search_console_questions(seen)
        fallback = catalogue_questions(catalogue, posts, seen)
        if not candidates:
            print(f"  falling back to the catalogue: {len(fallback)} unanswered question(s)")
    # The fallback is appended rather than used only when the primary list is
    # empty, so a run whose every Search Console candidate turns out to be
    # ungroundable still produces a post instead of a no-op.
    candidates = candidates + fallback

    if not candidates:
        print("\nNothing left to answer. This is a success, not a failure.")
        return 0

    today = datetime.now(timezone.utc).date().isoformat()
    undated = [e["slug"] for e in catalogue if not e["published"]]
    if undated:
        # Not fatal: an undated episode can still ground a post that does
        # not depend on timing. stale_reason() refuses a time sensitive one.
        print(f"  ! {len(undated)} transcribed episode(s) have no feed date, e.g. {undated[0]}")

    claude = IsaacClaudeClient()
    written = 0
    attempted = 0

    for candidate in candidates:
        if written >= config.ISAAC_MAX_POSTS:
            break
        # Bound the work per run. Without this a day when Search Console
        # returns 200 ungroundable queries spends 200 relevance passes and,
        # worse, keeps calling Claude on the marginal ones.
        if attempted >= config.ISAAC_MAX_POSTS * 8:
            print("\nGave up after too many candidates without a groundable question.")
            break
        attempted += 1

        question = candidate["question"]
        sources = rank_sources(question, catalogue, config.ISAAC_SOURCE_COUNT)
        if not sources:
            continue
        sources = prepare_sources(question, sources)

        print(f"\n{'-' * 80}")
        print(f"Question: {question}")
        for s in sources:
            print(f"  source: {s['slug']} ({s['published'] or 'no date'}, {len(s['passages'])} excerpts, "
                  f"{len(s['quotes'])} verified quotes)")

        success, data = claude.generate_post(question, candidate["origin"], sources, answered, today)
        if not success:
            print("  x generation failed")
            continue

        if data.get("unanswerable"):
            print(f"  - Claude judged the sources insufficient, moving on: {data.get('unanswerableReason') or '(no reason given)'}")
            continue

        source_slugs = {s["slug"] for s in sources}
        valid, reason = validate_post(data, source_slugs, existing_slugs)
        if not valid:
            print(f"  x rejected: {reason}")
            continue

        bad_quotes = unverified_quotes(data, sources)
        if bad_quotes:
            print(f"  x rejected: quotation not word for word in a cited transcript: {bad_quotes}")
            continue

        stale = stale_reason(data, sources, today)
        if stale:
            print(f"  x rejected: {stale}")
            continue

        checked, claims = claude.check_post(data, cited_sources(data, sources), today)
        if not checked or not claims:
            print("  x rejected: the fact check did not run or returned no claims")
            continue
        failures = fact_check_failures(claims)
        print(f"  fact check: {len(claims)} claims, {len(failures)} failed")
        for claim in failures:
            print(f"    x [{claim.get('verdict')}] {claim.get('claim')} :: {claim.get('note')}")
        if failures:
            print("  x rejected: fact check")
            continue

        path = write_post(data, candidate["sourceQuery"])
        written += 1
        existing_slugs.add(data["slug"])
        answered.append(data["title"])
        print(f"  + wrote {display_path(path)} ({len(data['body'].split())} words)")
        emit_output("post_slug", data["slug"])
        emit_output("post_title", strip_em_dashes(data["title"]))
        emit_output(
            "fact_check",
            f"{len(claims)} claims checked against the full transcripts of "
            f"{len(data['episodes'])} cited episode(s), all supported or opinion. "
            f"Newest source: {max((s['published'] for s in cited_sources(data, sources)), default='') or 'undated'}.",
        )

    print(f"\n{'=' * 80}")
    print(f"Wrote {written} post(s) from {attempted} candidate(s)")
    emit_output("post_count", str(written))
    # A run that writes nothing is not an error. Every question may already
    # be answered, or every candidate may have failed the grounding floor,
    # and both are the column working as intended. The workflow checks
    # post_count and skips the pull request rather than failing the job.
    return 0


if __name__ == "__main__":
    sys.exit(main())
