/** @type {import('next').NextConfig} */
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
