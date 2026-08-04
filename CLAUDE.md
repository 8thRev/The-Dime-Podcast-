# CLAUDE.md

This repo has two parts:

- `app/` — the Next.js site (dimepodcast.com): episode/video pages, SEO
  schema helpers (`app/lib/schema.ts`), transcript rendering (`app/lib/transcripts.ts`),
  the hand-written "First Principles" newsletter archive (`app/lib/newsletter.ts`,
  markdown in `app/content/newsletter/*.md`).

  Note the split in `app/content/`: `transcripts/*.json` is AI-generated from
  audio and always renders behind an `<AIDisclosure>` banner; `newsletter/*.md`
  is human-written and deliberately never does.
- `bot/` — Python automation, two separate pipelines:
  - Guest research bot (daily via GitHub Actions, Trello → Claude → Word doc → email) — see [README.md](README.md).
  - Transcript pipeline (YouTube captions → Claude → episode page content, written to `app/content/transcripts/*.json`) — runs via [.github/workflows/transcript-pipeline.yml](.github/workflows/transcript-pipeline.yml), matching logic in `bot/simplecast_feed.py`.

## SEO / LLM reach strategy

See [SEO_ROADMAP.md](SEO_ROADMAP.md) for what's shipped and what's planned
(topic hub pages, guest entity pages, llms.txt, etc.). Keep that file
updated as items ship rather than scattering roadmap notes in code comments.

## Site verification

`npm run verify` in `app/` runs `scripts/verify-site.mjs` against a built,
running site (`npm run build && npx next start`); CI runs it on every PR via
[.github/workflows/site-checks.yml](.github/workflows/site-checks.yml).

**Adding a new page type?** Add a sample URL to `STATIC_SAMPLE` or
`DYNAMIC_PREFIXES` in that script — check 15 fails the run if a route in
`src/pages/` has none, which is intentional.

**Adding a new kind of check?** There's a deliberate bar for that in the
"Guardrails" section of [SEO_ROADMAP.md](SEO_ROADMAP.md) — read it first. The
suite is capped on purpose, and check 1 specifically must not be weakened to
chase an external crawler's "broken JavaScript" count (that report is deploy
skew, not a defect; the reasoning is written up there).
