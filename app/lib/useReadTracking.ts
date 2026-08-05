// lib/useReadTracking.ts
// Read depth and engaged time for long pages. An episode page carries roughly
// 15,800 server-rendered words including the whole transcript, so GA4's single
// 90%-scroll enhanced measurement event says almost nothing about whether any of
// it was read. See docs/analytics-spec.md Part 2.8.
//
// Milestones dedupe through once() from lib/analytics and are keyed by slug, so
// a client-side navigation to another episode measures that page on its own.
//
// The parameter strings here are registered GA4 custom dimensions and are a
// fixed contract; renaming one empties the dimension silently (Part 1).

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { track, once, type ContentType } from './analytics';

const READ_MILESTONES = [25, 50, 75, 100];
const TICK_MS = 5000;
const ENGAGED_SECONDS = 45;

type ReadMeta = {
  slug: string;
  guest?: string;
  contentType: ContentType;
};

export function useReadTracking(
  articleRef: RefObject<HTMLElement | null>,
  transcriptRef: RefObject<HTMLElement | null>,
  meta: ReadMeta
): void {
  const rafQueued = useRef(false);

  useEffect(() => {
    const el = articleRef.current;
    if (!el) return;

    const ctx = {
      episode_slug: meta.slug,
      content_type: meta.contentType,
    };

    const measure = () => {
      const r = el.getBoundingClientRect();
      const total = r.height - window.innerHeight;
      // Nothing to scroll through: a page shorter than the viewport has no read
      // depth to report, and dividing by it would be meaningless.
      if (total <= 0) return;
      const pct = Math.min(100, Math.max(0, (-r.top / total) * 100));
      for (const m of READ_MILESTONES) {
        if (pct >= m) {
          once(`read_${m}:${meta.slug}`, () => track('read_depth', { ...ctx, percent_read: m }));
        }
      }
    };

    // Coalesce to one measurement per frame: scroll fires far more often than
    // layout changes, and getBoundingClientRect forces a reflow each time.
    const onScroll = () => {
      if (rafQueued.current) return;
      rafQueued.current = true;
      requestAnimationFrame(() => {
        rafQueued.current = false;
        measure();
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    measure(); // the visitor may land deep via an anchor, or on a short page

    // Active time, not wall clock: a tab left open in the background for an hour
    // is not engagement, so ticks only count while the page is visible.
    let activeSeconds = 0;
    const tick = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      activeSeconds += TICK_MS / 1000;
      if (activeSeconds >= ENGAGED_SECONDS) {
        clearInterval(tick);
        once(`engaged_visit:${meta.slug}`, () =>
          track('engaged_visit', { ...ctx, active_seconds: ENGAGED_SECONDS })
        );
      }
    }, TICK_MS);

    // transcript_open: the transcript scrolling into view is the signal that
    // someone went past the show notes into the substance of the page.
    let observer: IntersectionObserver | null = null;
    const transcript = transcriptRef.current;
    if (transcript && typeof IntersectionObserver !== 'undefined') {
      observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          observer?.disconnect();
          once(`transcript_open:${meta.slug}`, () =>
            track('transcript_open', { episode_slug: meta.slug, guest_name: meta.guest })
          );
        },
        { threshold: 0.01 }
      );
      observer.observe(transcript);
    }

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      clearInterval(tick);
      observer?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [articleRef, transcriptRef, meta.slug]);
}
