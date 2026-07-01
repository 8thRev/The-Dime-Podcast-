"""
Shared service-account credential loading for Google APIs (Search Console,
GA4). GSC_SERVICE_ACCOUNT_JSON is either a raw JSON string (GitHub Actions
secret) or a path to the downloaded key file (local dev).
"""

import json
import os

from google.oauth2 import service_account

from config import config


def load_credentials(scopes: list[str]) -> service_account.Credentials:
    raw = config.GSC_SERVICE_ACCOUNT_JSON.strip()
    if not raw:
        raise ValueError("GSC_SERVICE_ACCOUNT_JSON is not set")

    if os.path.isfile(raw):
        return service_account.Credentials.from_service_account_file(
            raw, scopes=scopes
        )

    try:
        info = json.loads(raw)
    except json.JSONDecodeError as e:
        raise ValueError(
            "GSC_SERVICE_ACCOUNT_JSON is not valid JSON and isn't a file path "
            f"either ({e}). Did the full key file contents get pasted into "
            "the secret?"
        ) from e
    return service_account.Credentials.from_service_account_info(
        info, scopes=scopes
    )
