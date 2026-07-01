"""
Fetches and matches published episodes from the Simplecast RSS feed.

The slugify logic here must stay identical to app/lib/rss.ts so that the
filenames this pipeline writes (transcripts/{slug}.json) line up with the
slugs the Next.js site looks up at render time.
"""

import re
import xml.etree.ElementTree as ET
from datetime import datetime
from difflib import SequenceMatcher
from email.utils import parsedate_to_datetime

import requests

FEED_URL = "https://feeds.simplecast.com/Vnrz0StH"


def slugify(title: str) -> str:
    s = title.lower()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"\s+", "-", s)
    s = re.sub(r"-+", "-", s)
    s = re.sub(r"-+$", "", s)
    return s


def extract_guest(title: str) -> str:
    """Best-effort guest name extraction from the episode title, mirroring
    extractGuest() in app/lib/rss.ts."""
    m = re.search(r"ft\.?\s+([^,\n]+?)(?:\s*,|\s*$)", title, re.IGNORECASE)
    if m:
        return m.group(1).strip()
    m = re.search(r"with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)", title)
    if m:
        return m.group(1).strip()
    m = re.match(r"^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+):\s", title)
    if m:
        return m.group(1).strip()
    return ""


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


def find_best_match(
    video_title: str,
    video_published_at: str,
    episodes: list[dict],
    threshold: float = 0.55,
) -> dict | None:
    """Match a YouTube video to a published episode.

    YouTube titles are often reworded substantially from the RSS title for
    the same episode (different copywriting per platform), so whole-title
    similarity alone is unreliable. Guest name is the stable anchor present
    in both — try that first, falling back to whole-title fuzzy matching
    only for episodes where no guest name could be extracted from either
    title. Returns None (skip) if nothing clears the bar, so non-episode
    content (trailers, clips, Shorts that slipped past duration filtering)
    is left alone rather than guessed at.
    """
    video_guest = extract_guest(video_title)

    if video_guest:
        candidates = [ep for ep in episodes if ep.get("guest") and _names_match(video_guest, ep["guest"])]
        if len(candidates) == 1:
            return candidates[0]
        if len(candidates) > 1:
            return _closest_by_date(candidates, video_published_at)

    best = None
    best_ratio = 0.0
    for ep in episodes:
        ratio = SequenceMatcher(None, video_title.lower(), ep["title"].lower()).ratio()
        if ratio > best_ratio:
            best_ratio = ratio
            best = ep
    if best and best_ratio >= threshold:
        return best
    return None
