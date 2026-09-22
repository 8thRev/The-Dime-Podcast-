"""
Tell search engines about newly published First Principles editions.

Run by .github/workflows/index-new-pages.yml after every successful Vercel
production deploy. Finds newsletter markdown added or changed in the deployed
commit, waits for those URLs to actually serve 200 on dimepodcast.com, then:

  1. IndexNow — one POST notifies Bing, Yandex, Seznam, Naver and the other
     participating engines. Bing's index is what ChatGPT search and Copilot
     draw on, so this is the fast path for LLM reach, not just Bing traffic.
     The key is public by design; it's verified against
     app/public/<key>.txt on the live site.
  2. Google Search Console — resubmits sitemap.xml so Google refetches it.
     Google has no API for "Request indexing" on articles (the Indexing API
     is restricted to JobPosting/BroadcastEvent pages), so this plus the
     internal links from /newsletter and the episode page is as much as can
     be automated. Non-fatal: the service account needs Full or Owner
     permission on the property, and the SEO report only ever needed read.

Each edition also nudges its related episode page (it gained a cross-link)
and the /newsletter index (it gained a listing).

Usage:
    python index_new_pages.py --base <sha> --head <sha>
    python index_new_pages.py --url /newsletter/some-slug [--url ...]
"""

import argparse
import re
import subprocess
import sys
import time
from pathlib import Path

import requests

SITE = "https://www.dimepodcast.com"
HOST = "www.dimepodcast.com"
INDEXNOW_KEY = "c75b5bdcf73876e49ba9bf0f8a001402"
INDEXNOW_KEY_LOCATION = f"{SITE}/{INDEXNOW_KEY}.txt"
INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow"

REPO_ROOT = Path(__file__).resolve().parent.parent
NEWSLETTER_DIR = "app/content/newsletter"

# Vercel marks the deployment successful once the production alias points at
# it, but give CDN propagation some slack before calling a URL dead.
LIVE_TIMEOUT_SECONDS = 600
LIVE_POLL_SECONDS = 20


def warn(message: str) -> None:
    # ::warning:: surfaces as an annotation on the Actions run summary.
    print(f"::warning::{message}")


def changed_editions(base: str, head: str) -> list[Path]:
    """Newsletter markdown files added or modified between two commits."""
    out = subprocess.run(
        ["git", "diff", "--name-only", "--diff-filter=AM", base, head, "--", NEWSLETTER_DIR],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=True,
    ).stdout
    return [REPO_ROOT / p for p in out.splitlines() if p.endswith(".md")]


def frontmatter_field(text: str, field: str) -> str:
    """One scalar field from YAML frontmatter. Enough for slug/episodeSlug —
    pulling in PyYAML for two string fields isn't worth a new dependency."""
    parts = text.split("---", 2)
    if len(parts) < 3:
        return ""
    match = re.search(rf"^{field}:\s*(.+?)\s*$", parts[1], re.MULTILINE)
    return match.group(1).strip("\"'") if match else ""


def urls_for_editions(files: list[Path]) -> list[str]:
    urls: list[str] = []
    for f in files:
        text = f.read_text(encoding="utf-8")
        # Same fallback as lib/newsletter.ts: slug defaults to the filename.
        slug = frontmatter_field(text, "slug") or f.stem
        urls.append(f"{SITE}/newsletter/{slug}")
        episode_slug = frontmatter_field(text, "episodeSlug")
        if episode_slug:
            urls.append(f"{SITE}/episodes/{episode_slug}")
    if urls:
        urls.append(f"{SITE}/newsletter")
    return list(dict.fromkeys(urls))


def wait_until_live(urls: list[str]) -> list[str]:
    """Drop any URL that never serves 200 — a malformed edition is skipped by
    the site rather than published, and submitting a 404 wastes crawl budget."""
    pending = set(urls)
    deadline = time.monotonic() + LIVE_TIMEOUT_SECONDS
    while pending and time.monotonic() < deadline:
        for url in sorted(pending):
            try:
                if requests.get(url, timeout=30).status_code == 200:
                    print(f"live: {url}")
                    pending.discard(url)
            except requests.RequestException:
                pass
        if pending:
            time.sleep(LIVE_POLL_SECONDS)
    for url in sorted(pending):
        warn(f"Not submitting {url}: still not 200 after {LIVE_TIMEOUT_SECONDS}s")
    return [u for u in urls if u not in pending]


def submit_indexnow(urls: list[str]) -> None:
    key_res = requests.get(INDEXNOW_KEY_LOCATION, timeout=30)
    if key_res.status_code != 200 or key_res.text.strip() != INDEXNOW_KEY:
        raise RuntimeError(
            f"IndexNow key file isn't being served correctly at {INDEXNOW_KEY_LOCATION} "
            f"(HTTP {key_res.status_code}). Check app/public/{INDEXNOW_KEY}.txt."
        )

    res = requests.post(
        INDEXNOW_ENDPOINT,
        json={
            "host": HOST,
            "key": INDEXNOW_KEY,
            "keyLocation": INDEXNOW_KEY_LOCATION,
            "urlList": urls,
        },
        headers={"Content-Type": "application/json; charset=utf-8"},
        timeout=30,
    )
    # 200 = accepted, 202 = accepted pending key validation.
    if res.status_code not in (200, 202):
        raise RuntimeError(f"IndexNow rejected submission: HTTP {res.status_code} {res.text[:300]}")
    print(f"IndexNow: submitted {len(urls)} URL(s), HTTP {res.status_code}")


def resubmit_sitemap() -> None:
    try:
        from googleapiclient.discovery import build

        from config import config
        from google_credentials import load_credentials

        service = build(
            "searchconsole",
            "v1",
            credentials=load_credentials(["https://www.googleapis.com/auth/webmasters"]),
        )
        service.sitemaps().submit(siteUrl=config.GSC_SITE_URL, feedpath=f"{SITE}/sitemap.xml").execute()
        print("Search Console: sitemap.xml resubmitted")
    except Exception as e:  # noqa: BLE001 — Google leg is best-effort by design
        warn(f"Search Console sitemap resubmit skipped: {e}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--base", help="Commit before the deploy")
    parser.add_argument("--head", help="Deployed commit")
    parser.add_argument("--url", action="append", default=[], help="Path or URL to submit (repeatable)")
    args = parser.parse_args()

    urls = [u if u.startswith("http") else SITE + "/" + u.lstrip("/") for u in args.url]
    if args.base and args.head:
        urls += urls_for_editions(changed_editions(args.base, args.head))
    urls = list(dict.fromkeys(urls))

    if not urls:
        print("No new or changed newsletter editions in this deploy — nothing to submit.")
        return 0

    print("Candidates:\n  " + "\n  ".join(urls))
    urls = wait_until_live(urls)
    if not urls:
        return 1

    submit_indexnow(urls)
    resubmit_sitemap()
    return 0


if __name__ == "__main__":
    sys.exit(main())
