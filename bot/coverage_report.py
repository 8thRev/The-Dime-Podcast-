"""
Read-only measurement for the SEO/LLM content plan checkpoints (see the
"Checkpoints" section of SEO_ROADMAP.md). Emits every leading metric the
plan is scored on in a single command, so a Day-9 or Day-30 checkpoint is
one run rather than a hand-assembled audit whose methodology quietly
drifts between measurements — which is the usual way a 30-day plan ends
up unfalsifiable.

Two modes:

    python coverage_report.py
        Content metrics only. Reads app/content/transcripts/*.json plus
        the Simplecast RSS feed. No credentials, no API spend, safe to run
        as often as you like.

    python coverage_report.py --census
        Adds the *reachability* census: walks the channel's full upload
        history, matches each video to a published episode using the same
        matcher transcript_pipeline.py uses, and checks whether a caption
        track exists. This is the number that decides whether the backfill
        target is 240 episodes or 300 — without it, every coverage target
        downstream is a guess.

Quota note for --census: captions.list costs 50 units per video against a
10,000 units/day default, so a full ~290-video sweep (~14,500 units) does
not fit in a single day. Caption lookups are therefore capped per run
(--budget) and cached to CACHE_PATH; re-run on consecutive days until the
report says 0 remaining. The same quota ceiling applies to a big
TRANSCRIPT_LIMIT backfill run, which is why the census is worth doing
first: it tells you which videos are worth spending the quota on.
"""

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

import simplecast_feed

REPO_ROOT = Path(__file__).resolve().parent.parent
TRANSCRIPT_DIR = REPO_ROOT / "app" / "content" / "transcripts"
CACHE_PATH = Path(__file__).resolve().parent / "caption_census_cache.json"

# Entities/topics only earn a hub page once at least this many episodes
# back them — the guardrail that separates a real entity hub from a
# doorway page. Mirrors the threshold the company-page generator will use.
MIN_EPISODES_FOR_ENTITY_PAGE = 2

# Caption lookups per --census run. 50 quota units each, against a
# 10,000/day default; 150 leaves ~2,500 units of headroom for the daily
# transcript pipeline run to still work the same day.
DEFAULT_CENSUS_BUDGET = 150


def load_transcripts() -> dict[str, dict]:
    """Return {slug: transcript record} for everything on disk."""
    records = {}
    for path in sorted(TRANSCRIPT_DIR.glob("*.json")):
        try:
            records[path.stem] = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError) as e:
            print(f"WARNING: could not read {path.name}: {e}", file=sys.stderr)
    return records


def content_metrics(records: dict[str, dict], episodes: list[dict]) -> dict:
    """The leading-metric block: everything that is fully under our control
    and therefore worth setting a dated target against."""
    published = {ep["slug"] for ep in episodes}

    # Transcripts can run ahead of the RSS publish date (content generated
    # before an episode goes live), so score coverage only over episodes
    # that are actually published and therefore actually indexable.
    live = {slug: rec for slug, rec in records.items() if slug in published}

    faq = takeaways = quotes = words = 0
    company_episodes: Counter = Counter()
    people_episodes: Counter = Counter()
    topic_episodes: Counter = Counter()

    for rec in live.values():
        faq += len(rec.get("faq") or [])
        takeaways += len(rec.get("takeaways") or [])
        quotes += len(rec.get("quotes") or [])
        words += len((rec.get("cleaned_transcript") or "").split())
        entities = rec.get("entities") or {}
        # Counters over a per-episode set: an entity named ten times in one
        # episode is still only one episode of evidence for its hub page.
        company_episodes.update(set(entities.get("companies") or []))
        people_episodes.update(set(entities.get("people") or []))
        topic_episodes.update(set(rec.get("topics") or []))

    n = len(live)
    total = len(episodes)
    per_episode = {
        "faq": faq / n if n else 0,
        "takeaways": takeaways / n if n else 0,
        "quotes": quotes / n if n else 0,
        "words": words / n if n else 0,
    }

    return {
        "episodes_published": total,
        "transcripts": n,
        "transcripts_ahead_of_publish": len(records) - n,
        "coverage_pct": round(100 * n / total, 1) if total else 0.0,
        "by_source": dict(Counter(r.get("source", "unknown") for r in live.values())),
        "faq_pairs": faq,
        "takeaways": takeaways,
        "quotes": quotes,
        "transcript_words": words,
        "per_episode_avg": {k: round(v, 1) for k, v in per_episode.items()},
        "companies_distinct": len(company_episodes),
        "companies_hub_eligible": sum(
            1 for c in company_episodes.values() if c >= MIN_EPISODES_FOR_ENTITY_PAGE
        ),
        "people_distinct": len(people_episodes),
        "people_hub_eligible": sum(
            1 for c in people_episodes.values() if c >= MIN_EPISODES_FOR_ENTITY_PAGE
        ),
        "topics_distinct": len(topic_episodes),
        # Straight-line extrapolation of the current per-episode averages to
        # full coverage. Not a forecast of traffic — just what the content
        # ceiling looks like, so a checkpoint can be read as "% of the way
        # to the ceiling" instead of an unanchored raw count.
        "at_full_coverage": {
            "faq_pairs": round(per_episode["faq"] * total),
            "takeaways": round(per_episode["takeaways"] * total),
            "quotes": round(per_episode["quotes"] * total),
            "transcript_words": round(per_episode["words"] * total),
        },
    }


def load_cache() -> dict:
    if not CACHE_PATH.exists():
        return {}
    try:
        return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def save_cache(cache: dict) -> None:
    CACHE_PATH.write_text(json.dumps(cache, indent=2, ensure_ascii=False), encoding="utf-8")


def reachability_census(
    records: dict[str, dict], episodes: list[dict], budget: int, scan_limit: int
) -> dict:
    """Classify every full-length upload by what stands between it and a
    transcript. Buckets are mutually exclusive and ordered by cost to fix:

      done            already has a transcript file
      ready           matched + has captions -> the pipeline will do it
      no_captions     matched but YouTube has no caption track -> needs a
                      different transcript source entirely
      unmatched       no confident match to a published episode -> either a
                      non-episode upload or a matcher gap worth a look
      unknown         not yet checked (ran out of quota budget this run)
    """
    from youtube_client import YouTubeClient  # local: needs OAuth config

    youtube = YouTubeClient()
    matcher = simplecast_feed.build_matcher(episodes)

    # Progress goes to stderr, not stdout: --json's output has to stay
    # parseable when redirected to a file.
    print(f"Listing up to {scan_limit} full-length uploads...", file=sys.stderr)
    videos = youtube.list_recent_videos(scan_limit)
    print(f"Found {len(videos)} videos\n", file=sys.stderr)

    cache = load_cache()
    buckets: dict[str, list[dict]] = {
        "done": [],
        "ready": [],
        "no_captions": [],
        "unmatched": [],
        "unknown": [],
    }
    spent = 0

    for video in videos:
        match = matcher.find_best_match(video["title"], video["publishedAt"])
        entry = {"id": video["id"], "title": video["title"], "publishedAt": video["publishedAt"]}

        if not match:
            buckets["unmatched"].append(entry)
            continue

        entry["slug"] = match["slug"]
        if match["slug"] in records:
            buckets["done"].append(entry)
            continue

        cached = cache.get(video["id"])
        if cached is None:
            if spent >= budget:
                buckets["unknown"].append(entry)
                continue
            try:
                has_captions = youtube.get_caption_track_id(video["id"]) is not None
            except Exception as e:
                print(f"  caption check failed for {video['id']}: {e}", file=sys.stderr)
                buckets["unknown"].append(entry)
                continue
            spent += 1
            cached = {"hasCaptions": has_captions, "title": video["title"]}
            cache[video["id"]] = cached
            save_cache(cache)

        buckets["ready" if cached["hasCaptions"] else "no_captions"].append(entry)

    return {
        "videos_scanned": len(videos),
        "caption_lookups_this_run": spent,
        "quota_units_spent": spent * 50,
        "counts": {k: len(v) for k, v in buckets.items()},
        "buckets": buckets,
    }


def _print_row(label: str, value, indent: int = 0) -> None:
    print(f"{'  ' * indent}{label:.<46} {value}")


def print_report(content: dict, census: dict | None) -> None:
    print("=" * 70)
    print("THE DIME - SEO CONTENT COVERAGE REPORT")
    print("=" * 70)

    print("\nCOVERAGE")
    _print_row("Published episodes", content["episodes_published"])
    _print_row(
        "Episodes with a transcript",
        f"{content['transcripts']} ({content['coverage_pct']}%)",
    )
    if content["transcripts_ahead_of_publish"]:
        _print_row(
            "Transcripts for unpublished episodes",
            content["transcripts_ahead_of_publish"],
        )
    for source, count in sorted(content["by_source"].items(), key=lambda kv: -kv[1]):
        _print_row(source, count, indent=1)

    print("\nANSWERABLE CONTENT (what LLMs and AI Overviews can lift)")
    ceiling = content["at_full_coverage"]
    _print_row("FAQ pairs", f"{content['faq_pairs']}  (ceiling ~{ceiling['faq_pairs']})")
    _print_row("Key takeaways", f"{content['takeaways']}  (ceiling ~{ceiling['takeaways']})")
    _print_row("Pull quotes", f"{content['quotes']}  (ceiling ~{ceiling['quotes']})")
    _print_row(
        "Transcript words",
        f"{content['transcript_words']:,}  (ceiling ~{ceiling['transcript_words']:,})",
    )
    avg = content["per_episode_avg"]
    _print_row("Per-episode avg (faq / takeaways / words)", f"{avg['faq']} / {avg['takeaways']} / {avg['words']:.0f}")

    print(f"\nENTITY PAGE SUPPLY (gate: >={MIN_EPISODES_FOR_ENTITY_PAGE} episodes)")
    _print_row(
        "Companies",
        f"{content['companies_hub_eligible']} eligible of {content['companies_distinct']} distinct",
    )
    _print_row(
        "People",
        f"{content['people_hub_eligible']} eligible of {content['people_distinct']} distinct",
    )
    _print_row("Distinct topics in transcripts", content["topics_distinct"])

    if census is None:
        print("\n(Run with --census for the YouTube reachability ceiling.)")
    else:
        c = census["counts"]
        print("\nREACHABILITY CEILING (full YouTube upload history)")
        _print_row("Full-length uploads scanned", census["videos_scanned"])
        _print_row("Already transcribed", c["done"])
        _print_row("Matched + has captions (pipeline can reach)", c["ready"])
        _print_row("Matched but NO captions (needs a new source)", c["no_captions"])
        _print_row("No confident episode match", c["unmatched"])
        _print_row("Not yet checked (quota budget)", c["unknown"])
        _print_row(
            "Quota spent this run",
            f"{census['quota_units_spent']} units ({census['caption_lookups_this_run']} lookups)",
        )
        reachable = content["transcripts"] + c["ready"]
        total = content["episodes_published"]
        print()
        _print_row(
            "=> Automated-path ceiling",
            f"{reachable} / {total} episodes ({round(100 * reachable / total, 1)}%)"
            if total
            else "n/a",
        )
        if c["unknown"]:
            print(f"   ({c['unknown']} unchecked - re-run tomorrow to finish the census)")

    print("\n" + "=" * 70)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--census",
        action="store_true",
        help="also run the YouTube caption-track census (needs OAuth config, spends quota)",
    )
    parser.add_argument(
        "--budget",
        type=int,
        default=DEFAULT_CENSUS_BUDGET,
        help=f"max caption lookups this run, 50 quota units each (default {DEFAULT_CENSUS_BUDGET})",
    )
    parser.add_argument(
        "--scan-limit",
        type=int,
        default=1000,
        help="how many full-length uploads to list (default 1000, i.e. the whole channel)",
    )
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON instead")
    args = parser.parse_args()

    records = load_transcripts()
    if not args.json:
        print("Fetching Simplecast RSS feed...")
    episodes = simplecast_feed.fetch_episodes()

    content = content_metrics(records, episodes)

    census = None
    if args.census:
        is_valid, missing = config_check()
        if not is_valid:
            print(f"ERROR: --census needs {', '.join(missing)} set.", file=sys.stderr)
            return 1
        census = reachability_census(records, episodes, args.budget, args.scan_limit)

    if args.json:
        payload = {"content": content}
        if census is not None:
            payload["census"] = census
        print(json.dumps(payload, indent=2, ensure_ascii=False))
    else:
        print_report(content, census)

    return 0


def config_check() -> tuple[bool, list[str]]:
    """The census needs the YouTube half of the transcript config but not
    the Anthropic half — it never calls Claude."""
    from config import config

    required = [
        ("YOUTUBE_OAUTH_CLIENT_ID", config.YOUTUBE_OAUTH_CLIENT_ID),
        ("YOUTUBE_OAUTH_CLIENT_SECRET", config.YOUTUBE_OAUTH_CLIENT_SECRET),
        ("YOUTUBE_OAUTH_REFRESH_TOKEN", config.YOUTUBE_OAUTH_REFRESH_TOKEN),
    ]
    missing = [name for name, value in required if not value]
    return len(missing) == 0, missing


if __name__ == "__main__":
    sys.exit(main())
