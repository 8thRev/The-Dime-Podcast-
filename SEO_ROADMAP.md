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
- [x] Real per-episode sitemap `lastmod` (from the RSS `pubDate`, via `next-sitemap.config.js`'s `transform`) instead of a single build timestamp for every URL — video/topic/static URLs still fall back to build time (see Hub layer below)
- [x] Real site search wired to the `SearchAction` schema — `/episodes` now reads the `?q=` param (seeds + syncs the URL) so the `WebSite`/`SearchAction` JSON-LD (`app/lib/schema.ts`) resolves to a real, shareable, crawlable result page instead of a dead endpoint. Match broadened beyond title/guest to transcript topics + AI summary via a build-time `searchText` field, and the `/episodes` list props were slimmed (dropped the unused full `showNotes` HTML) — page payload fell from ~1.31 MB to ~225 kB (`app/src/pages/episodes.js`)
- [x] Answer-first ordering — the AI TL;DR now renders above the audio player and RSS description on episode pages (`app/src/pages/episodes/[slug].js`), putting the citable summary in the first ~30% of the page where AI answer engines pull from
- [x] `llms.txt` now emits per-episode key takeaways + FAQ (Q/A) for transcribed episodes, not just the one-line summary (`app/src/pages/llms.txt.js`) — more answer-shaped, citable text for LLM crawlers
- [x] YouTube video listing switched from `search.list` (100 quota units/page) to the uploads-playlist `playlistItems.list` (1 unit/page) — a full back-catalog pull drops from ~600 units to ~6 (`app/lib/youtube.ts`). Note: video detail pages still need `YOUTUBE_API_KEY` set in the build env to generate + enter the sitemap (currently 0 `/videos/[slug]` URLs without it)
- [x] Guest entity pages (`/guests/[slug]`, `app/lib/guests.ts`) — derived entirely from the guest/company data `lib/rss.ts` already extracts per episode, no new data source needed. Each page gets `Person` + `BreadcrumbList` schema, an initials-avatar (no photo — see note below), and a full linked list of that guest's episodes. The existing `/guests` "Past Guests Include" ticker now links every name with a matching profile instead of showing dead text, and the episode-detail guest byline links to the guest's page. Deliberately *not* done: pulling headshots from LinkedIn or elsewhere on the web — that's a scraping-ToS and copyright/right-of-publicity problem at this scale, not a code problem, so guests get an initials avatar instead (same pattern as `Testimonials.js`). If real, rights-cleared photos are ever supplied for specific guests, they can be wired in the same way `testimonials.json`'s `photo` field already is.

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

- [ ] Split composite guest credits ("Kristin & Eric Rogers", "Emily Fisher & Dr June Chin") into separate `Person` entities instead of one combined entity page — needs real name-parsing, deliberately deferred when guest entity pages shipped (see Shipped) rather than guessed at with a quick regex
- [ ] Backfill AI transcripts for the ~270 episodes that don't have one yet (`bot/transcript_pipeline.py`) — this is the actual content-and-authority lever; the technical SEO/entity-page work only helps pages that have real content behind them

## Hub layer — next (as the library grows)

- [ ] `sameAs` links (LinkedIn/Twitter) on guest `Person` schema, once guest entity pages exist to source them from
- [ ] `og:image` is currently the same generic `og-default.jpg` on every episode page — no per-episode/guest thumbnail for social/LLM preview cards
- [ ] Sitemap `lastmod` for video pages still uses the build timestamp, not the real YouTube `publishedAt` date — episode pages already get a real per-URL `lastmod` from the RSS feed (see Shipped), but doing the same for videos means either an extra YouTube Data API call from `next-sitemap.config.js` (quota cost for a nice-to-have) or a shared cache file written during `next build` for `next-sitemap` to read afterward
