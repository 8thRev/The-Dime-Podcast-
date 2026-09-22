"""Offline stand ins for each API client, shaped like the real responses
seen in the Sep 2026 probe."""

from datetime import date, timedelta

import requests

TODAY = date(2026, 9, 22)

# Ten bi-weekly episodes, newest first, the last on Sep 16.
EPISODES = [
    {"id": f"ep{i}", "title": f"Episode {i}", "slug": f"episode-{i}", "type": "full",
     "number": 300 + i, "published_at": (date(2026, 9, 16) - timedelta(days=14 * (9 - i))).isoformat() + "T00:00:00-04:00"}
    for i in range(9, -1, -1)
]


class FakeSimplecast:
    def list_published_episodes(self):
        return EPISODES

    def episode_daily_downloads(self, episode_id):
        n = int(episode_id[2:])
        pub = next(date.fromisoformat(e["published_at"][:10]) for e in EPISODES if e["id"] == episode_id)
        out = {}
        d = pub
        while d < TODAY:
            age = (d - pub).days
            out[d.isoformat()] = max(1, (40 + n) // (age + 1))
            d += timedelta(days=1)
        return out

    def podcast_daily_downloads(self, start, end):
        return {start.isoformat(): 600}

    def downloads_by_app(self, start, end):
        return [{"name": "Apple Podcasts", "downloads": 296}, {"name": "Spotify", "downloads": 74}]

    def downloads_by_country(self, start, end):
        return [{"name": "United States", "downloads": 526}]

    def listeners(self, start, end):
        return {"total": 393, "daily_sum": 393}


class FakeYouTube:
    def last_data_date(self):
        return TODAY - timedelta(days=3)

    def channel_subscriber_count(self):
        return 6720

    def per_video_totals(self, start, end, ids):
        return {v: {"views": 100, "average_view_duration": 500.0, "average_view_percentage": 20.0, "subscribers_gained": 1} for v in ids}

    def video_daily(self, vid, start, end):
        out = {}
        d = start
        while d <= end:
            out[d.isoformat()] = {"views": 10, "average_view_duration": 400.0, "average_view_percentage": 18.0}
            d += timedelta(days=1)
        return out

    def video_traffic_sources(self, vid, start, end):
        return {"SUBSCRIBER": 39, "YT_SEARCH": 21}

    def video_retention(self, vid, start, end):
        return [(0.01, 0.88), (0.02, 0.44)]

    def daily_views_by_source(self, start, end, video_id=None):
        out = {}
        d = start
        while d <= end:
            out[d.isoformat()] = {"YT_SEARCH": 5, "SUBSCRIBER": 3, "EXT_URL": 2}
            d += timedelta(days=1)
        return out

    def external_referrers(self, start, end):
        return {"chatgpt.com": 4, "google.com": 10, "perplexity.ai": 1}

    def top_search_terms(self, start, end, row_limit=10):
        return [{"term": "cannabis rescheduling", "views": 12}]

    def totals(self, start, end):
        return {"views": 333, "minutes_watched": 933, "avg_view_duration_seconds": 300.0, "subscribers_gained": 3, "subscribers_lost": 71}


class FakeKit:
    def active_subscribers(self):
        return 1230

    def growth_stats(self, start, end):
        return {"new_subscribers": 0, "cancellations": -2, "net_new_subscribers": -2, "subscribers": 1230}

    def broadcasts_since(self, since):
        return [
            {"id": 1, "subject": "New Episode of The Dime Episode 9", "send_at": "2026-09-16T20:00:17Z", "recipients": 1236,
             "opens": 701, "clicks": 246, "open_rate": 56.72, "click_rate": 7.93, "unsubscribes": 2},
            {"id": 2, "subject": "A stray announcement", "send_at": "2026-08-28T16:00:00Z", "recipients": 1230,
             "opens": 600, "clicks": 50, "open_rate": 48.8, "click_rate": 4.1, "unsubscribes": 0},
        ]


class FakeGSC:
    def query_all(self, start, end, dims):
        page = "https://www.dimepodcast.com/episodes/episode-9"
        if dims == ["page", "date"]:
            return [{"keys": [page, end.isoformat()], "clicks": 2, "impressions": 40, "position": 9.0}]
        if dims == ["page", "query"]:
            return [
                {"keys": [page, "guest 9"], "clicks": 1, "impressions": 25, "position": 9.3},
                {"keys": [page, "too few"], "clicks": 0, "impressions": 5, "position": 10.0},
                {"keys": [page, "already top"], "clicks": 4, "impressions": 90, "position": 2.0},
            ]
        if dims == ["date", "query"]:
            rows = []
            d = start
            while d <= end:
                rows.append({"keys": [d.isoformat(), "the dime podcast"], "clicks": 1, "impressions": 3, "position": 2.0})
                rows.append({"keys": [d.isoformat(), "hemp ban cbd"], "clicks": 0, "impressions": 2, "position": 14.0})
                rows.append({"keys": [d.isoformat(), "why is cannabis rescheduling taking so long"], "clicks": 0, "impressions": 1, "position": 9.0})
                d += timedelta(days=1)
            return rows
        return [{"keys": [end.isoformat()], "clicks": 3, "impressions": 100, "position": 12.0}]

    def query_totals(self, start, end):
        return {"clicks": 10, "impressions": 500, "ctr": 0.02, "position": 14.0}


class FakeGA4:
    def sessions_by_channel_group(self, start, end):
        return {"Direct": 158, "Organic Search": 2, "AI Assistant": 2, "Unassigned": 2}

    def sessions_by_session_source(self, start, end):
        return {"(direct)": 158, "google": 2}

    def landing_page_engagement(self, start, end):
        return [{"landing_page": "/", "sessions": 148, "engagement_seconds": 415.0},
                {"landing_page": "/about", "sessions": 16, "engagement_seconds": 900.0}]

    def homepage_path_page_views(self, start, end):
        return [{"page_location": "https://www.dimepodcast.com/", "count": 157},
                {"page_location": "https://www.dimepodcast.com/?utm_source=x", "count": 3}]

    def event_counts(self, start, end, names):
        return {n: (1 if n == "guest_inquiry_submit" else 0) for n in names}

    def audio_progress_count(self, start, end, percent):
        return 0

    def daily_sessions_by_channel(self, start, end):
        out = {}
        d = start
        while d <= end:
            out[d.isoformat()] = {"Direct": 20, "Organic Search": 1, "AI Assistant": 1}
            d += timedelta(days=1)
        return out

    def sessions_by_source_channel_landing(self, start, end):
        return [
            {"source": "chatgpt.com", "channel": "AI Assistant", "landing_page": "/episodes/episode-9", "sessions": 3},
            {"source": "perplexity.ai", "channel": "Referral", "landing_page": "/episodes/episode-8", "sessions": 1},
            {"source": "google", "channel": "Organic Search", "landing_page": "/", "sessions": 9},
        ]


class FakeReporting:
    def ensure_job(self):
        return "job1", False

    def reach_rows(self, job_id, start, end):
        return [
            {"date": "20260910", "video_id": "vid8", "traffic_source_type": "5",
             "video_thumbnail_impressions": "1000", "video_thumbnail_impressions_ctr": "0.05"},
            {"date": "20260910", "video_id": "vid8", "traffic_source_type": "7",
             "video_thumbnail_impressions": "3000", "video_thumbnail_impressions_ctr": "0.01"},
        ]


class FakeAgentVisits:
    def daily_counts(self, start, end):
        out = {}
        d = start
        while d <= end:
            out[d.isoformat()] = [
                {"class": "retrieval", "agent": "ChatGPT-User", "path": "/episodes/episode-9", "count": 2},
                {"class": "retrieval", "agent": "Claude-User", "path": "/llms.txt", "count": 1},
                {"class": "training", "agent": "GPTBot", "path": "/episodes/episode-1", "count": 5},
                {"class": "search", "agent": "bingbot", "path": "/", "count": 3},
            ]
            d += timedelta(days=1)
        return out


def fake_ai_panel(video_ids):
    import ai_visibility
    results = [
        {"id": "cat-01", "category": "category", "prompt": "q1", "episode_slug": None, "cited": True,
         "in_search_results": True, "mentioned": True, "our_cited_urls": ["https://www.dimepodcast.com/"],
         "cited_domains": ["dimepodcast.com", "forbes.com"], "error": None},
        {"id": "top-01", "category": "topic", "prompt": "q2", "episode_slug": "episode-9", "cited": False,
         "in_search_results": False, "mentioned": False, "our_cited_urls": [],
         "cited_domains": ["mjbizdaily.com"], "error": None},
    ]
    return ai_visibility.summarize(results, "test-model")


class Broken:
    """Every method raises, like a client holding a bad token."""

    def __init__(self, message="401 Unauthorized"):
        self.message = message

    def __getattr__(self, name):
        def fail(*a, **k):
            raise requests.HTTPError(self.message)
        return fail


CATALOG = {
    f"vid{i}": {"id": f"vid{i}", "title": f"Episode {i} video", "durationISO": "PT52M0S",
                "publishedAt": (date(2026, 9, 17) - timedelta(days=14 * (9 - i))).isoformat() + "T21:00:00Z"}
    for i in range(0, 9)
}
CATALOG["stray"] = {"id": "stray", "title": "Unmapped upload", "durationISO": "PT45M0S", "publishedAt": "2026-09-01T12:00:00Z"}
VIDEO_MAP = {f"episode-{i}": [f"vid{i}"] for i in range(0, 9)}


def all_clients():
    return {"simplecast": FakeSimplecast(), "youtube": FakeYouTube(), "youtube_reporting": FakeReporting(),
            "kit": FakeKit(), "gsc": FakeGSC(), "ga4": FakeGA4(), "ai": fake_ai_panel,
            "agent_visits": FakeAgentVisits()}
