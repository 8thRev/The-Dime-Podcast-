"""
Simplecast client for the SEO report (podcast download stats).

Auth is a static read-only Private App token (Simplecast dashboard →
Account Settings → Private Apps), not OAuth.
"""

import requests

from config import config

API_BASE = "https://api.simplecast.com"
PODCAST_ID = "583052dc-8161-4a60-8c68-f486c33c8be9"  # The Dime


class SimplecastClient:
    """Client for pulling download analytics from the Simplecast API."""

    def __init__(self):
        self._headers = {"Authorization": f"Bearer {config.SIMPLECAST_API_TOKEN}"}

    def downloads_total(self, start, end) -> int:
        """Total downloads across all episodes for a date range."""
        resp = requests.get(
            f"{API_BASE}/analytics/downloads",
            headers=self._headers,
            params={
                "podcast": PODCAST_ID,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
            },
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json().get("total", 0)

    def recent_episode_downloads(self, limit: int = 10) -> list[dict]:
        """Lifetime download totals for the most recent episodes (most recent first)."""
        resp = requests.get(
            f"{API_BASE}/analytics/episodes",
            headers=self._headers,
            params={"podcast": PODCAST_ID, "limit": limit},
            timeout=30,
        )
        resp.raise_for_status()
        return [
            {
                "title": item["title"],
                "published_at": item["published_at"][:10],
                "downloads": item["downloads"]["total"],
            }
            for item in resp.json().get("collection", [])
        ]
