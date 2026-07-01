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

## MVP — now

- [ ] Topic hub pages (`/topics/[topic]`) aggregating episodes by the existing fixed topic taxonomy. The taxonomy already exists but tags currently render as plain `<span>`s on the episode page (`app/src/pages/episodes/[slug].js`), not links — nothing surfaces it as a crawlable hub yet. Highest-leverage single item on this list.
- [ ] Fix transcript pipeline JSON truncation — 2 of 10 episodes in the first backfill run failed with "Claude did not return valid JSON," almost certainly `max_tokens` cut off mid-string on a long episode (`bot/transcript_claude_client.py`, `bot/config.py` `TRANSCRIPT_MAX_TOKENS`)
- [ ] `llms.txt` at the site root — curated index for LLM crawlers pointing at the episode library, topic hubs, and condensed takeaways/FAQ content

## Hub layer — next (as the library grows)

- [ ] Guest entity pages (`/guests/[slug]`) — `/guests` today is only a "become a guest" ticker of ~180 real guest names with no links or schema; each name is a real, currently-invisible search query ("[Name] cannabis podcast")
- [ ] `Person` schema for guests in the `PodcastEpisode` JSON-LD (`worksFor`/`sameAs`) — only the host is a structured entity today
- [ ] `BreadcrumbList` schema on episode/topic/guest pages
- [ ] Speaker attribution on pull quotes — quotes are currently a flat string array; `cleaned_transcript` already infers Host/Guest turns, so this is a data-shape change to the pipeline output, not new AI work
