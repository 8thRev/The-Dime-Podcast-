// lib/llms.js
// Builds the two plain-text indexes for LLM crawlers:
//
//   /llms.txt      — the curated index. Topic hubs, the First Principles
//                    essays, and the most recent episodes. Kept small.
//   /llms-full.txt — the complete catalogue: every episode with its summary,
//                    key takeaways and FAQ.
//
// Why the split. The llms.txt convention is a *concise curated index* of
// links with one-line descriptions, conventionally 5-20KB. This file used to
// be a single document that emitted takeaways and FAQ for all 303 episodes
// and had grown past 700KB. That is not a large index, it is a truncated one:
// a consumer with a fixed context budget reads the head and silently drops
// the tail, so the back catalogue disappears *and* the crawler has no way to
// know anything is missing. A short complete index that names where the depth
// lives is strictly better, and the convention anticipates exactly this by
// allowing a companion full document.
//
// Both are served from .js page routes rather than written at build time, so
// they pick up new episodes as bot/transcript_pipeline.py lands them instead
// of waiting for the next deploy.
//
// Plain .js, not .ts, so the page routes under src/pages can import it
// directly without a type-only build step; it is consumed only by those two
// routes.

export const SITE_URL = 'https://www.dimepodcast.com';

// Both unbounded lists the index draws from are capped: episodes arrive
// weekly and essays one per episode, forever, and an index with one uncapped
// growing section is an index that silently leaves the size band again in six
// months. Topics are deliberately NOT capped — that is a fixed taxonomy of 20
// (~1.6KB), so it is bounded by the content model rather than by a constant
// here, and truncating it would make the hub list wrong rather than shorter.
// scripts/verify-site.mjs check 14 asserts the resulting size either way.
//
// 25 recent episodes is what the spec asks for (docs/analytics-spec.md Gap 1).
// The 12-edition cap is a departure from it: that spec predates the First
// Principles archive, and all 32 editions cost 13.7KB of a 20KB budget on
// their own. The complete list of both is in /llms-full.txt, and /newsletter
// is linked here as the human-facing archive.
const RECENT_EPISODE_COUNT = 25;
const RECENT_EDITION_COUNT = 12;

// A curated index wants one-line descriptions. The AI episode summaries
// average 947 characters — a paragraph, and 23KB across 25 episodes on its
// own. Cutting them here is not just size trimming: the full summary, plus
// the takeaways and FAQ, is what /llms-full.txt is for, and a consumer
// reading this file is choosing which page to fetch, not reading the answer
// out of it.
const DESCRIPTION_MAX = 200;

function oneLine(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= DESCRIPTION_MAX) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

function header(episodes) {
  return [
    '# The Dime Podcast',
    '',
    '> Cannabis business intelligence. Strategy conversations for operators, not observers.',
    '',
    // episodes.length, not getLatestEpisodeNumber(): the numbering has gaps, so
    // the highest episode number (305) overstates the 303 episodes this file
    // actually goes on to list. Elsewhere on the site that distinction is
    // cosmetic; here it is a factual claim inside a document written to be
    // ingested verbatim, sitting directly above the list that contradicts it.
    `${episodes.length} episodes. Conversations with cannabis founders, executives, operators, and investors on capital, regulation, and operations.`,
    '',
  ];
}

function siteLinks() {
  return [
    `About the hosts: ${SITE_URL}/about`,
    `Video library: ${SITE_URL}/videos`,
    `Guest applications: ${SITE_URL}/guests`,
    '',
  ];
}

// Listed before Topics and Episodes deliberately: everything below this
// section is AI-generated from audio, while these are human-written
// analysis with a named author — the most citable text on the site.
// Descriptions only, not full bodies; the linked HTML pages carry the
// full text and are explicitly allowed to AI crawlers in robots.txt.
function editionsSection(editions, limit) {
  if (editions.length === 0) return [];
  const listed = limit ? editions.slice(0, limit) : editions;
  const lines = [
    '## First Principles (written analysis)',
    '',
    'Human-written essays by Bryan Fields, one per episode. Not AI-generated.',
    `Archive: ${SITE_URL}/newsletter`,
  ];
  if (listed.length < editions.length) {
    lines.push(`The ${listed.length} most recent of ${editions.length}. All of them: ${SITE_URL}/llms-full.txt`);
  }
  lines.push('');
  for (const e of listed) {
    const url = `${SITE_URL}/newsletter/${e.slug}`;
    const parts = [`- [${e.title}](${url})`];
    if (e.dateDisplay) parts.push(`(${e.dateDisplay})`);
    lines.push(`${parts.join(' ')}: ${oneLine(e.description)}`);
    if (e.episodeSlug) {
      lines.push(`  Episode: ${SITE_URL}/episodes/${e.episodeSlug}`);
    }
  }
  lines.push('');
  return lines;
}

function topicsSection(topics) {
  const lines = ['## Topics', '', `Full topic index: ${SITE_URL}/topics`, ''];
  for (const t of topics) {
    lines.push(`- [${t.topic}](${SITE_URL}/topics/${t.slug}): ${t.count} episode${t.count === 1 ? '' : 's'}`);
  }
  lines.push('');
  return lines;
}

// One episode entry. `depth: 'summary'` is the index form (a link plus the
// one-line AI summary); `depth: 'full'` adds the takeaways and FAQ, which are
// the answer-shaped blocks most readily lifted into an LLM answer and also
// the reason the full document is three orders of magnitude larger.
function episodeLines(ep, getTranscript, depth) {
  const url = `${SITE_URL}/episodes/${ep.slug}`;
  const transcript = getTranscript(ep.slug);

  if (!transcript?.summary) {
    return [`- [${ep.title}](${url}) — ${ep.guest}`];
  }

  const summary = depth === 'full' ? transcript.summary : oneLine(transcript.summary);
  const lines = [`- [${ep.title}](${url}) — ${ep.guest}: ${summary}`];
  if (depth !== 'full') return lines;

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
  return lines;
}

/** The curated index served at /llms.txt. */
export function buildLlmsIndex(episodes, topics, editions, getTranscript) {
  const lines = [
    ...header(episodes),
    // Stated before any list, not in a footer: a consumer that truncates this
    // document still learns the full catalogue exists and where it is.
    'This file is a curated index. The complete catalogue — every episode with',
    `its summary, key takeaways and FAQ — is at ${SITE_URL}/llms-full.txt`,
    '',
    ...siteLinks(),
    ...editionsSection(editions, RECENT_EDITION_COUNT),
    ...topicsSection(topics),
    '## Recent episodes',
    '',
    `The ${RECENT_EPISODE_COUNT} most recent. Full archive: ${SITE_URL}/episodes`,
    `Every episode, with takeaways and FAQ: ${SITE_URL}/llms-full.txt`,
    '',
  ];

  for (const ep of episodes.slice(0, RECENT_EPISODE_COUNT)) {
    lines.push(...episodeLines(ep, getTranscript, 'summary'));
  }
  lines.push('');

  return lines.join('\n');
}

/** The complete catalogue served at /llms-full.txt. */
export function buildLlmsFull(episodes, topics, editions, getTranscript) {
  const lines = [
    ...header(episodes),
    `This is the complete catalogue. The curated index is at ${SITE_URL}/llms.txt`,
    '',
    ...siteLinks(),
    ...editionsSection(editions),
    ...topicsSection(topics),
    '## Episodes',
    '',
    `Full episode archive: ${SITE_URL}/episodes`,
    '',
  ];

  for (const ep of episodes) {
    lines.push(...episodeLines(ep, getTranscript, 'full'));
  }
  lines.push('');

  return lines.join('\n');
}
