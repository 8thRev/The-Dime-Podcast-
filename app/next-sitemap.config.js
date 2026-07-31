// next-sitemap.config.js
// Configuration for XML sitemaps

const fs = require('fs');
const path = require('path');
const Parser = require('rss-parser');

const siteUrl = process.env.SITE_URL || 'https://www.dimepodcast.com';
const FEED_URL = 'https://feeds.simplecast.com/Vnrz0StH';
const NEWSLETTER_DIR = path.join(__dirname, 'content', 'newsletter');

// Static pages that get a hand-set priority rather than the config default.
// These are emitted by additionalPaths() below AND auto-discovered by
// next-sitemap's page scan, so transform() has to drop the scanned copy —
// otherwise every one of them lands in the sitemap twice with conflicting
// priority and lastmod, and which version Google honours is arbitrary.
const STATIC_PAGES = [
  { path: '/', priority: 1.0, changefreq: 'daily' },
  { path: '/episodes', priority: 0.9, changefreq: 'daily' },
  { path: '/videos', priority: 0.8, changefreq: 'daily' },
  { path: '/topics', priority: 0.8, changefreq: 'weekly' },
  { path: '/guests', priority: 0.7, changefreq: 'weekly' },
  { path: '/about', priority: 0.6, changefreq: 'monthly' },
  // Raised from 0.6/monthly: /newsletter is now an archive index over the
  // First Principles editions, not a standalone signup form.
  { path: '/newsletter', priority: 0.8, changefreq: 'weekly' },
  { path: '/privacy', priority: 0.3, changefreq: 'yearly' },
  { path: '/terms', priority: 0.3, changefreq: 'yearly' },
];
const STATIC_PAGE_PATHS = new Set(STATIC_PAGES.map((p) => p.path));

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

// Real per-edition lastmod, read straight off the markdown frontmatter.
// Unlike the episode dates above this needs no network call — the content
// is on disk — so it's a plain sync read rather than a cached async fetch.
// gray-matter is CommonJS, so requiring it from this plain-Node script is
// safe (lib/newsletter.ts itself can't be imported here — it's TypeScript).
let newsletterLastmodCache = null;
function getNewsletterLastmodBySlug() {
  if (newsletterLastmodCache) return newsletterLastmodCache;
  newsletterLastmodCache = {};
  try {
    if (!fs.existsSync(NEWSLETTER_DIR)) return newsletterLastmodCache;
    const matter = require('gray-matter');
    for (const file of fs.readdirSync(NEWSLETTER_DIR)) {
      if (!file.endsWith('.md')) continue;
      const { data } = matter(fs.readFileSync(path.join(NEWSLETTER_DIR, file), 'utf-8'));
      const slug = String(data.slug || file.replace(/\.md$/, '')).trim();
      const parsed = new Date(data.date);
      if (slug && !Number.isNaN(parsed.getTime())) {
        newsletterLastmodCache[slug] = parsed.toISOString();
      }
    }
  } catch (error) {
    console.error('next-sitemap: could not read newsletter frontmatter for lastmod:', error.message);
  }
  return newsletterLastmodCache;
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
    // Returning null drops the URL. additionalPaths() re-adds each of these
    // with its intended priority — see STATIC_PAGES above.
    if (STATIC_PAGE_PATHS.has(path)) return null;

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

    const newsletterMatch = path.match(/^\/newsletter\/(.+)$/);
    if (newsletterMatch) {
      const lastmod = getNewsletterLastmodBySlug()[newsletterMatch[1]];
      if (lastmod) {
        return {
          loc: path,
          changefreq: 'monthly',
          priority: 0.8,
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

    STATIC_PAGES.forEach(({ path, priority, changefreq }) => {
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
