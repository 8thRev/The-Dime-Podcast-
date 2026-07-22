"""
Manual, one-off backfill for episodes that predate the podcast's YouTube
video/captions presence (see SEO_ROADMAP.md) and so can never be reached by
transcript_pipeline.py, which hard-depends on a matched YouTube video with
auto-captions.

Takes a raw transcript pulled from Riverside.fm (speaker-labeled, one
utterance per blank-line-separated block, formatted like
"[12.3m] Speaker Name: text..."), a Simplecast episode slug, generates the
same on-site artifacts transcript_pipeline.py does via Claude, and writes
app/content/transcripts/{slug}.json.

Not scheduled — unlike transcript_pipeline.py (triggered by new YouTube
uploads), there's no recurring signal to run this against. Each run is a
manual, one-off `python backfill_transcript.py --slug ... --file ...` call
that should be eyeballed for slug/Claude failures rather than retried
unattended.
"""

import argparse
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

import simplecast_feed
from config import config
from transcript_claude_client import TranscriptClaudeClient

OUTPUT_DIR = Path(__file__).resolve().parent.parent / "app" / "content" / "transcripts"

_UTTERANCE_RE = re.compile(
    r"^\[(?P<ts>[\d.]+)m\]\s*(?P<speaker>[^:]+):\s*(?P<text>.*)$", re.DOTALL
)

RIVERSIDE_SOURCE_DESCRIPTION = (
    "a Riverside.fm speaker-labeled recording transcript — speaker turns are "
    "accurately labeled, but text may contain minor transcription errors, "
    "especially around names, brands, and industry jargon"
)


def parse_riverside_transcript(raw: str) -> tuple[str, int]:
    """Strip the "[X.Xm]" timestamp prefix from each utterance, keeping the
    real speaker label. Returns (plain_text, distinct_speaker_count) — the
    speaker count lets the caller decide whether this recording actually had
    working diarization (2+ distinct labels) or collapsed to one blob, which
    changes what to tell Claude about the source."""
    blocks = re.split(r"\n\s*\n", raw.strip())
    lines = []
    speakers = set()
    for block in blocks:
        block = block.strip()
        if not block:
            continue
        m = _UTTERANCE_RE.match(block)
        if not m:
            raise ValueError(f"Utterance block did not match expected format:\n{block[:200]}")
        speaker = m.group("speaker").strip()
        text = " ".join(m.group("text").split())
        speakers.add(speaker)
        lines.append(f"{speaker}: {text}")
    return "\n\n".join(lines), len(speakers)


def find_episode(slug: str, episodes: list[dict]) -> dict | None:
    for ep in episodes:
        if ep["slug"] == slug:
            return ep
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--slug", required=True, help="Simplecast episode slug")
    parser.add_argument("--file", required=True, help="Path to the raw Riverside transcript .txt")
    args = parser.parse_args()

    if not config.ANTHROPIC_API_KEY:
        print("ERROR: ANTHROPIC_API_KEY is not set.")
        return 1

    out_path = OUTPUT_DIR / f"{args.slug}.json"
    if out_path.exists():
        print(f"-> {out_path.name} already exists, skipping.")
        return 0

    raw_path = Path(args.file)
    try:
        raw_text = raw_path.read_text(encoding="utf-8")
    except FileNotFoundError:
        print(f"ERROR: raw transcript file not found: {raw_path}")
        return 1

    print("Fetching Simplecast RSS feed to resolve episode metadata...")
    episodes = simplecast_feed.fetch_episodes()
    match = find_episode(args.slug, episodes)
    if not match:
        print(f"ERROR: slug '{args.slug}' not found in the Simplecast RSS feed.")
        return 1

    try:
        raw_transcript, speaker_count = parse_riverside_transcript(raw_text)
    except ValueError as e:
        print(f"ERROR: {e}")
        return 1

    source_description = RIVERSIDE_SOURCE_DESCRIPTION if speaker_count >= 2 else None

    print(f"Generating artifacts for '{match['title']}' (guest: {match.get('guest') or 'unknown'})...")
    claude = TranscriptClaudeClient()
    success, artifacts = claude.generate_artifacts(
        guest_name=match.get("guest", ""),
        company="",
        episode_title=match["title"],
        raw_transcript=raw_transcript,
        source_description=source_description,
    )
    if not success:
        print("ERROR: Claude failed to produce usable artifacts.")
        return 1

    record = {
        "slug": args.slug,
        "source": "riverside_transcript",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "aiGenerated": True,
        **artifacts,
    }

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(record, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"-> Wrote {out_path.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
