// lib/feed.js
// Builds the site's own RSS 2.0 feeds.
//
// These are NOT the podcast feed. The podcast feed is the Simplecast one
// advertised in _document.js: it carries <enclosure> audio and is what Apple
// and Spotify ingest, and nothing here should ever compete with it for that
// role — a second feed claiming to be the show would be a real problem, not a
// cosmetic one. What these are is a syndication surface for the *site*:
// pointers to episode and essay pages, so readers, aggregators and freshness
// crawlers have a machine-readable "what's new here" that does not require
// re-crawling the archive. No enclosures, deliberately.
//
// Plain .js for the same reason as lib/llms.js: consumed directly by page
// routes under src/pages.

export const SITE_URL = 'https://www.dimepodcast.com';

// The five characters that are not valid as raw text in XML content or
// attributes. Every value below passes through this — episode titles come
// from an external RSS feed and edition titles from hand-edited frontmatter,
// so a stray & or < is a question of when, not if, and a single unescaped one
// makes the whole document unparseable rather than degrading a field.
function escapeXml(value) {
  return String(value ?? '')
    // Control characters are not legal in XML 1.0 at all — not raw, and not
    // as numeric references either, so escaping cannot save them and one of
    // them makes the whole feed unparseable. Dropped before anything else.
    // Same "when, not if" reasoning as the entity escaping below: these
    // strings come from an external RSS feed and hand-edited frontmatter.
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// RSS requires RFC-822 dates. toUTCString() emits the RFC-1123 form, which is
// the modernised RFC-822 date every reader accepts. An unparseable date is
// omitted rather than emitted as "Invalid Date".
function rfc822(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toUTCString();
}

function item({ title, url, date, description }) {
  const lines = [
    '    <item>',
    `      <title>${escapeXml(title)}</title>`,
    `      <link>${escapeXml(url)}</link>`,
    // The page URL is a stable permalink, so it doubles as the guid — which
    // is what stops a reader re-notifying on every fetch.
    `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
  ];
  const pubDate = rfc822(date);
  if (pubDate) lines.push(`      <pubDate>${pubDate}</pubDate>`);
  if (description) lines.push(`      <description>${escapeXml(description)}</description>`);
  lines.push('    </item>');
  return lines.join('\n');
}

function feed({ title, description, selfPath, linkPath, items }) {
  // Newest item's date, not the request time: a lastBuildDate that changes on
  // every fetch tells a reader the feed changed when it did not.
  const lastBuild = rfc822(items[0]?.date) || new Date().toUTCString();

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    '  <channel>',
    `    <title>${escapeXml(title)}</title>`,
    `    <link>${SITE_URL}${linkPath}</link>`,
    `    <description>${escapeXml(description)}</description>`,
    '    <language>en-us</language>',
    `    <lastBuildDate>${lastBuild}</lastBuildDate>`,
    `    <atom:link href="${SITE_URL}${selfPath}" rel="self" type="application/rss+xml" />`,
    ...items.map(item),
    '  </channel>',
    '</rss>',
    '',
  ].join('\n');
}

// How many episodes /rss.xml carries. A feed is a "what's new" surface, not an
// archive — the archive is /episodes and /llms-full.txt — and 300+ items would
// make every fetch a multi-megabyte download of things no reader is new to.
const EPISODE_FEED_LIMIT = 50;

export function buildEpisodeFeed(episodes) {
  return feed({
    title: 'The Dime Podcast',
    description:
      'New episodes of The Dime. Cannabis business intelligence — strategy conversations for operators, not observers. ' +
      'This feed links to episode pages on dimepodcast.com; for the audio feed, subscribe in any podcast app.',
    selfPath: '/rss.xml',
    linkPath: '/episodes',
    items: episodes.slice(0, EPISODE_FEED_LIMIT).map((ep) => ({
      title: ep.title,
      url: `${SITE_URL}/episodes/${ep.slug}`,
      date: ep.dateISO,
      description: ep.description,
    })),
  });
}

export function buildNewsletterFeed(editions) {
  return feed({
    title: 'First Principles — The Dime Podcast',
    description:
      'One structural insight per episode. Human-written analysis by Bryan Fields for cannabis operators.',
    selfPath: '/newsletter/rss.xml',
    linkPath: '/newsletter',
    items: editions.map((edition) => ({
      title: edition.title,
      url: `${SITE_URL}/newsletter/${edition.slug}`,
      date: edition.date,
      description: edition.description,
    })),
  });
}
