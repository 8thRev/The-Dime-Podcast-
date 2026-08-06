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
//
// Split into two groups because the distinction decides whether we show up
// in an answer with a citation or only in a future model's weights:
//
//   - RETRIEVAL agents fetch a page while answering a live user question and
//     are what produce the linked citation. OAI-SearchBot in particular backs
//     ChatGPT *search* and is a different agent from GPTBot — allowing GPTBot
//     alone (the previous state) opted us into training and out of the thing
//     that actually sends traffic.
//   - TRAINING/corpus crawlers build datasets. Allowing them is a long-horizon
//     bet on being *known*, not on referrals. Applebot-Extended and
//     Google-Extended are pure opt-in signals: they are not crawlers at all,
//     just flags read off robots.txt that govern whether content already
//     fetched by Applebot/Googlebot may be used for AI training.
const AI_RETRIEVAL_CRAWLERS = [
  'OAI-SearchBot',
  'ChatGPT-User',
  'PerplexityBot',
  'Perplexity-User',
  'DuckAssistBot',
  'ClaudeBot',
  'Claude-User',
  'Claude-SearchBot',
];
const AI_TRAINING_CRAWLERS = [
  'GPTBot',
  'anthropic-ai',
  'Google-Extended',
  'Applebot-Extended',
  'Meta-ExternalAgent',
  'Amazonbot',
  'cohere-ai',
  'CCBot',
];
const AI_CRAWLERS = [...AI_RETRIEVAL_CRAWLERS, ...AI_TRAINING_CRAWLERS];

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

// The video catalogue, keyed by slug. Committed to the repo by
// scripts/build-video-catalog.mjs, so reading it here costs no YouTube quota
// and cannot fail the build on an API hiccup — the same reasoning that put
// lib/youtube.ts on the file rather than the API.
let videoCache = null;
function getVideosBySlug() {
  if (videoCache) return videoCache;
  videoCache = {};
  try {
    const file = path.join(__dirname, 'content', 'videos.json');
    if (!fs.existsSync(file)) return videoCache;
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8'));
    if (!Array.isArray(parsed)) return videoCache;
    for (const video of parsed) {
      if (video?.slug) videoCache[video.slug] = video;
    }
  } catch (error) {
    console.error('next-sitemap: could not read videos.json:', error.message);
  }
  return videoCache;
}

function isoDurationToSeconds(iso) {
  const match = (iso || '').match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

// <video:description> is capped at 2048 characters and <video:title> at 100.
// 235 of 287 catalogue descriptions are longer than that (max 4,993) because
// they carry the full YouTube description including the chapter list and
// link block. Google rejects the whole <video:video> entry when a field is
// over length, so cut at the last whole word rather than shipping 235
// silently-dropped videos. Titles already fit, but are cut for the same
// reason should a longer one ever be published.
function truncate(text, maxLength) {
  const trimmed = (text || '').trim();
  if (trimmed.length <= maxLength) return trimmed;
  const cut = trimmed.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

// A <video:video> entry for a /videos/<slug> URL. next-sitemap serializes
// these into the video: namespace it already declares on every urlset.
//
// player_loc rather than content_loc: content_loc must be a raw media file,
// and we have an embed, not an MP4. Duration is capped at the 28800s (8h)
// the spec allows and omitted when the catalogue has no parseable one, since
// an out-of-range value invalidates the whole entry rather than that field.
function videoSitemapEntry(video) {
  const duration = isoDurationToSeconds(video.durationISO);
  return {
    title: truncate(video.title, 100),
    thumbnailLoc: new URL(video.thumbnail),
    // description is a required field; fall back to the title so a video with
    // an empty YouTube description still produces a valid entry.
    description: truncate(video.description, 2048) || truncate(video.title, 100),
    playerLoc: new URL(`https://www.youtube.com/embed/${video.id}`),
    ...(duration > 0 && duration <= 28800 ? { duration } : {}),
    ...(typeof video.viewCountRaw === 'number' && video.viewCountRaw > 0
      ? { viewCount: video.viewCountRaw }
      : {}),
    publicationDate: video.publishedAt,
    familyFriendly: true,
    requiresSubscription: false,
    live: false,
    uploader: { name: 'The Dime Podcast', info: new URL(siteUrl) },
  };
}

module.exports = {
  // Not read by next-sitemap — exported purely so scripts/verify-site.mjs can
  // assert these exact paths appear in the generated sitemap exactly once,
  // without re-declaring the list and letting the two copies drift.
  STATIC_PAGE_PATHS: [...STATIC_PAGE_PATHS],
  siteUrl,
  changefreq: 'weekly',
  priority: 0.7,
  generateRobotsTxt: true,
  // Plain-text/XML endpoints, not indexable HTML pages. /rss.xml is
  // advertised through <link rel="alternate"> in _document.js instead.
  exclude: ['/llms.txt', '/llms-full.txt', '/rss.xml', '/newsletter/rss.xml'],
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
      // The disallows are repeated per agent, not inherited. A robots.txt
      // parser applies only the most specific matching group, so a named
      // agent with `Allow: /` and nothing else is NOT bound by the wildcard
      // group's `Disallow` lines — naming these crawlers to grant access
      // would quietly have granted them /admin and /api too. Moot today
      // (neither route exists) and a live hole the day one does.
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: '/',
        disallow: ['/admin', '/api'],
      })),
    ],
    // Points LLM crawlers at the curated index they cannot otherwise
    // discover: nothing links to /llms.txt, and it is excluded from the
    // sitemap above (it is not an indexable HTML page), so robots.txt is
    // the only machine-readable place left to announce it. The convention
    // has no dedicated directive, hence a comment.
    transformRobotsTxt: async (_config, robotsTxt) =>
      `${robotsTxt}# LLM-readable index of this site:\n` +
      `# ${siteUrl}/llms.txt (curated: topic hubs + recent episodes)\n` +
      `# ${siteUrl}/llms-full.txt (full catalogue with summaries, takeaways and FAQ)\n`,
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

    // Video URLs get a <video:video> extension AND a real lastmod. Both come
    // from the committed catalogue, so this closes the "video lastmod is the
    // build timestamp" item in SEO_ROADMAP.md without the YouTube Data API
    // call that item assumed it would need.
    const videoMatch = path.match(/^\/videos\/(.+)$/);
    if (videoMatch) {
      const video = getVideosBySlug()[videoMatch[1]];
      if (video) {
        return {
          loc: path,
          changefreq: 'monthly',
          priority: config.priority,
          lastmod: new Date(video.publishedAt).toISOString(),
          videos: [videoSitemapEntry(video)],
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
