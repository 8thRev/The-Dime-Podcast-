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
};

// Export config — next-sitemap will be handled via postbuild script in package.json
module.exports = nextConfig;
