// lib/platformClicks.ts
// Splits outbound platform clicks apart. Every outbound click currently merges
// into a handful of undifferentiated GA4 `click` events per month, which cannot
// answer the only question worth asking of them: which platform, from where.
// See docs/analytics-spec.md Part 2.5.
//
// The parameter strings here are registered GA4 custom dimensions and are a
// fixed contract; renaming one empties the dimension silently (Part 1).

import { track, type Platform } from './analytics';

// Part 1 enumerates these four. Typed rather than free string so a new call site
// cannot invent a fifth value and fragment the dimension.
export type LinkLocation = 'hero' | 'footer' | 'episode_page' | 'video_library';

const PLATFORM_MAP: ReadonlyArray<{ match: string; name: Platform }> = [
  { match: 'podcasts.apple.com', name: 'apple_podcasts' },
  { match: 'open.spotify.com', name: 'spotify' },
  { match: 'youtube.com', name: 'youtube' },
];

export function trackPlatformClick(
  href: string,
  location: LinkLocation,
  episodeSlug?: string
): void {
  const hit = PLATFORM_MAP.find((p) => href.includes(p.match));
  if (!hit) return;
  track('platform_subscribe_click', {
    platform: hit.name,
    link_location: location,
    episode_slug: episodeSlug,
    // The video library's button carries ?sub_confirmation=1, which asks YouTube
    // to pop the subscribe dialog — worth telling apart from a plain visit.
    is_sub_confirmation: href.includes('sub_confirmation=1'),
  });
}
