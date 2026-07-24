"""
Fetches and matches published episodes from the Simplecast RSS feed.

The slugify logic here must stay identical to app/lib/rss.ts so that the
filenames this pipeline writes (transcripts/{slug}.json) line up with the
slugs the Next.js site looks up at render time.
"""

import math
import re
import xml.etree.ElementTree as ET
from collections import Counter
from datetime import datetime
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime

import requests

FEED_URL = "https://feeds.simplecast.com/Vnrz0StH"

# Generic words that show up in almost every episode title (the show's own
# name, filler words, connectives). Excluded from token-overlap matching so
# scores are driven by the words that actually distinguish one episode from
# another (guest names, company names, topic-specific nouns).
STOPWORDS = {
    "the", "a", "an", "is", "in", "of", "to", "how", "why", "what", "that",
    "this", "for", "and", "or", "on", "at", "with", "ft", "featuring",
    "cannabis", "into", "from", "still", "never", "because", "its", "new",
    "top", "most", "are", "were", "was", "has", "have", "had", "not", "but",
    "you", "your", "can", "will", "every", "one", "all", "out", "about",
    "after", "before", "than", "then", "when", "who", "his", "her", "their",
    "them", "they", "been", "being", "doesn", "didn", "isn",
}


def slugify(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    s = re.sub(r"-+$", "", s)
    return s


def extract_guest(title: str) -> str:
    """Best-effort guest name extraction from the episode title, mirroring
    extractGuest() in app/lib/rss.ts (plus a couple of YouTube-specific
    patterns below, since YouTube titles credit guests differently than the
    RSS feed's copy: "featuring Name" and a trailing "| Name")."""
    m = re.search(r"\bft\.?\s+([^,\n|]+?)(?:\s*,|\s*$|\s*\|)", title, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"\bfeaturing\s+([^,\n|]+?)(?:\s*,|\s*$|\s*\|)", title, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"\|\s*([A-Z][a-zA-Z.'-]+(?:\s+[A-Z][a-zA-Z.'-]+)+)\s*$", title)
    if m:
        return m.group(1).strip()
    m = re.search(r"\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", title)
    if m:
        return m.group(1).strip()
    m = re.match(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+):\s", title)
    if m:
        return m.group(1).strip()
    return ""


def _tokenize(title: str) -> set[str]:
    s = title.lower()
    s = re.sub(r"[^a-z0-9\s]", " ", s)
    return {w for w in s.split() if len(w) >= 3 and w not in STOPWORDS}


def fetch_episodes() -> list[dict]:
    """Return published episodes as [{title, slug, guest, pubDate}], most recent first."""
    resp = requests.get(FEED_URL, timeout=30)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)

    episodes = []
    for item in root.iter("item"):
        title_el = item.find("title")
        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        if not title:
            continue
        pub_date_el = item.find("pubDate")
        pub_date = pub_date_el.text.strip() if pub_date_el is not None and pub_date_el.text else ""
        episodes.append(
            {
                "title": title,
                "slug": slugify(title),
                "guest": extract_guest(title),
                "pubDate": pub_date,
            }
        )
    return episodes


def _names_match(a: str, b: str) -> bool:
    a, b = a.strip().lower(), b.strip().lower()
    if not a or not b:
        return False
    if a == b:
        return True
    return SequenceMatcher(None, a, b).ratio() >= 0.85


def _name_contained(video_guest: str, ep_guest: str) -> bool:
    """True when the video's guest name appears in full, as consecutive whole
    words, inside a longer RSS credit — e.g. "Rena Sherbill" inside "Rena
    Sherbill Senior Editor".

    _names_match alone can't cover this: that pair scores 0.65 against a 0.85
    threshold, so the guest fast path misses, and the scored path then drops
    the episode because back-catalog uploads routinely fall outside the 60-day
    date window (the Sherbill episode published 2021-04-23 but was uploaded
    76 days later). Widening that window would invite bad matches across the
    whole feed; recognising a contained full name is the narrow fix.

    Requires at least two name tokens, so a bare first name can never match
    every episode that shares it.
    """
    a = video_guest.strip().lower().split()
    b = ep_guest.strip().lower().split()
    if len(a) < 2 or len(b) <= len(a):
        return False
    return any(b[i:i + len(a)] == a for i in range(len(b) - len(a) + 1))


def _closest_by_date(candidates: list[dict], video_published_at: str) -> dict:
    """Break ties between multiple episodes sharing the same guest (repeat
    guests happen) by picking whichever RSS episode published closest in
    time to the YouTube upload."""
    try:
        video_dt = datetime.fromisoformat(video_published_at.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return candidates[0]

    def time_diff(ep: dict) -> float:
        try:
            ep_dt = parsedate_to_datetime(ep["pubDate"])
            return abs((ep_dt - video_dt).total_seconds())
        except (ValueError, TypeError, KeyError):
            return float("inf")

    return min(candidates, key=time_diff)


def _guest_signal(video_guest: str, ep: dict) -> float:
    """How strongly `video_guest` points at this episode, independent of
    title wording. 1.0 for a confident name match, 0.6 for a partial (shared
    first/last name — handles nicknames vs. full names), 0.8 when the name
    turns up verbatim in the RSS title even though extraction missed it
    (e.g. a title built around initials), 0 otherwise."""
    if not video_guest:
        return 0.0
    ep_guest = ep.get("guest", "")
    if ep_guest and _names_match(video_guest, ep_guest):
        return 1.0
    if ep_guest and (set(video_guest.lower().split()) & set(ep_guest.lower().split())):
        return 0.6
    if video_guest.lower() in ep["title"].lower():
        return 0.8
    return 0.0


def _date_score(video_dt: datetime | None, ep_pubdate: str, window_days: int = 60) -> tuple[float, bool]:
    """Proximity score in [0, 1] plus whether the episode falls inside the
    plausibility window at all (episodes published months away from the
    video are excluded outright, not just down-weighted)."""
    if video_dt is None:
        return 0.0, True
    try:
        ep_dt = parsedate_to_datetime(ep_pubdate)
    except (ValueError, TypeError):
        return 0.0, True
    diff_days = abs((ep_dt - video_dt).total_seconds()) / 86400
    if diff_days > window_days:
        return 0.0, False
    return max(0.0, 1 - diff_days / window_days), True


class Matcher:
    """Matches YouTube videos to published episodes for one pipeline run.

    YouTube titles are frequently reworded from the RSS title for the same
    episode (different copywriting per platform) and guests are credited
    inconsistently (full name vs. nickname vs. omitted entirely), so no
    single signal is reliable alone. This combines three:

      - guest name (exact/partial/embedded match)
      - shared distinctive words between the two titles, weighted by rarity
        across the whole feed (idf) so two titles sharing "Jaunty" or
        "Cheech"/"Chong" score far higher than two sharing only generic
        words like "brand" or "market")
      - how close the episode's publish date is to the video's

    Guest match and word-overlap are combined with a noisy-OR (either signal
    alone can carry a match; a title with no extractable guest at all can
    still match confidently on word overlap) with date proximity added as a
    smaller supporting term. Built once per run so the corpus-wide word
    rarity stats aren't recomputed per video.
    """

    DATE_WINDOW_DAYS = 60
    MIN_TOKEN_OVERLAP = 0.15
    THRESHOLD = 0.40

    def __init__(self, episodes: list[dict]):
        self.episodes = episodes
        self._tokens = {id(ep): _tokenize(ep["title"]) for ep in episodes}
        df: Counter = Counter()
        for tokens in self._tokens.values():
            df.update(tokens)
        self._df = df
        self._n = len(episodes)

    def _idf(self, token: str) -> float:
        return math.log((self._n + 1) / (self._df.get(token, 0) + 1)) + 1

    def _weighted_overlap(self, a: set[str], b: set[str]) -> float:
        inter = a & b
        if not inter:
            return 0.0
        smaller = a if len(a) <= len(b) else b
        return sum(self._idf(t) for t in inter) / sum(self._idf(t) for t in smaller)

    def find_best_match(self, video_title: str, video_published_at: str) -> dict | None:
        video_guest = extract_guest(video_title)

        # Fast path: an unambiguous guest-name match is as good as it gets.
        # _name_contained also accepts a full name embedded in a longer RSS
        # credit ("Rena Sherbill" in "Rena Sherbill Senior Editor"), which
        # _names_match scores too low to catch — without it those fall through
        # to the scored path and get dropped by the date window whenever the
        # upload lags the episode by more than 60 days.
        if video_guest:
            strict = [
                ep
                for ep in self.episodes
                if ep.get("guest")
                and (
                    _names_match(video_guest, ep["guest"])
                    or _name_contained(video_guest, ep["guest"])
                )
            ]
            if len(strict) == 1:
                return strict[0]
            if len(strict) > 1:
                return _closest_by_date(strict, video_published_at)

        try:
            video_dt = datetime.fromisoformat(video_published_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            video_dt = None

        video_tokens = _tokenize(video_title)
        best, best_score = None, 0.0
        for ep in self.episodes:
            dscore, in_window = _date_score(video_dt, ep["pubDate"], self.DATE_WINDOW_DAYS)
            if not in_window:
                continue
            tscore = self._weighted_overlap(video_tokens, self._tokens[id(ep)])
            gscore = _guest_signal(video_guest, ep)
            if gscore == 0.0 and tscore < self.MIN_TOKEN_OVERLAP:
                continue
            score = (1 - (1 - gscore) * (1 - tscore)) + 0.10 * dscore
            if score > best_score:
                best_score, best = score, ep

        return best if best_score >= self.THRESHOLD else None


def build_matcher(episodes: list[dict]) -> Matcher:
    return Matcher(episodes)
