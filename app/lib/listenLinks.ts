// lib/listenLinks.ts
// Where to listen, in one place: the footer's Listen column, the subscribe
// row under every episode's player, and the PodcastSeries JSON-LD (webFeed,
// sameAs) all read from here, so a changed show URL is changed once.
//
// Pure constants, no imports, so client components can use it without
// pulling anything else into the bundle.

/**
 * The podcast's audio feed on Simplecast. This is what a podcast app
 * subscribes to, and it is the only feed with audio enclosures; /rss.xml and
 * /newsletter/rss.xml are the site's own page feeds (see lib/feed.js).
 */
export const PODCAST_FEED_URL = "https://feeds.simplecast.com/Vnrz0StH";

export const APPLE_PODCASTS_URL = "https://podcasts.apple.com/us/podcast/the-dime/id1540199573";
export const SPOTIFY_URL = "https://open.spotify.com/show/05y791a4A1vzTZ6DCZQHFz";
export const YOUTUBE_URL = "https://www.youtube.com/@theDime_Cannabis";

/**
 * Order is the display order. The RSS entry is last and is not tracked as a
 * platform_subscribe_click: `platform` is a registered GA4 dimension with
 * exactly three enumerated values (docs/analytics-spec.md Part 1), and
 * trackPlatformClick ignores any href it has no mapping for.
 */
export const LISTEN_LINKS: ReadonlyArray<{ label: string; href: string }> = [
  { label: "Apple Podcasts", href: APPLE_PODCASTS_URL },
  { label: "Spotify", href: SPOTIFY_URL },
  { label: "YouTube", href: YOUTUBE_URL },
  { label: "RSS feed", href: PODCAST_FEED_URL },
];
