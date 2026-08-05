// lib/useAudioTracking.ts
// Listen tracking for the native <audio> player on episode pages.
//
// GA4's video enhanced measurement only observes embedded YouTube iframes; it
// does not see an <audio> element in any configuration, so before this the
// property held no listen data at all. See docs/analytics-spec.md Part 2.2.
//
// Milestones are deduped through once() from lib/analytics, which is keyed per
// page view and cleared by resetMilestones() on route change — so rewinding and
// replaying does not refire a milestone, while navigating to a second episode
// arms them again for the new slug.
//
// The parameter strings below are registered GA4 custom dimensions and are a
// fixed contract; renaming one empties the dimension silently (Part 1).

import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import { track, once, type ContentType } from './analytics';

const MILESTONES = [10, 25, 50, 75, 90];

type AudioMeta = {
  slug: string;
  number?: number;
  guest?: string;
  topic?: string;
};

export function useAudioTracking(ref: RefObject<HTMLAudioElement | null>, meta: AudioMeta): void {
  const seekTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = {
      episode_slug: meta.slug,
      episode_number: meta.number,
      guest_name: meta.guest,
      episode_topic: meta.topic,
      content_type: 'episode_audio' as ContentType,
    };

    // The player has no preload attribute, so duration is often still NaN when
    // play fires. Math.round(NaN) is NaN, which || turns into undefined, and
    // track() drops undefined values rather than sending a blank dimension —
    // audio_progress carries the duration once metadata has loaded.
    const onPlay = () =>
      once(`audio_play:${meta.slug}`, () =>
        track('audio_play', { ...ctx, audio_duration: Math.round(el.duration) || undefined })
      );

    const onTimeUpdate = () => {
      // timeupdate also fires when the scrubber is dragged with the player
      // paused, which would book percent_played milestones for someone who
      // never pressed play. Observed while verifying: seeking to 30% while
      // paused fired audio_progress at 10 and 25 with no audio_play at all.
      // Milestones passed over during playback still land on the next
      // timeupdate once playback resumes, since the loop re-tests every
      // milestone on each tick.
      //
      // Reaching the end counts: browsers set paused on the ended transition,
      // and the final timeupdate must still be allowed through or a visitor who
      // seeks past 90% and plays out books audio_complete with no 90% milestone
      // behind it — a funnel showing more completes than 90s reads as broken
      // instrumentation.
      if (el.paused && !el.ended) return;
      if (!el.duration || !isFinite(el.duration)) return;
      const pct = (el.currentTime / el.duration) * 100;
      for (const m of MILESTONES) {
        if (pct >= m)
          once(`audio_${m}:${meta.slug}`, () =>
            track('audio_progress', {
              ...ctx,
              percent_played: m,
              seconds_played: Math.round(el.currentTime),
              audio_duration: Math.round(el.duration),
            })
          );
      }
    };

    // Deduped, unlike the spec's version: audio_complete is a key event, and
    // replaying an episode to the end within one page view would otherwise
    // count the same listener finishing it twice.
    const onEnded = () =>
      once(`audio_complete:${meta.slug}`, () =>
        track('audio_complete', { ...ctx, seconds_played: Math.round(el.duration) })
      );

    // Trailing edge, so seek_to is where the drag landed. The spec's version
    // compared performance.now() against a ref seeded at 0, which fires on the
    // *first* seeked event and then suppresses for 500ms: on a drag that emits
    // several, it records where the drag started, and because performance.now()
    // is milliseconds since navigation start, any seek in the first 500ms of a
    // page view was dropped entirely.
    const onSeeked = () => {
      if (seekTimer.current) clearTimeout(seekTimer.current);
      seekTimer.current = setTimeout(() => {
        seekTimer.current = null;
        track('audio_seek', { ...ctx, seek_to: Math.round(el.currentTime) });
      }, 500);
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
      if (seekTimer.current) clearTimeout(seekTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, meta.slug]);
}
