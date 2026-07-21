// next-sitemap.config.js
// Configuration for XML sitemaps

const Parser = require('rss-parser');

const siteUrl = process.env.SITE_URL || 'https://www.dimepodcast.com';
const FEED_URL = 'https://feeds.simplecast.com/Vnrz0StH';

// Named AI/LLM crawlers get an explicit allow rule rather than relying on
// the wildcard fallthrough — makes this site's LLM-discoverability intent
// auditable instead of incidental.
const AI_CRAWLERS = ['GPTBot', 'ChatGPT-User', 'ClaudeBot', 'anthropic-ai', 'PerplexityBot', 'Google-Extended', 'CCBot'];

// Mirrors slugify() in app/lib/rss.ts. Duplicated (rather than imported)
// because next-sitemap runs as a separate plain-Node script after the
// Next.js build and can't import TypeScript modules without extra
// tooling — this is the minimal piece needed to map a slug back to its
// real publish date for an accurate per-URL lastmod.
function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/-+$/, '');
}

let episodeLastmodCache = null;
async function getEpisodeLastmodBySlug() {
  if (episodeLastmodCache) return episodeLastmodCache;
  episodeLastmodCache = {};
  try {
    const parser = new Parser();
    const feed = await parser.parseURL(FEED_URL);
    for (const item of feed.items) {
      const slug = slugify(item.title || '');
      const iso = new Date(item.pubDate || '').toISOString();
      if (slug) episodeLastmodCache[slug] = iso;
    }
  } catch (error) {
    console.error('next-sitemap: could not fetch RSS feed for lastmod dates:', error.message);
  }
  return episodeLastmodCache;
}

module.exports = {
  siteUrl,
  changefreq: 'weekly',
  priority: 0.7,
  generateRobotsTxt: true,
  exclude: ['/llms.txt'],
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
      ...AI_CRAWLERS.map((userAgent) => ({ userAgent, allow: '/' })),
    ],
  },
  // Real per-episode lastmod (from the RSS pubDate) instead of the
  // build-timestamp default — Google discounts lastmod that doesn't
  // correlate with actual content changes. Video/topic/static URLs fall
  // back to the build timestamp: video lastmod would need the YouTube
  // Data API (quota cost for a nice-to-have), and topic/static pages
  // don't have a single authoritative "modified" date to source from.
  transform: async (config, path) => {
    const episodeMatch = path.match(/^\/episodes\/(.+)$/);
    if (episodeMatch) {
      const lastmodBySlug = await getEpisodeLastmodBySlug();
      const lastmod = lastmodBySlug[episodeMatch[1]];
      if (lastmod) {
        return {
          loc: path,
          changefreq: config.changefreq,
          priority: config.priority,
          lastmod,
        };
      }
    }
    return {
      loc: path,
      changefreq: config.changefreq,
      priority: config.priority,
      lastmod: new Date().toISOString(),
    };
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
