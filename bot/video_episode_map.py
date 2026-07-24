"""
Builds app/content/video-episode-map.json: a many-to-one map from published
episode slug to every YouTube video ID that matches it.

One episode can have several videos (full episode, a re-cut, a clip with its
own dedicated upload), so this is intentionally NOT a 1:1 pair — see the "W2"
note in SEO_ROADMAP.md's Day-9 section. This is what lets episode pages and
video pages cross-link in both directions.

Reuses the exact matching logic transcript_pipeline.py and coverage_report.py
already rely on (simplecast_feed.Matcher via find_best_match) rather than
reimplementing anything: same guest-signal / weighted-title-overlap /
date-proximity scoring, same confidence threshold. This script only adds the
grouping-by-episode and JSON-writing step on top.

Read-only against YouTube (list_recent_videos) and the RSS feed; writes a
single output file.
"""

import json
import os
import sys
from collections import defaultdict
from pathlib import Path

import simplecast_feed
from youtube_client import YouTubeClient

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "app" / "content" / "video-episode-map.json"

# The channel has ~287 full-length uploads total (see SEO_ROADMAP.md Day-9
# target); scan comfortably past that so a fresh upload never falls outside
# the window before this is re-run. Overridable via SCAN_LIMIT so the
# workflow's scan_limit input actually reaches the script.
try:
    SCAN_LIMIT = int(os.getenv("SCAN_LIMIT", "1000"))
except ValueError:
    SCAN_LIMIT = 1000

# The Feb 28 2024 bulk re-upload of the old audio-only back catalogue is
# excluded from the video library by app/lib/youtube.ts, so those uploads have
# no /videos/[slug] page to link to. This map must apply the same rule or it
# emits video IDs the site cannot resolve. Keep in sync with youtube.ts.
AUDIO_ONLY_REUPLOAD_DATE = "2024-02-28"


def build_map(videos: list[dict], episodes: list[dict]) -> tuple[dict[str, list[str]], int]:
    """Match every video to an episode and group by slug.

    Returns (map, matched_count). Videos with no confident match (Matcher
    returns None) are skipped entirely, mirroring how transcript_pipeline.py
    and coverage_report.py both treat a None match as "not this episode."

    Videos the site never builds a page for are skipped too — see
    AUDIO_ONLY_REUPLOAD_DATE. Including them would inflate this map with IDs
    that /videos/[slug] can never resolve, so an episode would advertise more
    videos than it can actually link to.
    """
    matcher = simplecast_feed.build_matcher(episodes)

    by_slug: dict[str, list[str]] = defaultdict(list)
    matched = 0
    for video in videos:
        if video.get("publishedAt", "").startswith(AUDIO_ONLY_REUPLOAD_DATE):
            continue
        match = matcher.find_best_match(video["title"], video["publishedAt"])
        if not match:
            continue
        matched += 1
        by_slug[match["slug"]].append(video["id"])

    # Sort both the top-level keys and each episode's video list so re-runs
    # produce a stable diff instead of reordering on incidental dict/set
    # iteration order.
    return {slug: sorted(ids) for slug, ids in sorted(by_slug.items())}, matched


def main() -> int:
    print("=" * 80)
    print("THE DIME PODCAST - VIDEO/EPISODE MAP")
    print("=" * 80)

    print("Fetching Simplecast RSS feed for episode matching...")
    episodes = simplecast_feed.fetch_episodes()
    print(f"Loaded {len(episodes)} published episodes\n")

    youtube = YouTubeClient()
    print(f"Fetching up to {SCAN_LIMIT} full-length YouTube videos...")
    try:
        videos = youtube.list_recent_videos(SCAN_LIMIT)
    except Exception as e:
        print(f"Error fetching videos from YouTube: {e}")
        return 1
    print(f"Found {len(videos)} videos\n")

    video_map, matched = build_map(videos, episodes)

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(video_map, indent=2, ensure_ascii=False, sort_keys=True),
        encoding="utf-8",
    )

    print("=" * 80)
    print("SUMMARY")
    print(f"Videos scanned: {len(videos)}")
    print(f"Videos matched: {matched}")
    print(f"Videos unmatched: {len(videos) - matched}")
    print(f"Episodes covered: {len(video_map)}")
    print(f"Wrote {OUTPUT_PATH.relative_to(OUTPUT_PATH.resolve().parents[2])}")
    print("=" * 80)

    return 0


if __name__ == "__main__":
    sys.exit(main())
