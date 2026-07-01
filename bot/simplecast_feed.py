"""
Fetches and matches published episodes from the Simplecast RSS feed.

The slugify logic here must stay identical to app/lib/rss.ts so that the
filenames this pipeline writes (transcripts/{slug}.json) line up with the
slugs the Next.js site looks up at render time.
"""

import re
import xml.etree.ElementTree as ET
from difflib import SequenceMatcher

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
    """Return published episodes as [{title, slug, guest}], most recent first."""
    resp = requests.get(FEED_URL, timeout=30)
    resp.raise_for_status()
    root = ET.fromstring(resp.content)

    episodes = []
    for item in root.iter("item"):
        title_el = item.find("title")
        title = title_el.text.strip() if title_el is not None and title_el.text else ""
        if not title:
            continue
        episodes.append(
            {"title": title, "slug": slugify(title), "guest": extract_guest(title)}
        )
    return episodes


def find_best_match(video_title: str, episodes: list[dict], threshold: float = 0.6) -> dict | None:
    """Fuzzy-match a YouTube video title to the closest published episode
    title. Returns None if nothing clears the confidence threshold, so
    non-episode content (trailers, clips, shorts) is naturally skipped."""
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
