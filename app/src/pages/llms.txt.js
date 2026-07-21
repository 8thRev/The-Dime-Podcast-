// src/pages/llms.txt.js
// Serves /llms.txt — a curated plain-text index for LLM crawlers, pointing
// at the episode library, topic hubs, and condensed AI-generated content.
// Regenerated per-request (episode/transcript data is memoized in lib/rss
// and lib/transcripts within the server process) so it stays current as
// bot/transcript_pipeline.py adds new episodes daily.

import { getAllEpisodes, getLatestEpisodeNumber } from '@/lib/rss';
import { getTranscriptBySlug } from '@/lib/transcripts';
import { getAllTopics } from '@/lib/topics';

const SITE_URL = 'https://www.dimepodcast.com';

function buildLlmsTxt(episodes, topics) {
  const lines = [];

  lines.push('# The Dime Podcast');
  lines.push('');
  lines.push('> Cannabis business intelligence. Strategy conversations for operators, not observers.');
  lines.push('');
  lines.push(`${getLatestEpisodeNumber(episodes)} episodes. Conversations with cannabis founders, executives, operators, and investors on capital, regulation, and operations.`);
  lines.push('');
  lines.push(`About the hosts: ${SITE_URL}/about`);
  lines.push(`Video library: ${SITE_URL}/videos`);
  lines.push(`Guest applications: ${SITE_URL}/guests`);
  lines.push('');

  lines.push('## Topics');
  lines.push('');
  if (topics.length > 0) {
    lines.push(`Full topic index: ${SITE_URL}/topics`);
    lines.push('');
    for (const t of topics) {
      lines.push(`- [${t.topic}](${SITE_URL}/topics/${t.slug}): ${t.count} episode${t.count === 1 ? '' : 's'}`);
    }
  } else {
    lines.push(`Full topic index: ${SITE_URL}/topics`);
  }
  lines.push('');

  lines.push('## Episodes');
  lines.push('');
  lines.push(`Full episode archive: ${SITE_URL}/episodes`);
  lines.push('');

  for (const ep of episodes) {
    const url = `${SITE_URL}/episodes/${ep.slug}`;
    const transcript = getTranscriptBySlug(ep.slug);
    if (transcript?.summary) {
      lines.push(`- [${ep.title}](${url}) — ${ep.guest}: ${transcript.summary}`);
      // Emit the AI takeaways + FAQ (indented) for transcribed episodes — these
      // answer-first, Q&A-shaped blocks are the content most readily lifted into
      // LLM answers. Episodes without a transcript stay as a single link line.
      if (transcript.takeaways?.length) {
        lines.push('  Key takeaways:');
        for (const t of transcript.takeaways) lines.push(`  - ${t}`);
      }
      if (transcript.faq?.length) {
        lines.push('  FAQ:');
        for (const f of transcript.faq) {
          lines.push(`  - Q: ${f.question}`);
          lines.push(`    A: ${f.answer}`);
        }
      }
    } else {
      lines.push(`- [${ep.title}](${url}) — ${ep.guest}`);
    }
  }
  lines.push('');

  return lines.join('\n');
}

export async function getServerSideProps({ res }) {
  const episodes = await getAllEpisodes();
  const topics = await getAllTopics();

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.write(buildLlmsTxt(episodes, topics));
  res.end();

  return { props: {} };
}

export default function LlmsTxt() {
  return null;
}
