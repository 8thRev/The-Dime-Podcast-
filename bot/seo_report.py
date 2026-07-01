"""
Weekly SEO report: pulls Search Console data for the trailing week vs the
week before, and emails a summary of totals, top queries/pages, and the
biggest gainers/losers by clicks.

Runs via .github/workflows/seo-report.yml (weekly cron + manual dispatch).
"""

import sys

from config import config
from email_client import EmailClient
from gsc_client import SearchConsoleClient, current_and_previous_windows

TOP_N = 15
MOVERS_N = 5


def pct_change(current: float, previous: float) -> str:
    if previous == 0:
        return "new" if current > 0 else "0%"
    change = (current - previous) / previous * 100
    sign = "+" if change >= 0 else ""
    return f"{sign}{change:.0f}%"


def build_movers(current_rows: list[dict], previous_rows: list[dict]) -> tuple[list[dict], list[dict]]:
    """Biggest click gainers/losers among terms present in both periods."""
    prev_by_key = {row["key"]: row for row in previous_rows}
    movers = []
    for row in current_rows:
        prev = prev_by_key.get(row["key"])
        if prev is None:
            continue
        movers.append({**row, "prev_clicks": prev["clicks"], "delta": row["clicks"] - prev["clicks"]})

    gainers = sorted(movers, key=lambda r: r["delta"], reverse=True)[:MOVERS_N]
    losers = sorted(movers, key=lambda r: r["delta"])[:MOVERS_N]
    losers = [row for row in losers if row["delta"] < 0]
    return gainers, losers


def rows_table_html(rows: list[dict], key_label: str) -> str:
    if not rows:
        return "<p><em>No data.</em></p>"
    lines = [
        f"<tr><th align='left'>{key_label}</th><th>Clicks</th><th>Impressions</th>"
        "<th>CTR</th><th>Avg Position</th></tr>"
    ]
    for row in rows:
        lines.append(
            f"<tr><td>{row['key']}</td><td align='right'>{row['clicks']}</td>"
            f"<td align='right'>{row['impressions']}</td>"
            f"<td align='right'>{row['ctr'] * 100:.1f}%</td>"
            f"<td align='right'>{row['position']:.1f}</td></tr>"
        )
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def movers_table_html(rows: list[dict], key_label: str) -> str:
    if not rows:
        return "<p><em>None.</em></p>"
    lines = [f"<tr><th align='left'>{key_label}</th><th>Clicks</th><th>Prev.</th><th>Change</th></tr>"]
    for row in rows:
        sign = "+" if row["delta"] >= 0 else ""
        lines.append(
            f"<tr><td>{row['key']}</td><td align='right'>{row['clicks']}</td>"
            f"<td align='right'>{row['prev_clicks']}</td>"
            f"<td align='right'>{sign}{row['delta']}</td></tr>"
        )
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def build_report(gsc: SearchConsoleClient) -> tuple[str, str, str]:
    (start, end), (prev_start, prev_end) = current_and_previous_windows()

    totals = gsc.query_totals(start, end)
    prev_totals = gsc.query_totals(prev_start, prev_end)

    queries = gsc.query(start, end, dimension="query", row_limit=TOP_N)
    prev_queries = gsc.query(prev_start, prev_end, dimension="query", row_limit=250)
    pages = gsc.query(start, end, dimension="page", row_limit=TOP_N)

    # movers are evaluated over a wider current-period pool than the top 15
    # displayed above, so gains further down the list aren't missed
    full_current_queries = gsc.query(start, end, dimension="query", row_limit=250)
    gainers, losers = build_movers(full_current_queries, prev_queries)

    subject = f"SEO report: {start.isoformat()} to {end.isoformat()}"

    text_lines = [
        f"SEO report for {start} to {end} (vs {prev_start} to {prev_end})",
        "",
        f"Clicks: {totals['clicks']} ({pct_change(totals['clicks'], prev_totals['clicks'])})",
        f"Impressions: {totals['impressions']} ({pct_change(totals['impressions'], prev_totals['impressions'])})",
        f"Avg CTR: {totals['ctr'] * 100:.1f}%",
        f"Avg position: {totals['position']:.1f}",
        "",
        "Top queries:",
    ]
    for row in queries:
        text_lines.append(f"  {row['clicks']:>4} clicks  {row['impressions']:>5} impr  pos {row['position']:.1f}  {row['key']}")
    text_lines.append("")
    text_lines.append("Top pages:")
    for row in pages:
        text_lines.append(f"  {row['clicks']:>4} clicks  {row['impressions']:>5} impr  pos {row['position']:.1f}  {row['key']}")
    text_body = "\n".join(text_lines)

    html_body = f"""
    <h2>SEO report: {start} to {end}</h2>
    <p>Compared to previous period: {prev_start} to {prev_end}</p>
    <ul>
      <li>Clicks: <b>{totals['clicks']}</b> ({pct_change(totals['clicks'], prev_totals['clicks'])})</li>
      <li>Impressions: <b>{totals['impressions']}</b> ({pct_change(totals['impressions'], prev_totals['impressions'])})</li>
      <li>Avg CTR: <b>{totals['ctr'] * 100:.1f}%</b></li>
      <li>Avg position: <b>{totals['position']:.1f}</b></li>
    </ul>
    <h3>Top queries</h3>
    {rows_table_html(queries, "Query")}
    <h3>Top pages</h3>
    {rows_table_html(pages, "Page")}
    <h3>Biggest gainers (clicks)</h3>
    {movers_table_html(gainers, "Query")}
    <h3>Biggest losers (clicks)</h3>
    {movers_table_html(losers, "Query")}
    """

    return subject, html_body, text_body


def main() -> int:
    is_valid, missing = config.validate_seo_report_config()
    if not is_valid:
        print("ERROR: Missing required environment variables:")
        for var in missing:
            print(f"  - {var}")
        return 1

    gsc = SearchConsoleClient()
    subject, html_body, text_body = build_report(gsc)

    email_client = EmailClient()
    success = email_client.send_report(subject, html_body, text_body)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
