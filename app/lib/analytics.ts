// lib/analytics.ts
// GA4 client helpers. Every page_view on this site is fired from here.
//
// gtag's own automatic pageview is off (`send_page_view: false` in the
// bootstrap in src/pages/_document.js) and GA4's "page changes based on
// browser history events" enhanced measurement has to be off with it. Between
// them they were the only thing reporting client-side navigations, and they
// reported them wrong: the pageview carried the *previous* route's page_path
// forward. /episodes is linked from every page's nav and had logged a single
// landing session and no top-ten views, while / showed 269 views against 169
// landing sessions. See docs/analytics-spec.md Part 2.1.
//
// The parameter strings passed to gtag are a fixed contract. Each one is a
// registered GA4 custom dimension; renaming one empties that dimension
// silently, with no error anywhere. Rename the local variable, never the
// string. See docs/analytics-spec.md Part 1.
//
// Never pass an email address, a personal name typed into a form, or a
// free-text field value into an event parameter. guest_name is the one
// exception, because it is published editorial metadata about a public guest.

// Read from the environment rather than hardcoded, so a deployment without
// NEXT_PUBLIC_GA_ID set sends nothing at all — the same gate _document.js and
// _app.js use around the snippet and the gtag.js loader.
export const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

export type Platform = 'apple_podcasts' | 'spotify' | 'youtube';
export type ContentType =
  | 'episode_audio'
  | 'video'
  | 'newsletter'
  | 'guest_profile'
  | 'topic_hub';

type Params = Record<string, string | number | boolean | undefined>;

type Gtag = (...args: unknown[]) => void;

const isProd = process.env.NODE_ENV === 'production';

// The dataLayer shim in _document.js defines window.gtag inline in <head>, so
// this resolves during hydration and queues calls until gtag.js itself loads.
function getGtag(): Gtag | null {
  if (typeof window === 'undefined') return null;
  const fn = (window as unknown as { gtag?: unknown }).gtag;
  return typeof fn === 'function' ? (fn as Gtag) : null;
}

export function track(event: string, params: Params = {}): void {
  const gtag = getGtag();
  if (!gtag) return;
  // Undefined and empty values are dropped rather than sent; GA4 would
  // otherwise store them as present-but-blank dimension values.
  const clean: Params = {};
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') clean[k] = v;
  gtag('event', event, clean);
  if (!isProd) console.log('[ga4]', event, clean);
}

export function pageview(url: string): void {
  const gtag = getGtag();
  if (!gtag) return;
  gtag('event', 'page_view', {
    page_location: window.location.origin + url,
    page_title: document.title,
    page_referrer: document.referrer || undefined,
  });
}

/** Fire a milestone at most once per page view. */
export function once(key: string, fn: () => void): void {
  const w = window as unknown as { __fired?: Set<string> };
  w.__fired = w.__fired || new Set<string>();
  if (w.__fired.has(key)) return;
  w.__fired.add(key);
  fn();
}

/** Clear the per-page milestone set. Called on every completed route change so
 *  the next page's milestones can fire again for their own slug. */
export function resetMilestones(): void {
  (window as unknown as { __fired?: Set<string> }).__fired = new Set<string>();
}
