// next-sitemap.config.js
// Configuration for XML sitemaps

const siteUrl = process.env.SITE_URL || 'https://www.dimepodcast.com';

module.exports = {
  siteUrl,
  changefreq: 'weekly',
  priority: 0.7,
  generateRobotsTxt: true,
  robotsTxtOptions: {
    sitemaps: [
      `${siteUrl}/sitemap.xml`,
    ],
    policies: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/api'],
      },
    ],
  },
  additionalPaths: async (config) => {
    const paths = [];

    // Static pages with specific priorities
    const staticPages = [
      { path: '/', priority: 1.0, changefreq: 'daily' },
      { path: '/episodes', priority: 0.9, changefreq: 'daily' },
      { path: '/videos', priority: 0.8, changefreq: 'daily' },
      { path: '/topics', priority: 0.8, changefreq: 'weekly' },
      { path: '/guests', priority: 0.7, changefreq: 'weekly' },
      { path: '/about', priority: 0.6, changefreq: 'monthly' },
      { path: '/newsletter', priority: 0.6, changefreq: 'monthly' },
      { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
      { path: '/terms', priority: 0.3, changefreq: 'yearly' },
    ];

    staticPages.forEach(({ path, priority, changefreq }) => {
      paths.push({
        loc: `${siteUrl}${path}`,
        changefreq,
        priority,
        lastmod: new Date().toISOString(),
      });
    });

    return paths;
  },
};
