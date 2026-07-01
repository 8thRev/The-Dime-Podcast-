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

## MVP — now

- [ ] Guest entity pages (`/guests/[slug]`) — `/guests` today is only a "become a guest" ticker of ~180 real guest names with no links or schema; each name is a real, currently-invisible search query ("[Name] cannabis podcast"). `createPersonSchema` in `app/lib/schema.ts` already exists as a building block for this.

## Hub layer — next (as the library grows)

- [ ] `sameAs` links (LinkedIn/Twitter) on guest `Person` schema, once guest entity pages exist to source them from
- [ ] `og:image` is currently the same generic `og-default.jpg` on every episode page — no per-episode/guest thumbnail for social/LLM preview cards
