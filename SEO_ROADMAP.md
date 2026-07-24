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
- [x] Fixed guest `company`/`companyUrl` attribution in `extractCompanyFromShowNotes()` (`app/lib/rss.ts`) — it used to scan the *entire* episode show notes for the first link not on `SKIP_DOMAINS`, which on ~150 of 303 episodes (any without a "Guest Links" section) landed on the "Newton Insights" sponsor read or "Eighth Revolution" footer link and published that as the guest's company on their entity page. Detection is now scoped to the show notes' "Guest Links" section specifically (bounded by the "Our Links" heading or the boilerplate Twitter/Eighth-Revolution links, both of which vary in markup across episodes), and falls back to no company rather than a wrong one when that section is absent. Verified against all 303 live feed items.
  - Follow-up fix after re-verifying against the live feed: two different guest links glued together with no separator (e.g. a LinkedIn URL immediately followed by `https://theflowery.co/`) were being truncated down to just the first one, silently dropping a real company link on the "Ilya Shmidt" episode; a small number of episodes wrap guest links in an email-tracking redirect (Streak's `streaklinks.com/<id>/<url-encoded-destination>`), which published the redirect host itself ("Streaklinks") as the company instead of the actual destination (AYR Wellness, on the David Goubert episode); and `hostnameToCompanyName()` left a literal dot in the label for subdomained hosts (`en.wikipedia.org` → "En.wikipedia", `mitchellosak.substack.com` → "Mitchellosak.substack"). All three are fixed in `app/lib/rss.ts` and re-verified against all 303 live feed items with zero regressions on the other 128 previously-correct results.

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

## Checkpoints — dated targets for the 30-day content push

Run `python bot/coverage_report.py` to produce every leading metric below in
one shot. It reads `app/content/transcripts/*.json` + the live RSS feed, so
the measurement can't drift between checkpoints the way a hand-assembled
audit does. `--census` adds the YouTube reachability ceiling (needs OAuth,
spends quota — see the script docstring).

### Baseline — 2026-07-23

| Metric | Value |
|---|---|
| Published episodes | 303 |
| Episodes with a transcript | **63 (20.8%)** — 36 `youtube_captions`, 27 `riverside_transcript` |
| FAQ pairs / takeaways / quotes | 536 / 504 / 315 |
| Transcript words | 386,439 |
| Per-episode average | 8.5 FAQ, 8.0 takeaways, ~6,134 words |
| Companies with ≥2 episodes | 82 (of 500 distinct) |
| People with ≥2 episodes | 30 (of 236 distinct) |
| Distinct topics | 20 |

At full coverage those extrapolate to ~2,578 FAQ pairs and ~1.86M indexed
words — that ceiling, not a traffic number, is what the backfill is
actually buying.

### Day 1 gates

- [x] **Caption-track census** — run 1 of 2 complete (Actions run
  `30058384055`, 2026-07-24). Results below.
- [ ] **GSC Coverage export** — submitted vs discovered vs indexed. No bulk
  Index Coverage API exists (`bot/gsc_client.py` only wraps Search
  Analytics); this needs a manual Search Console UI export
  (Indexing → Pages) — the only gate left with no automated path.
- [ ] **GA4 AI-referrer sessions** (chatgpt.com, perplexity.ai, claude.ai) —
  `GA4Client.ai_referrer_sessions()` shipped 2026-07-24
  (`bot/ga4_client.py`), wired into the weekly email
  (`bot/seo_report.py`). Code verified against mocked GA4 responses; the
  live number still needs a `seo-report.yml` dispatch (no GA4 credentials
  available outside Actions) — assumed ~0 until that runs.

#### Census result — the backfill is not source-limited, it is quota-limited

| Bucket | Count |
|---|---|
| Full-length uploads scanned | 262 |
| Already transcribed | 60 |
| **Matched + has captions — the pipeline can reach these today** | **149** |
| Matched but no caption track | 1 |
| No confident episode match | 6 |
| Not yet checked (quota budget) | 46 |

**Automated-path ceiling so far: 212 / 303 (70%)**, rising to ~258 (85%) if
the unchecked 46 carry captions at the same rate — which, at 149 of 150
checked, they almost certainly do.

This overturns the assumption the whole plan was built on. `SEO_ROADMAP.md`
said the Riverside source was exhausted and implied the backfill had run out
of runway; in fact **149 episodes are reachable by the existing automated
pipeline right now**, needing no new transcript source at all. The audio-only
re-upload theory was right: those uploads are invisible to `/videos` but
fully visible to `bot/youtube_client.py`, and YouTube captioned them.

The binding constraint is not transcript supply, it is YouTube quota:
`captions.list` costs 50 units per episode against 10,000/day, so the
pipeline can process at most ~190 episodes/day even ignoring the 6-hour
Actions job cap (~60-90 episodes/run at 4-6 min each).

Two cheap follow-ups worth taking:

- The **6 unmatched** uploads are worth 3 episodes, not 6. Checking each
  against the episodes published nearest it:
  - **3 are second videos for episodes that already have a transcript** —
    the Jushi/Virginia upload is the Trent Woloveck episode (he is Jushi's
    Chief Strategy Director), the White House CBD upload is the Bill
    Morachnick Charlotte's Web episode, and "Richard Proud" is the "Richie
    Proud" episode. Forcing these to match would have overwritten good
    transcripts, so the matcher declining was the right call. Note for W2:
    **one episode can have several videos**, so the video↔episode map has to
    be many-to-one, not a pair.
  - **3 are genuine gaps**: Jesse Redmond (2024-10-24), Erik Knutson /
    Keef Brands (2024-10-10), and Rena Sherbill.
- **The matcher's 60-day window is the reason for the Sherbill miss**, and
  it is a structural risk for back-catalog uploads generally: that episode
  published 2021-04-23 but was uploaded to YouTube 2021-07-08, 76 days
  later. The guest fast-path in `Matcher.find_best_match` normally rescues
  such cases before the window is ever consulted — which is how the Feb 2024
  bulk re-upload of 2019-2023 episodes matched at all — but it needs a
  *strict* name match, and "Rena Sherbill" against the RSS feed's "Rena
  Sherbill Senior Editor" scores 0.65 against a 0.85 threshold. Falling
  through to the scored path then puts it outside the window and it is
  dropped. Widening the window is the wrong fix (it invites bad matches);
  letting the fast path accept a full-name-contained-in-credit match is the
  narrow one.
- Only **1** upload genuinely lacks captions (the 2022 VetCBD episode), so
  "needs a different transcript source" is a ~1-episode problem among videos
  that exist. The real residual gap is the ~39 episodes with no full-length
  upload at all.

### Day 9 — 2026-07-31

Everything here is fully under our control. No traffic metric belongs in
this column; at 8 days post-resubmit those are noise, and reading them only
invites course-correcting on variance.

Targets raised after the census: the original ≥130 was set before we knew
149 episodes were already reachable, which made it a target we'd clear
without trying.

| Metric | Baseline | Target |
|---|---|---|
| Transcripts | 63 | ≥212, **and** every caption-having video exhausted |
| FAQ pairs | 536 | ≥1,800 |
| Transcript words | 386k | ≥1.3M |
| Episodes with `FAQPage` schema | 63 | = transcript count |
| `video-episode-map.json` | doesn't exist | ≥250 of ~287 videos mapped |
| `videoId` on newly written transcripts | 0 | 100% |
| Cross-links present in **server** HTML | 0 | 100% of mapped pairs, both directions |
| GSC submitted / discovered | 563 / TBD | 850 / ≥60% of 850 |
| `npm run build && npm run checkseo` | green | green |

**2026-07-24 progress**: `video-episode-map.json` generator shipped
(`bot/video_episode_map.py`) — reuses the existing `Matcher` from
`bot/simplecast_feed.py`, groups matches many-to-one, verified against
stubbed YouTube/RSS fixtures. Frontend plumbing shipped too:
`app/lib/videoEpisodeMap.ts` (typed forward/reverse lookups) and `videoId`
added to `TranscriptData` (`app/lib/transcripts.ts`); `npm run build &&
checkseo` green. **Not done yet**: the script hasn't been run against
live YouTube data (needs the same OAuth secrets as the census, only
available in Actions — no workflow dispatches it yet, unlike
`coverage-census.yml`), so `app/content/video-episode-map.json` doesn't
exist on disk, and the cross-link UI on episode/video page templates
hasn't been built. Both are next.

**2026-07-24 progress (2)**: both of the "next" items above are now built.
- **Map workflow** — `.github/workflows/video-episode-map.yml` dispatches
  `bot/video_episode_map.py` with the same YouTube OAuth secrets as the
  census, commits `app/content/video-episode-map.json` back using the
  transcript pipeline's rebase-and-retry push loop, and also runs weekly
  (Mon 14:00 UTC, an hour after the daily pipeline so the two don't contend
  for quota). `SCAN_LIMIT` is now read from the environment so the workflow's
  `scan_limit` input actually reaches the script — it was previously a
  hardcoded constant the input could not affect.
- **Cross-link UI** — episode pages render "Watch this episode" beneath the
  audio player (many-to-one: every mapped upload is listed, not just the
  first); video pages render "Full episode, transcript & show notes →"
  beneath the embed. Both resolve in `getStaticProps`, so the links are in
  **server** HTML. Both degrade to rendering nothing when the map file or
  `YOUTUBE_API_KEY` is absent — verified by a clean `npm run build &&
  checkseo` (556 pages) with the map file missing.
- **Matcher fix** — `_name_contained` lets the guest fast path accept a full
  name embedded in a longer RSS credit ("Rena Sherbill" in "Rena Sherbill
  Senior Editor", which scores 0.65 against the 0.85 threshold). The 60-day
  date window is deliberately unchanged. Guarded against false positives: a
  bare first name (<2 tokens) can never match, and "Richard Proud" still does
  not match "Richie Proud", so the three correctly-declined second-video
  uploads stay declined.

**Cross-verified against live YouTube data (2026-07-24)**, by generating the map
locally with a real `YOUTUBE_API_KEY` and building the site:
- 892 uploads on the channel → 341 full-length → **310 matched → 283 episodes**,
  comfortably past the Day-9 target of ≥250. 23 episodes have more than one
  video, confirming the many-to-one map shape was necessary.
- Build produced **843 pages** (up from 556 without the key — the 287 video
  pages). Both cross-link directions verified in **server** HTML via `curl`
  (no JS): the Chris Guthrie episode links to its video and the video links
  back. An unmapped episode renders no "Watch this episode" block.
- **Bug found and fixed by this exercise.** `bot/youtube_client.py` (which feeds
  the map) does not apply the 2024-02-28 audio-only-re-upload exclusion that
  `app/lib/youtube.ts:142` applies, so the map contained **30 video IDs with no
  `/videos/[slug]` page**. No broken links resulted — the UI resolves IDs
  through `getAllVideos()` and drops misses — but coverage was overstated: 283
  episodes appeared mapped while only 276 could render a link, and **7 episodes
  advertised nothing but pageless videos**. `build_map` now skips
  `AUDIO_ONLY_REUPLOAD_DATE`, keeping it in sync with `youtube.ts`.
- Note the two sides still use different duration floors (`youtube_client.py`
  1800s vs `youtube.ts` 180s). Left alone deliberately: that constant also
  governs the transcript pipeline, so changing it is out of scope here. Effect
  is under-inclusion (a missing link), not a broken one.

**Still outstanding**: the map workflow has not been run yet, so the JSON does
not exist on disk and the cross-links render nothing in production until it is
dispatched once. That is the next action.

### Day 30 — 2026-08-22

| Metric | Baseline | Target |
|---|---|---|
| Transcripts | 63 | ≥258 (85%); ~264 with the 6 unmatched hand-mapped. 303 needs a source for the ~39 episodes with no video at all |
| FAQ pairs | 536 | ≥2,190 |
| Transcript words | 386k | ≥1.58M |
| Company entity pages | 0 | ≥82, every one gated at ≥2 real episodes (build fails otherwise) |
| Topic hubs with aggregated FAQ blocks | 0 | 20 |
| `/questions` index | none | live, 1 URL |
| Episodes with a real `og:image` | 0 | = mapped count (`i.ytimg.com`, not `og-default.jpg`) |
| Video pages with chapters / `Clip` schema | 0 | ≥36 (the ones with stored `raw_captions_srt`) |
| Sitemap `video:video` + real video `lastmod` | 0 | ~287 |
| YouTube descriptions linking to episode pages | ~0 | ≥100 |
| GSC discovered | TBD | ≥90% of published URLs |
| GSC indexed | TBD | ≥60% **of the Day-1 URL set only** |
| GSC impressions | TBD | +30–60% |
| GSC clicks | TBD | +0–20% (lagging — don't over-read) |
| AI-referrer sessions | ~0 | first non-zero |

Indexation is deliberately scored only against URLs that existed on Day 1.
Anything published in week 2–3 will still be in Google's discovery queue on
Day 30, and judging it as "not indexed" would make a working plan look
broken.

### Corrections to earlier assumptions

- **The 28-topics-vs-20-hubs gap does not exist.** Measured over published
  episodes there are exactly 20 distinct topics, and all 20 have hubs. No
  work to do here.
- **The audio-only re-uploads are invisible to the site but visible to the
  pipeline.** The Feb 2024 bulk upload of 54 back-catalog episodes is
  filtered out of `/videos` by `app/lib/youtube.ts`, but `bot/youtube_client.py`
  filters only on duration — so those uploads are still candidates for the
  transcript pipeline, and YouTube auto-captions audio uploads. If they have
  caption tracks, that is ~54 episodes of coverage from a source the Riverside
  note above declared exhausted. The Day-1 census settles it.
- **One transcript was a superseded duplicate, now deleted.**
  `chris-guthrie-why-cannabis-companies-shouldnt-vibe-code-their-erp.json`
  (the lone `manual_transcript`) had no matching episode in the RSS feed, so
  it rendered nowhere. The same episode is published under
  `understand-this-before-you-use-ai-to-build-software-ft-chris-guthrie`,
  which already has a `youtube_captions` transcript generated 12 days later
  and strictly richer — it has `summary`, `entities`, and `raw_captions_srt`,
  none of which the manual one had. Deleted rather than renamed: renaming
  would have clobbered the better file. Real coverage was always 63, not 64.

## MVP — now

- [ ] Split composite guest credits ("Kristin & Eric Rogers", "Emily Fisher & Dr June Chin") into separate `Person` entities instead of one combined entity page — needs real name-parsing, deliberately deferred when guest entity pages shipped (see Shipped) rather than guessed at with a quick regex
- [ ] Backfill AI transcripts for the remaining ~236 episodes that don't have one yet — this is the actual content-and-authority lever; the technical SEO/entity-page work only helps pages that have real content behind them. Two sources feed this, run separately:
  - `bot/transcript_pipeline.py` — YouTube captions, for any episode with a matched video (scheduled, ongoing, runs itself as new episodes/videos publish)
  - `bot/backfill_transcript.py` — manual one-off path for episodes with no YouTube captions, using a raw transcript pulled from Riverside.fm's internal transcript API (see PR #23, "Riverside pull 1"). **This source is now exhausted** — all 78 Riverside recordings on file (Feb 2025–present) are either already transcribed or matched and backfilled; every remaining episode predates Riverside adoption entirely. The next round needs a different transcript source (e.g. pulling audio straight from Simplecast through a transcription service) — there's no more low-hanging fruit from Riverside.

## Hub layer — next (as the library grows)

- [ ] `sameAs` links (LinkedIn/Twitter) on guest `Person` schema, once guest entity pages exist to source them from
- [ ] `og:image` is currently the same generic `og-default.jpg` on every episode page — no per-episode/guest thumbnail for social/LLM preview cards
- [ ] Sitemap `lastmod` for video pages still uses the build timestamp, not the real YouTube `publishedAt` date — episode pages already get a real per-URL `lastmod` from the RSS feed (see Shipped), but doing the same for videos means either an extra YouTube Data API call from `next-sitemap.config.js` (quota cost for a nice-to-have) or a shared cache file written during `next build` for `next-sitemap` to read afterward
