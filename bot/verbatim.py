"""
Verbatim checks for pull quotes.

Episode pages render transcript `quotes` as blockquotes, and the Isaac
column is handed them as "verbatim quotes" it may repeat. Both only hold up
if every quote is word for word in the episode's own cleaned transcript, so
the transcript pipeline filters on that before writing, and
backfill_verbatim_quotes.py applies the same test to files already written.

The comparison form is the same as word_seq() in isaac_blogger.py on the
grounding branch: lowercase alphanumeric runs, single spaced. Punctuation,
case, em dashes and curly quotes are ignored because none of them change
what was said.
"""

import re
from difflib import SequenceMatcher

WORD_RE = re.compile(r"[a-z0-9]+")

# A speaker label at the start of a paragraph: "Bryan Fields: ..." Loose on
# purpose. It only has to find where turns begin, and a missed label would
# fold that speaker's words into the previous turn, where closest_span()
# could attribute them to the wrong person. Splitting a turn too often
# costs nothing but a candidate.
SPEAKER_RE = re.compile(r"^([^\n:]{1,60}):[ \t]", re.MULTILINE)

# How alike a quote and a transcript span must be (difflib ratio over
# words, after the span is widened to whole sentences) before the span can
# stand in for the quote. Set by reading every backfill pair between 0.80
# and 0.83: those are the same statement with fillers kept or a clause the
# quote skipped. Just below, pairs start to say something different.
REPLACE_MIN_RATIO = 0.80

# How far a matched span may be widened to reach a sentence edge.
SNAP_WORDS = 6


def word_seq(text: str) -> str:
    return " ".join(WORD_RE.findall(text.lower()))


def is_verbatim(quote: str, transcript: str) -> bool:
    words = word_seq(quote)
    return bool(words) and words in word_seq(transcript)


def filter_verbatim(quotes: list, transcript: str) -> tuple[list, list]:
    """Split quotes into (kept, dropped). A quote is kept only when its word
    sequence appears in the transcript's word sequence. Malformed entries
    (not a dict, no quote text) are dropped too."""
    haystack = word_seq(transcript)
    kept, dropped = [], []
    for q in quotes or []:
        text = q.get("quote", "") if isinstance(q, dict) else ""
        words = word_seq(text)
        if words and words in haystack:
            kept.append(q)
        else:
            dropped.append(q)
    return kept, dropped


def verified_quotes(artifacts: dict) -> list:
    """The quotes that are word for word in the cleaned transcript. Pages
    render these as blockquotes and the Isaac column repeats them as
    verbatim, so a paraphrase is dropped here rather than published as
    something the guest said. Dropping all of them is fine: the page hides
    the section when the list is empty."""
    kept, dropped = filter_verbatim(
        artifacts.get("quotes") or [], artifacts.get("cleaned_transcript", "")
    )
    if dropped:
        print(f"  -> Dropped {len(dropped)} of {len(kept) + len(dropped)} quotes not verbatim in the transcript")
    return kept


def _turns(transcript: str) -> list[tuple[str, int, int]]:
    """(speaker, start, end) character ranges of each speaker turn's text."""
    labels = list(SPEAKER_RE.finditer(transcript))
    turns = []
    for i, m in enumerate(labels):
        end = labels[i + 1].start() if i + 1 < len(labels) else len(transcript)
        turns.append((m.group(1).strip(), m.end(), end))
    return turns


def _sentence_edges(text: str, tokens: list) -> tuple[set, set]:
    """Token indices that open and close a sentence within one turn."""
    ends = set()
    for i, tok in enumerate(tokens):
        nxt = tokens[i + 1].start() if i + 1 < len(tokens) else len(text)
        if i + 1 == len(tokens) or re.search(r"[.!?]", text[tok.end() : nxt]):
            ends.add(i)
    starts = {0} | {i + 1 for i in ends if i + 1 < len(tokens)}
    return starts, ends


def _snap(s: int, e: int, starts: set, ends: set) -> tuple[int, int] | None:
    """Widen the word range [s, e) to whole sentences, or None if a sentence
    edge is more than SNAP_WORDS away. A pull quote that stops mid clause
    reads as a misquote even when every word is right."""
    for back in range(SNAP_WORDS + 1):
        if s - back in starts:
            s -= back
            break
    else:
        return None
    for fwd in range(SNAP_WORDS + 1):
        if e - 1 + fwd in ends:
            return s, e + fwd
    return None


def closest_span(quote: str, speaker: str, transcript: str) -> tuple[str, float] | None:
    """The whole sentence run in the speaker's own words that best matches a
    non-verbatim quote, as (text, ratio). None when the speaker has no
    labeled turns, ("", 0.0) when nothing in those turns lines up.

    The search stays inside single turns labeled with the quote's speaker,
    so a replacement can never splice two people together or reattribute a
    line. Candidates come from shared three word runs, are widened to
    sentence edges, and are scored with difflib over words. The text is cut
    straight from the transcript, so it passes is_verbatim() by construction.
    """
    q_words = WORD_RE.findall(quote.lower())
    if len(q_words) < 3:
        return ("", 0.0)
    q_grams = {tuple(q_words[i : i + 3]) for i in range(len(q_words) - 2)}
    n = len(q_words)
    want = speaker.strip().lower()
    best = (0.0, "")
    found_turn = False

    for turn_speaker, start, end in _turns(transcript):
        if turn_speaker.lower() != want:
            continue
        found_turn = True
        text = transcript[start:end]
        tokens = list(WORD_RE.finditer(text.lower()))
        t_words = [t.group(0) for t in tokens]
        starts, ends = _sentence_edges(text, tokens)
        anchors = [
            i for i in range(len(t_words) - 2) if tuple(t_words[i : i + 3]) in q_grams
        ]
        # Anchors a few words apart describe the same region; score each
        # region once rather than once per shared three word run.
        last = None
        for a in anchors:
            if last is not None and a - last < max(3, n // 2):
                continue
            last = a
            lo, hi = max(0, a - n), min(len(t_words), a + 2 * n)
            blocks = [
                b
                for b in SequenceMatcher(None, q_words, t_words[lo:hi], autojunk=False).get_matching_blocks()
                if b.size
            ]
            if not blocks:
                continue
            snapped = _snap(lo + blocks[0].b, lo + blocks[-1].b + blocks[-1].size, starts, ends)
            if not snapped:
                continue
            s, e = snapped
            ratio = SequenceMatcher(None, q_words, t_words[s:e], autojunk=False).ratio()
            if ratio > best[0]:
                span = text[tokens[s].start() : tokens[e - 1].end()]
                if e - 1 in ends:
                    tail = re.match(r"[^\s\w]*", text[tokens[e - 1].end() :]).group(0)
                    span += tail if re.search(r"[.!?]", tail) else ""
                best = (ratio, span)

    if not found_turn:
        return None
    ratio, span = best
    return (span[:1].upper() + span[1:], ratio)
