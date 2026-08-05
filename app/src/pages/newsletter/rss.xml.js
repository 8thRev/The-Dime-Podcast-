// src/pages/newsletter/rss.xml.js
// Serves /newsletter/rss.xml — the First Principles editions as a feed.
//
// Kept separate from /rss.xml rather than merged into one site feed: these
// are a distinct product with their own cadence (essays, not episodes), and
// the whole reason they are worth syndicating is that they are human-written
// analysis. Mixing them into a 50-item episode feed would bury them.

import { getAllEditions } from '@/lib/newsletter';
import { buildNewsletterFeed } from '@/lib/feed';

export async function getServerSideProps({ res }) {
  const editions = getAllEditions();

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.write(buildNewsletterFeed(editions));
  res.end();

  return { props: {} };
}

export default function NewsletterFeed() {
  return null;
}
