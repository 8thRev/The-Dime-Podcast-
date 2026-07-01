"""
YouTube Data API client for the transcript pipeline.

Refreshes an OAuth access token from the stored refresh token (obtained
once via get_youtube_refresh_token.py), lists the channel's most recent
videos, and downloads caption tracks. Captions require OAuth as the
channel owner even to list track IDs — an API key alone isn't enough —
so this uses the bearer token for every call, including listing videos.
"""

import re

import requests

from config import config

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://www.googleapis.com/youtube/v3"
CHANNEL_ID = "UCcck3tzBNXrJ1WJ8EtIVq1w"  # @thedime_cannabis

# The channel posts short highlight clips between full-episode uploads;
# clips run a few minutes at most, so this threshold reliably separates
# full episodes from clips/Shorts without needing to inspect titles.
MIN_EPISODE_DURATION_SECONDS = 1800  # 30 minutes


def _parse_iso8601_duration(duration: str) -> int:
    match = re.match(r"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?", duration or "")
    if not match:
        return 0
    hours, minutes, seconds = (int(v) if v else 0 for v in match.groups())
    return hours * 3600 + minutes * 60 + seconds


class YouTubeClient:
    """Client for listing recent videos and downloading their captions."""

    def __init__(self):
        self._access_token = None

    def _get_access_token(self) -> str:
        if self._access_token:
            return self._access_token

        resp = requests.post(
            TOKEN_URL,
            data={
                "client_id": config.YOUTUBE_OAUTH_CLIENT_ID,
                "client_secret": config.YOUTUBE_OAUTH_CLIENT_SECRET,
                "refresh_token": config.YOUTUBE_OAUTH_REFRESH_TOKEN,
                "grant_type": "refresh_token",
            },
            timeout=30,
        )
        resp.raise_for_status()
        self._access_token = resp.json()["access_token"]
        return self._access_token

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self._get_access_token()}"}

    def list_recent_videos(self, limit: int) -> list[dict]:
        """Return up to `limit` most recent full-length videos — short
        clips/Shorts the channel also posts are filtered out by duration —
        as [{id, title, publishedAt}]. Scans up to 10 pages (500 videos)
        looking for enough qualifying full episodes before giving up."""
        candidates: list[dict] = []
        page_token = None
        pages_scanned = 0
        max_pages = 10

        while len(candidates) < limit and pages_scanned < max_pages:
            params = {
                "part": "snippet",
                "channelId": CHANNEL_ID,
                "type": "video",
                "order": "date",
                "maxResults": 50,
            }
            if page_token:
                params["pageToken"] = page_token

            resp = requests.get(
                f"{API_BASE}/search", params=params, headers=self._headers(), timeout=30
            )
            resp.raise_for_status()
            data = resp.json()
            pages_scanned += 1

            items = data.get("items", [])
            video_ids = [item["id"]["videoId"] for item in items]
            snippets = {item["id"]["videoId"]: item["snippet"] for item in items}

            if video_ids:
                durations = self._get_durations(video_ids)
                for vid in video_ids:
                    if durations.get(vid, 0) >= MIN_EPISODE_DURATION_SECONDS:
                        candidates.append(
                            {
                                "id": vid,
                                "title": snippets[vid]["title"],
                                "publishedAt": snippets[vid]["publishedAt"],
                            }
                        )
                    if len(candidates) >= limit:
                        break

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return candidates[:limit]

    def _get_durations(self, video_ids: list[str]) -> dict:
        """Return {video_id: duration_in_seconds} for up to 50 video IDs."""
        resp = requests.get(
            f"{API_BASE}/videos",
            params={"part": "contentDetails", "id": ",".join(video_ids)},
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        return {
            item["id"]: _parse_iso8601_duration(item["contentDetails"]["duration"])
            for item in resp.json().get("items", [])
        }

    def get_video_stats(self, video_ids: list[str]) -> dict[str, dict]:
        """Return {video_id: {views, likes, comments}} for up to 50 video IDs."""
        if not video_ids:
            return {}
        resp = requests.get(
            f"{API_BASE}/videos",
            params={"part": "statistics", "id": ",".join(video_ids)},
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        stats = {}
        for item in resp.json().get("items", []):
            s = item["statistics"]
            stats[item["id"]] = {
                "views": int(s.get("viewCount", 0)),
                "likes": int(s.get("likeCount", 0)),
                "comments": int(s.get("commentCount", 0)),
            }
        return stats

    def get_caption_track_id(self, video_id: str) -> str | None:
        """Return the best available English caption track ID, preferring a
        manually-created track over the auto-generated (ASR) one."""
        resp = requests.get(
            f"{API_BASE}/captions",
            params={"part": "snippet", "videoId": video_id},
            headers=self._headers(),
            timeout=30,
        )
        resp.raise_for_status()
        items = resp.json().get("items", [])
        if not items:
            return None

        def is_english(item):
            return item["snippet"].get("language", "").lower().startswith("en")

        manual = [i for i in items if is_english(i) and i["snippet"].get("trackKind") != "ASR"]
        asr = [i for i in items if is_english(i) and i["snippet"].get("trackKind") == "ASR"]
        chosen = (manual or asr or items)[0]
        return chosen["id"]

    def download_caption_text(self, caption_id: str) -> str | None:
        """Download a caption track as SRT text."""
        resp = requests.get(
            f"{API_BASE}/captions/{caption_id}",
            params={"tfmt": "srt"},
            headers=self._headers(),
            timeout=60,
        )
        if resp.status_code != 200:
            print(f"  Caption download failed with status {resp.status_code}: {resp.text[:200]}")
            return None
        return resp.text
