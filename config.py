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
    ANTHROPIC_MODEL: str = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-4-20250514")
    ANTHROPIC_MAX_TOKENS: int = int(os.getenv("ANTHROPIC_MAX_TOKENS", "8000"))
    ANTHROPIC_TEMPERATURE: float = float(os.getenv("ANTHROPIC_TEMPERATURE", "0.3"))

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
