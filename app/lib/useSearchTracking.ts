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
// on the stream's email redaction as the only defence, so anything shaped like
// an address is dropped here instead — an unsent search is worth more than a
// redaction that has already left the browser.
const EMAIL_SHAPED = /\S+@\S+\.\S+/;

function normalize(term: string): string | null {
  const q = term.trim().toLowerCase();
  if (q.length < MIN_LENGTH || EMAIL_SHAPED.test(q)) return null;
  return q;
}

export function useSearchTracking(
  term: string,
  resultsCount: number,
  location = 'episodes_archive'
): void {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const q = normalize(term);
    if (!q) return;

    // One event per pause in typing, not one per keystroke: each render clears
    // the pending timer, so a twelve-character query sends once.
    timer.current = setTimeout(() => {
      timer.current = null;
      track('search', {
        search_term: q,
        search_results_count: resultsCount,
        search_location: location,
        zero_results: resultsCount === 0,
      });
    }, DEBOUNCE_MS);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [term, resultsCount, location]);
}

/** Fired when a result is clicked while a query is active, so the archive's
 *  useful queries can be told apart from the ones that go nowhere. */
export function trackSearchResultClick(term: string, index: number, episodeSlug: string): void {
  const q = normalize(term);
  if (!q) return;
  track('search_result_click', {
    search_term: q,
    result_position: index + 1,
    episode_slug: episodeSlug,
  });
}
