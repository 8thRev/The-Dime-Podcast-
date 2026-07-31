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
- [x] Fixed live 404s on 7 of 287 `/videos/[slug]` pages (`app/lib/youtube.ts`). Root cause: `fetchAllVideoIds`/`fetchVideoDetails` silently swallowed YouTube API errors — a bare `console.error` + `break`/`catch` that returned whatever had been collected so far, indistinguishable from "the rest of the channel doesn't exist." Once a transient hiccup (quota, 5xx) hit *during* an ISR background regeneration for a specific video page, `getVideoBySlug` returning `null` made `getStaticProps` return `notFound: true`, which permanently overwrote that page's previously-good cached HTML with a 404 — confirmed live (all 7 URLs 404'd consistently across repeated requests, and the video itself is still public on YouTube). Both fetch functions now throw on API failure instead, so Next.js keeps serving the last good page and retries on the next request rather than caching a false 404; per-item processing is now wrapped so one malformed item (missing `statistics`, missing `thumbnails.high`) can't cascade into dropping every video after it in the fetch order. Also added a conversion CTA to `/videos` (`app/src/pages/videos.js`), which previously had no capture mechanism at all. Went with a "Subscribe on YouTube" button (`?sub_confirmation=1` deep link) rather than email: video-page visitors have already shown video intent, so a one-click platform-native subscribe matches that better than an email form, and the site's email list ("First Principles") is a distinct written-analysis product, not an episode-alert feed, so wiring it up here would have overpromised on what signing up gets you.

- [x] Templated Newton Insights sponsor slot on **all 303** episode pages (`app/lib/sponsor.ts`, `app/src/components/SponsorSlot.js`, wired in `app/src/pages/episodes/[slug].js`), plus a `sponsor` Organization node on the episode `PodcastEpisode` JSON-LD (`app/lib/schema.ts`). Newton is a sister company (both it and The Dime are Eighth Revolution LLC) and this site's search authority is meant to route to Newton. Before this, the only Newton link on the site came from per-episode Simplecast show notes — present on **48 of 303** episodes. Specifics worth keeping:
  - Target is `https://www.newton-insights.com/?utm_source=Thedime&utm_medium=referral&utm_campaign=episode_sponsor` — Newton's **homepage**. An earlier revision of this block pointed at `/request-demo`; it was retargeted before merge and the full reasoning lives in the header comment of `app/lib/sponsor.ts`. Short version: 303 templated site-wide links carrying commercial anchors into a conversion page is a recognizable manipulative-link footprint; the homepage is the hub that distributes authority to the rest of the Newton site anyway (its internal links to `/request-demo` were `<button onClick>` handlers no crawler could follow, which has since been fixed on the Newton side); and a listener mid-episode is cold traffic for whom a demo form is a high-commitment ask. Anchors were rewritten brand-led to match.
  - UTM params, not the shorter `?ref=dime` this block first used. GA4 only auto-parses `utm_*`, and the `rel="noreferrer"` below strips the Referer header — so `?ref=dime` would have landed all 303 links in GA4 as **direct traffic**, unattributable. `utm_source` reuses the existing `Thedime` value so reporting stays continuous; the distinct medium/campaign separate this templated slot from the hand-written show-note reads. No SEO cost: Newton's homepage serves a self-referencing canonical, so the parameterized URL consolidates.
  - `rel="noopener noreferrer"`, deliberately **no `nofollow`** — passing equity is the entire point, and the relationship is disclosed in the block itself ("Episode Sponsor · Newton Insights").
  - Anchor text is picked from 10 descriptive variants (and the lead paragraph from 3) by hashing the episode slug — **deterministic, not random**. 303 byte-identical anchors read as machine link-building, and a random per-render pick would produce a server/client hydration mismatch. Verified distribution across the 303 built pages: 18–41 uses per anchor, and a given episode renders the same anchor on every rebuild.
  - **Duplicate handling**: on the 48 episodes whose show-notes HTML already renders the sponsor read, the block collapses to a compact one-line credit (`compact` prop, driven by `showNotesMentionSponsor()`) so the same pitch doesn't appear twice on one page. Verified in built HTML: 255 pages full mode, 48 compact — exactly the 48 that carry the read.
  - The `sponsor` node uses `@id: https://www.newton-insights.com/#organization`, the same `@id` the Newton site emits for its own Organization, so the two sites' JSON-LD resolve to one entity instead of two look-alikes. Verified all 303 `PodcastEpisode` blocks parse and carry it, with the existing FAQ/Breadcrumb blocks intact.
- [x] Host-level 301 for the `eighthrevolution.com` alias domain (`app/next.config.js` `redirects()` with a `has` host condition, both apex and `www`). That host is aliased onto this same deployment: its homepage served the Dime homepage, but `/episodes`, `/episodes/<slug>`, `/guests`, `/topics`, `/about`, and `/newsletter` all 404'd on it — crawl budget and any inbound equity going into dead URLs. Uses `statusCode: 301` rather than `permanent: true` (which Next emits as a 308); both are permanent to Google, but 301 needs no qualification for older crawlers and link tools. Loop safety is structural, not incidental: Next compiles `has` host values to `new RegExp("^" + value + "$")` against the lowercased, port-stripped Host header, and the dots are escaped — so `dimepodcast.com`/`www.dimepodcast.com`, the destination, can never match. Verified against a real `next start` with forged Host headers: 301 for apex/`www`/mixed-case/with-port `eighthrevolution.com` (query strings preserved), 200 and no redirect for both dimepodcast.com forms.

- [x] **First Principles archive at `/newsletter/[slug]`** — infrastructure for re-homing the 31 LinkedIn newsletter editions onto the site as human-written articles (`app/lib/newsletter.ts`, `app/src/pages/newsletter/`, `createArticleSchema()` in `app/lib/schema.ts`). `/newsletter` went from a bare ConvertKit signup form to an archive index over the editions, keeping the signup above the fold. Specifics worth keeping:
  - **Why this is worth doing at all, given the editions are already published on LinkedIn.** The Google case is the weaker half: LinkedIn published first and outweighs this domain, so a verbatim mirror risks being filtered as the duplicate. The decisive argument is GEO, not SEO — **LinkedIn blocks AI crawlers** (GPTBot/ClaudeBot/etc. are disallowed in their robots.txt, and newsletter articles gate to non-logged-in fetchers), so 31 pieces of the best human-written analysis produced by this show are currently invisible to every answer engine. This site already carries explicit AI-crawler allow rules and an `llms.txt`. Moving them here is a pure win on that axis regardless of how the Google side lands.
  - Self-canonical, **not** canonical-to-LinkedIn. Pointing the canonical at LinkedIn would forfeit the entire exercise. The on-site version is instead made the *richer* one — episode/guest/topic cross-links, Article schema, an archive it belongs to — rather than a byte-identical copy. `linkedinUrl` frontmatter renders a visible "Originally published on LinkedIn" credit for provenance; it is deliberately not a `rel=canonical`.
  - **These are the only human-written long-form pages on the site.** Everything else of length (transcripts, TL;DRs, takeaways, FAQ) is AI-generated from audio and carries `<AIDisclosure>`. The edition template deliberately does **not** render that banner, uses a `Person` byline, and gets `Article` schema with no `disclaimer` field. `llms.txt` lists the First Principles section *above* Topics and Episodes and labels it "Not AI-generated" — the distinction is the point.
  - **`episodeSlug` frontmatter is the load-bearing field.** It is what makes these 31 pages reinforce the existing 303-episode graph instead of sitting beside it as orphans: the edition links to its episode, and the episode page gains an "analysis behind this episode" block placed alongside the audio player and video cross-link (the third format of the same conversation). Guest entity pages gain a "Written analysis" section, topic hubs gain an "Analysis on <topic>" block *above* the episode list — a topic hub is otherwise a bare list of links with no prose an answer engine can quote. All four resolve in `getStaticProps`, so the links are in **server** HTML, and all four render nothing when no edition matches.
  - Schema uses `isPartOf: CreativeWorkSeries "First Principles"` so the editions read as one named publication rather than N loose posts, and `about: PodcastEpisode` restating the episode relationship for machines.
  - Payload discipline: `toSummary()` strips the markdown body on every list/cross-link surface. Without it `/newsletter` would ship 31 × ~600 words of unrendered prose into `__NEXT_DATA__` — the same trap already fixed on `/episodes` and still open on the episode detail page (see the 2026-07-27 note below).
  - **Ingestion**: `app/scripts/import-linkedin-editions.mjs` converts the Articles folder from a LinkedIn data export into `content/newsletter/*.md`, guessing each edition's episode via rarity-weighted (IDF) title-word overlap against the live RSS feed plus a full-guest-name fast path — the same principle as `bot/simplecast_feed.py`'s `Matcher`, reimplemented small rather than shared, since the two run in different languages over different inputs. A low-confidence or ambiguous match leaves `episodeSlug` **blank** and writes a `<!-- REVIEW: -->` comment into the file rather than committing a confident guess: a blank cross-link is recoverable, one pointing at the wrong conversation is not. `topics` is left empty by design — it has to come from the fixed taxonomy the `/topics` hubs are built on, and an invented tag would create a hub-less topic linking nowhere.
  - Verified with a temporary fixture edition (deleted before commit): Article + BreadcrumbList JSON-LD parse; all four cross-link directions present in server HTML; an unrelated episode renders no block; real frontmatter `lastmod` in the sitemap; `npm run build && checkseo` green **both** with the fixture and with `content/newsletter/` empty (the clean-degrade path, same contract as `videoEpisodeMap.ts`).
- [x] **All 31 editions imported** (`app/content/newsletter/*.md`). The newsletter is **"Unpacking Cannabis — First Principles"**, published under the **The Dime Podcast company page** (LinkedIn org 28969050), not Bryan's member account — which is why the personal LinkedIn data export came back with none of them and `scripts/import-linkedin-editions.mjs` had nothing to convert. They were pulled through a logged-in browser session instead. Dates span 2025-08-28 → 2026-05-27; every edition trails its episode by 0–7 days, which was used as the independent check on each episode match.
  - Cleanup applied uniformly on import: LinkedIn profile/company links flattened to plain text (they were **relative** `/in/...` hrefs that would have rendered as broken *internal* links on this domain), the "Apple Links | Spotify Links | YouTube Links" footer dropped (redundant with the episode cross-link block), and the trailing "Bryan Fields" sign-off removed (the page has a byline). Genuine external links — `newton-insights.com`, `active710.com` — are kept and followable.
  - Verified against a running server, all 31: article page 200 with self-canonical + `Article` + `BreadcrumbList` schema and **no** AI-disclosure banner; episode page links back; every topic hub listed in frontmatter links to it; 31/31 in `llms.txt`; 31 sitemap URLs with real frontmatter `lastmod` and zero duplicates; `npm run build && checkseo` green.
  - **Two guest cross-links don't resolve, both from a pre-existing `extractGuest()` bug in `app/lib/rss.ts` — not from this work.** 13 of 222 guest pages have malformed slugs; three are outright wrong, taking a title fragment instead of a name: `playbook-for-cannabis-building-trust-through-tech-ft-ashwin-raj` (should be `ashwin-raj`), `cannabis-model-is-disrupting-the-industry-ft-obie-strickler` (should be `obie-strickler`), and `helping-cannabis-start-ups-light-up` (a tagline, not a person). Separately, episodes whose titles carry no "ft." credit — e.g. the Cheech & Chong episode with Jonathan Black — produce no guest entity at all. The edition frontmatter deliberately carries the **correct human name** in both cases, so these cross-links wire themselves up the moment `extractGuest()` is fixed. Worth fixing on its own merits: those are three wrong-and-indexed entity pages.
- [x] Fixed duplicate URLs in the XML sitemap, found while verifying the above. All **9** static pages (`/`, `/episodes`, `/videos`, `/topics`, `/guests`, `/about`, `/newsletter`, `/privacy`, `/terms`) were emitted **twice** — once by `additionalPaths()` with its hand-set priority, once by next-sitemap's own page scan with the config default — so which priority Google honoured was arbitrary, and the entire point of `additionalPaths()` was being coin-flipped away on every build. The two copies also carried different `lastmod` timestamps. `transform()` now returns `null` for those paths so only the intentional version survives, and the list lives in one `STATIC_PAGES` const instead of being duplicated between the two functions. Sitemap went 852 → 843 URLs, zero duplicates, all 9 intended priorities intact. Pre-existing, not introduced by the newsletter work.

## Guardrails — how new pages stay correct

Every page renders `<SeoHead>` (`app/src/components/SeoHead.js`) instead of a hand-rolled `next/head` block. It owns title/description truncation (`truncateTitle`/`truncateDescription` in `app/lib/schema.ts`), the canonical tag, and OG/Twitter tags — so a new page can't reintroduce the duplicate-description or uncapped-length bugs by construction. Two enforcement layers back this up:

- **Lint**: `app/.eslintrc.json` restricts importing `next/head` outside `SeoHead.js` itself.
- **Build tripwire**: `npm run checkseo` (wired into `npm run build` via `app/package.json`) statically scans every page file and fails the build if anything imports `next/head` directly or renders a raw `<title>`/`<meta name="description">` tag. See `app/scripts/check-seo.mjs`.

New pages: add them to this list, don't hand-roll `<head>` tags, and this stays true without anyone having to remember to re-audit.

**Publish written analysis here first, LinkedIn second.** The 31 backfilled editions inherit a duplicate-origin problem that can't be undone — LinkedIn's copy is older and on a stronger domain. Every edition from now on should go live at `/newsletter/<slug>` before or on the same day it posts to LinkedIn, with the LinkedIn version linking back to it. That makes this domain the demonstrable original and stops the problem recurring 31 more times.

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
  `GA4Client.ai_referrer_sessions()` shipped and dispatched live
  2026-07-24 (Actions run `30095198022`): **Total: 0**. Not a trustworthy
  read yet, but for a benign reason, not a bug: the `NEXT_PUBLIC_GA_ID`
  gtag tag (`app/src/pages/_app.js`) only went live 2026-07-23 night —
  it's a build-time env var, so it only fires starting from the first
  deploy after it was set. The reported week (2026-07-15 to 2026-07-21)
  entirely predates it, and the "trailing 30 days" query is still inside
  GA4's standard-reporting processing lag (hours, sometimes ~1-2 days)
  on top of less than a day of real collection. Re-check in 24-48 hours
  once real data has had time to land — no property/tag fix needed.
  Separately found and **not yet fixed**: `EMAIL_PASSWORD` has been
  broken (SMTP auth failure) since 2026-07-17 — every run of
  `seo-report.yml` and `daily.yml` that reaches the email-send step has
  failed since then. Needs the Gmail App Password regenerated and
  re-saved to the secret (human action, not automatable).

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
| Episode pages with a followable Newton link | 48 (show notes only) | 303 |
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

**2026-07-24 backfill dispatch** (Actions run `30094672346`,
`limit=262 max_new=35`): transcripts **66 → 81** (+15, confirmed via
`coverage_report.py`), each new record carrying a real `videoId` — first
production proof the PR #29 fix works. Fell well short of the 35 target:
aborted on the 5-consecutive-failure circuit breaker
(`bot/transcript_pipeline.py`) after hitting YouTube 403 quota errors at
~52 minutes in. The assumption that quota resets at midnight Pacific
(and so a 12:52 UTC dispatch would be on a fresh pool, clear of an
earlier same-day failed run at 02:13 UTC) **did not hold up**: this run's
own usage (15 successes + 6 failed attempts, all *new* API calls —
verified `bot/transcript_pipeline.py`'s "already exists" skip path is a
pure filesystem check, zero quota cost) totals nowhere near 10,000 units
on its own, so residual exhaustion from earlier in the day was still in
effect despite the theoretical reset window having passed. Ruled out a
concurrent scheduled run as the cause (`gh run list` shows no `schedule`-
triggered run fired in this window). **Lesson: don't plan same-day
redispatch timing around the assumed reset schedule — verify quota
headroom empirically before dispatching again.** Next dispatch should
wait for a day with a verified-clean quota start.

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

**Independent corroboration of the quota finding**: the live cross-verification
above exhausted the daily quota after only ~50 units of its own
(`playlistItems` + `videos.list` paging, twice), returning
`403 quotaExceeded`. That is nowhere near 10,000 units, so it confirms the
backfill dispatch's conclusion from a second direction: the pool was already
drained by earlier activity and did not reset on the assumed schedule. Treat
quota headroom as something to measure, never to assume.

**Still outstanding**: the map workflow has not been run yet, so the JSON does
not exist on disk and the cross-links render nothing in production until it is
dispatched once. That is the next action — and per the finding above, it should
wait for a day with verified-clean quota rather than an assumed reset.

**2026-07-27 — Newton link routing**: the sponsor slot, sponsor schema, and
`eighthrevolution.com` 301 all shipped (see Shipped). Episode pages carrying a
followable Newton link went 48 → 303. The slot was retargeted from
`/request-demo` to Newton's homepage before merge, and `?ref=dime` swapped for
UTM params so GA4 can attribute the traffic — both decisions are documented in
the Shipped entry and in `app/lib/sponsor.ts`. Two things this exercise
surfaced that are **not** fixed here:

- **`/videos/[slug]` cannot be built locally right now.** A full `npm run
  build` with the real `YOUTUBE_API_KEY` fails on `playlistItems API error:
  403` — the same quota exhaustion documented above, and now the third
  independent sighting of it. Verification was done with the key blanked
  (`YOUTUBE_API_KEY= npm run build`), which is the documented clean-degrade
  path: 556 pages, no video pages. Confirmed the 403 is pre-existing by
  reproducing it on an unmodified tree. Nothing in this change touches
  `/videos`.
- **Episode-page payload bloat.** `getStaticProps` in
  `app/src/pages/episodes/[slug].js` passes the full `relatedEpisodes`
  objects, each carrying its complete `showNotes` HTML, into `__NEXT_DATA__`
  — so every episode page ships up to 5 other episodes' show notes it never
  renders. This is the same bug already fixed for `/episodes` (see Shipped,
  "the `/episodes` list props were slimmed"), just not for the detail page.
  Found while counting Newton links in the built HTML: a naive grep reported
  194 pages carrying the show-notes sponsor link instead of 48, because the
  other 146 had it inside a *related* episode's serialized props.

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
