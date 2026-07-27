"""
YouTube Analytics API client for the SEO report (traffic sources, watch
time, search terms, and subscriber growth — deeper than the basic
views/likes/comments stats from the YouTube Data API in youtube_client.py).

Requires the OAuth refresh token to include the yt-analytics.readonly
scope (see get_youtube_refresh_token.py). Older tokens issued before that
scope was added will get a 403 from this API; callers should treat that
as "not available yet" rather than a hard failure.
"""

from datetime import date

import requests

from config import config
from youtube_client import CHANNEL_ID, raise_for_status

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://youtubeanalytics.googleapis.com/v2/reports"


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
