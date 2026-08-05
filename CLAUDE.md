# CLAUDE.md

This repo has two parts:

- `app/` — the Next.js site (dimepodcast.com): episode/video pages, SEO
  schema helpers (`app/lib/schema.ts`), transcript rendering (`app/lib/transcripts.ts`).
- `bot/` — Python automation, two separate pipelines:
  - Guest research bot (daily via GitHub Actions, Trello → Claude → Word doc → email) — see [README.md](README.md).
  - Transcript pipeline (YouTube captions → Claude → episode page content, written to `app/content/transcripts/*.json`) — runs via [.github/workflows/transcript-pipeline.yml](.github/workflows/transcript-pipeline.yml), matching logic in `bot/simplecast_feed.py`.

## Analytics

Event tracking follows [docs/analytics-spec.md](docs/analytics-spec.md).
The parameter names in Part 1 are registered as GA4 custom dimensions.
Renaming one silently breaks reporting with no error. Do not rename them.
Never pass email, personal names, or free-text form values to gtag.

All events go through `app/lib/analytics.ts` (`track`, `pageview`, `once`).
`page_view` is fired only there — gtag's `send_page_view` is off and GA4's
browser-history enhanced measurement must stay off, or route changes double
count.

## SEO / LLM reach strategy

See [SEO_ROADMAP.md](SEO_ROADMAP.md) for what's shipped and what's planned
(topic hub pages, guest entity pages, llms.txt, etc.). Keep that file
updated as items ship rather than scattering roadmap notes in code comments.
