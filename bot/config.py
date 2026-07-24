"""
Configuration management for The Dime Podcast automation.
Reads all credentials and settings from environment variables.
"""

import os
from typing import Optional


class Config:
    """Centralized configuration for the automation."""

    # Trello Configuration
    TRELLO_API_KEY: str = os.getenv("TRELLO_API_KEY", "")
    TRELLO_API_TOKEN: str = os.getenv("TRELLO_API_TOKEN", "")
    TRELLO_BOARD_ID: str = os.getenv("TRELLO_BOARD_ID", "")
    TRELLO_PRE_COLUMN_NAME: str = os.getenv("TRELLO_PRE_COLUMN_NAME", "Pre")
    TRELLO_PROCESSED_LABEL: str = os.getenv(
        "TRELLO_PROCESSED_LABEL", "AI Research Completed"
    )

    # Anthropic Configuration
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")
    ANTHROPIC_MAX_TOKENS: int = int(os.getenv("ANTHROPIC_MAX_TOKENS", "8000"))

    # web_search is billed per use ($10/1,000 searches) in addition to token
    # costs; web_fetch has no per-use fee but its content still counts as
    # input tokens. These cap both per guest as a cost/runaway-loop guard.
    ANTHROPIC_MAX_WEB_SEARCHES: int = int(os.getenv("ANTHROPIC_MAX_WEB_SEARCHES", "20"))
    ANTHROPIC_MAX_WEB_FETCHES: int = int(os.getenv("ANTHROPIC_MAX_WEB_FETCHES", "10"))
    ANTHROPIC_MAX_FETCH_CONTENT_TOKENS: int = int(
        os.getenv("ANTHROPIC_MAX_FETCH_CONTENT_TOKENS", "50000")
    )

    # Email Configuration
    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", "587"))
    EMAIL_USERNAME: str = os.getenv("EMAIL_USERNAME", "")
    EMAIL_PASSWORD: str = os.getenv("EMAIL_PASSWORD", "")
    EMAIL_FROM: str = os.getenv("EMAIL_FROM", "")
    EMAIL_TO: str = os.getenv("EMAIL_TO", "Bryan.Fields@8threv.com")

    # General Configuration
    TIMEZONE: str = os.getenv("TIMEZONE", "UTC")
    DAYS_BEFORE_RECORDING: int = int(os.getenv("DAYS_BEFORE_RECORDING", "3"))

    # Manual override: process a specific card by name regardless of its
    # recording date. Used for one-off manual runs (workflow_dispatch).
    FORCE_CARD_NAME: str = os.getenv("FORCE_CARD_NAME", "")

    # YouTube OAuth (transcript pipeline) — refresh token obtained once via
    # bot/get_youtube_refresh_token.py, used to pull captions for our own
    # channel's videos.
    YOUTUBE_OAUTH_CLIENT_ID: str = os.getenv("YOUTUBE_OAUTH_CLIENT_ID", "")
    YOUTUBE_OAUTH_CLIENT_SECRET: str = os.getenv("YOUTUBE_OAUTH_CLIENT_SECRET", "")
    YOUTUBE_OAUTH_REFRESH_TOKEN: str = os.getenv("YOUTUBE_OAUTH_REFRESH_TOKEN", "")

    # Transcript pipeline tuning. Much higher max tokens than the research
    # bot since output includes a full cleaned episode transcript (with
    # speaker labels) plus takeaways/FAQ/quotes/topics, not just a short
    # document -- a 60-90 min episode alone needs ~20-30k output tokens for
    # the cleaned transcript. claude-sonnet-5 supports up to 128k output
    # tokens (streamed).
    TRANSCRIPT_MAX_TOKENS: int = int(os.getenv("TRANSCRIPT_MAX_TOKENS", "64000"))
    TRANSCRIPT_LIMIT: int = int(os.getenv("TRANSCRIPT_LIMIT", "10"))

    # How many episodes a run may actually transcribe, as opposed to
    # TRANSCRIPT_LIMIT, which only bounds how many videos it *scans*. The
    # two are the same thing for the daily run (the newest videos are the
    # untranscribed ones) but come apart badly for backfill: reaching an
    # untranscribed 2024 upload means scanning ~260 videos, which then
    # queues every one of the ~149 untranscribed episodes behind it.
    #
    # That overruns two hard ceilings at once — the 6-hour Actions job cap
    # (~60-90 episodes at 4-6 min each) and, sooner, the YouTube quota: a
    # transcribed episode costs 250 units (captions.list 50 +
    # captions.download 200) against 10,000/day, so a day's quota is ~40
    # episodes. Past that the run doesn't stop cleanly, it starts failing
    # 403s until MAX_CONSECUTIVE_FAILURES aborts it.
    #
    # 0 means no cap, which is right for the daily run — it should process
    # however many genuinely new episodes appeared, and that is never more
    # than a handful.
    TRANSCRIPT_MAX_NEW: int = int(os.getenv("TRANSCRIPT_MAX_NEW", "0"))

    # SEO report (Search Console). GSC_SERVICE_ACCOUNT_JSON is either a raw
    # JSON string (GitHub Actions secret) or a path to the downloaded key
    # file (local dev).
    GSC_SERVICE_ACCOUNT_JSON: str = os.getenv("GSC_SERVICE_ACCOUNT_JSON", "")
    GSC_SITE_URL: str = os.getenv("GSC_SITE_URL") or "sc-domain:dimepodcast.com"

    # GA4 traffic data (optional add-on to the SEO report). If unset, the
    # report just skips the GA4 section.
    GA4_PROPERTY_ID: str = os.getenv("GA4_PROPERTY_ID", "")

    # Simplecast download stats (optional add-on to the SEO report). Static
    # read-only Private App token, not OAuth. If unset, the report just
    # skips the Simplecast section.
    SIMPLECAST_API_TOKEN: str = os.getenv("SIMPLECAST_API_TOKEN", "")

    @classmethod
    def validate_seo_report_config(cls) -> tuple[bool, list[str]]:
        """Validate config required specifically by the SEO report script."""
        required_vars = [
            ("GSC_SERVICE_ACCOUNT_JSON", cls.GSC_SERVICE_ACCOUNT_JSON),
            ("EMAIL_USERNAME", cls.EMAIL_USERNAME),
            ("EMAIL_PASSWORD", cls.EMAIL_PASSWORD),
            ("EMAIL_FROM", cls.EMAIL_FROM),
        ]
        missing = [name for name, value in required_vars if not value]
        return len(missing) == 0, missing

    @classmethod
    def validate_transcript_config(cls) -> tuple[bool, list[str]]:
        """Validate config required specifically by the transcript pipeline."""
        required_vars = [
            ("YOUTUBE_OAUTH_CLIENT_ID", cls.YOUTUBE_OAUTH_CLIENT_ID),
            ("YOUTUBE_OAUTH_CLIENT_SECRET", cls.YOUTUBE_OAUTH_CLIENT_SECRET),
            ("YOUTUBE_OAUTH_REFRESH_TOKEN", cls.YOUTUBE_OAUTH_REFRESH_TOKEN),
            ("ANTHROPIC_API_KEY", cls.ANTHROPIC_API_KEY),
        ]
        missing = [name for name, value in required_vars if not value]
        return len(missing) == 0, missing

    @classmethod
    def validate(cls) -> tuple[bool, list[str]]:
        """
        Validate that all required configuration values are set.

        Returns:
            tuple: (is_valid, list_of_missing_vars)
        """
        required_vars = [
            ("TRELLO_API_KEY", cls.TRELLO_API_KEY),
            ("TRELLO_API_TOKEN", cls.TRELLO_API_TOKEN),
            ("TRELLO_BOARD_ID", cls.TRELLO_BOARD_ID),
            ("ANTHROPIC_API_KEY", cls.ANTHROPIC_API_KEY),
            ("EMAIL_USERNAME", cls.EMAIL_USERNAME),
            ("EMAIL_PASSWORD", cls.EMAIL_PASSWORD),
            ("EMAIL_FROM", cls.EMAIL_FROM),
        ]

        missing = [name for name, value in required_vars if not value]

        return len(missing) == 0, missing


# Singleton instance
config = Config()
