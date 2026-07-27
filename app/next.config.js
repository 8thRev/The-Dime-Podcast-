/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Ensure the AI-generated transcript JSON files (read via fs at request
  // time in lib/transcripts.ts) are included in the episode page's
  // serverless function bundle.
  outputFileTracingIncludes: {
    '/episodes/[slug]': ['./content/transcripts/**'],
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
  async redirects() {
    return ['eighthrevolution\\.com', 'www\\.eighthrevolution\\.com'].map((host) => ({
      source: '/:path*',
      has: [{ type: 'host', value: host }],
      destination: 'https://www.dimepodcast.com/:path*',
      // Explicit 301 rather than `permanent: true`, which Next emits as a 308.
      // Both are permanent to Google, but 301 is what every older crawler and
      // link-equity tool understands without qualification.
      statusCode: 301,
    }));
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
