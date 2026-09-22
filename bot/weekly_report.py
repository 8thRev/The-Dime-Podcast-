"""
Weekly Report v2 entry point. See docs/report-v2-spec.md.

Phase 1 builds the data layer only: it writes data/weekly/YYYY-MM-DD.json
and appends data/reach.csv. No email is sent in any mode yet; --dry-run is
accepted now so the flag keeps its meaning once Phase 3 adds sending.

    python weekly_report.py --dry-run
    python weekly_report.py --dry-run --out-dir /tmp/weekly
"""

import argparse
import json
import sys
from pathlib import Path

import jsonschema

import weekly_data
from config import config

SCHEMA_PATH = weekly_data.REPO_ROOT / "schemas" / "weekly.schema.json"
DEFAULT_OUT = weekly_data.REPO_ROOT / "data"


def build_clients(skip_ai: bool = False) -> dict:
    """Instantiate each client whose credentials are present. Construction
    itself can fail (a malformed service account key, for example), so that
    is caught per client too and reported as a missing source."""
    clients = {}

    def make(name, ok, factory):
        if not ok:
            return
        try:
            clients[name] = factory()
        except Exception as e:
            print(f"[{name}] client setup failed: {weekly_data.scrub(str(e))[:300]}")

    from ga4_client import GA4Client
    from gsc_client import SearchConsoleClient
    from kit_client import KitClient
    from simplecast_client import SimplecastClient
    from youtube_analytics_client import YouTubeAnalyticsClient

    make("simplecast", config.SIMPLECAST_API_TOKEN, SimplecastClient)
    make("kit", config.KIT_API_KEY, KitClient)
    make(
        "youtube",
        config.YOUTUBE_OAUTH_CLIENT_ID and config.YOUTUBE_OAUTH_CLIENT_SECRET and config.YOUTUBE_OAUTH_REFRESH_TOKEN,
        YouTubeAnalyticsClient,
    )
    if "youtube" in clients:
        from youtube_reporting_client import YouTubeReportingClient
        make("youtube_reporting", True, lambda: YouTubeReportingClient(clients["youtube"]))
    make("gsc", config.GSC_SERVICE_ACCOUNT_JSON, SearchConsoleClient)
    make("ga4", config.GSC_SERVICE_ACCOUNT_JSON and config.GA4_PROPERTY_ID, GA4Client)
    from agent_visits_client import AgentVisitsClient
    make("agent_visits", config.KV_REST_API_URL and config.KV_REST_API_TOKEN, AgentVisitsClient)
    if config.ANTHROPIC_API_KEY and not skip_ai:
        import ai_visibility
        clients["ai"] = ai_visibility.run_panel
    return clients


def validate(snapshot: dict) -> list[str]:
    schema = json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
    validator = jsonschema.Draft202012Validator(schema)
    return [f"{'/'.join(map(str, e.absolute_path))}: {e.message}" for e in validator.iter_errors(snapshot)]


def write_outputs(snapshot: dict, out_dir: Path) -> Path:
    weekly_dir = out_dir / "weekly"
    weekly_dir.mkdir(parents=True, exist_ok=True)
    path = weekly_dir / f"{snapshot['run_date']}.json"
    text = json.dumps(snapshot, indent=2, ensure_ascii=False)
    # Last line of defense: a secret value must never be written to disk.
    if weekly_data.scrub(text) != text:
        raise RuntimeError("snapshot contains a credential value; refusing to write")
    path.write_text(text + "\n", encoding="utf-8")
    weekly_data.append_reach_row(out_dir / "reach.csv", snapshot)
    return path


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Weekly Report v2")
    parser.add_argument("--dry-run", action="store_true", help="write the JSON and send nothing")
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT)
    parser.add_argument("--skip-ai", action="store_true", help="skip the paid AI answer check")
    args = parser.parse_args(argv)

    snapshot = weekly_data.build_snapshot(build_clients(skip_ai=args.skip_ai))
    errors = validate(snapshot)
    path = write_outputs(snapshot, args.out_dir)

    print(f"\nWrote {path}")
    for name, status in sorted(snapshot["sources"].items()):
        print(f"  {name:<12} {status['status']}" + (f"  ({status['error']})" if status["error"] else ""))
    if errors:
        print(f"\nSchema validation failed ({len(errors)} errors):")
        for e in errors[:20]:
            print(f"  {e}")
        return 1
    print("Schema validation passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
