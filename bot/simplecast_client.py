"""
Simplecast client for the SEO report and weekly report (podcast download stats).

Auth is a static read-only Private App token (Simplecast dashboard →
Account Settings → Private Apps), not OAuth.

Endpoints confirmed against the live API (Sep 2026 probe):
  /podcasts/{id}/episodes            episode list, paginated, has type/status
  /analytics/downloads?episode=ID    daily series since publish (no dates needed)
  /analytics/downloads?podcast=ID    podcast daily series for a date range
  /analytics/technology/applications downloads by app for a date range
  /analytics/location                downloads by country for a date range
  /analytics/listeners               unique listeners for a date range
Simplecast exposes no follower or subscriber count.
"""

import requests

from config import config

API_BASE = "https://api.simplecast.com"
PODCAST_ID = "583052dc-8161-4a60-8c68-f486c33c8be9"  # The Dime


class SimplecastClient:
    """Client for pulling download analytics from the Simplecast API."""

    def __init__(self):
        self._headers = {"Authorization": f"Bearer {config.SIMPLECAST_API_TOKEN}"}

    def _get(self, path: str, **params) -> dict:
        resp = requests.get(f"{API_BASE}{path}", headers=self._headers, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def downloads_total(self, start, end) -> int:
        """Total downloads across all episodes for a date range."""
        return self._get(
            "/analytics/downloads",
            podcast=PODCAST_ID,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        ).get("total", 0)

    def recent_episode_downloads(self, limit: int = 10) -> list[dict]:
        """Lifetime download totals for the most recent episodes (most recent first)."""
        data = self._get("/analytics/episodes", podcast=PODCAST_ID, limit=limit)
        return [
            {
                "title": item["title"],
                "published_at": item["published_at"][:10],
                "downloads": item["downloads"]["total"],
            }
            for item in data.get("collection", [])
        ]

    def list_published_episodes(self) -> list[dict]:
        """Every published episode as {id, title, slug, type, number, published_at},
        most recent first. Drafts, scheduled and private episodes are skipped."""
        episodes = []
        offset = 0
        page_size = 100
        while True:
            data = self._get(f"/podcasts/{PODCAST_ID}/episodes", limit=page_size, offset=offset)
            items = data.get("collection", [])
            for item in items:
                if item.get("status") != "published" or not item.get("published_at"):
                    continue
                episodes.append(
                    {
                        "id": item["id"],
                        "title": item["title"],
                        "slug": item.get("slug"),
                        "type": item.get("type"),
                        "number": item.get("number"),
                        "published_at": item["published_at"],
                    }
                )
            if len(items) < page_size:
                break
            offset += page_size
        episodes.sort(key=lambda e: e["published_at"], reverse=True)
        return episodes

    def episode_daily_downloads(self, episode_id: str) -> dict[str, int]:
        """Downloads per day since publish, as {YYYY-MM-DD: downloads}."""
        data = self._get("/analytics/downloads", episode=episode_id)
        return {row["interval"]: int(row["downloads_total"]) for row in data.get("by_interval", [])}

    def podcast_daily_downloads(self, start, end) -> dict[str, int]:
        data = self._get(
            "/analytics/downloads",
            podcast=PODCAST_ID,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        return {row["interval"]: int(row["downloads_total"]) for row in data.get("by_interval", [])}

    def downloads_by_app(self, start, end) -> list[dict]:
        data = self._get(
            "/analytics/technology/applications",
            podcast=PODCAST_ID,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        return [{"name": r["name"], "downloads": int(r["downloads_total"])} for r in data.get("collection", [])]

    def downloads_by_country(self, start, end) -> list[dict]:
        data = self._get(
            "/analytics/location",
            podcast=PODCAST_ID,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        return [{"name": r["name"], "downloads": int(r["downloads_total"])} for r in data.get("countries", [])]

    def listeners(self, start, end) -> dict:
        """{total, daily_sum} for a date range. total is Simplecast's own figure
        for the window; daily_sum is the sum of its per day values, kept so
        whether total is deduplicated across days stays visible."""
        data = self._get(
            "/analytics/listeners",
            podcast=PODCAST_ID,
            start_date=start.isoformat(),
            end_date=end.isoformat(),
        )
        return {
            "total": int(data.get("total", 0)),
            "daily_sum": sum(int(r.get("total", 0)) for r in data.get("by_interval", [])),
        }
