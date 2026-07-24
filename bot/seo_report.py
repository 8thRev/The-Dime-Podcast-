"""
Weekly SEO report: pulls Search Console data for the trailing week vs the
week before, and emails a summary of totals, top queries/pages, and the
biggest gainers/losers by clicks.

Runs via .github/workflows/seo-report.yml (weekly cron + manual dispatch).
"""

import sys

import requests

from config import config
from email_client import EmailClient
from ga4_client import GA4Client
from gsc_client import SearchConsoleClient, current_and_previous_windows
from simplecast_client import SimplecastClient
from youtube_analytics_client import YouTubeAnalyticsClient
from youtube_client import YouTubeClient

TOP_N = 15
MOVERS_N = 5
YOUTUBE_VIDEO_LIMIT = 10
SIMPLECAST_EPISODE_LIMIT = 10


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


def ga4_pages_table_html(rows: list[dict]) -> str:
    if not rows:
        return "<p><em>No data.</em></p>"
    lines = ["<tr><th align='left'>Page</th><th>Sessions</th><th>Pageviews</th></tr>"]
    for row in rows:
        lines.append(
            f"<tr><td>{row['path']}</td><td align='right'>{row['sessions']}</td>"
            f"<td align='right'>{row['pageviews']}</td></tr>"
        )
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def youtube_table_html(rows: list[dict]) -> str:
    if not rows:
        return "<p><em>No data.</em></p>"
    lines = ["<tr><th align='left'>Title</th><th>Views</th><th>Likes</th><th>Comments</th></tr>"]
    for row in rows:
        lines.append(
            f"<tr><td>{row['title']}</td><td align='right'>{row['views']}</td>"
            f"<td align='right'>{row['likes']}</td><td align='right'>{row['comments']}</td></tr>"
        )
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def simplecast_table_html(rows: list[dict]) -> str:
    if not rows:
        return "<p><em>No data.</em></p>"
    lines = ["<tr><th align='left'>Title</th><th>Published</th><th>Downloads</th></tr>"]
    for row in rows:
        lines.append(
            f"<tr><td>{row['title']}</td><td>{row['published_at']}</td>"
            f"<td align='right'>{row['downloads']}</td></tr>"
        )
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def traffic_sources_table_html(rows: list[dict]) -> str:
    if not rows:
        return "<p><em>No data.</em></p>"
    lines = ["<tr><th align='left'>Source</th><th>Views</th><th>Minutes watched</th></tr>"]
    for row in rows:
        lines.append(
            f"<tr><td>{row['source']}</td><td align='right'>{row['views']}</td>"
            f"<td align='right'>{row['minutes_watched']}</td></tr>"
        )
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def ai_referrer_table_html(by_source: dict[str, int]) -> str:
    if not by_source:
        return "<p><em>No AI-referrer sessions in this window.</em></p>"
    lines = ["<tr><th align='left'>Source / medium</th><th>Sessions</th></tr>"]
    for source, sessions in sorted(by_source.items(), key=lambda kv: kv[1], reverse=True):
        lines.append(f"<tr><td>{source}</td><td align='right'>{sessions}</td></tr>")
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def search_terms_table_html(rows: list[dict]) -> str:
    if not rows:
        return "<p><em>No data.</em></p>"
    lines = ["<tr><th align='left'>Search term</th><th>Views</th></tr>"]
    for row in rows:
        lines.append(f"<tr><td>{row['term']}</td><td align='right'>{row['views']}</td></tr>")
    return "<table border='1' cellpadding='6' cellspacing='0'>" + "".join(lines) + "</table>"


def build_report(
    gsc: SearchConsoleClient,
    ga4: GA4Client | None,
    youtube: YouTubeClient | None,
    youtube_analytics: YouTubeAnalyticsClient | None,
    simplecast: SimplecastClient | None,
) -> tuple[str, str, str]:
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

    ga4_totals = ga4_prev_totals = ga4_pages = ai_referrers = None
    if ga4 is not None:
        ga4_totals = ga4.totals(start, end)
        ga4_prev_totals = ga4.totals(prev_start, prev_end)
        ga4_pages = ga4.top_pages(start, end, row_limit=TOP_N)
        # Trailing 30 days rather than the report's own 7-day window -- AI
        # referral volume is expected to be low, so a longer lookback is
        # needed to tell "genuinely zero" apart from "just a quiet week".
        ai_referrers = ga4.ai_referrer_sessions()

    youtube_videos = None
    if youtube is not None:
        recent = youtube.list_recent_videos(limit=YOUTUBE_VIDEO_LIMIT)
        stats = youtube.get_video_stats([v["id"] for v in recent])
        empty_stats = {"views": 0, "likes": 0, "comments": 0}
        youtube_videos = [{**v, **stats.get(v["id"], empty_stats)} for v in recent]

    yta_totals = yta_prev_totals = yta_sources = yta_search_terms = None
    if youtube_analytics is not None:
        try:
            yta_totals = youtube_analytics.totals(start, end)
            yta_prev_totals = youtube_analytics.totals(prev_start, prev_end)
            yta_sources = youtube_analytics.traffic_sources(start, end, row_limit=TOP_N)
            yta_search_terms = youtube_analytics.top_search_terms(start, end, row_limit=TOP_N)
        except requests.HTTPError as e:
            # Most likely the refresh token predates the yt-analytics.readonly
            # scope being added — skip the section rather than failing the report.
            print(f"YouTube Analytics unavailable, skipping: {e}")
            yta_totals = yta_prev_totals = yta_sources = yta_search_terms = None

    sc_downloads = sc_prev_downloads = sc_episodes = None
    if simplecast is not None:
        sc_downloads = simplecast.downloads_total(start, end)
        sc_prev_downloads = simplecast.downloads_total(prev_start, prev_end)
        sc_episodes = simplecast.recent_episode_downloads(limit=SIMPLECAST_EPISODE_LIMIT)

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

    if ga4_totals is not None:
        text_lines.append("")
        text_lines.append("Site traffic (GA4):")
        text_lines.append(f"  Sessions: {ga4_totals['sessions']} ({pct_change(ga4_totals['sessions'], ga4_prev_totals['sessions'])})")
        text_lines.append(f"  Users: {ga4_totals['users']} ({pct_change(ga4_totals['users'], ga4_prev_totals['users'])})")
        text_lines.append(f"  Pageviews: {ga4_totals['pageviews']} ({pct_change(ga4_totals['pageviews'], ga4_prev_totals['pageviews'])})")
        text_lines.append(f"  Avg session duration: {ga4_totals['avg_session_seconds']:.0f}s")
        text_lines.append("")
        text_lines.append("Top pages by sessions:")
        for row in ga4_pages:
            text_lines.append(f"  {row['sessions']:>4} sessions  {row['pageviews']:>5} pageviews  {row['path']}")

    if ai_referrers is not None:
        text_lines.append("")
        text_lines.append("AI Referrer Sessions (trailing 30 days -- ChatGPT, Perplexity, Claude):")
        text_lines.append(f"  Total: {ai_referrers['total']}")
        for source, sessions in sorted(ai_referrers["by_source"].items(), key=lambda kv: kv[1], reverse=True):
            text_lines.append(f"  {sessions:>4} sessions  {source}")

    if youtube_videos is not None:
        text_lines.append("")
        text_lines.append("Recent YouTube episodes:")
        for v in youtube_videos:
            text_lines.append(f"  {v['views']:>6} views  {v['likes']:>4} likes  {v['comments']:>3} comments  {v['title']}")

    if yta_totals is not None:
        text_lines.append("")
        text_lines.append("YouTube Analytics:")
        text_lines.append(f"  Views: {yta_totals['views']} ({pct_change(yta_totals['views'], yta_prev_totals['views'])})")
        text_lines.append(f"  Minutes watched: {yta_totals['minutes_watched']} ({pct_change(yta_totals['minutes_watched'], yta_prev_totals['minutes_watched'])})")
        text_lines.append(f"  Avg view duration: {yta_totals['avg_view_duration_seconds']:.0f}s")
        text_lines.append(f"  Subscribers gained/lost: +{yta_totals['subscribers_gained']} / -{yta_totals['subscribers_lost']}")
        text_lines.append("")
        text_lines.append("Traffic sources:")
        for row in yta_sources:
            text_lines.append(f"  {row['views']:>6} views  {row['minutes_watched']:>6} min  {row['source']}")
        text_lines.append("")
        text_lines.append("Top YouTube search terms:")
        for row in yta_search_terms:
            text_lines.append(f"  {row['views']:>6} views  {row['term']}")

    if sc_downloads is not None:
        text_lines.append("")
        text_lines.append("Podcast downloads (Simplecast):")
        text_lines.append(f"  Downloads: {sc_downloads} ({pct_change(sc_downloads, sc_prev_downloads)})")
        text_lines.append("")
        text_lines.append("Recent episodes (lifetime downloads):")
        for ep in sc_episodes:
            text_lines.append(f"  {ep['downloads']:>6} downloads  {ep['published_at']}  {ep['title']}")

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

    if ga4_totals is not None:
        html_body += f"""
        <h2>Site traffic (GA4)</h2>
        <ul>
          <li>Sessions: <b>{ga4_totals['sessions']}</b> ({pct_change(ga4_totals['sessions'], ga4_prev_totals['sessions'])})</li>
          <li>Users: <b>{ga4_totals['users']}</b> ({pct_change(ga4_totals['users'], ga4_prev_totals['users'])})</li>
          <li>Pageviews: <b>{ga4_totals['pageviews']}</b> ({pct_change(ga4_totals['pageviews'], ga4_prev_totals['pageviews'])})</li>
          <li>Avg session duration: <b>{ga4_totals['avg_session_seconds']:.0f}s</b></li>
        </ul>
        <h3>Top pages by sessions</h3>
        {ga4_pages_table_html(ga4_pages)}
        """

    if ai_referrers is not None:
        html_body += f"""
        <h2>AI Referrer Sessions</h2>
        <p>Trailing 30 days -- sessions from ChatGPT, Perplexity, or Claude.</p>
        <ul>
          <li>Total: <b>{ai_referrers['total']}</b></li>
        </ul>
        {ai_referrer_table_html(ai_referrers['by_source'])}
        """

    if youtube_videos is not None:
        html_body += f"""
        <h2>Recent YouTube episodes</h2>
        {youtube_table_html(youtube_videos)}
        """

    if yta_totals is not None:
        html_body += f"""
        <h2>YouTube Analytics</h2>
        <ul>
          <li>Views: <b>{yta_totals['views']}</b> ({pct_change(yta_totals['views'], yta_prev_totals['views'])})</li>
          <li>Minutes watched: <b>{yta_totals['minutes_watched']}</b> ({pct_change(yta_totals['minutes_watched'], yta_prev_totals['minutes_watched'])})</li>
          <li>Avg view duration: <b>{yta_totals['avg_view_duration_seconds']:.0f}s</b></li>
          <li>Subscribers gained/lost: <b>+{yta_totals['subscribers_gained']} / -{yta_totals['subscribers_lost']}</b></li>
        </ul>
        <h3>Traffic sources</h3>
        {traffic_sources_table_html(yta_sources)}
        <h3>Top YouTube search terms</h3>
        {search_terms_table_html(yta_search_terms)}
        """

    if sc_downloads is not None:
        html_body += f"""
        <h2>Podcast downloads (Simplecast)</h2>
        <ul>
          <li>Downloads: <b>{sc_downloads}</b> ({pct_change(sc_downloads, sc_prev_downloads)})</li>
        </ul>
        <h3>Recent episodes (lifetime downloads)</h3>
        {simplecast_table_html(sc_episodes)}
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
    ga4 = GA4Client() if config.GA4_PROPERTY_ID else None
    has_youtube_creds = (
        config.YOUTUBE_OAUTH_CLIENT_ID
        and config.YOUTUBE_OAUTH_CLIENT_SECRET
        and config.YOUTUBE_OAUTH_REFRESH_TOKEN
    )
    youtube = YouTubeClient() if has_youtube_creds else None
    youtube_analytics = YouTubeAnalyticsClient() if has_youtube_creds else None
    simplecast = SimplecastClient() if config.SIMPLECAST_API_TOKEN else None
    subject, html_body, text_body = build_report(gsc, ga4, youtube, youtube_analytics, simplecast)

    # Printed unconditionally, before the send attempt, so a downstream SMTP
    # failure (auth, network, whatever) never discards a report that was
    # already fully computed -- the numbers are otherwise gone for good.
    print("=" * 80)
    print(subject)
    print("=" * 80)
    print(text_body)
    print("=" * 80)

    email_client = EmailClient()
    success = email_client.send_report(subject, html_body, text_body)
    return 0 if success else 1


if __name__ == "__main__":
    sys.exit(main())
