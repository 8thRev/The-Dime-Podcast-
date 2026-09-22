"""
Weekly Report v2 data layer: pulls every source, normalizes episodes by age,
attaches baselines, and returns one JSON serializable snapshot.

The report answers three questions, in this order of priority:
  1. Is AI citing us more?   ai_visibility, AI referrals (site and YouTube)
  2. Is search finding us?   YouTube search, non branded Google queries
  3. Is the base holding?    day 7 and day 30 downloads, follower counts

Each source is collected independently. A failing source is recorded as
{"status": "unavailable", "error": ...} and the rest of the snapshot still
builds; nothing here raises for a single bad credential or API outage.
See docs/report-v2-spec.md.
"""

import csv
import json
import os
import re
import time
import traceback
from datetime import date, datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path
from urllib.parse import urlparse

import baselines
import simplecast_feed

REPO_ROOT = Path(__file__).resolve().parent.parent
VIDEOS_PATH = REPO_ROOT / "app" / "content" / "videos.json"
VIDEO_MAP_PATH = REPO_ROOT / "app" / "content" / "video-episode-map.json"
OVERRIDES_PATH = REPO_ROOT / "data" / "video_episode_overrides.csv"
FOLLOWERS_PATH = REPO_ROOT / "data" / "platform_followers.csv"
REACH_PATH = REPO_ROOT / "data" / "reach.csv"
SITE = "https://www.dimepodcast.com"

EPISODE_LOOKBACK_DAYS = 400
UNMAPPED_VIDEO_DAYS = 60
BROADCAST_LOOKBACK_DAYS = 90
# A broadcast is matched to the episode published closest to it within this
# window: up to 2 days before the episode (scheduled ahead) or 7 days after.
BROADCAST_MATCH_BEFORE_DAYS = 2
BROADCAST_MATCH_AFTER_DAYS = 7
GSC_LAG_DAYS = 3
# Search opportunities: queries a page ranks for just off the top results.
# Wider than the spec's 8 to 20 / 20 impressions because at the site's
# current volume nothing clears that bar; tighten as impressions grow.
OPPORTUNITY_MIN_POSITION = 5
OPPORTUNITY_MAX_POSITION = 30
OPPORTUNITY_MIN_IMPRESSIONS = 10
TREND_WEEKS = 8
BRAND_QUERY = re.compile(r"\bdime\b", re.IGNORECASE)
# Full sentence questions and long queries: the closest proxy for AI style
# searches, since Google reports AI Mode queries inside Search Console.
QUESTION_QUERY = re.compile(
    r"^(who|what|when|where|why|how|is|are|can|could|does|do|did|should|will|which)\b", re.IGNORECASE
)
QUESTION_MIN_WORDS = 7
BOT_HOMEPAGE_SHARE = 0.70
BOT_MAX_ENGAGEMENT_SECONDS = 15
RETENTION_SECONDS = 30
FOLLOWERS_STALE_DAYS = 10
KEY_EVENTS = [
    "newsletter_signup",
    "platform_subscribe_click",
    "video_progress",
    "sponsor_inquiry_submit",
    "guest_inquiry_submit",
]
# Referrers counted as AI assistants, for GA4 sessions and YouTube external
# traffic. GA4's own "AI Assistant" channel group is counted too.
AI_REFERRER_DOMAINS = [
    "chatgpt.com", "chat.openai.com", "openai.com", "perplexity.ai", "claude.ai",
    "gemini.google.com", "bard.google.com", "copilot.microsoft.com", "meta.ai",
    "you.com", "grok.com", "deepseek.com", "poe.com", "phind.com", "mistral.ai",
]

# Environment variables whose values must never reach logs or the JSON.
SECRET_ENV_NAMES = [
    "SIMPLECAST_API_TOKEN",
    "KIT_API_KEY",
    "YOUTUBE_OAUTH_CLIENT_ID",
    "YOUTUBE_OAUTH_CLIENT_SECRET",
    "YOUTUBE_OAUTH_REFRESH_TOKEN",
    "GSC_SERVICE_ACCOUNT_JSON",
    "GA4_PROPERTY_ID",
    "ANTHROPIC_API_KEY",
    "EMAIL_PASSWORD",
    "KV_REST_API_TOKEN",
    "UPSTASH_REDIS_REST_TOKEN",
]
AGENT_TOP_PAGES = 25


def scrub(text: str) -> str:
    """Replace any secret value that appears in `text` with ***."""
    for name in SECRET_ENV_NAMES:
        value = os.getenv(name, "")
        if len(value) >= 6:
            text = text.replace(value, "***")
    return text


class Sources:
    """Records ok/unavailable per source and runs collectors safely."""

    def __init__(self):
        self.status: dict[str, dict] = {}

    def run(self, name: str, fn, *args):
        started = time.monotonic()
        try:
            result = fn(*args)
            self.status.setdefault(name, {"status": "ok", "error": None})
            print(f"[{name}] {getattr(fn, '__name__', 'step')} done in {time.monotonic() - started:.0f}s", flush=True)
            return result
        except Exception as e:
            msg = scrub(f"{type(e).__name__}: {e}")[:500]
            print(f"[{name}] unavailable: {msg}")
            print(scrub(traceback.format_exc())[-1500:])
            self.status[name] = {"status": "unavailable", "error": msg}
            return None

    def missing(self, name: str, why: str = "credentials not configured") -> None:
        self.status[name] = {"status": "unavailable", "error": why}
        print(f"[{name}] unavailable: {why}")

    def ok(self, name: str) -> bool:
        return self.status.get(name, {}).get("status") == "ok"


def _published_date(iso: str) -> date:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).date()


def _trailing_sum(daily: dict[str, int], end: date, days: int) -> int:
    start = end - timedelta(days=days - 1)
    return sum(v for d, v in daily.items() if start <= date.fromisoformat(d) <= end)


def _iso_duration_seconds(duration: str) -> int:
    from youtube_client import _parse_iso8601_duration
    return _parse_iso8601_duration(duration)


def _week_buckets(end: date, weeks: int = TREND_WEEKS) -> list[tuple[date, date]]:
    """Consecutive 7 day windows ending on `end`, oldest first."""
    out = []
    for i in range(weeks - 1, -1, -1):
        week_end = end - timedelta(days=7 * i)
        out.append((week_end - timedelta(days=6), week_end))
    return out


def _is_ai_domain(value: str) -> bool:
    v = value.lower()
    return any(d in v for d in AI_REFERRER_DOMAINS)


# ---------------------------------------------------------------- episodes

def episodes_from_simplecast(sc, today: date) -> list[dict]:
    cutoff = today - timedelta(days=EPISODE_LOOKBACK_DAYS)
    out = []
    for ep in sc.list_published_episodes():
        pub = _published_date(ep["published_at"])
        if pub < cutoff or ep.get("type") not in (None, "full"):
            continue
        out.append({
            "id": ep["id"],
            "title": ep["title"],
            "slug": simplecast_feed.slugify(ep["title"]),
            "number": ep.get("number"),
            "published_at": pub.isoformat(),
        })
    return out


def episodes_from_rss(today: date) -> list[dict]:
    """Fallback episode list when Simplecast's API is down: the public feed
    has titles and dates, just no Simplecast ids."""
    cutoff = today - timedelta(days=EPISODE_LOOKBACK_DAYS)
    out = []
    for ep in simplecast_feed.fetch_episodes():
        pub = parsedate_to_datetime(ep["pubDate"]).date()
        if pub < cutoff:
            continue
        out.append({"id": None, "title": ep["title"], "slug": ep["slug"], "number": None, "published_at": pub.isoformat()})
    return out


def collect_downloads(sc, episodes: list[dict], as_of: date) -> None:
    for ep in episodes:
        if not ep["id"]:
            ep["downloads"] = None
            continue
        daily = sc.episode_daily_downloads(ep["id"])
        pub = date.fromisoformat(ep["published_at"])
        ep["downloads"] = {
            **baselines.day_n_values(daily, pub, as_of),
            "lifetime": sum(daily.values()),
            "trailing_7d": _trailing_sum(daily, as_of, 7),
            "trailing_28d": _trailing_sum(daily, as_of, 28),
        }


def collect_podcast(sc, today: date) -> dict:
    end = today - timedelta(days=1)
    start = end - timedelta(days=27)
    prev_end = start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=27)
    listeners = sc.listeners(start, end)
    prev_listeners = sc.listeners(prev_start, prev_end)
    return {
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "downloads_28d": sum(sc.podcast_daily_downloads(start, end).values()),
        "downloads_by_app_28d": sc.downloads_by_app(start, end),
        "downloads_by_country_28d": sc.downloads_by_country(start, end),
        "listeners_28d": listeners["total"],
        "listeners_28d_daily_sum": listeners["daily_sum"],
        "listeners_prev_28d": prev_listeners["total"],
    }


# ---------------------------------------------------------------- youtube

def load_video_catalog() -> dict[str, dict]:
    videos = json.loads(VIDEOS_PATH.read_text(encoding="utf-8"))
    return {v["id"]: v for v in videos}


def load_video_map() -> dict[str, list[str]]:
    """Episode slug -> video ids, from the auto built map, with any rows in
    data/video_episode_overrides.csv replacing the map for that slug."""
    mapping = json.loads(VIDEO_MAP_PATH.read_text(encoding="utf-8"))
    if OVERRIDES_PATH.exists():
        overrides: dict[str, list[str]] = {}
        with OVERRIDES_PATH.open(encoding="utf-8") as f:
            for row in csv.DictReader(f):
                slug = (row.get("episode_slug") or "").strip()
                vid = (row.get("video_id") or "").strip()
                if slug and vid:
                    overrides.setdefault(slug, []).append(vid)
        mapping.update(overrides)
    return mapping


def assign_videos(episodes: list[dict], mapping: dict, catalog: dict, today: date) -> list[dict]:
    """Sets ep["video_id"] (the earliest full length upload mapped to the
    episode) and returns recent catalog videos no episode claims."""
    for ep in episodes:
        ids = [v for v in mapping.get(ep["slug"], []) if v in catalog]
        ids.sort(key=lambda v: catalog[v]["publishedAt"])
        ep["video_id"] = ids[0] if ids else None
    claimed = {v for ids in mapping.values() for v in ids}
    cutoff = today - timedelta(days=UNMAPPED_VIDEO_DAYS)
    return [
        {"video_id": v["id"], "title": v["title"], "published_at": v["publishedAt"][:10]}
        for v in catalog.values()
        if v["id"] not in claimed and _published_date(v["publishedAt"]) >= cutoff
    ]


def _retention_at(curve: list[tuple[float, float]], duration_seconds: int, seconds: int) -> float | None:
    if not curve or not duration_seconds:
        return None
    target = seconds / duration_seconds
    for ratio, watch in curve:
        if ratio >= target:
            return round(watch, 4)
    return None


EMPTY_TOTALS = {"views": 0, "average_view_duration": 0.0, "average_view_percentage": 0.0, "subscribers_gained": 0}


def collect_youtube(yta, episodes: list[dict], catalog: dict, today: date) -> dict:
    as_of = yta.last_data_date()
    end = as_of or today - timedelta(days=3)
    start_28 = end - timedelta(days=27)
    start_7 = end - timedelta(days=6)

    video_ids = [ep["video_id"] for ep in episodes if ep.get("video_id")]
    trailing = yta.per_video_totals(start_28, end, video_ids) if video_ids else {}
    lifetime = yta.per_video_totals(date(2015, 1, 1), end, video_ids) if video_ids else {}

    for ep in episodes:
        vid = ep.get("video_id")
        if not vid:
            ep["youtube"] = None
            continue
        video = catalog[vid]
        pub = _published_date(video["publishedAt"])
        if pub > end:
            # Published after the Analytics API's last complete day; nothing to query yet.
            ep["youtube"] = {"video_id": vid, "published_at": pub.isoformat(), "pending_analytics": True}
            continue
        window_end = min(end, pub + timedelta(days=89))
        try:
            daily = yta.video_daily(vid, pub, window_end)
            search_daily = {d: s.get("YT_SEARCH", 0) for d, s in yta.daily_views_by_source(pub, window_end, vid).items()}
            curve = yta.video_retention(vid, pub, end)
        except Exception as e:
            # One video's queries failing (after retries) must not take the
            # whole YouTube section down with it.
            msg = scrub(f"{type(e).__name__}: {e}")[:300]
            print(f"[youtube] video {vid} unavailable: {msg}")
            ep["youtube"] = {"video_id": vid, "published_at": pub.isoformat(), "analytics_unavailable": True, "error": msg}
            continue
        views_daily = {d: r["views"] for d, r in daily.items()}
        duration = _iso_duration_seconds(video.get("durationISO", ""))
        ep["youtube"] = {
            "video_id": vid,
            "published_at": pub.isoformat(),
            "duration_seconds": duration,
            **{f"views_{k}": v for k, v in baselines.day_n_values(views_daily, pub, as_of).items()},
            **{f"search_views_{k}": v for k, v in baselines.day_n_values(search_daily, pub, as_of).items()},
            "average_view_percentage_day_7": baselines.weighted_average(daily, pub, 7, as_of, "average_view_percentage"),
            "trailing_28d": trailing.get(vid, dict(EMPTY_TOTALS)),
            "lifetime": lifetime.get(vid, dict(EMPTY_TOTALS)),
            "traffic_sources_28d": yta.video_traffic_sources(vid, start_28, end),
            "retention_30s": _retention_at(curve, duration, RETENTION_SECONDS),
            # Filled from the Reporting API by collect_youtube_reach when its
            # reports exist; explicit nulls until then.
            "impressions_28d": None,
            "impression_ctr_28d": None,
            "search_impressions_28d": None,
            "search_impression_ctr_28d": None,
        }

    by_day = yta.daily_views_by_source(end - timedelta(days=7 * TREND_WEEKS - 1), end)
    weekly = []
    for ws, we in _week_buckets(end):
        views = search = 0
        for d, sources in by_day.items():
            if ws <= date.fromisoformat(d) <= we:
                views += sum(sources.values())
                search += sources.get("YT_SEARCH", 0)
        weekly.append({
            "week_start": ws.isoformat(), "week_end": we.isoformat(), "views": views,
            "search_views": search, "search_share": round(search / views, 3) if views else None,
        })

    try:
        referrers = yta.external_referrers(start_28, end)
        ai_referrers = {d: v for d, v in referrers.items() if _is_ai_domain(d)}
        ai_referrer_views = sum(ai_referrers.values())
    except Exception as e:
        print(f"[youtube] external referrers unavailable: {scrub(str(e))[:300]}")
        referrers, ai_referrers, ai_referrer_views = None, None, None
    week = yta.totals(start_7, end)
    month = yta.totals(start_28, end)
    return {
        "last_data_date": as_of.isoformat() if as_of else None,
        "window_28d": {"start": start_28.isoformat(), "end": end.isoformat()},
        "subscribers": yta.channel_subscriber_count(),
        "subscribers_gained_week": week["subscribers_gained"],
        "subscribers_lost_week": week["subscribers_lost"],
        "subscribers_net_28d": month["subscribers_gained"] - month["subscribers_lost"],
        "views_week": week["views"],
        "search_views_weekly": weekly,
        "top_search_terms_28d": yta.top_search_terms(start_28, end, row_limit=25),
        "external_referrers_28d": referrers,
        "ai_referrer_views_28d": ai_referrer_views,
        "ai_referrers_28d": ai_referrers,
        "reach_report": None,
    }


def collect_youtube_reach(reporting, episodes: list[dict], youtube_channel: dict) -> dict:
    """Impressions and CTR from the Reporting API job, per video and channel
    wide. Creates the job on first run; reports then take about two days to
    appear, so an empty result is "pending", not a failure."""
    from youtube_reporting_client import summarize_reach

    job_id, created = reporting.ensure_job()
    window = youtube_channel["window_28d"]
    rows = reporting.reach_rows(job_id, date.fromisoformat(window["start"]), date.fromisoformat(window["end"]))
    summary = summarize_reach(rows)
    for ep in episodes:
        yt = ep.get("youtube")
        usable = yt and not yt.get("pending_analytics") and not yt.get("analytics_unavailable")
        stats = summary["per_video"].get(yt.get("video_id")) if usable else None
        if stats:
            yt["impressions_28d"] = stats["impressions"]
            yt["impression_ctr_28d"] = stats["ctr"]
            yt["search_impressions_28d"] = stats["search_impressions"]
            yt["search_impression_ctr_28d"] = stats["search_ctr"]
    status = "ok" if summary["days_covered"] else "pending"
    return {
        "status": status,
        "job_created_this_run": created,
        "days_covered": summary["days_covered"],
        "channel": summary["channel"],
        "note": None if status == "ok" else "Reporting job exists; YouTube has not published reports yet (about 2 days after creation).",
    }


# ---------------------------------------------------------------- kit

def collect_kit(kit, episodes: list[dict], today: date) -> dict:
    week_start = today - timedelta(days=7)
    month_start = today - timedelta(days=28)
    broadcasts = kit.broadcasts_since(today - timedelta(days=BROADCAST_LOOKBACK_DAYS))
    unmatched = []
    for b in broadcasts:
        ep = match_broadcast(b, episodes)
        b["episode_slug"] = ep["slug"] if ep else None
        if ep is None:
            unmatched.append({"id": b["id"], "subject": b["subject"], "send_at": b["send_at"]})
        elif "newsletter" not in ep:
            ep["newsletter"] = {k: b[k] for k in ("id", "subject", "send_at", "recipients", "opens", "clicks", "open_rate", "click_rate")}
    return {
        "active_subscribers": kit.active_subscribers(),
        "week": kit.growth_stats(week_start, today),
        "last_28d": kit.growth_stats(month_start, today),
        "broadcasts": broadcasts,
        "unmatched_broadcasts": unmatched,
    }


def match_broadcast(broadcast: dict, episodes: list[dict]) -> dict | None:
    """The episode this broadcast announced. Subjects normally carry the
    episode title ("New Episode of The Dime <title>"), so a title match wins;
    otherwise the closest episode inside the date window."""
    sent = _published_date(broadcast["send_at"])
    subject = broadcast["subject"].lower()
    titled = [ep for ep in episodes if ep["title"].lower() in subject]
    if titled:
        return min(titled, key=lambda ep: abs((sent - date.fromisoformat(ep["published_at"])).days))
    best = None
    for ep in episodes:
        delta = (sent - date.fromisoformat(ep["published_at"])).days
        if -BROADCAST_MATCH_BEFORE_DAYS <= delta <= BROADCAST_MATCH_AFTER_DAYS:
            if best is None or abs(delta) < best[0]:
                best = (abs(delta), ep)
    return best[1] if best else None


# ---------------------------------------------------------------- search console

def is_question_query(query: str) -> bool:
    return bool(QUESTION_QUERY.match(query)) or len(query.split()) >= QUESTION_MIN_WORDS


def _query_split(rows: list[dict]) -> dict:
    brand = {"impressions": 0, "clicks": 0, "queries": 0}
    non_brand = {"impressions": 0, "clicks": 0, "queries": 0}
    for r in rows:
        bucket = brand if BRAND_QUERY.search(r["query"]) else non_brand
        bucket["impressions"] += r["impressions"]
        bucket["clicks"] += r["clicks"]
        bucket["queries"] += 1
    return {"brand": brand, "non_brand": non_brand}


def collect_gsc(gsc, episodes: list[dict], today: date) -> dict:
    end = today - timedelta(days=GSC_LAG_DAYS)
    start_28 = end - timedelta(days=27)
    start_7 = end - timedelta(days=6)
    prev_end = start_28 - timedelta(days=1)
    prev_start = prev_end - timedelta(days=27)

    pages: dict[str, dict] = {}

    def page(url):
        return pages.setdefault(url, {"page": url, "clicks_28d": 0, "impressions_28d": 0, "impressions_7d": 0, "opportunities": []})

    for r in gsc.query_all(start_28, end, ["page", "date"]):
        url, day = r["keys"]
        p = page(url)
        p["clicks_28d"] += r["clicks"]
        p["impressions_28d"] += r["impressions"]
        if date.fromisoformat(day) >= start_7:
            p["impressions_7d"] += r["impressions"]

    for r in gsc.query_all(start_28, end, ["page", "query"]):
        url, query = r["keys"]
        if OPPORTUNITY_MIN_POSITION <= r["position"] <= OPPORTUNITY_MAX_POSITION and r["impressions"] >= OPPORTUNITY_MIN_IMPRESSIONS:
            page(url)["opportunities"].append({
                "query": query,
                "position": round(r["position"], 1),
                "impressions": r["impressions"],
                "clicks": r["clicks"],
            })
    for p in pages.values():
        p["opportunities"].sort(key=lambda o: o["impressions"], reverse=True)

    for ep in episodes:
        url = f"{SITE}/episodes/{ep['slug']}"
        p = pages.get(url)
        ep["search"] = {k: p[k] for k in ("page", "clicks_28d", "impressions_28d", "impressions_7d", "opportunities")} if p else {
            "page": url, "clicks_28d": 0, "impressions_28d": 0, "impressions_7d": 0, "opportunities": []
        }

    # Query level, by day, over the trend window: branded vs non branded,
    # distinct queries, and question style queries. Google omits rare
    # anonymized queries here, so these totals run below the site totals.
    trend_start = end - timedelta(days=7 * TREND_WEEKS - 1)
    daily_queries = gsc.query_all(min(trend_start, prev_start), end, ["date", "query"])

    def aggregate(lo: date, hi: date) -> list[dict]:
        acc: dict[str, dict] = {}
        for r in daily_queries:
            day, query = r["keys"]
            if lo <= date.fromisoformat(day) <= hi:
                a = acc.setdefault(query, {"query": query, "impressions": 0, "clicks": 0, "weighted_position": 0.0})
                a["impressions"] += r["impressions"]
                a["clicks"] += r["clicks"]
                a["weighted_position"] += r["position"] * r["impressions"]
        for a in acc.values():
            a["position"] = round(a.pop("weighted_position") / a["impressions"], 1) if a["impressions"] else None
        return list(acc.values())

    current = aggregate(start_28, end)
    previous = aggregate(prev_start, prev_end)
    questions = sorted((q for q in current if is_question_query(q["query"])), key=lambda q: q["impressions"], reverse=True)
    weekly = []
    for ws, we in _week_buckets(end):
        split = _query_split(aggregate(ws, we))
        weekly.append({"week_start": ws.isoformat(), "week_end": we.isoformat(), **split})

    monthly: dict[str, dict] = {}
    for r in gsc.query_all(end - timedelta(days=486), end, ["date"]):
        m = monthly.setdefault(r["keys"][0][:7], {"month": r["keys"][0][:7], "clicks": 0, "impressions": 0})
        m["clicks"] += r["clicks"]
        m["impressions"] += r["impressions"]

    ranked = sorted(pages.values(), key=lambda p: p["impressions_28d"], reverse=True)
    keep = [p for p in ranked[:200] if p["impressions_28d"] > 0 or p["opportunities"]]
    top_non_brand = sorted((q for q in current if not BRAND_QUERY.search(q["query"])), key=lambda q: q["impressions"], reverse=True)
    return {
        "window_28d": {"start": start_28.isoformat(), "end": end.isoformat()},
        "totals_28d": gsc.query_totals(start_28, end),
        "totals_prev_28d": gsc.query_totals(prev_start, prev_end),
        "queries_28d": _query_split(current),
        "queries_prev_28d": _query_split(previous),
        "top_non_brand_queries_28d": top_non_brand[:25],
        "question_queries_28d": questions[:25],
        "question_query_count_28d": len(questions),
        "weekly": weekly,
        "monthly": sorted(monthly.values(), key=lambda m: m["month"]),
        "pages": keep,
    }


# ---------------------------------------------------------------- ga4

def collect_ga4(ga4, today: date) -> dict:
    end = today - timedelta(days=1)
    start = end - timedelta(days=6)
    by_channel = ga4.sessions_by_channel_group(start, end)
    by_source = ga4.sessions_by_session_source(start, end)
    landing = ga4.landing_page_engagement(start, end)
    total = sum(r["sessions"] for r in landing) or sum(by_channel.values())
    home = [r for r in landing if r["landing_page"] == "/"]
    home_sessions = sum(r["sessions"] for r in home)
    home_engagement = sum(r["engagement_seconds"] for r in home)
    home_share = round(home_sessions / total, 3) if total else 0.0
    home_avg = round(home_engagement / home_sessions, 1) if home_sessions else None

    stale = [
        r for r in ga4.homepage_path_page_views(start, end)
        if urlparse(r["page_location"]).path not in ("", "/")
    ]
    stale_count = sum(r["count"] for r in stale)

    key_events = ga4.event_counts(start, end, KEY_EVENTS)
    key_events["audio_progress_50"] = ga4.audio_progress_count(start, end, 50)

    # Trend and AI referrals. Organic Search and AI Assistant sessions are
    # the site numbers that bots do not inflate.
    trend_start = end - timedelta(days=7 * TREND_WEEKS - 1)
    daily = ga4.daily_sessions_by_channel(trend_start, end)
    weekly = []
    for ws, we in _week_buckets(end):
        acc: dict[str, int] = {}
        for d, channels in daily.items():
            if ws <= date.fromisoformat(d) <= we:
                for ch, n in channels.items():
                    acc[ch] = acc.get(ch, 0) + n
        weekly.append({
            "week_start": ws.isoformat(), "week_end": we.isoformat(), "sessions": sum(acc.values()),
            "organic_search": acc.get("Organic Search", 0), "ai_assistant": acc.get("AI Assistant", 0),
        })

    ai_start = end - timedelta(days=27)
    ai_rows = [
        r for r in ga4.sessions_by_source_channel_landing(ai_start, end)
        if r["channel"] == "AI Assistant" or _is_ai_domain(r["source"])
    ]
    ai_by_source: dict[str, int] = {}
    ai_by_page: dict[str, int] = {}
    for r in ai_rows:
        ai_by_source[r["source"]] = ai_by_source.get(r["source"], 0) + r["sessions"]
        ai_by_page[r["landing_page"]] = ai_by_page.get(r["landing_page"], 0) + r["sessions"]

    direct = by_channel.get("Direct", 0)
    return {
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "sessions": total,
        "sessions_by_channel_group": by_channel,
        "sessions_by_source": by_source,
        "organic_search_sessions": by_channel.get("Organic Search", 0),
        "direct_sessions": direct,
        "direct_share": round(direct / total, 3) if total else 0.0,
        "homepage_landing_share": home_share,
        "homepage_avg_engagement_seconds": home_avg,
        "suspect_bot_traffic": bool(
            home_share > BOT_HOMEPAGE_SHARE and home_avg is not None and home_avg < BOT_MAX_ENGAGEMENT_SECONDS
        ),
        "stale_pageview_count": stale_count,
        "stale_pageview_examples": [r["page_location"] for r in stale[:5]],
        "stale_pageview_bug": stale_count > 0,
        "key_events": key_events,
        "weekly": weekly,
        "ai_referrals_28d": {
            "window": {"start": ai_start.isoformat(), "end": end.isoformat()},
            "sessions": sum(ai_by_source.values()),
            "by_source": ai_by_source,
            "landing_pages": [
                {"page": p, "sessions": n} for p, n in sorted(ai_by_page.items(), key=lambda kv: kv[1], reverse=True)
            ],
        },
    }


# ---------------------------------------------------------------- agent visits

def collect_agent_visits(client, today: date) -> dict:
    """Page fetches by AI agents, from the counters the site middleware
    writes. Retrieval class fetches (an assistant answering a live question
    or indexing for its own search) are the demand signal; training and
    search engine crawls are shown but not headlined."""
    end = today - timedelta(days=1)
    start_28 = end - timedelta(days=27)
    start_7 = end - timedelta(days=6)
    trend_start = end - timedelta(days=7 * TREND_WEEKS - 1)
    daily = client.daily_counts(trend_start, end)

    def rows_between(lo, hi):
        return [r for d, rows in daily.items() if lo <= date.fromisoformat(d) <= hi for r in rows]

    month = rows_between(start_28, end)
    by_class: dict[str, int] = {}
    by_agent: dict[str, int] = {}
    by_page: dict[str, int] = {}
    retrieval_pages: dict[str, int] = {}
    for r in month:
        by_class[r["class"]] = by_class.get(r["class"], 0) + r["count"]
        by_agent[r["agent"]] = by_agent.get(r["agent"], 0) + r["count"]
        by_page[r["path"]] = by_page.get(r["path"], 0) + r["count"]
        if r["class"] == "retrieval":
            retrieval_pages[r["path"]] = retrieval_pages.get(r["path"], 0) + r["count"]

    def top(counts, n=AGENT_TOP_PAGES):
        return [{"path": p, "fetches": c} for p, c in sorted(counts.items(), key=lambda kv: kv[1], reverse=True)[:n]]

    weekly = []
    for ws, we in _week_buckets(end):
        rows = rows_between(ws, we)
        weekly.append({
            "week_start": ws.isoformat(), "week_end": we.isoformat(),
            "fetches": sum(r["count"] for r in rows),
            "retrieval_fetches": sum(r["count"] for r in rows if r["class"] == "retrieval"),
        })

    week = rows_between(start_7, end)
    return {
        "window_28d": {"start": start_28.isoformat(), "end": end.isoformat()},
        "fetches_28d": sum(r["count"] for r in month),
        "retrieval_fetches_28d": by_class.get("retrieval", 0),
        "retrieval_fetches_7d": sum(r["count"] for r in week if r["class"] == "retrieval"),
        "by_class_28d": by_class,
        "by_agent_28d": dict(sorted(by_agent.items(), key=lambda kv: kv[1], reverse=True)),
        "top_pages_28d": top(by_page),
        "top_retrieval_pages_28d": top(retrieval_pages),
        "llms_txt_fetches_28d": by_page.get("/llms.txt", 0) + by_page.get("/llms-full.txt", 0),
        "weekly": weekly,
        "days_with_data": sum(1 for d, rows in daily.items() if rows and start_28 <= date.fromisoformat(d) <= end),
    }


# ---------------------------------------------------------------- manual inputs

def load_platform_followers(today: date) -> dict | None:
    """Apple and Spotify follower counts, entered by hand in
    data/platform_followers.csv because neither platform has an API."""
    if not FOLLOWERS_PATH.exists():
        return None
    with FOLLOWERS_PATH.open(encoding="utf-8") as f:
        rows = [r for r in csv.DictReader(f) if (r.get("date") or "").strip()]
    if not rows:
        return None
    rows.sort(key=lambda r: r["date"])
    latest = rows[-1]
    latest_date = date.fromisoformat(latest["date"])
    older = [r for r in rows if date.fromisoformat(r["date"]) <= latest_date - timedelta(days=28)]
    prior = older[-1] if older else None

    def num(row, key):
        v = (row or {}).get(key, "")
        return int(v) if str(v).strip().isdigit() else None

    def change(key):
        a, b = num(latest, key), num(prior, key)
        return a - b if a is not None and b is not None else None

    return {
        "as_of": latest["date"],
        "stale": (today - latest_date).days > FOLLOWERS_STALE_DAYS,
        "apple_followers": num(latest, "apple_followers"),
        "spotify_followers": num(latest, "spotify_followers"),
        "apple_change_28d": change("apple_followers"),
        "spotify_change_28d": change("spotify_followers"),
    }


# ---------------------------------------------------------------- baselines and reach

def _metric(section: str, field: str, source_ok: bool, missing_reason: str):
    def get(ep):
        if not source_ok:
            return None, "source_unavailable"
        block = ep.get(section)
        if block is None:
            return None, missing_reason
        if block.get("pending_analytics"):
            return None, "analytics_pending"
        if block.get("analytics_unavailable"):
            return None, "video_analytics_unavailable"
        value = block.get(field)
        if value is None:
            return None, f"not_yet_{field}" if "day_" in field else f"no_{field}"
        return value, None
    return get


def attach_all_baselines(episodes: list[dict], sources: Sources) -> None:
    yt_ok = sources.ok("youtube")
    metrics = {}
    for n in baselines.CHECKPOINT_DAYS:
        metrics[f"downloads_day_{n}"] = _metric("downloads", f"day_{n}", sources.ok("simplecast"), "no_simplecast_id")
        metrics[f"youtube_views_day_{n}"] = _metric("youtube", f"views_day_{n}", yt_ok, "no_mapped_video")
    for n in (7, 30):
        metrics[f"youtube_search_views_day_{n}"] = _metric("youtube", f"search_views_day_{n}", yt_ok, "no_mapped_video")
    metrics["youtube_average_view_percentage_day_7"] = _metric(
        "youtube", "average_view_percentage_day_7", yt_ok, "no_mapped_video"
    )
    metrics["youtube_impression_ctr_28d"] = _metric("youtube", "impression_ctr_28d", yt_ok, "no_mapped_video")
    metrics["newsletter_click_rate"] = _metric("newsletter", "click_rate", sources.ok("kit"), "no_matched_broadcast")
    metrics["newsletter_open_rate"] = _metric("newsletter", "open_rate", sources.ok("kit"), "no_matched_broadcast")

    oldest_first = sorted(episodes, key=lambda e: e["published_at"])
    baselines.attach_baselines(oldest_first, metrics)


def _history_change(column: str, value, today: date) -> float | None:
    """Change against the reach.csv row closest to 28 days ago, for series
    that have no native 28 day comparison."""
    if value is None or not REACH_PATH.exists():
        return None
    with REACH_PATH.open(encoding="utf-8", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r.get(column) not in (None, "")]
    cutoff = (today - timedelta(days=28)).isoformat()
    older = [r for r in rows if r["date"] <= cutoff]
    if not older:
        return None
    return round(float(value) - float(older[-1][column]), 1)


def build_reach(podcast, youtube_channel, kit, gsc, ga4, ai, followers, today: date, agents=None) -> dict:
    def entry(value, change, note):
        return {"value": value, "change_28d": change, "note": note}

    ai_rate = ai["citation_rate"] if ai else None
    agent_fetches = agents["retrieval_fetches_28d"] if agents else None
    ai_sessions = ga4["ai_referrals_28d"]["sessions"] if ga4 else None
    non_brand = gsc["queries_28d"]["non_brand"] if gsc else None
    non_brand_prev = gsc["queries_prev_28d"]["non_brand"] if gsc else None
    return {
        "ai_citation_rate": entry(
            ai_rate, _history_change("ai_citation_rate", ai_rate, today),
            "percent of the weekly AI question panel whose answer cites The Dime; change is against the run 28 days earlier.",
        ),
        "ai_agent_fetches_28d": entry(
            agent_fetches, _history_change("ai_agent_fetches_28d", agent_fetches, today),
            "page fetches by retrieval class AI agents (assistants answering live questions and their search indexes) over the trailing 28 days; change is against the run 28 days earlier.",
        ),
        "ai_referral_sessions_28d": entry(
            ai_sessions, _history_change("ai_referral_sessions_28d", ai_sessions, today),
            "GA4 sessions from AI assistants over the trailing 28 days.",
        ),
        "youtube_ai_referral_views_28d": entry(
            youtube_channel["ai_referrer_views_28d"] if youtube_channel else None,
            _history_change("youtube_ai_referral_views_28d", youtube_channel["ai_referrer_views_28d"] if youtube_channel else None, today),
            "YouTube views referred by AI assistant sites over the trailing 28 days.",
        ),
        "youtube_search_views_28d": entry(
            sum(w["search_views"] for w in youtube_channel["search_views_weekly"][-4:]) if youtube_channel else None,
            (sum(w["search_views"] for w in youtube_channel["search_views_weekly"][-4:])
             - sum(w["search_views"] for w in youtube_channel["search_views_weekly"][-8:-4])) if youtube_channel else None,
            "channel views from YouTube search, last 4 weeks against the 4 before.",
        ),
        "non_brand_search_impressions_28d": entry(
            non_brand["impressions"] if non_brand else None,
            non_brand["impressions"] - non_brand_prev["impressions"] if non_brand else None,
            "Google impressions on queries that do not contain the show's name, against the previous 28 days.",
        ),
        "search_impressions_28d": entry(
            gsc["totals_28d"]["impressions"] if gsc else None,
            gsc["totals_28d"]["impressions"] - gsc["totals_prev_28d"]["impressions"] if gsc else None,
            "all Google impressions, against the previous 28 day window.",
        ),
        "podcast_listeners_28d": entry(
            podcast["listeners_28d"] if podcast else None,
            podcast["listeners_28d"] - podcast["listeners_prev_28d"] if podcast else None,
            "Simplecast has no follower count; unique listeners over the trailing 28 days is the proxy.",
        ),
        "apple_followers": entry(
            followers["apple_followers"] if followers else None,
            followers["apple_change_28d"] if followers else None,
            "entered by hand in data/platform_followers.csv.",
        ),
        "spotify_followers": entry(
            followers["spotify_followers"] if followers else None,
            followers["spotify_change_28d"] if followers else None,
            "entered by hand in data/platform_followers.csv.",
        ),
        "youtube_subscribers": entry(
            youtube_channel["subscribers"] if youtube_channel else None,
            youtube_channel["subscribers_net_28d"] if youtube_channel else None,
            "change is subscribers gained minus lost over the trailing 28 days of Analytics data.",
        ),
        "kit_active_subscribers": entry(
            kit["active_subscribers"] if kit else None,
            kit["last_28d"]["net_new_subscribers"] if kit else None,
            "change is Kit net new subscribers over the trailing 28 days.",
        ),
    }


# ---------------------------------------------------------------- entry

def build_snapshot(clients: dict, today: date | None = None) -> dict:
    """clients: {"simplecast", "youtube", "youtube_reporting", "kit", "gsc",
    "ga4", "ai"}, each a client instance or None when its credentials are
    missing. clients["ai"] is a callable taking the set of our video ids."""
    today = today or date.today()
    as_of = today - timedelta(days=1)
    sources = Sources()

    sc = clients.get("simplecast")
    episodes = None
    if sc:
        episodes = sources.run("simplecast", episodes_from_simplecast, sc, today)
    else:
        sources.missing("simplecast")
    if episodes is None:
        episodes = sources.run("rss_feed", episodes_from_rss, today) or []
    if sc and sources.ok("simplecast"):
        sources.run("simplecast", collect_downloads, sc, episodes, as_of)
    podcast = sources.run("simplecast", collect_podcast, sc, today) if sc and sources.ok("simplecast") else None
    for ep in episodes:
        ep.setdefault("downloads", None)

    catalog = sources.run("video_map", load_video_catalog) or {}
    mapping = sources.run("video_map", load_video_map) or {}
    unmapped = assign_videos(episodes, mapping, catalog, today)

    youtube_channel = None
    if clients.get("youtube"):
        youtube_channel = sources.run("youtube", collect_youtube, clients["youtube"], episodes, catalog, today)
    else:
        sources.missing("youtube")
    if youtube_channel is None:
        for ep in episodes:
            ep["youtube"] = None
        sources.missing("youtube_reach", "skipped: YouTube Analytics unavailable")
    else:
        youtube_channel["unmapped_recent_videos"] = unmapped
        if clients.get("youtube_reporting"):
            youtube_channel["reach_report"] = sources.run(
                "youtube_reach", collect_youtube_reach, clients["youtube_reporting"], episodes, youtube_channel
            )
        else:
            sources.missing("youtube_reach")
    for ep in episodes:
        ep.setdefault("youtube", None)

    kit = sources.run("kit", collect_kit, clients["kit"], episodes, today) if clients.get("kit") else sources.missing("kit")
    for ep in episodes:
        ep.setdefault("newsletter", None)

    gsc = sources.run("gsc", collect_gsc, clients["gsc"], episodes, today) if clients.get("gsc") else sources.missing("gsc")
    for ep in episodes:
        ep.setdefault("search", None)

    ga4 = sources.run("ga4", collect_ga4, clients["ga4"], today) if clients.get("ga4") else sources.missing("ga4")

    our_videos = set(catalog)
    ai = sources.run("ai_visibility", clients["ai"], our_videos) if clients.get("ai") else sources.missing("ai_visibility")

    agents = sources.run("agent_visits", collect_agent_visits, clients["agent_visits"], today) if clients.get("agent_visits") else sources.missing("agent_visits")

    followers = sources.run("platform_followers", load_platform_followers, today)

    for ep in episodes:
        ep["age_days"] = (today - date.fromisoformat(ep["published_at"])).days
    attach_all_baselines(episodes, sources)

    return {
        "schema_version": 2,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_date": today.isoformat(),
        "sources": sources.status,
        "episodes": sorted(episodes, key=lambda e: e["published_at"], reverse=True),
        "podcast": podcast,
        "youtube_channel": youtube_channel,
        "kit": kit,
        "search_console": gsc,
        "ga4": ga4,
        "ai_visibility": ai,
        "agent_visits": agents,
        "platform_followers": followers,
        "reach": build_reach(podcast, youtube_channel, kit, gsc, ga4, ai, followers, today, agents),
    }


REACH_COLUMNS = [
    "date",
    "ai_citation_rate",
    "ai_agent_fetches_28d",
    "ai_referral_sessions_28d",
    "youtube_ai_referral_views_28d",
    "youtube_search_views_28d",
    "non_brand_search_impressions_28d",
    "search_impressions_28d",
    "podcast_listeners_28d",
    "apple_followers",
    "spotify_followers",
    "youtube_subscribers",
    "kit_active_subscribers",
]


def append_reach_row(path: Path, snapshot: dict) -> None:
    """One row per run date; rerunning the same day replaces that row.
    Columns added later are left blank on older rows."""
    reach = snapshot["reach"]
    row = {"date": snapshot["run_date"]}
    for col in REACH_COLUMNS[1:]:
        value = reach[col]["value"]
        row[col] = "" if value is None else value
    rows = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as f:
            rows = [r for r in csv.DictReader(f) if r["date"] != row["date"]]
    rows.append(row)
    rows.sort(key=lambda r: r["date"])
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=REACH_COLUMNS, extrasaction="ignore")
        writer.writeheader()
        writer.writerows(rows)
