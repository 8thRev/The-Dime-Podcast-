"""
One-time setup script: obtains a YouTube Data API OAuth refresh token
for the account that manages the channel, so the automation pipeline
can call captions.list / captions.download unattended afterward.

Run this once locally, from your own machine, logged in as the
channel owner. It opens a browser tab for the Google consent screen.

Usage:
    pip install google-auth-oauthlib google-api-python-client
    python bot/get_youtube_refresh_token.py --client-secret path/to/downloaded_client_secret.json

After it prints the refresh token, save it (along with the client id
and secret from the same JSON file) as GitHub Actions secrets:
    YOUTUBE_OAUTH_CLIENT_ID
    YOUTUBE_OAUTH_CLIENT_SECRET
    YOUTUBE_OAUTH_REFRESH_TOKEN
"""

import argparse
import json
import sys

from google_auth_oauthlib.flow import InstalledAppFlow

SCOPES = ["https://www.googleapis.com/auth/youtube.force-ssl"]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--client-secret",
        required=True,
        help="Path to the client secret JSON downloaded from Google Cloud Console",
    )
    args = parser.parse_args()

    flow = InstalledAppFlow.from_client_secrets_file(args.client_secret, SCOPES)
    # access_type=offline + prompt=consent force Google to issue a fresh
    # refresh token every run, even if this account already authorized
    # the app before (otherwise a repeat run can come back empty-handed).
    credentials = flow.run_local_server(port=0, access_type="offline", prompt="consent")

    with open(args.client_secret) as f:
        client_config = json.load(f)
    client_id = client_config["installed"]["client_id"]
    client_secret = client_config["installed"]["client_secret"]

    print("\nSave these as GitHub Actions secrets:\n")
    print(f"YOUTUBE_OAUTH_CLIENT_ID={client_id}")
    print(f"YOUTUBE_OAUTH_CLIENT_SECRET={client_secret}")
    print(f"YOUTUBE_OAUTH_REFRESH_TOKEN={credentials.refresh_token}")

    if not credentials.refresh_token:
        print(
            "\nNo refresh token was returned. This usually means you've already "
            "authorized this app before with this Google account. Revoke access at "
            "https://myaccount.google.com/permissions and run this script again.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
