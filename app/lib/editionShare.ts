// lib/editionShare.ts
// Share tracking for First Principles editions. See docs/analytics-spec.md
// Part 3, `edition_share`.
//
// Its own event rather than Part 3's `episode_share`: an edition is not an
// episode, and sending an edition slug as `episode_slug` would mix two kinds
// of id in one registered dimension. Which edition was shared is already on
// the event as page_location, so no slug parameter is sent at all.
//
// `share_method` is enumerated. It is not yet a registered dimension (owner
// action, Part 1), so the event counts from day one and the per-method split
// appears once it is registered.

import { track, type ContentType } from './analytics';

export type ShareMethod = 'copy_link' | 'linkedin' | 'x' | 'email' | 'native';

export function trackEditionShare(method: ShareMethod): void {
  track('edition_share', {
    share_method: method,
    content_type: 'newsletter' as ContentType,
  });
}
