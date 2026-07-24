"""
Google Analytics 4 client for the SEO report (traffic data alongside
Search Console query data).
"""

from datetime import date, timedelta

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

# Substrings matched (case-insensitive) against sessionSourceMedium values
# like "chatgpt.com / referral" to identify sessions referred by AI chat
# products, as opposed to organic/search/social traffic.
AI_REFERRER_SOURCES = ["chatgpt.com", "perplexity.ai", "claude.ai"]


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

    def sessions_by_source(self, start: date, end: date, row_limit: int = 100) -> list[dict]:
        """Sessions by session source/medium for a date range, ordered by sessions desc.

        Uses sessionSourceMedium (e.g. "chatgpt.com / referral", "google / organic")
        rather than bare sessionSource so referral traffic is distinguishable from
        other channels sharing the same source name.
        """
        request = RunReportRequest(
            property=self.property,
            date_ranges=[DateRange(start_date=start.isoformat(), end_date=end.isoformat())],
            dimensions=[Dimension(name="sessionSourceMedium")],
            metrics=[Metric(name="sessions")],
            order_bys=[OrderBy(metric=OrderBy.MetricOrderBy(metric_name="sessions"), desc=True)],
            limit=row_limit,
        )
        response = self._client.run_report(request)

        return [
            {
                "source": row.dimension_values[0].value,
                "sessions": int(row.metric_values[0].value),
            }
            for row in response.rows
        ]

    def ai_referrer_sessions(self, start: date | None = None, end: date | None = None) -> dict:
        """Sessions referred by known AI products (ChatGPT, Perplexity, Claude).

        AI-referral volume is expected to be low, so this defaults to a trailing
        30-day window rather than the 7-day window the rest of the report uses --
        a week is too short a lookback to reliably show whether it's nonzero.
        Pass start/end explicitly to match the report's own window instead.

        Returns {"total": int, "by_source": {sessionSourceMedium: sessions}} for
        the sources that matched, so callers can render both a headline number
        and a breakdown by AI product.
        """
        if end is None:
            end = date.today()
        if start is None:
            start = end - timedelta(days=30)

        rows = self.sessions_by_source(start, end, row_limit=250)

        by_source: dict[str, int] = {}
        for row in rows:
            source = row["source"]
            if any(needle in source.lower() for needle in AI_REFERRER_SOURCES):
                by_source[source] = by_source.get(source, 0) + row["sessions"]

        return {"total": sum(by_source.values()), "by_source": by_source}
