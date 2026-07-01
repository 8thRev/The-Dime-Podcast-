"""
Google Search Console client for the SEO report.
"""

import json
import os
from datetime import date, timedelta

from google.oauth2 import service_account
from googleapiclient.discovery import build

from config import config

SCOPES = ["https://www.googleapis.com/auth/webmasters.readonly"]

# GSC data typically isn't finalized for the most recent 1-3 days, so
# reporting windows end a few days back to avoid comparing against
# incomplete data.
REPORT_LAG_DAYS = 3
REPORT_WINDOW_DAYS = 7


class SearchConsoleClient:
    """Client for pulling Search Analytics data from Search Console."""

    def __init__(self):
        self.site_url = config.GSC_SITE_URL
        self._service = build(
            "searchconsole", "v1", credentials=self._load_credentials()
        )

    def _load_credentials(self) -> service_account.Credentials:
        raw = config.GSC_SERVICE_ACCOUNT_JSON.strip()
        if not raw:
            raise ValueError("GSC_SERVICE_ACCOUNT_JSON is not set")

        if os.path.isfile(raw):
            return service_account.Credentials.from_service_account_file(
                raw, scopes=SCOPES
            )

        try:
            info = json.loads(raw)
        except json.JSONDecodeError as e:
            raise ValueError(
                "GSC_SERVICE_ACCOUNT_JSON is not valid JSON and isn't a file path "
                f"either ({e}). Did the full key file contents get pasted into "
                "the secret?"
            ) from e
        return service_account.Credentials.from_service_account_info(
            info, scopes=SCOPES
        )

    def query(self, start: date, end: date, dimension: str, row_limit: int = 25) -> list[dict]:
        """
        Run a Search Analytics query for a single dimension over a date range.

        Args:
            start: Start date (inclusive)
            end: End date (inclusive)
            dimension: 'query' or 'page'
            row_limit: Max rows to return, ranked by clicks

        Returns:
            List of rows, each with keys: key, clicks, impressions, ctr, position
        """
        response = self._service.searchanalytics().query(
            siteUrl=self.site_url,
            body={
                "startDate": start.isoformat(),
                "endDate": end.isoformat(),
                "dimensions": [dimension],
                "rowLimit": row_limit,
            },
        ).execute()

        return [
            {
                "key": row["keys"][0],
                "clicks": row["clicks"],
                "impressions": row["impressions"],
                "ctr": row["ctr"],
                "position": row["position"],
            }
            for row in response.get("rows", [])
        ]

    def query_totals(self, start: date, end: date) -> dict:
        """Site-wide totals (no dimension breakdown) for a date range."""
        response = self._service.searchanalytics().query(
            siteUrl=self.site_url,
            body={"startDate": start.isoformat(), "endDate": end.isoformat()},
        ).execute()

        rows = response.get("rows", [])
        if not rows:
            return {"clicks": 0, "impressions": 0, "ctr": 0.0, "position": 0.0}

        row = rows[0]
        return {
            "clicks": row["clicks"],
            "impressions": row["impressions"],
            "ctr": row["ctr"],
            "position": row["position"],
        }


def current_and_previous_windows() -> tuple[tuple[date, date], tuple[date, date]]:
    """Two adjacent REPORT_WINDOW_DAYS windows, offset by REPORT_LAG_DAYS from today."""
    end = date.today() - timedelta(days=REPORT_LAG_DAYS)
    start = end - timedelta(days=REPORT_WINDOW_DAYS - 1)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=REPORT_WINDOW_DAYS - 1)
    return (start, end), (prev_start, prev_end)
