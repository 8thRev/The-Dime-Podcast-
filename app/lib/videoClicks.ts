// lib/videoClicks.ts
// Outbound clicks to individual YouTube videos: the ~8 cards on the homepage
// shelf and the "Watch on YouTube" button on each of the 288 video pages. Both
// point at youtube.com/watch?v=..., and until now both landed in GA4's
// undifferentiated `click` bucket with no way to tell which video, or from
// where. See docs/analytics-spec.md Part 2.9.
//
// Deliberately NOT routed through trackPlatformClick (lib/platformClicks.ts).
// `platform_subscribe_click` is a key event meaning "subscribed to us on a
// platform", and it feeds the Committed Audience audience; folding a thumbnail
// click into it would quietly redefine that audience as "clicked a thumbnail".
// This is a separate, non-key event — do not mark it as a key event in GA4
// admin, or the same dilution happens one level up in the conversion count.
//
// `video_id` and `video_slug` are new GA4 custom dimensions and must be
// registered before any report leans on them. Like every other parameter here
// they are a fixed contract; renaming one empties the dimension silently
// (Part 1). `link_location` is the dimension platform clicks already use — the
// same question ("where on the site was this link") with values that never
// collide, since reports read it per event name.

import { track } from './analytics';

// Union rather than free string, for the reason platformClicks gives: a new
// call site must not be able to invent a value and fragment the dimension.
// Kept separate from platformClicks' LinkLocation rather than widening it, so
// a platform-click call site still cannot reach these two values.
export type VideoLinkLocation = 'home_video_shelf' | 'video_page';

/** Fired when a visitor leaves for YouTube to watch one specific video. */
export function trackVideoOutboundClick(
  video: { id?: string; slug?: string },
  location: VideoLinkLocation
): void {
  track('video_outbound_click', {
    // The YouTube video ID, which is what joins these clicks to the view
    // numbers in YouTube Studio — the whole point of measuring the handoff.
    video_id: video.id,
    // The site's own slug for the same video: readable in a GA4 report, where
    // a bare ID is not, and the key to the /videos/[slug] page.
    video_slug: video.slug,
    link_location: location,
  });
}
