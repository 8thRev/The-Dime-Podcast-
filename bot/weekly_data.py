"""
Weekly Report v2 data layer: pulls every source, normalizes episodes by age,
attaches baselines, and returns one JSON serializable snapshot.

Each source is collected independently. A failing source is recorded as
{"status": "unavailable", "error": ...} and the rest of the snapshot still
builds; nothing here raises for a single bad credential or API outage.
See docs/report-v2-spec.md.
"""

import csv
import json
import os
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
SITE = "https://www.dimepodcast.com"

EPISODE_LOOKBACK_DAYS = 400
UNMAPPED_VIDEO_DAYS = 60
BROADCAST_LOOKBACK_DAYS = 90
# A broadcast is matched to the episode published closest to it within this
# window: up to 2 days before the episode (scheduled ahead) or 7 days after.
BROADCAST_MATCH_BEFORE_DAYS = 2
BROADCAST_MATCH_AFTER_DAYS = 7
GSC_LAG_DAYS = 3
OPPORTUNITY_MIN_POSITION = 8
OPPORTUNITY_MAX_POSITION = 20
OPPORTUNITY_MIN_IMPRESSIONS = 20
BOT_HOMEPAGE_SHARE = 0.70
BOT_MAX_ENGAGEMENT_SECONDS = 15
RETENTION_SECONDS = 30
KEY_EVENTS = [
    "newsletter_signup",
    "platform_subscribe_click",
    "video_progress",
    "sponsor_inquiry_submit",
    "guest_inquiry_submit",
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
]


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
        try:
            result = fn(*args)
            self.status.setdefault(name, {"status": "ok", "error": None})
            return result
        except Exception as e:
            msg = scrub(f"{type(e).__name__}: {e}")[:500]
            print(f"[{name}] unavailable: {msg}")
            print(scrub(traceback.format_exc())[-1500:])
            self.status[name] = {"status": "unavailable", "error": msg}
            return None

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
        ep["video_ids"] = ids
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
        daily = yta.video_daily(vid, pub, min(end, pub + timedelta(days=89)))
        views_daily = {d: r["views"] for d, r in daily.items()}
        duration = _iso_duration_seconds(video.get("durationISO", ""))
        curve = yta.video_retention(vid, pub, end)
        ep["youtube"] = {
            "video_id": vid,
            "published_at": pub.isoformat(),
            "duration_seconds": duration,
            **{f"views_{k}": v for k, v in baselines.day_n_values(views_daily, pub, as_of).items()},
            "average_view_percentage_day_7": baselines.weighted_average(daily, pub, 7, as_of, "average_view_percentage"),
            "trailing_28d": trailing.get(vid, {"views": 0, "average_view_duration": 0.0, "average_view_percentage": 0.0, "subscribers_gained": 0}),
            "lifetime": lifetime.get(vid, {"views": 0, "average_view_duration": 0.0, "average_view_percentage": 0.0, "subscribers_gained": 0}),
            "traffic_sources_28d": yta.video_traffic_sources(vid, start_28, end),
            "retention_30s": _retention_at(curve, duration, RETENTION_SECONDS),
            # Not available from the Analytics API; needs a YouTube Reporting
            # API job (channel_reach_basic_a1). Kept as explicit nulls.
            "impressions_28d": None,
            "impression_ctr_28d": None,
        }

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
        "impressions_available": False,
        "impressions_note": "YouTube Analytics API has no impressions metric; needs a Reporting API job (channel_reach_basic_a1).",
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

    monthly: dict[str, dict] = {}
    for r in gsc.query_all(end - timedelta(days=486), end, ["date"]):
        m = monthly.setdefault(r["keys"][0][:7], {"month": r["keys"][0][:7], "clicks": 0, "impressions": 0})
        m["clicks"] += r["clicks"]
        m["impressions"] += r["impressions"]

    ranked = sorted(pages.values(), key=lambda p: p["impressions_28d"], reverse=True)
    keep = [p for p in ranked[:200] if p["impressions_28d"] > 0 or p["opportunities"]]
    return {
        "window_28d": {"start": start_28.isoformat(), "end": end.isoformat()},
        "totals_28d": gsc.query_totals(start_28, end),
        "totals_prev_28d": gsc.query_totals(prev_start, prev_end),
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

    direct = by_channel.get("Direct", 0)
    return {
        "window": {"start": start.isoformat(), "end": end.isoformat()},
        "sessions": total,
        "sessions_by_channel_group": by_channel,
        "sessions_by_source": by_source,
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
    }


# ---------------------------------------------------------------- baselines and reach

def _metric(section: str, field: str, source_ok: bool, missing_reason: str):
    def get(ep):
        if not source_ok:
            return None, "source_unavailable"
        block = ep.get(section)
        if block is None:
            return None, missing_reason
        value = block.get(field)
        if value is None:
            return None, f"not_yet_{field}" if "day_" in field else f"no_{field}"
        return value, None
    return get


def attach_all_baselines(episodes: list[dict], sources: Sources) -> None:
    metrics = {}
    for n in baselines.CHECKPOINT_DAYS:
        metrics[f"downloads_day_{n}"] = _metric("downloads", f"day_{n}", sources.ok("simplecast"), "no_simplecast_id")
        metrics[f"youtube_views_day_{n}"] = _metric("youtube", f"views_day_{n}", sources.ok("youtube"), "no_mapped_video")
    metrics["youtube_average_view_percentage_day_7"] = _metric(
        "youtube", "average_view_percentage_day_7", sources.ok("youtube"), "no_mapped_video"
    )
    metrics["youtube_impression_ctr_28d"] = _metric("youtube", "impression_ctr_28d", sources.ok("youtube"), "no_mapped_video")
    metrics["newsletter_click_rate"] = _metric("newsletter", "click_rate", sources.ok("kit"), "no_matched_broadcast")
    metrics["newsletter_open_rate"] = _metric("newsletter", "open_rate", sources.ok("kit"), "no_matched_broadcast")

    oldest_first = sorted(episodes, key=lambda e: e["published_at"])
    baselines.attach_baselines(oldest_first, metrics)


def build_reach(podcast, youtube_channel, kit, gsc) -> dict:
    def entry(value, change, note):
        return {"value": value, "change_28d": change, "note": note}

    return {
        "podcast_listeners_28d": entry(
            podcast["listeners_28d"] if podcast else None,
            podcast["listeners_28d"] - podcast["listeners_prev_28d"] if podcast else None,
            "Simplecast has no follower count; unique listeners over the trailing 28 days is the proxy.",
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
        "search_impressions_28d": entry(
            gsc["totals_28d"]["impressions"] if gsc else None,
            gsc["totals_28d"]["impressions"] - gsc["totals_prev_28d"]["impressions"] if gsc else None,
            "change is against the previous 28 day window.",
        ),
    }


# ---------------------------------------------------------------- entry

def build_snapshot(clients: dict, today: date | None = None) -> dict:
    """clients: {"simplecast", "youtube", "kit", "gsc", "ga4"}, each a client
    instance or None when its credentials are missing."""
    today = today or date.today()
    as_of = today - timedelta(days=1)
    sources = Sources()

    def missing(name):
        sources.status[name] = {"status": "unavailable", "error": "credentials not configured"}
        print(f"[{name}] unavailable: credentials not configured")

    sc = clients.get("simplecast")
    episodes = None
    if sc:
        episodes = sources.run("simplecast", episodes_from_simplecast, sc, today)
    else:
        missing("simplecast")
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
        missing("youtube")
    for ep in episodes:
        ep.setdefault("youtube", None)
    if youtube_channel is None:
        for ep in episodes:
            ep["youtube"] = None
    else:
        youtube_channel["unmapped_recent_videos"] = unmapped

    kit = sources.run("kit", collect_kit, clients["kit"], episodes, today) if clients.get("kit") else missing("kit")
    for ep in episodes:
        ep.setdefault("newsletter", None)

    gsc = sources.run("gsc", collect_gsc, clients["gsc"], episodes, today) if clients.get("gsc") else missing("gsc")
    for ep in episodes:
        ep.setdefault("search", None)

    ga4 = sources.run("ga4", collect_ga4, clients["ga4"], today) if clients.get("ga4") else missing("ga4")

    for ep in episodes:
        ep["age_days"] = (today - date.fromisoformat(ep["published_at"])).days
        ep.pop("video_ids", None)
    attach_all_baselines(episodes, sources)

    return {
        "schema_version": 1,
        "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_date": today.isoformat(),
        "sources": sources.status,
        "episodes": sorted(episodes, key=lambda e: e["published_at"], reverse=True),
        "podcast": podcast,
        "youtube_channel": youtube_channel,
        "kit": kit,
        "search_console": gsc,
        "ga4": ga4,
        "reach": build_reach(podcast, youtube_channel, kit, gsc),
    }


REACH_COLUMNS = ["date", "podcast_listeners_28d", "youtube_subscribers", "kit_active_subscribers", "search_impressions_28d"]


def append_reach_row(path: Path, snapshot: dict) -> None:
    """One row per run date; rerunning the same day replaces that row."""
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
        writer = csv.DictWriter(f, fieldnames=REACH_COLUMNS)
        writer.writeheader()
        writer.writerows(rows)
