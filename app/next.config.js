/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
};

// Export config — next-sitemap will be handled via postbuild script in package.json
module.exports = nextConfig;
