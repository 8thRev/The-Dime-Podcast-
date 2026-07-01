"""
Google Analytics 4 client for the SEO report (traffic data alongside
Search Console query data).
"""

from datetime import date

from google.analytics.data_v1beta import BetaAnalyticsDataClient
from google.analytics.data_v1beta.types import (
    DateRange,
    Dimension,
    Metric,
    OrderBy,
    RunReportRequest,
)

from config import config
from google_credentials import load_credentials

SCOPES = ["https://www.googleapis.com/auth/analytics.readonly"]


class GA4Client:
    """Client for pulling traffic data from the GA4 Data API."""

    def __init__(self):
        self.property = f"properties/{config.GA4_PROPERTY_ID}"
        self._client = BetaAnalyticsDataClient(credentials=load_credentials(SCOPES))

    def totals(self, start: date, end: date) -> dict:
        """Site-wide totals for a date range: sessions, users, pageviews, avg session duration."""
        request = RunReportRequest(
            property=self.property,
            date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
            metrics=[
                Metric(name="sessions"),
                Metric(name="totalUsers"),
                Metric(name="screenPageViews"),
                Metric(name="averageSessionDuration"),
            ],
        )
        response = self._client.run_report(request)

        if not response.rows:
            return {"sessions": 0, "users": 0, "pageviews": 0, "avg_session_seconds": 0.0}

        values = response.rows[0].metric_values
        return {
            "sessions": int(values[0].value),
            "users": int(values[1].value),
            "pageviews": int(values[2].value),
            "avg_session_seconds": float(values[3].value),
        }

    def top_pages(self, start: date, end: date, row_limit: int = 15) -> list[dict]:
        """Top pages by sessions for a date range."""
        request = RunReportRequest(
            property=self.property,
            date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
            dimensions=[Dimension(name="pagePath")],
            metrics=[Metric(name="sessions"), Metric(name="screenPageViews")],
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
            limit=row_limit,
        )
        response = self._client.run_report(request)

        return [
            {
                "path": row.dimension_values[0].value,
                "sessions": int(row.metric_values[0].value),
                "pageviews": int(row.metric_values[1].value),
            }
            for row in response.rows
        ]
