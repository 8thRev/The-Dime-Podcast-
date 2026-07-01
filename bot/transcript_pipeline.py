"""
Transcript pipeline: pulls the N most recent YouTube videos for The Dime,
matches each to its published Simplecast episode, downloads YouTube's
auto-generated captions, runs them through Claude to produce a cleaned
transcript plus takeaways/FAQ/quotes/topics, and writes the result to
app/content/transcripts/{slug}.json for the site to render.

Idempotent: episodes that already have a transcript file are skipped, so
this is safe to re-run on a schedule for ongoing new episodes as well as
one-off backfill batches (raise TRANSCRIPT_LIMIT for a bigger backfill run).
"""

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import simplecast_feed
from config import config
from srt_utils import srt_to_text
from transcript_claude_client import TranscriptClaudeClient
from youtube_client import YouTubeClient

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "app" / "content" / "transcripts"


def main() -> int:
    print("=" * 80)
    print("THE DIME PODCAST - TRANSCRIPT PIPELINE")
    print("=" * 80)

    is_valid, missing = config.validate_transcript_config()
    if not is_valid:
        print("\nERROR: Missing required environment variables:")
        for var in missing:
            print(f"  - {var}")
        return 1

    limit = config.TRANSCRIPT_LIMIT
    print(f"Processing up to {limit} most recent episodes\n")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    print("Fetching Simplecast RSS feed for episode matching...")
    episodes = simplecast_feed.fetch_episodes()
    print(f"Loaded {len(episodes)} published episodes\n")
    matcher = simplecast_feed.build_matcher(episodes)

    youtube = YouTubeClient()
    claude = TranscriptClaudeClient()

    print(f"Fetching {limit} most recent YouTube videos...")
    try:
        videos = youtube.list_recent_videos(limit)
    except Exception as e:
        print(f"✗ Error fetching videos from YouTube: {e}")
        return 1
    print(f"Found {len(videos)} videos\n")

    processed = 0
    skipped = 0
    failed = 0

    for i, video in enumerate(videos, 1):
        print(f"[{i}/{len(videos)}] {video['title']}")

        match = matcher.find_best_match(video["title"], video["publishedAt"])
        if not match:
            print("  -> No confident match to a published episode. Skipping.\n")
            skipped += 1
            continue

        slug = match["slug"]
        out_path = OUTPUT_DIR / f"{slug}.json"
        if out_path.exists():
            print(f"  -> Transcript already exists ({slug}.json). Skipping.\n")
            skipped += 1
            continue

        try:
            caption_id = youtube.get_caption_track_id(video["id"])
        except Exception as e:
            print(f"  -> Error checking captions: {e}. Skipping.\n")
            failed += 1
            continue

        if not caption_id:
            print("  -> No captions available for this video yet. Skipping.\n")
            skipped += 1
            continue

        srt = youtube.download_caption_text(caption_id)
        if not srt:
            print("  -> Failed to download captions. Skipping.\n")
            failed += 1
            continue

        raw_text = srt_to_text(srt)
        if len(raw_text) < 200:
            print("  -> Downloaded captions look too short/empty. Skipping.\n")
            failed += 1
            continue

        success, artifacts = claude.generate_artifacts(
            guest_name=match.get("guest", ""),
            company="",
            episode_title=match["title"],
            raw_transcript=raw_text,
        )
        if not success:
            print("  -> Claude failed to produce usable artifacts. Skipping.\n")
            failed += 1
            continue

        record = {
            "slug": slug,
            "source": "youtube_captions",
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "aiGenerated": True,
            # Preserved even though nothing renders it yet — timestamp data
            # (chapter markers, jump-to-timestamp links, video Clip schema)
            # is expensive to reconstruct later; keeping the raw SRT means
            # we never have to re-fetch captions from YouTube to get it.
            "raw_captions_srt": srt,
            **artifacts,
        }

        out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"  -> Wrote {out_path.name}\n")
        processed += 1

    print("=" * 80)
    print("SUMMARY")
    print(f"Processed: {processed}  Skipped: {skipped}  Failed: {failed}")
    print("=" * 80)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
