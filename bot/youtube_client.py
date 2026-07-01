"""
YouTube Data API client for the transcript pipeline.

Refreshes an OAuth access token from the stored refresh token (obtained
once via get_youtube_refresh_token.py), lists the channel's most recent
videos, and downloads caption tracks. Captions require OAuth as the
channel owner even to list track IDs — an API key alone isn't enough —
so this uses the bearer token for every call, including listing videos.
"""

import requests

from config import config

TOKEN_URL = "https://oauth2.googleapis.com/token"
API_BASE = "https://www.googleapis.com/youtube/v3"
CHANNEL_ID = "UCcck3tzBNXrJ1WJ8EtIVq1w"  # @thedime_cannabis


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
        """Return up to `limit` most recent public videos: [{id, title, publishedAt}]."""
        videos: list[dict] = []
        page_token = None

        while len(videos) < limit:
            params = {
                "part": "snippet",
                "channelId": CHANNEL_ID,
                "type": "video",
                "order": "date",
                "maxResults": min(50, limit - len(videos)),
            }
            if page_token:
                params["pageToken"] = page_token

            resp = requests.get(
                f"{API_BASE}/search", params=params, headers=self._headers(), timeout=30
            )
            resp.raise_for_status()
            data = resp.json()

            for item in data.get("items", []):
                videos.append(
                    {
                        "id": item["id"]["videoId"],
                        "title": item["snippet"]["title"],
                        "publishedAt": item["snippet"]["publishedAt"],
                    }
                )

            page_token = data.get("nextPageToken")
            if not page_token:
                break

        return videos[:limit]

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
