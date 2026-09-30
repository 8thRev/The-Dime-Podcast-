"""
Daily spend watchdog. Runs from .github/workflows/spend-watch.yml.

Two independent checks, either of which fails the run and posts an alert:

  1. Anthropic usage by API key: any key whose estimated spend for a day is
     over SPEND_DAILY_LIMIT_USD (default 4; the Monday AI panel alone is
     about 2.5). Needs ANTHROPIC_ADMIN_KEY (sk-ant-admin...), which is a
     different key from the one the bots use.
  2. GitHub Actions duration: any run longer than 5x the median for its
     workflow (and over 5 minutes), which is how the Sep 16 24 minute
     "25 second" job would have shown up.

The per run dollar cap lives in spend_guard.py (in process, before the money
is spent). This is the backstop for whatever bypasses it.

    python spend_watch.py            # yesterday and today
    python spend_watch.py --selftest # fires a test alert, exits 0
"""

import argparse
import os
import statistics
import sys
from datetime import date, datetime, timedelta, timezone

import requests

import spend_guard
from spend_guard import PRICES, FALLBACK_PRICE, WEB_SEARCH_USD

USAGE_URL = "https://api.anthropic.com/v1/organizations/usage_report/messages"
DAILY_LIMIT_USD = float(os.getenv("SPEND_DAILY_LIMIT_USD", "4"))
DURATION_MULTIPLE = 5
# A Daily run with a guest to research legitimately takes 5 to 7 minutes against
# a 30 second median (no-op days), so the floor sits above that. Sep 16, the
# run that burned $7.25, took 24.5 minutes.
MIN_ALERT_SECONDS = 900


def result_usd(r: dict) -> float:
    p_in, p_out, p_read, p_write = PRICES.get(r.get("model") or "", FALLBACK_PRICE)
    cc = r.get("cache_creation") or {}
    write = (cc.get("ephemeral_5m_input_tokens") or 0) + (cc.get("ephemeral_1h_input_tokens") or 0)
    searches = (r.get("server_tool_use") or {}).get("web_search_requests") or 0
    return (
        (r.get("uncached_input_tokens") or 0) * p_in + (r.get("output_tokens") or 0) * p_out
        + (r.get("cache_read_input_tokens") or 0) * p_read + write * p_write
    ) / 1e6 + searches * WEB_SEARCH_USD


def daily_cost_by_key(buckets: list[dict]) -> dict[tuple[str, str], float]:
    """{(day, api_key_id): estimated usd} from usage_report daily buckets."""
    out: dict[tuple[str, str], float] = {}
    for b in buckets:
        day = (b.get("starting_at") or "")[:10]
        for r in b.get("results") or []:
            k = (day, r.get("api_key_id") or "unknown")
            out[k] = out.get(k, 0.0) + result_usd(r)
    return out


def cost_anomalies(costs: dict[tuple[str, str], float], limit: float = DAILY_LIMIT_USD) -> list[str]:
    return [f"API key {k} spent an estimated ${usd:.2f} on {day} (limit ${limit:.2f})"
            for (day, k), usd in sorted(costs.items()) if usd > limit]


def duration_anomalies(runs: list[dict], today: date) -> list[str]:
    """runs: [{name, number, seconds, day}], history plus today's. Flags today's
    runs over DURATION_MULTIPLE x their workflow's median."""
    by_name: dict[str, list[float]] = {}
    for r in runs:
        if r["day"] < today:
            by_name.setdefault(r["name"], []).append(r["seconds"])
    out = []
    for r in runs:
        hist = by_name.get(r["name"])
        if r["day"] < today or not hist:
            continue
        med = statistics.median(hist)
        if r["seconds"] > max(MIN_ALERT_SECONDS, DURATION_MULTIPLE * med):
            out.append(f"{r['name']} #{r['number']} ran {r['seconds'] / 60:.1f} min (median {med / 60:.1f} min)")
    return out


def fetch_usage(admin_key: str, start: date, end: date) -> list[dict]:
    headers = {"x-api-key": admin_key, "anthropic-version": "2023-06-01"}
    params = {"starting_at": f"{start.isoformat()}T00:00:00Z", "ending_at": f"{end.isoformat()}T00:00:00Z",
              "bucket_width": "1d", "group_by[]": ["api_key_id", "model"], "limit": 31}
    buckets, page = [], None
    while True:
        resp = requests.get(USAGE_URL, headers=headers, params={**params, **({"page": page} if page else {})}, timeout=30)
        resp.raise_for_status()
        body = resp.json()
        buckets += body.get("data") or []
        page = body.get("next_page")
        if not body.get("has_more") or not page:
            return buckets


def fetch_runs(repo: str, token: str, since: date) -> list[dict]:
    resp = requests.get(f"https://api.github.com/repos/{repo}/actions/runs",
                        headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"},
                        params={"created": f">={since.isoformat()}", "per_page": 100, "status": "completed"}, timeout=30)
    resp.raise_for_status()
    runs = []
    for r in resp.json().get("workflow_runs", []):
        if not r.get("run_started_at") or not r.get("updated_at"):
            continue
        start = datetime.fromisoformat(r["run_started_at"].replace("Z", "+00:00"))
        end = datetime.fromisoformat(r["updated_at"].replace("Z", "+00:00"))
        runs.append({"name": r["name"], "number": r["run_number"], "seconds": (end - start).total_seconds(), "day": start.date()})
    return runs


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest", action="store_true")
    args = ap.parse_args()
    if args.selftest:
        spend_guard.alert("Self test from spend_watch.py. If you can read this, alerts reach you.")
        return 0

    today = datetime.now(timezone.utc).date()
    problems: list[str] = []

    admin = os.getenv("ANTHROPIC_ADMIN_KEY", "")
    if admin:
        costs = daily_cost_by_key(fetch_usage(admin, today - timedelta(days=1), today + timedelta(days=1)))
        problems += cost_anomalies(costs)
    else:
        # Setup not finished, not a spend anomaly: warn, do not fail the run,
        # so a real alert is never drowned out by a daily red X.
        print("::warning title=Spend Watch::ANTHROPIC_ADMIN_KEY is not set, so the per key spend check did not run")

    repo, token = os.getenv("GITHUB_REPOSITORY", ""), os.getenv("GITHUB_TOKEN", "")
    if repo and token:
        problems += duration_anomalies(fetch_runs(repo, token, today - timedelta(days=15)), today)

    if problems:
        spend_guard.alert("Daily spend watch: " + " | ".join(problems))
        return 1
    print("spend_watch: no anomalies")
    return 0


if __name__ == "__main__":
    sys.exit(main())
