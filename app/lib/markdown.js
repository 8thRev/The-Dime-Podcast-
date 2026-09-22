// lib/markdown.js
// Builds the Markdown variant of each content page, served at the page's own
// URL plus `.md`:
//
//   /episodes/<slug>.md   /guests/<slug>.md   /newsletter/<slug>.md   /topics/<topic>.md
//
// by src/pages/api/markdown/[kind]/[slug].js (the rewrite that maps the .md
// URLs onto that handler is in next.config.js). Each HTML page also announces
// its variant with <link rel="alternate" type="text/markdown"> via SeoHead.
//
// Every builder takes the same records the HTML page's getStaticProps reads,
// from the same loaders (lib/rss, lib/transcripts, lib/newsletter, lib/topics,
// lib/guests, lib/youtube), so the two renderings of a page cannot drift: there
// is no second copy of the data, only a second serialisation of it.
//
// Provenance is stated inline, matching the HTML. Transcript-derived text
// (summary, takeaways, FAQ, transcript) sits under an AI note the way it sits
// under <AIDisclosure> on the page. First Principles editions are human
// written and carry a byline instead; their body is emitted verbatim from
// content/newsletter/*.md, never a disclosure (see CLAUDE.md).
//
// Plain .js for the same reason as lib/llms.js, which this shares its
// episode and edition line builders with.

import { SITE_URL, oneLine, episodeLines } from './llms';
import { topicToSlug } from './topicSlug';
import { guestToSlug } from './guests';

const AI_NOTE = '> AI generated from the episode audio by the transcript pipeline. May contain errors.';
const TRANSCRIPT_NOTE =
  '> AI generated transcript. Produced from the episode audio, not reviewed by the hosts, and may contain errors or mishear names.';

// Every .md file ends with the same lines so an agent that lands on one page
// learns the convention and where the indexes are.
function footer() {
  return [
    '',
    '---',
    '',
    'Markdown variant of any episode, guest, newsletter or topic page on this site: add .md to its URL.',
    `Site index: ${SITE_URL}/llms.txt. Complete catalogue: ${SITE_URL}/llms-full.txt`,
    '',
  ];
}

const isoDate = (iso) => {
  const d = new Date(iso || '');
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
};

const flat = (text) => String(text || '').replace(/\s+/g, ' ').trim();

const NAMED_ENTITIES = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: String.fromCharCode(0x2014),
  ndash: String.fromCharCode(0x2013),
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(text) {
  return String(text || '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] !== '#') return NAMED_ENTITIES[body.toLowerCase()] ?? match;
    const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
  });
}

// The Simplecast show notes are a small HTML subset (p, br, a, strong, em,
// ul/li). This keeps the paragraph breaks and the links, which are the two
// things that matter to a reader, and drops everything else. Not a general
// converter, and deliberately not a dependency: the one HTML-to-Markdown
// package in the repo (turndown) is a devDependency used by an import script,
// and the show notes do not need it.
export function htmlToMarkdown(html) {
  const text = String(html || '')
    .replace(/\r/g, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h[1-6]|ul|ol|blockquote)>/gi, '\n\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<(strong|b)>([\s\S]*?)<\/\1>/gi, '**$2**')
    .replace(/<(em|i)>([\s\S]*?)<\/\1>/gi, '*$2*')
    .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (m, href, label) => {
      const clean = label.replace(/<[^>]+>/g, '').trim();
      return clean ? `[${clean}](${href})` : href;
    })
    .replace(/<[^>]+>/g, '');
  return decodeEntities(text)
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const hasRealGuest = (episode) => !!episode.guest && episode.guest !== 'Guest';

function guestLine(episode) {
  if (!hasRealGuest(episode)) return '- Guest: none (hosts only)';
  const parts = [episode.guest];
  if (episode.company) parts.push(episode.company);
  return `- Guest: ${parts.join(', ')} (${SITE_URL}/guests/${guestToSlug(episode.guest)})`;
}

function editionListLines(editions) {
  const lines = [];
  for (const e of editions) {
    const eUrl = `${SITE_URL}/newsletter/${e.slug}`;
    lines.push(`- [${e.title}](${eUrl})${e.dateDisplay ? ` (${e.dateDisplay})` : ''}: ${oneLine(e.description)}`);
    lines.push(`  Markdown: ${eUrl}.md`);
  }
  return lines;
}

/**
 * /episodes/<slug>.md. `transcript` is the lib/transcripts record or null;
 * `videos` the YTVideo records mapped to this episode (lib/videoEpisodeMap +
 * lib/youtube); `edition` the First Principles edition written about it, if
 * any. Same inputs as src/pages/episodes/[slug].js.
 */
export function buildEpisodeMarkdown({ episode, transcript, videos = [], edition = null }) {
  const url = `${SITE_URL}/episodes/${episode.slug}`;
  const topics = transcript?.topics || [];
  const lines = [
    `# ${episode.title}`,
    '',
    transcript?.summary ? oneLine(transcript.summary) : decodeEntities(episode.description),
    '',
    `- Episode: ${episode.num}`,
    `- Published: ${isoDate(episode.dateISO)}`,
    guestLine(episode),
    `- Duration: ${episode.duration}`,
    `- Canonical: ${url}`,
    `- Audio: ${episode.audioUrl}`,
  ];
  for (const v of videos) {
    lines.push(`- Video: ${SITE_URL}/videos/${v.slug} (YouTube: ${v.watchUrl})`);
  }
  if (topics.length) {
    lines.push(`- Topics: ${topics.map((t) => `[${t}](${SITE_URL}/topics/${topicToSlug(t)})`).join(', ')}`);
  }
  if (edition) {
    lines.push(`- Written analysis: [${edition.title}](${SITE_URL}/newsletter/${edition.slug})`);
  }

  lines.push('', '## Show notes', '', htmlToMarkdown(episode.showNotes) || decodeEntities(episode.description));

  if (transcript?.summary) {
    lines.push('', '## Summary', '', AI_NOTE, '', transcript.summary.trim());
  }
  if (transcript?.takeaways?.length) {
    lines.push('', '## Key takeaways', '', AI_NOTE, '');
    for (const t of transcript.takeaways) lines.push(`- ${flat(t)}`);
  }
  if (transcript?.faq?.length) {
    lines.push('', '## FAQ', '', AI_NOTE, '');
    for (const item of transcript.faq) {
      lines.push(`### ${flat(item.question)}`, '', String(item.answer || '').trim(), '');
    }
  }
  if (transcript?.cleaned_transcript) {
    lines.push('', '## Transcript', '', TRANSCRIPT_NOTE, '', transcript.cleaned_transcript.trim());
  }

  lines.push(...footer());
  return lines.join('\n');
}

/**
 * /guests/<slug>.md. `guest` and `episodes` are getGuestBySlug's result,
 * `editions` getEditionsForGuest's; `getTranscript` supplies the one-line
 * episode summaries the same way the llms.txt builders get them.
 */
export function buildGuestMarkdown({ guest, episodes, editions = [], getTranscript }) {
  const url = `${SITE_URL}/guests/${guest.slug}`;
  const times = `${guest.episodeCount} time${guest.episodeCount === 1 ? '' : 's'}`;
  const lines = [
    `# ${guest.name}`,
    '',
    `${guest.name}${guest.company ? ` (${guest.company})` : ''} has appeared on The Dime Podcast ${times}: cannabis business conversations on strategy, capital and operations.`,
    '',
    `- Canonical: ${url}`,
  ];
  if (guest.company) {
    lines.push(`- Company: ${guest.company}${guest.companyUrl ? ` (${guest.companyUrl})` : ''}`);
  }
  lines.push(`- Episodes: ${guest.episodeCount}`, '', `## Episodes with ${guest.name}`, '');
  // Not episodeLines from lib/llms.js: that format leads with the guest's
  // name, which on the guest's own page is noise, and it has no date. Same
  // summary source (the transcript), different line.
  for (const ep of episodes) {
    const epUrl = `${SITE_URL}/episodes/${ep.slug}`;
    const summary = getTranscript(ep.slug)?.summary;
    lines.push(`- [${ep.title}](${epUrl}) (${isoDate(ep.dateISO)}, episode ${ep.num})${summary ? `: ${oneLine(summary)}` : ''}`);
    lines.push(`  Markdown: ${epUrl}.md`);
  }
  if (editions.length) {
    lines.push('', '## Written analysis', '', 'First Principles essays by Bryan Fields about these conversations. Human written.', '');
    lines.push(...editionListLines(editions));
  }
  lines.push(...footer());
  return lines.join('\n');
}

/**
 * /newsletter/<slug>.md. `edition` is the full lib/newsletter record (body
 * included); `episode` the related Episode or null, resolved the same way
 * src/pages/newsletter/[slug].js resolves it.
 */
export function buildEditionMarkdown({ edition, episode = null }) {
  const url = `${SITE_URL}/newsletter/${edition.slug}`;
  const guest = edition.guest || (episode && hasRealGuest(episode) ? episode.guest : '');
  const lines = [
    `# ${edition.title}`,
    '',
    oneLine(edition.description),
    '',
    '- Author: Bryan Fields (human written, not AI generated)',
    `- Published: ${isoDate(edition.date)}`,
    `- Canonical: ${url}`,
  ];
  if (episode) {
    lines.push(`- Episode: [${episode.title}](${SITE_URL}/episodes/${episode.slug})${guest ? ` with ${guest}` : ''}`);
    if (episode.audioUrl) lines.push(`- Audio: ${episode.audioUrl}`);
  } else if (guest) {
    lines.push(`- Guest: ${guest}`);
  }
  if (edition.topics.length) {
    lines.push(`- Topics: ${edition.topics.map((t) => `[${t}](${SITE_URL}/topics/${topicToSlug(t)})`).join(', ')}`);
  }
  if (edition.linkedinUrl) lines.push(`- Originally published: ${edition.linkedinUrl}`);

  // The essay itself, exactly as written in content/newsletter/<slug>.md.
  lines.push('', edition.body);
  lines.push(...footer());
  return lines.join('\n');
}

/**
 * /topics/<topic>.md: the hub page as Markdown. `episodes` and `editions`
 * are the hub's own lists. The per topic llms.txt (lib/llms.js
 * buildTopicLlms) is the index form of the same lists; this is the page.
 */
export function buildTopicMarkdown({ topic, slug, episodes, editions = [], getTranscript }) {
  const url = `${SITE_URL}/topics/${slug}`;
  const lines = [
    `# ${topic}`,
    '',
    `Episodes of The Dime Podcast covering ${topic}: cannabis business conversations with founders, executives and investors. ${episodes.length} episode${episodes.length === 1 ? '' : 's'}.`,
    '',
    `- Canonical: ${url}`,
    `- Topic index for agents: ${url}/llms.txt`,
    `- All topics: ${SITE_URL}/topics`,
  ];
  if (editions.length) {
    lines.push('', `## Analysis on ${topic}`, '', 'First Principles essays by Bryan Fields. Human written.', '');
    lines.push(...editionListLines(editions));
  }
  lines.push('', '## Episodes', '');
  for (const ep of episodes) {
    lines.push(...episodeLines(ep, getTranscript, 'summary', { markdown: true }));
  }
  lines.push(...footer());
  return lines.join('\n');
}
