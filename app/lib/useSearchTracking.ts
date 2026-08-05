// lib/useSearchTracking.ts
// Archive search tracking. /episodes filters all 306 episodes client side, and
// GA4's built-in site search only reads URL query parameters on a pageview, so
// view_search_results has never fired for it. See docs/analytics-spec.md 2.4.
//
// Unlike the spec's version this does not also rewrite the URL: episodes.js
// already syncs ?q= on every keystroke through a shallow router.replace, which
// predates the spec's note that "typing does not change the URL". Adding a
// second, debounced replace would fight the existing one, and the spec's version
// only rewrites for queries of three characters or more, which would leave a
// stale ?q= behind when the box is cleared. Reading ?q= back on mount is also
// already handled there.
//
// The parameter strings here are registered GA4 custom dimensions and are a
// fixed contract; renaming one empties the dimension silently (Part 1).

import { useEffect, useRef } from 'react';
import { track } from './analytics';

const MIN_LENGTH = 3;
const DEBOUNCE_MS = 800;

// search_term is the one free-text value the spec sends, so it is the one place
// a visitor can type something personal into an event. Part 1 warns not to lean
// on the stream's email redaction as the only defence, and names phone numbers
// alongside addresses, so anything shaped like either is dropped here instead —
// an unsent search is worth more than a redaction that has already left the
// browser.
const EMAIL_SHAPED = /\S+@\S+\.\S+/;
const PHONE_SHAPED = /(?:\d[\s().-]*){7,}/;

function normalize(term: string): string | null {
  const q = term.trim().toLowerCase();
  if (q.length < MIN_LENGTH) return null;
  if (EMAIL_SHAPED.test(q) || PHONE_SHAPED.test(q)) return null;
  return q;
}

// Set while a debounced search is waiting, so a result click can settle it first.
// Without this the ordering works against us: clicking a result inside the 800ms
// window fires search_result_click, then the Link navigation unmounts the page
// and the search event dies in its timer — losing exactly the queries that
// converted fastest, and making search_result_click exceed search.
let flushPendingSearch: (() => void) | null = null;

export function useSearchTracking(
  term: string,
  resultsCount: number,
  location = 'episodes_archive'
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The query the page was loaded with, read here rather than from props because
  // episodes.js seeds its input from ?q= in its own effect, one render later.
  const seeded = useRef<string | null>(null);
  if (seeded.current === null) {
    seeded.current =
      typeof window === 'undefined'
        ? ''
        : (new URLSearchParams(window.location.search).get('q') || '').trim().toLowerCase();
  }

  useEffect(() => {
    const q = normalize(term);
    if (!q) return;

    // A query that arrived in the URL was not typed by anyone. These URLs are
    // deliberately crawlable through the SearchAction JSON-LD, so counting them
    // would fill the dimension with queries no visitor formulated — including
    // whatever JS-executing crawlers request — and report a result count against
    // a search nobody ran.
    if (q === seeded.current) return;

    const send = () => {
      timer.current = null;
      flushPendingSearch = null;
      track('search', {
        search_term: q,
        search_results_count: resultsCount,
        search_location: location,
        zero_results: resultsCount === 0,
      });
    };

    // One event per pause in typing, not one per keystroke: this effect re-runs
    // on every change and the cleanup clears the pending timer, so a
    // twelve-character query sends once.
    timer.current = setTimeout(send, DEBOUNCE_MS);

    const flush = () => {
      if (!timer.current) return;
      clearTimeout(timer.current);
      send();
    };
    flushPendingSearch = flush;
    window.addEventListener('pagehide', flush);

    return () => {
      window.removeEventListener('pagehide', flush);
      // Deliberately not flushed here: this cleanup also runs on every keystroke,
      // and flushing would send one event per character. Abandoning the page
      // mid-query drops it; leaving via a result click does not, because
      // trackSearchResultClick settles it first.
      if (timer.current) clearTimeout(timer.current);
      if (flushPendingSearch === flush) flushPendingSearch = null;
    };
  }, [term, resultsCount, location]);
}

/** Fired when a result is clicked while a query is active, so the archive's
 *  useful queries can be told apart from the ones that go nowhere. */
export function trackSearchResultClick(term: string, index: number, episodeSlug: string): void {
  // Settle the debounced search first, so the click cannot arrive without the
  // query that produced it when someone clicks inside the debounce window.
  flushPendingSearch?.();
  const q = normalize(term);
  if (!q) return;
  track('search_result_click', {
    search_term: q,
    result_position: index + 1,
    episode_slug: episodeSlug,
  });
}
