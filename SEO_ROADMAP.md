# SEO & LLM Reach Roadmap

Single source of truth for sequencing SEO/LLM-discoverability work across
`app/` (the Next.js site) and `bot/` (the transcript pipeline that feeds it).
Update checkboxes as items ship; add new phases below rather than rewriting
history. Don't duplicate this plan in code comments — it goes stale the
moment an item ships and stops being useful.

## Shipped

- [x] `PodcastEpisode` JSON-LD schema (`app/lib/schema.ts`) — audio, ListenAction, author
- [x] `FAQPage` JSON-LD schema — AI-generated Q&A pairs per episode, the schema type most likely to get lifted into Google AI Overviews and LLM answer engines
- [x] `VideoObject` schema for YouTube-sourced video pages
- [x] AI-generated transcript pipeline (`bot/transcript_pipeline.py`) — full cleaned transcript, takeaways, quotes, FAQ, topics per episode, written to `app/content/transcripts/*.json`
- [x] Canonical URLs, OG/Twitter meta tags, AI-content disclosure component
- [x] XML sitemap + robots.txt (`next-sitemap`)
- [x] Related-episodes internal linking by shared tags
- [x] Robust YouTube-to-RSS episode matching (`bot/simplecast_feed.py`) — guest name + rarity-weighted title-word overlap + date proximity, so the transcript pipeline actually attaches generated content to the right episode page even when YouTube and RSS titles/guest credits diverge
- [x] Fix transcript pipeline JSON truncation — switched to streaming + raised `TRANSCRIPT_MAX_TOKENS` (`bot/transcript_claude_client.py`)
- [x] Topic hub pages (`/topics/[topic]`) aggregating episodes by the fixed topic taxonomy (`app/lib/topics.ts`, `app/src/pages/topics/`). Episode tags now link to their hub page when transcript-derived topics are available, falling back to plain (non-linked) RSS keyword spans for episodes without transcript coverage yet, since those have no hub page to link to.
- [x] `llms.txt` at the site root (`app/src/pages/llms.txt.js`) — dynamically generated per-request from current episode/topic/transcript data, so it never goes stale
- [x] `Person` schema for guests in the `PodcastEpisode` JSON-LD (`contributor`, with `worksFor`) — `app/lib/schema.ts`
- [x] `BreadcrumbList` schema on episode and topic pages
- [x] Speaker attribution on pull quotes — `quotes` is now `{speaker, quote}[]` instead of a flat string array (prompt, type, and rendering all updated; the one already-published transcript was migrated in place)
- [x] Host speaker label in `cleaned_transcript` now says "Bryan Fields" instead of generic "Host"
- [x] Fixed the Ahrefs-flagged site-wide issues: duplicate `<meta name="description">` (removed the global default from `_document.js` that duplicated every page's own tag), uncapped title/description length on episode and video pages, invalid `"Podcast"` schema.org type (→ `PodcastSeries`), non-ISO-8601 `duration` in JSON-LD, missing viewport meta tag
- [x] Missing canonical tag on video pages and `/guests`; `/videos`, `/topics`, `/guests` added to Header/Footer nav (were sitemap-only orphans); heading hierarchy fixed (h1→h2, no more h1→h3 skips) across episode, video, home, and about pages
- [x] `CollectionPage`/`ItemList` schema on `/episodes`, `/videos`, `/topics`; `WebSite`+`SearchAction` schema on home; `Person` schema for both hosts on `/about`; `AggregateRating` on the podcast schema (sourced from the existing `PODCAST_RATING`)
- [x] Visible "Mentioned in This Episode" entity list on episode pages (previously only in JSON-LD, invisible to plain-text LLM crawlers)
- [x] Explicit AI-crawler allow rules in `robots.txt`/`next-sitemap.config.js` (GPTBot, ClaudeBot, PerplexityBot, Google-Extended, CCBot, etc.); `/llms.txt` links to `/about`, `/videos`, `/guests`; excluded from the XML sitemap (it's not an indexable HTML page)
- [x] GA4 moved from a raw `<script>` in `_document.js` to `next/script` (`_app.js`); baseline security headers (`next.config.js`); ESLint config added (`next/core-web-vitals`)
- [x] Video legacy-slug 301 redirect, mirroring the existing episode-slug redirect

## Guardrails — how new pages stay correct

Every page renders `<SeoHead>` (`app/src/components/SeoHead.js`) instead of a hand-rolled `next/head` block. It owns title/description truncation (`truncateTitle`/`truncateDescription` in `app/lib/schema.ts`), the canonical tag, and OG/Twitter tags — so a new page can't reintroduce the duplicate-description or uncapped-length bugs by construction. Two enforcement layers back this up:

- **Lint**: `app/.eslintrc.json` restricts importing `next/head` outside `SeoHead.js` itself.
- **Build tripwire**: `npm run checkseo` (wired into `npm run build` via `app/package.json`) statically scans every page file and fails the build if anything imports `next/head` directly or renders a raw `<title>`/`<meta name="description">` tag. See `app/scripts/check-seo.mjs`.

New pages: add them to this list, don't hand-roll `<head>` tags, and this stays true without anyone having to remember to re-audit.

## Success metrics — what "done" looks like

Baseline snapshot to be taken from a fresh Ahrefs re-crawl + Google Search Console export right after this branch ships (external tools, can't be pulled from inside a coding session):

- Ahrefs duplicate-description / description-too-long / title-too-long counts → 0
- GSC Coverage: `/videos`, `/topics`, `/guests` indexed-and-crawled, not just "discovered"
- GSC Performance: average position + clicks/impressions trending up month-over-month (the real organic-traffic signal)
- Core Web Vitals (mobile) in the "Good" band; Lighthouse SEO 100 / Best Practices 90+
- LLM/AI-referrer traffic (ChatGPT/Perplexity/Claude referrers in GA4/Vercel Analytics) — expect near-zero today, track as a leading indicator that the llms.txt + structured-data work is paying off

Re-check at +30 days (crawl-level fixes should be visible) and +60-90 days (organic traffic trend, which lags further behind).

## MVP — now

- [ ] Guest entity pages (`/guests/[slug]`) — `/guests` today is only a "become a guest" ticker of ~180 real guest names with no links or schema; each name is a real, currently-invisible search query ("[Name] cannabis podcast"). `createPersonSchema` in `app/lib/schema.ts` already exists as a building block for this.

## Hub layer — next (as the library grows)

- [ ] `sameAs` links (LinkedIn/Twitter) on guest `Person` schema, once guest entity pages exist to source them from
- [ ] `og:image` is currently the same generic `og-default.jpg` on every episode page — no per-episode/guest thumbnail for social/LLM preview cards
- [ ] Sitemap `lastmod` for episode/video/topic detail pages is currently just the build timestamp for every URL, not the real publish/update date — accurate per-URL `lastmod` would need `next-sitemap`'s `transform` to read the same data `app/lib/rss.ts`/`youtube.ts` expose, which isn't straightforward from `next-sitemap.config.js` (a plain Node script that runs after the Next.js build, can't directly import the TypeScript lib modules without extra tooling)
