// src/pages/llms.txt.js
// Serves /llms.txt — the curated plain-text index for LLM crawlers. The
// document itself, and the reasoning for keeping it small while
// /llms-full.txt carries the whole catalogue, live in lib/llms.js.
//
// Regenerated per-request (episode/transcript data is memoized in lib/rss
// and lib/transcripts within the server process) so it stays current as
// bot/transcript_pipeline.py adds new episodes daily.

import { getAllEpisodes } from '@/lib/rss';
import { getTranscriptBySlug } from '@/lib/transcripts';
import { getAllTopics } from '@/lib/topics';
import { getAllEditions } from '@/lib/newsletter';
import { buildLlmsIndex } from '@/lib/llms';

export async function getServerSideProps({ res }) {
  const episodes = await getAllEpisodes();
  const topics = await getAllTopics();
  const editions = getAllEditions();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.write(buildLlmsIndex(episodes, topics, editions, getTranscriptBySlug));
  res.end();

  return { props: {} };
}

export default function LlmsTxt() {
  return null;
}
