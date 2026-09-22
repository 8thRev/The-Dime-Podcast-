"""
Kit (ConvertKit) API v4 client for the weekly report. Read only: subscriber
counts, growth stats and broadcast stats. Never reads or stores subscriber
emails.

Auth is the KIT_API_KEY secret sent as the X-Kit-Api-Key header.
"""

from datetime import date, datetime, timezone

import requests

from config import config

API_BASE = "https://api.kit.com/v4"


class KitClient:
    def __init__(self):
        self._headers = {"X-Kit-Api-Key": config.KIT_API_KEY, "Accept": "application/json"}

    def _get(self, path: str, **params) -> dict:
        resp = requests.get(f"{API_BASE}{path}", headers=self._headers, params=params, timeout=30)
        resp.raise_for_status()
        return resp.json()

    def active_subscribers(self) -> int:
        data = self._get("/subscribers", status="active", include_total_count="true", per_page=1)
        return int(data["pagination"]["total_count"])

    def growth_stats(self, start: date, end: date) -> dict:
        """{new_subscribers, cancellations, net_new_subscribers, subscribers}.
        Kit reports cancellations as a negative number; kept as returned."""
        stats = self._get("/account/growth_stats", starting=start.isoformat(), ending=end.isoformat())["stats"]
        return {
            "new_subscribers": int(stats["new_subscribers"]),
            "cancellations": int(stats["cancellations"]),
            "net_new_subscribers": int(stats["net_new_subscribers"]),
            "subscribers": int(stats["subscribers"]),
        }

    def broadcasts_since(self, since: date) -> list[dict]:
        """Sent broadcasts with send_at on or after `since`, most recent first,
        each with its stats. Uses the bulk stats endpoint, which is ordered
        newest first, and stops paging once it passes `since`."""
        out = []
        cursor = None
        since_dt = datetime(since.year, since.month, since.day, tzinfo=timezone.utc)
        while True:
            params = {"per_page": 50}
            if cursor:
                params["after"] = cursor
            data = self._get("/broadcasts/stats", **params)
            done = False
            for b in data.get("broadcasts", []):
                if not b.get("send_at"):
                    continue
                sent = datetime.fromisoformat(b["send_at"].replace("Z", "+00:00"))
                if sent < since_dt:
                    done = True
                    break
                s = b.get("stats") or {}
                if s.get("status") != "completed":
                    continue
                out.append(
                    {
                        "id": b["id"],
                        "subject": b.get("subject") or "",
                        "send_at": b["send_at"],
                        "recipients": int(s.get("recipients", 0)),
                        "opens": int(s.get("emails_opened", 0)),
                        "clicks": int(s.get("total_clicks", 0)),
                        "open_rate": float(s.get("open_rate", 0.0)),
                        "click_rate": float(s.get("click_rate", 0.0)),
                        "unsubscribes": int(s.get("unsubscribes", 0)),
                    }
                )
            page = data.get("pagination") or {}
            if done or not page.get("has_next_page"):
                break
            cursor = page.get("end_cursor")
        return out
