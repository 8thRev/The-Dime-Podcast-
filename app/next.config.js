/** @type {import('next').NextConfig} */

// The two redirect tables live in lib/retiredSlugs.cjs so that
// scripts/verify-site.mjs can import the same object this config redirects
// from, and assert every row still 301s to a destination that returns 200.
const { RETIRED_GUEST_SLUGS, RETIRED_VIDEO_SLUGS } = require('./lib/retiredSlugs.cjs');

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Ensure the JSON content files read via fs at request time are included in
  // each route's serverless function bundle. ISR revalidation re-runs
  // getStaticProps in the deployed lambda, so anything missing here reads as
  // absent at runtime even though it was present at build time:
  // transcripts (lib/transcripts.ts), the video catalogue (lib/youtube.ts)
  // and the episode<->video map (lib/videoEpisodeMap.ts).
  outputFileTracingIncludes: {
    '/episodes/[slug]': [
      './content/transcripts/**',
      './content/videos.json',
      './content/video-episode-map.json',
    ],
    '/videos': ['./content/videos.json'],
    '/videos/[slug]': ['./content/videos.json', './content/video-episode-map.json'],
    '/': ['./content/videos.json'],
  },
  // eighthrevolution.com is an alias domain pointed at this same deployment.
  // Its homepage served the Dime homepage (canonicalled to dimepodcast.com),
  // but every real path — /episodes, /episodes/<slug>, /guests, /topics,
  // /about, /newsletter — 404'd on that host, so it was leaking crawl budget
  // and link equity into dead URLs. Fold the whole host into the canonical one.
  //
  // Loop safety: `has` host values compile to `new RegExp("^" + value + "$")`
  // against the lowercased, port-stripped Host header (see Next's
  // prepare-destination `matchHas`). Both patterns are fully anchored and the
  // dots are escaped, so neither `dimepodcast.com` nor `www.dimepodcast.com`
  // — the redirect destination — can ever match, and the rule cannot re-fire
  // on its own output.
  // NOTE (verified 2026-07-31): eighthrevolution.com currently resolves to an
  // AWS load balancer (`Server: awselb/2.0`), NOT this deployment, so the host
  // rules below never fire today. They are kept because they are correct if the
  // domain is ever re-pointed here — but the ~200 episode pages linking to
  // eighthrevolution.com/the-dime and /monthly-report are 404ing at the origin
  // and cannot be fixed from this repo.
  async redirects() {
    const hostRedirects = ['eighthrevolution\\.com', 'www\\.eighthrevolution\\.com'].map((host) => ({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: 'https://www.dimepodcast.com/:path*',
      // Explicit 301 rather than `permanent: true`, which Next emits as a 308.
      // Both are permanent to Google, but 301 is what every older crawler and
      // link-equity tool understands without qualification.
      statusCode: 301,
    }));

    const slugRedirects = [
      ...Object.entries(RETIRED_GUEST_SLUGS).map(([slug, destination]) => ({
        source: `/guests/${slug}`,
        destination,
        statusCode: 301,
      })),
      ...Object.entries(RETIRED_VIDEO_SLUGS).map(([slug, destination]) => ({
        source: `/videos/${slug}`,
        destination,
        statusCode: 301,
      })),
    ];

    // The two other paths readers and aggregators habitually try for a feed.
    // Redirecting rather than serving copies keeps one canonical feed URL:
    // three URLs serving byte-identical RSS means three stored subscriptions
    // to the same content and a self-competing <atom:link rel="self">.
    const feedAliases = ['/feed', '/feed.xml'].map((source) => ({
      source,
      destination: '/rss.xml',
      statusCode: 301,
    }));

    return [...hostRedirects, ...slugRedirects, ...feedAliases];
  },

  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

// Export config — next-sitemap will be handled via postbuild script in package.json
module.exports = nextConfig;
