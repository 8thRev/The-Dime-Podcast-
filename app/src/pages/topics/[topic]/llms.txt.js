// src/pages/topics/[topic]/llms.txt.js
// Serves /topics/<topic>/llms.txt: one topic's slice of the catalogue for
// agents researching a single subject, so they read a few KB rather than the
// 800KB+ of /llms-full.txt. Built by buildTopicLlms in lib/llms.js from the
// same episode and edition line builders as /llms.txt, and from the hub
// page's own loaders (getEpisodesByTopicSlug, getEditionsForTopic), so it
// cannot drift from either.
//
// Same request-time shape as src/pages/llms.txt.js, and for the same reason:
// a static path segment (`llms.txt`) under a dynamic one is a valid page
// file, unlike the .md variants, so no rewrite is needed. The CDN cache
// policy matches the hub page's hourly revalidation.

import { getTranscriptBySlug } from '@/lib/transcripts';
import { getEpisodesByTopicSlug } from '@/lib/topics';
import { getEditionsForTopic } from '@/lib/newsletter';
import { buildTopicLlms } from '@/lib/llms';

export async function getServerSideProps({ params, res }) {
  const result = await getEpisodesByTopicSlug(params.topic);
  if (!result) {
    return { notFound: true };
  }

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.write(
    buildTopicLlms({
      topic: result.topic,
      slug: params.topic,
      episodes: result.episodes,
      editions: getEditionsForTopic(params.topic),
      getTranscript: getTranscriptBySlug,
    })
  );
  res.end();

  return { props: {} };
}

export default function TopicLlmsTxt() {
  return null;
}
