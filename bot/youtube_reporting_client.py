"""
YouTube Reporting API client: the only source of thumbnail impressions and
impression click through rate, which the Analytics API does not expose.

The Reporting API works through a standing "job" on the channel: once a job
exists, YouTube writes one CSV report per day for it, and historical reports
may be backfilled after the job is created. ensure_job() creates the job the
first time it runs (approved by Bryan, Sep 22 2026) and is a no-op after.
Read only otherwise, and uses the same OAuth token as the Analytics client.
"""

import csv
import io
from datetime import date

import requests

from youtube_client import raise_for_status

API_BASE = "https://youtubereporting.googleapis.com/v1"
# Per video, per day, per traffic source: thumbnail impressions and CTR.
REACH_REPORT_TYPE = "channel_reach_combined_a1"
JOB_NAME = "dime-weekly-report-reach"
# Reporting API traffic_source_type code for YouTube search.
YT_SEARCH_CODE = "5"


class YouTubeReportingClient:
    def __init__(self, analytics_client):
        # Reuses the Analytics client's token exchange and cache.
        self._auth = analytics_client

    def _get(self, url: str, **params):
        resp = requests.get(url, headers=self._auth._headers(), params=params, timeout=60)
        raise_for_status(resp)
        return resp

    def ensure_job(self) -> tuple[str, bool]:
        """(job_id, created_now)."""
        jobs = self._get(f"{API_BASE}/jobs").json().get("jobs", [])
        for job in jobs:
            if job.get("reportTypeId") == REACH_REPORT_TYPE:
                return job["id"], False
        resp = requests.post(
            f"{API_BASE}/jobs",
            headers=self._auth._headers(),
            json={"reportTypeId": REACH_REPORT_TYPE, "name": JOB_NAME},
            timeout=30,
        )
        raise_for_status(resp)
        return resp.json()["id"], True

    def reach_rows(self, job_id: str, start: date, end: date) -> list[dict]:
        """Every CSV row from reports whose data day falls in [start, end]."""
        reports = []
        page_token = None
        while True:
            params = {}
            if page_token:
                params["pageToken"] = page_token
            data = self._get(f"{API_BASE}/jobs/{job_id}/reports", **params).json()
            reports.extend(data.get("reports", []))
            page_token = data.get("nextPageToken")
            if not page_token:
                break

        # A day can have more than one report if YouTube regenerated it;
        # keep only the newest per data day.
        newest: dict[str, dict] = {}
        for r in reports:
            day = r["startTime"][:10]
            if start.isoformat() <= day <= end.isoformat():
                if day not in newest or r["createTime"] > newest[day]["createTime"]:
                    newest[day] = r

        rows = []
        for day, r in sorted(newest.items()):
            text = self._get(r["downloadUrl"]).text
            rows.extend(csv.DictReader(io.StringIO(text)))
        return rows


def summarize_reach(rows: list[dict]) -> dict:
    """Per video and channel totals: impressions and impression weighted CTR,
    overall and from YouTube search. CTR is returned as a percentage."""
    if rows and not {"video_id", "video_thumbnail_impressions", "video_thumbnail_impressions_ctr"} <= set(rows[0]):
        raise ValueError(f"unexpected reach report columns: {sorted(rows[0])}")

    def blank():
        return {"impressions": 0, "clicks": 0.0, "search_impressions": 0, "search_clicks": 0.0}

    per_video: dict[str, dict] = {}
    channel = blank()
    days = set()
    for row in rows:
        impressions = int(float(row["video_thumbnail_impressions"] or 0))
        ctr = float(row["video_thumbnail_impressions_ctr"] or 0)
        # Documented as a fraction; guard in case a report ever uses percent.
        if ctr > 1:
            ctr /= 100
        clicks = impressions * ctr
        is_search = row.get("traffic_source_type") == YT_SEARCH_CODE
        days.add(row.get("date"))
        for bucket in (per_video.setdefault(row["video_id"], blank()), channel):
            bucket["impressions"] += impressions
            bucket["clicks"] += clicks
            if is_search:
                bucket["search_impressions"] += impressions
                bucket["search_clicks"] += clicks

    def finish(b):
        return {
            "impressions": b["impressions"],
            "ctr": round(100 * b["clicks"] / b["impressions"], 2) if b["impressions"] else None,
            "search_impressions": b["search_impressions"],
            "search_ctr": round(100 * b["search_clicks"] / b["search_impressions"], 2) if b["search_impressions"] else None,
        }

    return {
        "days_covered": len(days),
        "channel": finish(channel),
        "per_video": {vid: finish(b) for vid, b in per_video.items()},
    }
