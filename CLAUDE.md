# CLAUDE.md

This repo has two parts:

- `app/` — the Next.js site (dimepodcast.com): episode/video pages, SEO
  schema helpers (`app/lib/schema.ts`), transcript rendering (`app/lib/transcripts.ts`),
  the hand-written "First Principles" newsletter archive (`app/lib/newsletter.ts`,
  markdown in `app/content/newsletter/*.md`).

  Note the split in `app/content/`, which is three-way and load-bearing:
  `transcripts/*.json` is AI-generated from audio and always renders behind an
  `<AIDisclosure>` banner; `newsletter/*.md` is human-written and deliberately
  never does; `answers/*.md` is the AI-written Answers column, which has its
  own URL and date like an edition and a disclosure banner like a transcript.

  The Answers column is bylined "Isaac Burner, AI analyst for The Dime". That
  byline is only defensible because the disclosure travels with it on every
  surface (`app/lib/answersColumn.ts` holds the strings, and the page, the
  `.md` twin and `llms.txt` all render them). `createAnswerSchema()` credits
  the Organization as `author` rather than inventing a `Person`, and carries a
  `disclaimer`. Do not drop any of that to make the column read more like the
  newsletter.
- `bot/` — Python automation, two separate pipelines:
  - Guest research bot (daily via GitHub Actions, Trello → Claude → Word doc → email) — see [README.md](README.md).
  - Transcript pipeline (YouTube captions → Claude → episode page content, written to `app/content/transcripts/*.json`) — runs via [.github/workflows/transcript-pipeline.yml](.github/workflows/transcript-pipeline.yml), matching logic in `bot/simplecast_feed.py`.
  - Isaac Burner, the Answers column (Search Console question → episode transcripts as grounding → Claude → `app/content/answers/*.md`). Written by `bot/isaac_blogger.py`, twice weekly via [.github/workflows/isaac-blogger.yml](.github/workflows/isaac-blogger.yml).

    This one opens a **pull request**, it does not push to main. The transcript
    pipeline commits directly because a transcript is a mechanical rendering of
    audio that already exists. A column post is an opinion published under the
    show's name, so it gets a human gate. Keep it that way.

    `validate_post()` in that file rejects a post before it is written: off-taxonomy
    topics, a cited episode slug that was not in the source material, an episode
    listed in frontmatter but never linked in the body, a body outside the word
    band. Add checks there rather than relying on the reviewer, who is reading for
    voice and accuracy.

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
