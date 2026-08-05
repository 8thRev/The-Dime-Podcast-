# The Dime: Analytics, SEO, and GEO Implementation Spec

**Repo path:** `docs/analytics-spec.md`
**Property:** GA4 `The Dime Podcast` (533936792) · Stream `Dime Podcast` (14409353816) · Measurement ID `G-LQZKLCKWSV`
**Stack:** Next.js pages router on Vercel · gtag.js direct (no GTM) · Kit (ConvertKit) forms · Vercel Web Analytics + Speed Insights
**Written:** Aug 5, 2026
**Audience:** Claude Code (Parts 1 to 4) and the site owner (Part 5 and 6)

---

## Implementation status

All of Part 2 is implemented on branch `analytics-pageview-fix`. Where the code
departs from what this document specifies, the reason is in the commit message
for that part; the departures are summarised here.

| Part | State | Where it lives | Departure from this doc |
|---|---|---|---|
| 2.1 Pageview fix | Shipped | `app/lib/analytics.ts`, `_document.js`, `_app.js` | gtag bootstrap inline in `<head>`, not a `next/script`. `config` omits `page_location`/`page_title` — in a config call they become sticky defaults for every later event. Route-change pageview waits for the head mutation that applies the new title, not `setTimeout(0)`, which read the previous page's title. Shallow route changes ignored. |
| 2.2 Audio | Shipped | `app/lib/useAudioTracking.ts` | `episode_number` parsed to a number. Freeform RSS keywords never sent as `episode_topic`. Milestones require playback to have started. `audio_complete` deduped. `audio_seek` debounces on the trailing edge. |
| 2.3 YouTube | Shipped | `app/src/pages/videos/[slug].js` | No `origin` — a build-time value cannot match every host these pages are served from, and a mismatch silently kills the events. No `autoplay=1` — it would make `video_start` count page loads. API loaded on the video route, not site wide. |
| 2.4 Search | Shipped | `app/lib/useSearchTracking.ts` | Event only; the page already syncs `?q=` and rehydrates from it. `search_term` dropped when it looks like an email address. |
| 2.5 Platform clicks | Shipped | `app/lib/platformClicks.ts` | `link_location` is a union type. No call site for `episode_page` — there are no platform links on episode pages. |
| 2.6 Newsletter | Shipped | `app/lib/newsletterSignup.ts` | Listens only for `ckjs:submission:complete`, the event `ck.6.js` actually dispatches; `convertkit:form-success` does not exist in it. No native `submit` listener — Kit submits over AJAX, so `submit` fires on failures too. |
| 2.7 Sponsor funnel | Shipped | `app/lib/sponsorFunnel.ts` | `campaign_goal` and `target_customer` **not sent** — both fields are textareas, so free text. The form has no server submit; it hands off to `mailto:`, so `sponsor_inquiry_submit` means "validated and handed to the mail client" and overcounts against inquiries received. |
| 2.8 Read depth | Shipped | `app/lib/useReadTracking.ts` | None. |
| 2.9 Video outbound clicks | Shipped | `app/lib/videoClicks.ts` | Added after Part 2. Reuses `link_location` rather than adding a location parameter. Non-key event by design. |
| 2.10 Video library search | Shipped | `app/src/pages/videos.js` | Added after Part 2. Call site for the 2.4 hook. No `?q=` sync on `/videos`, deliberately. `search_result_click` gained `search_location` and a `video_slug` variant. |
| Change D (admin) | Done Aug 5, 2026 | GA4 admin | "Page changes based on browser history events" turned off after Part 2 reached production. "Page loads" left on (GA4 locks it). See 2.1. |
| Dimension registration | Done Aug 5, 2026 | GA4 admin | `video_id`, `video_slug`, `search_location` registered, event scoped. 15 of 15. See Part 1. |

Three events named in Part 3 have no Part 2 section and no code: `topic_filter`
(no topic filter control exists), `episode_share` (Part 3 says "add if absent" —
still absent) and `guest_inquiry_submit` (blocked on the form in Part 5.3).

Everything in Parts 5 and 6 remains outstanding.

---

## How to use this document

Parts 1 through 4 are the implementation contract. Work them in order. Part 1 is non negotiable naming; if you rename a parameter the corresponding GA4 custom dimension silently goes empty and nothing throws an error.

Part 5 is owner action items that cannot be done from the repo.

Part 6 is the SEO and GEO work, which is partly code and partly owner decision. It is separated because it has a different reviewer and a different definition of done.

---

## Part 0: Current state (already done, do not redo)

These GA4 admin changes were applied on Aug 5, 2026 and are live:

| Change | State |
|---|---|
| Event data retention | 14 months (was 2) |
| 12 custom dimensions | Registered, event scoped, empty until events fire |
| Google signals | Enabled, 307 of 307 regions |
| Search Console link | Linked to `dimepodcast.com` Domain property + Dime Podcast stream |
| Life cycle report collection | Published (Retention and Engagement reports now reachable) |

Two known non actions:

- **`purchase` cannot be unmarked as a key event.** GA4 locks it. It will sit at zero forever. Ignore it.
- **Enhanced measurement "page changes based on browser history events" is still ON.** It must stay on until the pageview fix in Part 2.1 deploys, because it is currently the only thing firing a pageview on client side navigation. See Part 2.1 for the exact sequencing.

---

## Part 1: The parameter contract

**These names are fixed.** Do not rename, do not camelCase, do not abbreviate. If a refactor makes one of these names awkward, change the variable name in the code, not the string passed to `gtag`.

All fifteen rows are registered as GA4 custom dimensions, event scoped: the first twelve in Part 0, and `video_id`, `video_slug` and `search_location` on Aug 5, 2026 alongside 2.9 and 2.10. `search_location` was the one that had slipped — it shipped with Part 2.4 and was never added to this table or to the property, so archive searches had been landing in an unregistered parameter since Part 2.

Registration is not retroactive: only events received *after* it takes effect populate the dimension. Register before relying on a report, not after noticing it is empty.

| GA4 dimension | Parameter string | Type | Example values |
|---|---|---|---|
| Episode Slug | `episode_slug` | string | `hirsh-jain-rescheduling-is-already-picking-winners` |
| Episode Number | `episode_number` | number | `306` |
| Guest Name | `guest_name` | string | `Hirsh Jain` |
| Episode Topic | `episode_topic` | string | `rescheduling-and-federal-policy` |
| Content Type | `content_type` | string | `episode_audio` `video` `newsletter` `guest_profile` `topic_hub` |
| Percent Played | `percent_played` | number | `10` `25` `50` `75` `90` |
| Percent Read | `percent_read` | number | `25` `50` `75` `100` |
| Platform | `platform` | string | `apple_podcasts` `spotify` `youtube` |
| Link Location | `link_location` | string | `hero` `footer` `episode_page` `video_library` `home_video_shelf` `video_page` |
| Video ID | `video_id` | string | `dQw4w9WgXcQ` |
| Video Slug | `video_slug` | string | `hirsh-jain-on-rescheduling` |
| Search Location | `search_location` | string | `episodes_archive` `video_library` |
| Signup Location | `signup_location` | string | `newsletter_page` `footer` `episode_inline` `home_hero` |
| Search Term | `search_term` | string | lowercased, trimmed |
| CTA Location | `cta_location` | string | `hero` `pricing` `inline` `footer` |

**Enumerated values matter.** `platform` must be exactly one of the three strings above. Free text will fragment the dimension and make it useless. Same for `content_type` and `link_location`. Define these as TypeScript union types and let the compiler enforce it.

### PII prohibition

Never pass into any event parameter: email address, personal name typed into a form, free text message bodies, phone numbers.

`guest_name` is allowed because it is published editorial metadata about a public podcast guest, not user data.

For the sponsorship form, send `company_provided: true` (boolean), not the company string, unless the field becomes an enumerated dropdown. `campaign_goal` and `target_customer` are only safe if they are enumerated select values. If they are free text inputs today, either convert them to selects or do not send them.

The stream already has email redaction active. Do not rely on it as your only defense.

---

## Part 2: Implementation, file by file

### 2.1 The pageview fix (do this first, alone, and verify before continuing)

**Problem observed live.** The site calls `gtag('config', 'G-LQZKLCKWSV', { page_path: <route> })` on hard load. On client side navigation the site sends nothing, so GA4's own history listener fires the pageview and carries the stale `page_path` forward. Captured going from `/` to `/episodes`:

```
en=page_view
dl=https%3A%2F%2Fwww.dimepodcast.com%2Fepisodes   <- updated
dt=All%20Episodes%20...                            <- updated
dp=%2F                                             <- STALE
```

Corroboration: `/` has 269 views against 169 landing sessions. `/episodes`, a link in every page's nav, appears once as a landing page and never in the top 10 by views.

**Change A, `pages/_document.tsx`** (or wherever the gtag snippet lives). Remove `page_path`, disable automatic pageviews:

```js
gtag('config', 'G-LQZKLCKWSV', {
  send_page_view: false,
  page_location: window.location.href,
  page_title: document.title
});
```

**Change B, new file `lib/analytics.ts`:**

```ts
export const GA_ID = 'G-LQZKLCKWSV';

export type Platform = 'apple_podcasts' | 'spotify' | 'youtube';
export type ContentType = 'episode_audio' | 'video' | 'newsletter' | 'guest_profile' | 'topic_hub';

type Params = Record<string, string | number | boolean | undefined>;

const isProd = process.env.NODE_ENV === 'production';

export function track(event: string, params: Params = {}) {
  if (typeof window === 'undefined' || typeof (window as any).gtag !== 'function') return;
  const clean: Params = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') clean[k] = v;
  (window as any).gtag('event', event, clean);
  if (!isProd) console.log('[ga4]', event, clean);
}

export function pageview(url: string) {
  if (typeof window === 'undefined' || typeof (window as any).gtag !== 'function') return;
  (window as any).gtag('event', 'page_view', {
    page_location: window.location.origin + url,
    page_title: document.title,
    page_referrer: document.referrer || undefined,
  });
}

/** Fire a milestone at most once per page view. */
export function once(key: string, fn: () => void) {
  const w = window as any;
  w.__fired = w.__fired || new Set<string>();
  if (w.__fired.has(key)) return;
  w.__fired.add(key);
  fn();
}

export function resetMilestones() {
  (window as any).__fired = new Set<string>();
}
```

**Change C, `pages/_app.tsx`:**

```tsx
useEffect(() => {
  pageview(router.asPath);

  const onRouteChange = (url: string) => {
    // title updates after the route commits; next tick keeps them in sync
    setTimeout(() => { pageview(url); resetMilestones(); }, 0);
  };

  router.events.on('routeChangeComplete', onRouteChange);
  return () => router.events.off('routeChangeComplete', onRouteChange);
}, []);
```

**Change D, GA4 admin, at deploy time not before.** Admin → Data streams → Dime Podcast → Enhanced measurement → gear → Page views → Show advanced settings → turn OFF "Page changes based on browser history events."

> **Sequencing is critical.** Turning D off before A/B/C ship means SPA navigations produce no pageview at all, which is worse than the current stale path. Shipping A/B/C without turning D off means every route change is counted twice. They go together.

**Both halves are now done.** A/B/C reached production (verified: the live HTML
serves `gtag('config',"G-LQZKLCKWSV",{send_page_view:false})`), and D was turned
off on Aug 5, 2026 once that was confirmed. Between the merge and that change
there is a window where client-side navigations were counted twice — expect a
short spike in `page_view` against sessions, and do not read it as a traffic
change.

**Acceptance:** navigate `/` → `/episodes` → an episode → `/sponsorship`. In DebugView, exactly one `page_view` per step, `page_location` matching the URL every time, no `dp` parameter present at all.

Do not run that acceptance check immediately after flipping D. The enhanced
measurement setting is baked into the cached `gtag/js` config a browser already
holds, so a test in the first hour can still show the old double-count and prove
nothing.

---

### 2.2 Audio listen tracking (highest value gap)

Episode pages render a native `<audio controls preload="metadata">`. GA4 video enhanced measurement covers embedded YouTube iframes only and does not observe `<audio>` in any configuration. Currently zero listen data exists.

New file `lib/useAudioTracking.ts`:

```ts
const MILESTONES = [10, 25, 50, 75, 90];

export function useAudioTracking(
  ref: React.RefObject<HTMLAudioElement>,
  meta: { slug: string; number?: number; guest?: string; topic?: string }
) {
  const lastSeek = useRef(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = {
      episode_slug: meta.slug,
      episode_number: meta.number,
      guest_name: meta.guest,
      episode_topic: meta.topic,
      content_type: 'episode_audio' as const,
    };

    const onPlay = () => once(`audio_play:${meta.slug}`, () =>
      track('audio_play', { ...ctx, audio_duration: Math.round(el.duration) || undefined }));

    const onTimeUpdate = () => {
      if (!el.duration || !isFinite(el.duration)) return;
      const pct = (el.currentTime / el.duration) * 100;
      for (const m of MILESTONES) {
        if (pct >= m) once(`audio_${m}:${meta.slug}`, () =>
          track('audio_progress', {
            ...ctx,
            percent_played: m,
            seconds_played: Math.round(el.currentTime),
            audio_duration: Math.round(el.duration),
          }));
      }
    };

    const onEnded = () =>
      track('audio_complete', { ...ctx, seconds_played: Math.round(el.duration) });

    const onSeeked = () => {
      const now = performance.now();
      if (now - lastSeek.current < 500) return;  // debounce scrub drags
      lastSeek.current = now;
      track('audio_seek', { ...ctx, seek_to: Math.round(el.currentTime) });
    };

    el.addEventListener('play', onPlay);
    el.addEventListener('timeupdate', onTimeUpdate);
    el.addEventListener('ended', onEnded);
    el.addEventListener('seeked', onSeeked);
    return () => {
      el.removeEventListener('play', onPlay);
      el.removeEventListener('timeupdate', onTimeUpdate);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('seeked', onSeeked);
    };
  }, [ref, meta.slug]);
}
```

**Acceptance:** play, scrub to 60%, let it run. `audio_play` once. `audio_progress` at 10, 25, 50 exactly once each. Rewinding and replaying does NOT refire them.

---

### 2.3 YouTube video tracking (one line, 288 pages)

Verified live: video page iframes have no `enablejsapi=1` and `window.YT` is undefined, so GA4's video enhanced measurement collects nothing across all 288 video pages.

```tsx
const src =
  `https://www.youtube.com/embed/${videoId}` +
  `?enablejsapi=1&origin=https://www.dimepodcast.com&rel=0`;
```

And in `_document.tsx`, load the API once site wide:

```html
<script src="https://www.youtube.com/iframe_api" async />
```

No custom event code. GA4 produces `video_start`, `video_progress`, `video_complete` automatically once the API is reachable.

**Acceptance:** play any embed, confirm `video_start` in DebugView with no custom code involved.

---

### 2.4 Archive search

`/episodes` filters 306 episodes client side. Verified: typing does not change the URL, add a query string, or push history. GA4 site search reads URL query parameters only, so `view_search_results` has never fired.

```ts
export function useSearchTracking(term: string, resultsCount: number, location = 'episodes_archive') {
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const router = useRouter();

  useEffect(() => {
    clearTimeout(timer.current);
    const q = term.trim();
    if (q.length < 3) return;

    timer.current = setTimeout(() => {
      track('search', {
        search_term: q.toLowerCase(),
        search_results_count: resultsCount,
        search_location: location,
        zero_results: resultsCount === 0,
      });
      router.replace(
        { pathname: router.pathname, query: { ...router.query, q } },
        undefined,
        { shallow: true }
      );
    }, 800);

    return () => clearTimeout(timer.current);
  }, [term, resultsCount]);
}
```

Also read `?q=` on mount to hydrate the input, so shared and indexed search URLs work.

On result click while a query is active:

```ts
track('search_result_click', {
  search_term: q.toLowerCase(),
  result_position: index + 1,
  episode_slug: slug,
});
```

**Acceptance:** typing "rescheduling" produces exactly one `search` event, not one per keystroke, and the URL becomes `/episodes?q=rescheduling`.

---

### 2.5 Platform subscribe clicks

Currently all outbound clicks merge into 6 undifferentiated `click` events per month. Split them.

```ts
const PLATFORM_MAP = [
  { match: 'podcasts.apple.com', name: 'apple_podcasts' },
  { match: 'open.spotify.com',   name: 'spotify' },
  { match: 'youtube.com',        name: 'youtube' },
] as const;

export function trackPlatformClick(href: string, location: string, episodeSlug?: string) {
  const hit = PLATFORM_MAP.find(p => href.includes(p.match));
  if (!hit) return;
  track('platform_subscribe_click', {
    platform: hit.name,
    link_location: location,
    episode_slug: episodeSlug,
    is_sub_confirmation: href.includes('sub_confirmation=1'),
  });
}
```

Apply on every Apple, Spotify, and YouTube link: hero, footer, episode pages, video library header.

---

### 2.6 Newsletter signup (Kit)

The form POSTs cross domain to `https://app.kit.com/forms/2466258/subscriptions`, so the handler must fire before navigation.

```ts
const forms = document.querySelectorAll<HTMLFormElement>('form.formkit-form');

const onSubmit = (e: Event) => {
  const f = e.target as HTMLFormElement;
  once('newsletter_signup', () => track('newsletter_signup', {
    signup_location: location,
    episode_slug: episodeSlug,
    form_id: f.dataset.svForm || '2466258',
  }));
};

forms.forEach(f => f.addEventListener('submit', onSubmit));
document.addEventListener('convertkit:form-success', onKitSuccess as EventListener);
```

Kit may fire both the native submit and its own success event. The `once()` wrapper dedupes. **During QA, confirm which path actually fires on this deployment** and remove the unused listener rather than leaving both.

---

### 2.7 Sponsor funnel

Form fields observed: `name`, `company`, `email`, `targetCustomer`, `campaignGoal`, posting same origin to `/sponsorship`.

```ts
// CTA clicks
track('sponsor_cta_click', { cta_label: 'request_a_sponsorship', cta_location: 'hero' });

// first field focus
once('sponsor_form_start', () => track('sponsor_form_start', { form_location: 'sponsorship_page' }));

// successful submit only, not on validation failure
track('sponsor_inquiry_submit', {
  company_provided: Boolean(values.company),
  campaign_goal: values.campaignGoal,      // ONLY if enumerated select
  target_customer: values.targetCustomer,  // ONLY if enumerated select
  form_location: 'sponsorship_page',
});
```

Fire on success response, not on click. A failed submit that fires the event corrupts your only revenue metric.

---

### 2.8 Read depth and engaged visits

Episode pages carry 15,813 server rendered words including the full transcript. A single 90% scroll event tells you nothing about that.

```ts
const onScroll = () => {
  const r = el.getBoundingClientRect();
  const total = r.height - window.innerHeight;
  if (total <= 0) return;
  const pct = Math.min(100, Math.max(0, (-r.top / total) * 100));
  [25, 50, 75, 100].forEach(m => {
    if (pct >= m) once(`read_${m}`, () => track('read_depth', { ...ctx, percent_read: m }));
  });
};

// 45 seconds of ACTIVE time, visibility aware, not wall clock
let active = 0;
const tick = setInterval(() => {
  if (document.visibilityState !== 'visible') return;
  active += 5;
  if (active >= 45) {
    once('engaged_visit', () => track('engaged_visit', { ...ctx, active_seconds: 45 }));
    clearInterval(tick);
  }
}, 5000);
```

Throttle `onScroll` with `requestAnimationFrame`. Attach with `{ passive: true }`.

Also add `transcript_open` when the Full Transcript section enters the viewport.

---

### 2.9 Outbound clicks to individual videos

Added after Part 2, to close a gap that part left open.

Two surfaces link straight out to `youtube.com/watch?v=...`: the ~8 cards on the
homepage's "Watch on YouTube" shelf (`src/pages/index.js`) and the "Watch on
YouTube" button on each of the 288 video pages (`src/pages/videos/[slug].js`).
These are the highest-intent moments on the site — someone choosing a specific
conversation to go watch — and every one of those clicks landed in GA4's
undifferentiated `click` bucket, which cannot say which video or from where.

New file `lib/videoClicks.ts`, one event:

```ts
track('video_outbound_click', {
  video_id: video.id,      // joins to YouTube Studio
  video_slug: video.slug,  // readable in a report
  link_location: location, // 'home_video_shelf' | 'video_page'
});
```

**Do not route these through `platform_subscribe_click`.** That is a key event
meaning "subscribed to us on a platform" and it feeds the Committed Audience
audience; a thumbnail click is not a subscription, and folding one into the
other silently redefines the audience as "clicked a thumbnail" and inflates the
conversion count with the site's most common outbound action. For the same
reason `video_outbound_click` **must not be marked as a key event** in GA4
admin. It is a volume metric, not a commitment.

`link_location` is reused rather than a fourth location parameter invented: it
already means "where on the site was this link", the dimension is registered,
and its values never collide because reports read it per event name. The union
type is kept separate from `platformClicks.LinkLocation` all the same, so a
platform-click call site cannot reach `home_video_shelf`.

**Registration:** `video_id` and `video_slug` were registered as event-scoped
custom dimensions on Aug 5, 2026. See Part 1.

**Acceptance:** on the homepage, click a video card; in `window.dataLayer`, one
`video_outbound_click` with `link_location: 'home_video_shelf'` and a
`video_id` matching the `?v=` in the href. Same on a video page with
`'video_page'`. No `platform_subscribe_click` on either.

---

### 2.10 Video library search

Added after Part 2, alongside 2.9.

`/videos` filters 288 videos client side through its own search box and was
never instrumented, while `/episodes` has been since 2.4. `search_location`
exists precisely to tell the two apart, so this is a call site, not a new
mechanism:

```js
useSearchTracking(query, filtered.length, 'video_library');
```

Three things carried over from 2.4 apply unchanged and are worth restating,
because each is a way this could have been got wrong:

- **`?q=` is not synced on `/videos`,** unlike `episodes.js`. This is left
  alone. The `?q=` URLs exist on `/episodes` to make the `SearchAction` JSON-LD
  resolve to a crawlable result page, and that JSON-LD targets `/episodes`
  only; giving `/videos` a crawlable query surface is a product decision, not
  an analytics one. The only effect on tracking is that the hook's
  seeded-query guard never suppresses anything here — correct, since with no
  `?q=` to arrive in, every query on this page really was typed by a person.
- **Queries shaped like an email address or phone number are dropped,** not
  redacted downstream. Same rule, same reason (Part 1's PII prohibition).
- **Result clicks are tracked here too** — `trackSearchResultClick(query, i,
  v.slug, 'video_library')`. Not for the click count: it is what flushes the
  pending debounced `search`. A card click is a client-side navigation that
  unmounts the page, and the hook's cleanup deliberately does not flush, so
  without this the queries that converted fastest would be exactly the ones
  lost.

`search_result_click` gained `search_location`, and sends the clicked slug as
`video_slug` when it comes from the library. `episode_slug` must never hold a
video slug — it is the join key across the audio, read-depth and platform
events, and one wrong value type in it corrupts all of them.

**Acceptance:** type `cannabis` into the `/videos` box, wait a second; one
`search` in `window.dataLayer` with `search_location: 'video_library'` and a
`search_results_count` matching the cards on screen. Type a two-character
query: nothing. Type an email address: nothing.

---

## Part 3: Full event schema

### Consume
| Event | Trigger | Parameters | Key event |
|---|---|---|---|
| `audio_play` | first play | `episode_slug` `episode_number` `guest_name` `episode_topic` `content_type` `audio_duration` | |
| `audio_progress` | 10/25/50/75/90%, once each | above + `percent_played` `seconds_played` | at 50% |
| `audio_complete` | ended | above + `seconds_played` | yes |
| `audio_seek` | seeked, 500ms debounce | `episode_slug` `seek_to` | |
| `video_start` | GA4 automatic | GA4 supplied | |
| `video_progress` | GA4 automatic | GA4 supplied | at 50% |
| `video_complete` | GA4 automatic | GA4 supplied | yes |
| `video_outbound_click` | click through to a video on youtube.com | `video_id` `video_slug` `link_location` | no — deliberately, see 2.9 |
| `read_depth` | 25/50/75/100% of article | `percent_read` `episode_slug` `content_type` | |
| `transcript_open` | transcript in viewport | `episode_slug` `guest_name` | |
| `engaged_visit` | 45s active | `content_type` `episode_slug` `active_seconds` | |

### Commit
| Event | Trigger | Parameters | Key event |
|---|---|---|---|
| `newsletter_signup` | Kit submit success | `signup_location` `episode_slug` `form_id` | yes |
| `platform_subscribe_click` | Apple/Spotify/YouTube click | `platform` `link_location` `episode_slug` `is_sub_confirmation` | yes |
| `search` | 800ms debounce, min 3 chars | `search_term` `search_results_count` `search_location` `zero_results` | |
| `search_result_click` | result click with active query | `search_term` `result_position` `search_location` `episode_slug` or `video_slug` | |
| `topic_filter` | topic selected | `episode_topic` `results_count` | |
| `episode_share` | share control (add if absent) | `share_method` `episode_slug` | |

### Convert
| Event | Trigger | Parameters | Key event |
|---|---|---|---|
| `sponsor_cta_click` | sponsorship CTA | `cta_label` `cta_location` | |
| `sponsor_form_start` | first field focus | `form_location` | |
| `sponsor_inquiry_submit` | submit success | `company_provided` `campaign_goal` `target_customer` `form_location` | yes, primary |
| `guest_inquiry_submit` | guest pitch submit | `company` `role` `referral_source` | yes, primary |

`guest_inquiry_submit` has no form to attach to yet. See Part 5.

---

## Part 4: QA acceptance criteria

Run all of these in GA4 DebugView before calling any phase done.

1. **No double counting.** After 2.1 ships and the enhanced measurement toggle is off, a four page click through produces exactly four `page_view` events. Not eight.
2. **No stale paths.** Every `page_view` has `page_location` matching the address bar. No `dp` parameter present.
3. **Milestone idempotency.** Play an episode to 60%, rewind to 0, play again. `audio_progress` at 10/25/50 fires once each total, not twice.
4. **Milestone reset across routes.** Navigate to a second episode client side and play it. Milestones fire again for the new slug. This tests that `resetMilestones()` is wired.
5. **Search debounce.** Typing a 12 character query produces one `search` event, not 12.
6. **No PII.** Submit both forms with a real email. Inspect every parameter in DebugView. Zero email addresses, zero personal names, zero free text.
7. **Dimension population.** 24 hours after deploy, GA4 → Explore → free form → add Episode Slug and Guest Name as dimensions. Both must return values, not `(not set)`. If they show `(not set)`, the parameter string does not match Part 1.
8. **Cross check.** Compare GA4 sessions to Vercel Web Analytics for the same window. Divergence beyond roughly 15% means something is double firing or being blocked.

---

## Part 5: Owner action items (cannot be done from the repo)

### 5.1 GTM: my recommendation is do not add it

You asked specifically. Here is the honest trade.

**GTM's actual value** is letting non developers add and change tags without a code deploy. That is a real benefit when marketing and engineering are separate teams with a slow release cycle.

**Your situation is the opposite.** You have direct repo access, a Next.js codebase, Vercel's instant deploys, and now Claude Code to write the tags. Adding GTM would mean: an extra 60 to 90KB script on every page, a second place where tracking logic lives, tags that are invisible to code review and version control, and a new failure mode where the container and the code disagree.

**Add GTM only if one of these becomes true:**

- You start running paid acquisition and need to manage LinkedIn Insight Tag, Meta Pixel, and Google Ads conversion tags together.
- You need consent mode for GDPR because EU traffic becomes material. Right now it is not.
- Someone who does not write code needs to add tracking on their own.

Until one of those is true, direct gtag plus the code in Part 2 is faster, cheaper, and more reliable. Revisit in six months.

### 5.2 UTM discipline (the highest value non code item on this list)

86% of your sessions are Direct with a 16.6% engagement rate and 5 seconds average engagement. Organic Search is 11% of sessions at 90% engagement and 50 seconds. Search users engage ten times longer. That gap is not real audience behavior. Direct is a pool of untagged newsletter clicks, untagged LinkedIn clicks, untagged show note clicks, and bots.

Every off site link gets tagged. No exceptions.

| Placement | `utm_source` | `utm_medium` | `utm_campaign` |
|---|---|---|---|
| Kit newsletter body | `kit` | `email` | `fp_{issue-slug}` |
| LinkedIn post | `linkedin` | `social` | `ep{number}_{guest-slug}` |
| X post | `x` | `social` | `ep{number}_{guest-slug}` |
| YouTube description | `youtube` | `video_description` | `ep{number}_{guest-slug}` |
| Apple / Spotify show notes | `apple` / `spotify` | `show_notes` | `ep{number}_{guest-slug}` |
| Guest share assets | `guest_share` | `referral` | `ep{number}_{guest-slug}` |
| Sponsor deck | `sponsor_deck` | `outbound` | `sponsor_q{n}_{year}` |
| Email signature | `email_sig` | `referral` | `evergreen` |

Build a one page internal UTM builder so nobody improvises. Claude Code can generate it as a static page at `/internal/utm` with `noindex`.

### 5.3 Add a guest pitch form to `/guests`

`/guests` is headlined "This is the room serious operators want to be in." It is your status validation page and it has no form and no CTA. There is nothing on it to convert and therefore nothing to measure.

This is the single highest leverage change on the list, because it turns a page that only builds status into a page that captures it. You have 250 individual guest profile pages already indexed. That is real inbound surface with no capture mechanism at the end of it.

Fields: name, company, role, what they would talk about, LinkedIn URL. Wire `guest_inquiry_submit` per Part 3.

### 5.4 Confirm the privacy policy covers Google Advertising Features

Google signals is now on. Enabling it asserts that your privacy policy discloses Google Advertising Features and that users can access and delete that data via My Activity. Check `/privacy` says so. If it does not, either update it or turn signals back off in Admin → Data collection.

### 5.5 Create an internal traffic filter

Your own browsing is inflating a 179 user property. Admin → Data streams → Configure tag settings → Define internal traffic, add your office and home IPs, then Admin → Data filters → activate the Internal Traffic filter. Start it in Testing mode for a week before setting it to Active.

### 5.6 Mark key events and build audiences (after events start flowing)

Key events cannot be starred until the event has fired at least once. Roughly 24 hours after deploy, go to Admin → Events and star: `sponsor_inquiry_submit`, `guest_inquiry_submit`, `newsletter_signup`, `platform_subscribe_click`. For the 50% milestones, use Admin → Events → Create event to make `audio_halfway` from `audio_progress` where `percent_played` equals 50, then star that.

Audiences worth building:

- **Deep Listeners:** `audio_progress` where `percent_played >= 50`, last 30 days. This is the number you quote to sponsors. Note what it means as implemented: `percent_played` is *position reached while playing*, not time listened — same semantics as GA4's own `video_progress`. Someone who presses play and scrubs to 60% books the 50% milestone. Pure scrub-browsing with the player paused books nothing, but "reached halfway" is the honest phrasing, not "listened to half."
- **Sponsor Intent:** viewed `/sponsorship` or fired `sponsor_cta_click`, last 90 days, excluding submitters.
- **Committed Audience:** fired `newsletter_signup` or `platform_subscribe_click`.
- **Researchers:** 3+ `search` events or 3+ episode views in a session.
- **Lurking Operators:** 2+ sessions with `engaged_visit` but no `newsletter_signup`.

---

## Part 6: SEO and GEO

### 6.1 What is already right (do not break these)

The technical foundation here is genuinely strong. Verified live:

- **`robots.txt` explicitly allows AI crawlers:** GPTBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, CCBot. Most sites have not done this. It is the single biggest GEO prerequisite and it is already handled.
- **Episode pages are 15,813 words server rendered**, including the full transcript, with `PodcastEpisode` + `FAQPage` + `BreadcrumbList` schema, canonical, meta description, and og:image. This is close to ideal for both search and LLM ingestion. The FAQPage schema in particular is what earns AI Overview and answer engine citations.
- **Sitemap is clean:** 902 URLs with `lastmod` and `priority`, covering 305 episodes, 288 videos, 250 guest profiles, 33 newsletter issues, 21 topic hubs.
- **Topic hub pages average 24,393 words.** Guest pages carry `Person` schema. Video pages carry `VideoObject`.
- **An `llms.txt` exists.** Very few sites have one.

### 6.2 The gaps, in priority order

**Gap 1: `llms.txt` is 714KB and breaks the convention.**

The `llms.txt` convention is a *concise curated index* of links with one line descriptions, typically 5 to 20KB. Yours is 713,689 bytes across 3,501 lines. Most consumers will truncate it, and a truncated index is worse than a short complete one because the tail of your catalog silently disappears.

The fix is a split, which the convention already anticipates:

- **`/llms.txt`** — the site summary, the section headers, and links to the 20 topic hubs plus the 25 most recent episodes. Target under 20KB.
- **`/llms-full.txt`** — everything currently in `llms.txt`. This path currently 404s.

Reference `llms-full.txt` from within `llms.txt` so a crawler that wants depth can find it.

**Gap 2: `llms.txt` is stale.** It says "304 episodes" while the site says 306. It is not regenerating on publish. Move generation into the build step alongside the sitemap so it can never drift.

**Gap 3: `OAI-SearchBot` is missing from robots.txt.** This is the crawler that powers ChatGPT's *search* citations, and it is distinct from `GPTBot`, which is for training. If you want to be cited when someone asks ChatGPT about cannabis rescheduling, this is the one that matters most. Add these:

```
User-agent: OAI-SearchBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Perplexity-User
Allow: /

User-agent: DuckAssistBot
Allow: /

User-agent: Meta-ExternalAgent
Allow: /

User-agent: Amazonbot
Allow: /

User-agent: cohere-ai
Allow: /
```

Also add `Sitemap:` lines for any future sitemaps and consider referencing `llms.txt` in a comment.

**Gap 4: video pages have no transcript.** Episode pages have the full transcript; the 288 video pages do not. The video page is the one that ranks for watch intent, and it is currently 3,500 words against the episode page's 15,813. You already have every transcript. Render it on the video page too, or canonicalize the video page to the episode page if they are genuinely the same content. Do not leave 288 thin duplicates of your best content.

**Gap 5: `VideoObject` schema is minimal.** Current keys: `name`, `description`, `url`, `thumbnailUrl`, `uploadDate`, `duration`, `embedUrl`. Missing the fields that actually earn video rich results:

- `transcript` (the full text)
- `hasPart` as `Clip` objects with `startOffset` and `name`, which produces Google's key moments
- `interactionStatistic` with `WatchAction` and the view count. You already display view counts on `/videos`, so the data exists.
- `publisher` as an `Organization`

**Gap 6: no video sitemap extensions.** 288 video pages and the sitemap has no `<video:video>` entries. Add them. This is a build step change and it directly affects video indexing.

**Gap 7: topic hubs have only `BreadcrumbList`.** These are 24,000 word pages, the best hub assets on the site. Add `CollectionPage` with an `ItemList` of the episodes in that topic. This is what makes an LLM understand the page as an authoritative index of a subject rather than a wall of text.

**Gap 8: no on site RSS.** `/rss.xml`, `/feed.xml`, and `/feed` all 404. Your podcast RSS presumably lives with your host, which is fine, but a site level feed for First Principles and for new episodes is a cheap syndication surface and a signal of freshness.

### 6.3 The autopilot layer

You asked to run this on autopilot. Here is what should be generated at build time, never by hand, so that publishing an episode automatically updates everything:

| Artifact | Generated from | Regenerates on |
|---|---|---|
| `sitemap.xml` + video extensions | content collection | every build |
| `llms.txt` (index) | 20 topic hubs + 25 latest episodes | every build |
| `llms-full.txt` | full catalog | every build |
| `PodcastEpisode` + `FAQPage` schema | episode frontmatter | every build |
| `VideoObject` + `Clip` schema | video metadata + chapter markers | every build |
| `CollectionPage` schema on topic hubs | topic to episode mapping | every build |
| `/rss.xml` and `/newsletter/rss.xml` | episodes and issues | every build |
| Internal links: episode ↔ video ↔ guest ↔ topic | slug relationships | every build |

The last row is worth calling out. You have 305 episodes, 288 videos, 250 guests, and 21 topics. If every episode page links to its guest profile, its topic hub, and its video page, and each of those links back, you create a dense internal link graph across 864 pages automatically. That is the highest leverage SEO work available to you and it requires no new content at all.

**The compounding move:** you already produce a First Principles essay per episode. Those are human written analysis, which is exactly what answer engines prefer to cite over transcripts. Make sure each essay is linked from its episode page, its guest page, and its topic hub, and that it carries `Article` schema with `author` as a `Person` pointing at Bryan Fields. Author entity consistency across 33 essays and growing is what builds the topical authority that gets you cited by name.

### 6.4 What to measure for GEO

Once Search Console data lands in GA4 in 24 to 48 hours, watch:

- Queries where you rank but click through is low. In an AI Overview world that often means you were summarized rather than clicked, which is a citation win, not a loss. Track impressions separately from clicks and do not panic when CTR falls.
- Referrals from `chatgpt.com`, `perplexity.ai`, `claude.ai`, and `gemini.google.com` in the Traffic acquisition report. These arrive as Referral traffic. Create a custom channel group for "AI Assistants" so they do not hide inside Referral.
- Which topic hubs earn impressions. That tells you where your authority is real and where to publish next.

---

## Appendix: Rollout order

**Week 1** — 2.1 pageview fix alone, verified. Then 2.3 YouTube one liner. Then 2.2 audio. Owner does 5.4 and 5.5 in parallel.
**Week 2** — 2.5 platform, 2.6 newsletter, 2.7 sponsor. Owner does 5.2 UTMs, 5.3 guest form, 5.6 key events and audiences.
**Week 3** — 2.4 search, 2.8 read depth. SEO gaps 1, 2, 3 from Part 6, which are small and high value.
**Week 4** — SEO gaps 4 through 8 and the autopilot build steps in 6.3.

---

*Baseline for comparison, Jul 8 to Aug 4 2026: 179 users, 196 sessions, 443 page views, 949 total events, 0 key events, 25% engagement rate, 10s average engagement per session.*
