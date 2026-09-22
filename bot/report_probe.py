"""
Temporary probe for Weekly Report v2, Phase 1. Deleted before the PR merges.

Calls each candidate endpoint once and prints the HTTP status plus a
truncated response shape, so the real clients are built against what the
APIs actually return rather than against guessed docs. Prints no
credentials and no subscriber emails.
"""

import json
import sys
import traceback
from datetime import date, timedelta

import requests

from config import config

TODAY = date.today()


def show(label, resp, limit=1500):
    try:
        body = json.dumps(resp.json())
    except ValueError:
        body = resp.text
    print(f"\n### {label}: {resp.status_code}\n{body[:limit]}")


def section(name, fn):
    print(f"\n\n======== {name} ========")
    try:
        fn()
    except Exception:
        traceback.print_exc(file=sys.stdout)


def simplecast():
    from simplecast_client import API_BASE, PODCAST_ID

    h = {"Authorization": f"Bearer {config.SIMPLECAST_API_TOKEN}"}

    def get(path, **params):
        return requests.get(f"{API_BASE}{path}", headers=h, params=params, timeout=30)

    eps = get(f"/podcasts/{PODCAST_ID}/episodes", limit=5)
    show("podcast episodes", eps, 2500)
    items = eps.json().get("collection", []) if eps.ok else []
    ep = items[1] if len(items) > 1 else (items[0] if items else None)

    d28 = (TODAY - timedelta(days=28)).isoformat()
    show("downloads podcast 28d", get("/analytics/downloads", podcast=PODCAST_ID, start_date=d28, end_date=TODAY.isoformat()))
    show("downloads podcast 28d interval=day", get("/analytics/downloads", podcast=PODCAST_ID, start_date=d28, end_date=TODAY.isoformat(), interval="day"))
    show("analytics/episodes", get("/analytics/episodes", podcast=PODCAST_ID, limit=3))
    if ep:
        pub = (ep.get("published_at") or "")[:10]
        print(f"\nprobe episode: {ep.get('id')} {ep.get('title')} published {pub}")
        show("downloads episode interval=day", get("/analytics/downloads", episode=ep["id"], start_date=pub, end_date=TODAY.isoformat(), interval="day"), 3000)
        show("downloads episode no dates", get("/analytics/downloads", episode=ep["id"]), 3000)
    for path in [
        "/analytics/technology/applications",
        "/analytics/technology/listening_methods",
        "/analytics/location",
        "/analytics/location/countries",
        "/analytics/audience",
        "/analytics/listeners",
        "/analytics/downloads/unique",
        "/analytics",
    ]:
        show(path, get(path, podcast=PODCAST_ID, start_date=d28, end_date=TODAY.isoformat()), 1200)


def kit():
    h = {"X-Kit-Api-Key": config.KIT_API_KEY, "Accept": "application/json"}
    base = "https://api.kit.com/v4"

    def get(path, **params):
        return requests.get(f"{base}{path}", headers=h, params=params, timeout=30)

    acct = get("/account")
    print(f"\n### account: {acct.status_code} keys={list(acct.json()) if acct.ok else acct.text[:300]}")
    subs = get("/subscribers", status="active", include_total_count="true", per_page=1)
    print(f"\n### subscribers active: {subs.status_code} pagination={subs.json().get('pagination') if subs.ok else subs.text[:300]}")
    wk = (TODAY - timedelta(days=7)).isoformat()
    show("growth_stats 7d", get("/account/growth_stats", starting=wk, ending=TODAY.isoformat()))
    b = get("/broadcasts", per_page=5)
    if b.ok:
        rows = b.json().get("broadcasts", [])
        print(f"\n### broadcasts: {b.status_code} pagination={b.json().get('pagination')}")
        if rows:
            print(f"broadcast keys: {list(rows[0])}")
        for r in rows:
            print(f"  id={r.get('id')} send_at={r.get('send_at')} published_at={r.get('published_at')} subject={r.get('subject')!r}")
        if rows:
            show("broadcast stats single", get(f"/broadcasts/{rows[0]['id']}/stats"))
        show("broadcasts/stats bulk", get("/broadcasts/stats", per_page=3))
    else:
        show("broadcasts", b)


def youtube():
    from youtube_analytics_client import API_BASE, YouTubeAnalyticsClient
    from youtube_client import API_BASE as DATA_BASE, CHANNEL_ID

    yta = YouTubeAnalyticsClient()
    h = yta._headers()
    s28 = (TODAY - timedelta(days=28)).isoformat()

    def rep(label, **params):
        p = {"ids": f"channel=={CHANNEL_ID}", "startDate": s28, "endDate": TODAY.isoformat(), **params}
        show(label, requests.get(API_BASE, params=p, headers=h, timeout=30), 1500)

    show("channel statistics", requests.get(f"{DATA_BASE}/channels", params={"part": "statistics", "id": CHANNEL_ID}, headers=h, timeout=30))
    rep("per video core", dimensions="video", metrics="views,averageViewDuration,averageViewPercentage,subscribersGained", sort="-views", maxResults=5)
    rep("per video thumbnail impressions", dimensions="video", metrics="videoThumbnailImpressions,videoThumbnailImpressionsClickRate", sort="-videoThumbnailImpressions", maxResults=5)
    rep("impressions (legacy name)", dimensions="video", metrics="impressions,impressionClickThroughRate", maxResults=5)
    top = requests.get(API_BASE, params={"ids": f"channel=={CHANNEL_ID}", "startDate": s28, "endDate": TODAY.isoformat(), "dimensions": "video", "metrics": "views", "sort": "-views", "maxResults": 1}, headers=h, timeout=30).json()
    vid = (top.get("rows") or [[None]])[0][0]
    print(f"\nprobe video: {vid}")
    if vid:
        rep("video by day", dimensions="day", filters=f"video=={vid}", metrics="views")
        rep("video traffic sources", dimensions="insightTrafficSourceType", filters=f"video=={vid}", metrics="views")
        rep("video retention", dimensions="elapsedVideoTimeRatio", filters=f"video=={vid}", metrics="audienceWatchRatio", startDate="2020-01-01")
    rep("lifetime per video", dimensions="video", metrics="views", sort="-views", maxResults=3, startDate="2015-01-01")
    rb = "https://youtubereporting.googleapis.com/v1"
    rt = requests.get(f"{rb}/reportTypes", headers=h, timeout=30)
    if rt.ok:
        print(f"\n### reporting reportTypes: {[t['id'] for t in rt.json().get('reportTypes', [])]}")
    else:
        show("reporting reportTypes", rt)
    show("reporting jobs", requests.get(f"{rb}/jobs", headers=h, timeout=30))


def gsc():
    from gsc_client import SearchConsoleClient

    c = SearchConsoleClient()
    end = TODAY - timedelta(days=3)
    body = {"startDate": (end - timedelta(days=27)).isoformat(), "endDate": end.isoformat(), "dimensions": ["page", "query"], "rowLimit": 5}
    r = c._service.searchanalytics().query(siteUrl=c.site_url, body=body).execute()
    print(f"\n### page+query 28d sample: {json.dumps(r)[:1200]}")
    body = {"startDate": (end - timedelta(days=486)).isoformat(), "endDate": end.isoformat(), "dimensions": ["date"], "rowLimit": 3}
    r = c._service.searchanalytics().query(siteUrl=c.site_url, body=body).execute()
    print(f"\n### earliest dates in 16mo: {json.dumps(r)[:600]}")


def ga4():
    from ga4_client import GA4Client
    from google.analytics.data_v1beta.types import (
        DateRange, Dimension, Filter, FilterExpression, Metric, RunReportRequest,
    )

    g = GA4Client()
    dr = [DateRange(start_date=(TODAY - timedelta(days=7)).isoformat(), end_date="yesterday")]

    def run(label, dims, mets, flt=None, limit=15):
        req = RunReportRequest(
            property=g.property, date_ranges=dr,
            dimensions=[Dimension(name=d) for d in dims],
            metrics=[Metric(name=m) for m in mets],
            dimension_filter=flt, limit=limit,
        )
        resp = g._client.run_report(req)
        print(f"\n### {label}: {len(resp.rows)} rows")
        for row in resp.rows:
            print("  ", [v.value for v in row.dimension_values], [v.value for v in row.metric_values])

    run("channel group", ["sessionDefaultChannelGroup"], ["sessions"])
    run("landing page", ["landingPage"], ["sessions", "userEngagementDuration", "averageSessionDuration"], limit=5)
    run("page_view path=/ by location", ["pagePath", "pageLocation"], ["eventCount"],
        FilterExpression(and_group={"expressions": [
            FilterExpression(filter=Filter(field_name="eventName", string_filter=Filter.StringFilter(value="page_view"))),
            FilterExpression(filter=Filter(field_name="pagePath", string_filter=Filter.StringFilter(value="/"))),
        ]}), limit=10)
    run("event counts", ["eventName"], ["eventCount"], limit=50)
    run("audio_progress by percent", ["customEvent:percent_played"], ["eventCount"],
        FilterExpression(filter=Filter(field_name="eventName", string_filter=Filter.StringFilter(value="audio_progress"))))


if __name__ == "__main__":
    for name, fn in [("SIMPLECAST", simplecast), ("KIT", kit), ("YOUTUBE", youtube), ("GSC", gsc), ("GA4", ga4)]:
        section(name, fn)
