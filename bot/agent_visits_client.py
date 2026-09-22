"""
Reads the AI agent fetch counters that app/src/middleware.js writes to the
Upstash Redis store: one hash per day, agents:YYYY-MM-DD, with fields
"<class>\t<agent>\t<path>" and integer counts.

Read only. Uses the store's REST endpoint (KV_REST_API_URL and
KV_REST_API_TOKEN, the names the Vercel marketplace integration sets).
"""

from datetime import date, timedelta

import requests

from config import config


class AgentVisitsClient:
    def __init__(self):
        self._url = config.KV_REST_API_URL.rstrip("/")
        self._headers = {"Authorization": f"Bearer {config.KV_REST_API_TOKEN}"}

    def daily_counts(self, start: date, end: date) -> dict[str, list[dict]]:
        """{YYYY-MM-DD: [{class, agent, path, count}, ...]} for every day in
        the range. Days with no fetches are present with an empty list."""
        days = []
        d = start
        while d <= end:
            days.append(d.isoformat())
            d += timedelta(days=1)
        resp = requests.post(
            f"{self._url}/pipeline",
            headers=self._headers,
            json=[["HGETALL", f"agents:{day}"] for day in days],
            timeout=30,
        )
        resp.raise_for_status()
        out = {}
        for day, result in zip(days, resp.json()):
            if "error" in result:
                raise RuntimeError(f"store error for {day}: {result['error']}")
            flat = result.get("result") or []
            rows = []
            for field, count in zip(flat[0::2], flat[1::2]):
                parts = field.split("\t", 2)
                if len(parts) != 3:
                    continue
                cls, agent, path = parts
                rows.append({"class": cls, "agent": agent, "path": path, "count": int(count)})
            out[day] = rows
        return out
