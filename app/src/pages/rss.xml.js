// src/pages/rss.xml.js
// Serves /rss.xml — the site's own episode feed. /feed and /feed.xml 301 here
// (next.config.js) rather than serving copies, so there is one canonical feed
// URL for readers to store.
//
// This is not the podcast audio feed — see the header of lib/feed.js.

import { getAllEpisodes } from '@/lib/rss';
import { buildEpisodeFeed } from '@/lib/feed';

export async function getServerSideProps({ res }) {
  const episodes = await getAllEpisodes();

  res.setHeader('Content-Type', 'application/rss+xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.write(buildEpisodeFeed(episodes));
  res.end();

  return { props: {} };
}

export default function EpisodeFeed() {
  return null;
}
