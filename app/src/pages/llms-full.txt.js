// src/pages/llms-full.txt.js
// Serves /llms-full.txt — the complete catalogue for LLM crawlers that want
// depth: every episode with its AI summary, key takeaways and FAQ. This is
// what /llms.txt used to be before it was split; see lib/llms.js for why.
//
// Referenced from /llms.txt and from robots.txt (next-sitemap.config.js), the
// only two places a crawler can discover it — nothing on the site links here,
// and like /llms.txt it is excluded from the XML sitemap because it is not an
// indexable HTML page.

import { getAllEpisodes } from '@/lib/rss';
import { getTranscriptBySlug } from '@/lib/transcripts';
import { getAllTopics } from '@/lib/topics';
import { getAllEditions } from '@/lib/newsletter';
import { buildLlmsFull } from '@/lib/llms';

export async function getServerSideProps({ res }) {
  const episodes = await getAllEpisodes();
  const topics = await getAllTopics();
  const editions = getAllEditions();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.write(buildLlmsFull(episodes, topics, editions, getTranscriptBySlug));
  res.end();

  return { props: {} };
}

export default function LlmsFullTxt() {
  return null;
}
