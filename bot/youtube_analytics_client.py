"""
YouTube Analytics API client for the SEO report (traffic sources, watch
time, search terms, and subscriber growth, deeper than the basic
views/likes/comments stats from the YouTube Data API in youtube_client.py).

Requires the OAuth refresh token to include the yt-analytics.readonly
scope (see get_youtube_refresh_token.py). Older tokens issued before that
scope was added will get a 403 from this API; callers should treat that
as "not available yet" rather than a hard failure.
"""

import time
from datetime import date, timedelta

import requests

from config import config
from youtube_client import API_BASE as DATA_API_BASE, CHANNEL_ID, raise_for_status

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://youtubeanalytics.googleapis.com/v2/reports"
RETRIES = 4
RETRY_BASE_SECONDS = 2


class YouTubeAnalyticsClient:
    """Client for pulling channel-level analytics from the YouTube Analytics API."""

    def __init__(self):
        self._access_token = None

    def _get_access_token(self) -> str:
        if self._access_token:
            return self._access_token

        resp = requests.post(
            TOKEN_URL,
            data={
                "client_id": config.YOUTUBE_OAUTH_CLIENT_ID,
                "client_secret": config.YOUTUBE_OAUTH_CLIENT_SECRET,
                "refresh_token": config.YOUTUBE_OAUTH_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
        raise_for_status(resp)
        self._access_token = resp.json()["access_token"]
        return self._access_token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_access_token()}"}

    def _query(self, start: date, end: date, params: dict) -> dict:
        # Google documents 5xx "backendError" as retryable with backoff; it
        # showed up on two ordinary queries in one afternoon (Sep 2026).
        for attempt in range(RETRIES):
            resp = requests.get(
                API_BASE,
                params={
                    "ids": f"channel=={CHANNEL_ID}",
                    "startDate": start.isoformat(),
                    "endDate": end.isoformat(),
                    **params,
                },
                headers=self._headers(),
                timeout=30,
            )
            if resp.status_code < 500 or attempt == RETRIES - 1:
                break
            time.sleep(RETRY_BASE_SECONDS * 2 ** attempt)
        raise_for_status(resp)
        return resp.json()

    def totals(self, start: date, end: date) -> dict:
        """Channel-wide totals for a date range: views, watch time,
        avg view duration, subscribers gained/lost."""
        data = self._query(
            start,
            end,
            {"metrics": "views,estimatedMinutesWatched,averageViewDuration,subscribersGained,subscribersLost"},
        )
        rows = data.get("rows") or [[0, 0, 0, 0, 0]]
        views, minutes_watched, avg_duration, gained, lost = rows[0]
        return {
            "views": int(views),
            "minutes_watched": int(minutes_watched),
            "avg_view_duration_seconds": float(avg_duration),
            "subscribers_gained": int(gained),
            "subscribers_lost": int(lost),
        }

    def traffic_sources(self, start: date, end: date, row_limit: int = 10) -> list[dict]:
        """Views/watch time broken down by traffic source type, sorted by views desc."""
        data = self._query(
            start,
            end,
            {
                "metrics": "views,estimatedMinutesWatched",
                "dimensions": "insightTrafficSourceType",
                "sort": "-views",
                "maxResults": row_limit,
            },
        )
        return [
            {"source": row[0], "views": int(row[1]), "minutes_watched": int(row[2])}
            for row in data.get("rows", [])
        ]

    # Per video methods for the weekly report. The Analytics API has no
    # impressions or thumbnail CTR metric (confirmed Sep 2026: both return
    # 400); those only exist in the YouTube Reporting API bulk reports.

    def channel_subscriber_count(self) -> int:
        """Current public subscriber count, from the Data API."""
        resp = requests.get(
            f"{DATA_API_BASE}/channels",
            params={"part": "statistics", "id": CHANNEL_ID},
            headers=self._headers(),
            timeout=30,
        )
        raise_for_status(resp)
        return int(resp.json()["items"][0]["statistics"]["subscriberCount"])

    def last_data_date(self) -> date | None:
        """Latest day the Analytics API has channel data for. It trails the
        calendar by two to three days, so day N values are only complete up
        to this date."""
        today = date.today()
        data = self._query(today - timedelta(days=10), today, {"dimensions": "day", "metrics": "views"})
        days = [row[0] for row in data.get("rows", [])]
        return date.fromisoformat(max(days)) if days else None

    def per_video_totals(self, start: date, end: date, video_ids: list[str]) -> dict[str, dict]:
        """{video_id: {views, average_view_duration, average_view_percentage,
        subscribers_gained}} for a date range. Videos with no views in the
        range are absent from the result."""
        out = {}
        for i in range(0, len(video_ids), 200):
            chunk = video_ids[i:i + 200]
            data = self._query(
                start,
                end,
                {
                    "dimensions": "video",
                    "metrics": "views,averageViewDuration,averageViewPercentage,subscribersGained",
                    "filters": "video==" + ",".join(chunk),
                    "maxResults": 200,
                },
            )
            for vid, views, avd, avp, subs in data.get("rows", []):
                out[vid] = {
                    "views": int(views),
                    "average_view_duration": float(avd),
                    "average_view_percentage": float(avp),
                    "subscribers_gained": int(subs),
                }
        return out

    def video_daily(self, video_id: str, start: date, end: date) -> dict[str, dict]:
        """{YYYY-MM-DD: {views, average_view_duration, average_view_percentage}}."""
        data = self._query(
            start,
            end,
            {
                "dimensions": "day",
                "metrics": "views,averageViewDuration,averageViewPercentage",
                "filters": f"video=={video_id}",
            },
        )
        return {
            day: {
                "views": int(views),
                "average_view_duration": float(avd),
                "average_view_percentage": float(avp),
            }
            for day, views, avd, avp in data.get("rows", [])
        }

    def video_traffic_sources(self, video_id: str, start: date, end: date) -> dict[str, int]:
        data = self._query(
            start,
            end,
            {"dimensions": "insightTrafficSourceType", "metrics": "views", "filters": f"video=={video_id}"},
        )
        return {source: int(views) for source, views in data.get("rows", []) if int(views) > 0}

    def video_retention(self, video_id: str, start: date, end: date) -> list[tuple[float, float]]:
        """[(elapsed_ratio, audience_watch_ratio)] in 1 percent steps."""
        data = self._query(
            start,
            end,
            {"dimensions": "elapsedVideoTimeRatio", "metrics": "audienceWatchRatio", "filters": f"video=={video_id}"},
        )
        return [(float(r), float(w)) for r, w in data.get("rows", [])]

    def daily_views_by_source(self, start: date, end: date, video_id: str | None = None) -> dict[str, dict[str, int]]:
        """{YYYY-MM-DD: {traffic_source_type: views}}, channel wide or for one video."""
        params = {"dimensions": "day,insightTrafficSourceType", "metrics": "views"}
        if video_id:
            params["filters"] = f"video=={video_id}"
        data = self._query(start, end, params)
        out: dict[str, dict[str, int]] = {}
        for day, source, views in data.get("rows", []):
            out.setdefault(day, {})[source] = int(views)
        return out

    def external_referrers(self, start: date, end: date, row_limit: int = 50) -> dict[str, int]:
        """Views from outside sites by referring domain (EXT_URL detail)."""
        data = self._query(
            start,
            end,
            {
                "dimensions": "insightTrafficSourceDetail",
                "metrics": "views",
                "filters": "insightTrafficSourceType==EXT_URL",
                "sort": "-views",
                "maxResults": row_limit,
            },
        )
        return {detail: int(views) for detail, views in data.get("rows", [])}

    def top_search_terms(self, start: date, end: date, row_limit: int = 10) -> list[dict]:
        """Top YouTube search terms driving views, sorted by views desc."""
        data = self._query(
            start,
            end,
            {
                "metrics": "views",
                "dimensions": "insightTrafficSourceDetail",
                "filters": "insightTrafficSourceType==YT_SEARCH",
                "sort": "-views",
                "maxResults": row_limit,
            },
        )
        return [{"term": row[0], "views": int(row[1])} for row in data.get("rows", [])]
