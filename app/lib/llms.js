// lib/llms.js
// Builds the two plain-text indexes for LLM crawlers:
//
//   /llms.txt      — the curated index. Topic hubs, the First Principles
//                    essays, and the most recent episodes. Kept small.
//   /llms-full.txt — the complete catalogue: every episode with its summary,
//                    key takeaways and FAQ.
//   /topics/<slug>/llms.txt
//                    one topic's slice of the catalogue, so an agent
//                    researching one subject reads tens of KB, not the full
//                    document. Built by buildTopicLlms below from the same
//                    episode and edition line builders as the other two.
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

import { PODCAST_RATING } from '@/lib/ratings';
import {
  ASSETS_PER_EPISODE,
  ASSETS_PER_EPISODE_MAX,
  SOCIAL_CUTS_MIN,
  SOCIAL_CUTS_MAX,
  EPISODE_PRICE,
  CAMPAIGN_PRICE,
  PER_EPISODE_IN_CAMPAIGN,
  CAMPAIGN_DISCOUNT_PCT,
} from '@/lib/sponsorOffer';

export const SITE_URL = 'https://www.dimepodcast.com';

// Both unbounded lists the index draws from are capped: episodes arrive
// weekly and essays one per episode, forever, and an index with one uncapped
// growing section is an index that silently leaves the size band again in six
// months. Topics are deliberately NOT capped — that is a fixed taxonomy of 20
// (~1.6KB), so it is bounded by the content model rather than by a constant
// here, and truncating it would make the hub list wrong rather than shorter.
// scripts/verify-site.mjs check 14 asserts the resulting size either way.
//
// The spec asks for 25 recent episodes (docs/analytics-spec.md Gap 1). Both
// caps below are departures from it. The 12-edition cap: that spec predates
// the First Principles archive, and all 32 editions cost 13.7KB of a 20KB
// budget on their own. The 15-episode cap: the agent actions and sponsorship
// facts sections added 4.5KB to an index that was already at 18.0KB, and at
// about 400 bytes an episode line the recent list is the only section with
// slack. It is also the least valuable one to an agent, which can read the
// same 25 and 300 more in /llms-full.txt and per topic. The complete list of
// both is in /llms-full.txt, and /newsletter is linked here as the
// human-facing archive.
const RECENT_EPISODE_COUNT = 15;
const RECENT_EDITION_COUNT = 12;

// A curated index wants one-line descriptions. The AI episode summaries
// average 947 characters — a paragraph, and 23KB across 25 episodes on its
// own. Cutting them here is not just size trimming: the full summary, plus
// the takeaways and FAQ, is what /llms-full.txt is for, and a consumer
// reading this file is choosing which page to fetch, not reading the answer
// out of it.
const DESCRIPTION_MAX = 200;

export function oneLine(text) {
  const flat = String(text || '').replace(/\s+/g, ' ').trim();
  if (flat.length <= DESCRIPTION_MAX) return flat;
  const cut = flat.slice(0, DESCRIPTION_MAX);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
}

// Every episode, guest, First Principles and topic page has a Markdown
// variant at the page URL plus `.md`, served by
// src/pages/api/markdown/[kind]/[slug].js. The index says so once, as a rule,
// rather than repeating a second URL on every line: at 18KB of a 20KB budget
// there is no room for 37 extra links, and the rule is what an agent needs.
// The per topic index does spell them out; it is small enough to afford it.
const MARKDOWN_RULE = [
  'Markdown variant of any episode, guest, newsletter or topic page: add .md to its URL',
  `(for example ${SITE_URL}/episodes/<slug>.md). Per topic index: ${SITE_URL}/topics/<slug>/llms.txt`,
];

const markdownUrl = (url) => `${url}.md`;

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
function editionsSection(editions, limit, { markdown = false } = {}) {
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
    if (markdown) lines.push(`  Markdown: ${markdownUrl(url)}`);
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
// `markdown: true` adds the episode's .md URL under the line (see
// MARKDOWN_RULE for why the site index does not).
export function episodeLines(ep, getTranscript, depth, { markdown = false } = {}) {
  const url = `${SITE_URL}/episodes/${ep.slug}`;
  const transcript = getTranscript(ep.slug);
  const lines = [];

  if (!transcript?.summary) {
    lines.push(`- [${ep.title}](${url}) — ${ep.guest}`);
  } else {
    const summary = depth === 'full' ? transcript.summary : oneLine(transcript.summary);
    lines.push(`- [${ep.title}](${url}) — ${ep.guest}: ${summary}`);
  }
  if (markdown) lines.push(`  Markdown: ${markdownUrl(url)}`);
  if (depth !== 'full' || !transcript?.summary) return lines;

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

// ---------------------------------------------------------------------------
// Agent actions and sponsorship facts. One contiguous block, kept together on
// purpose: other work touches this file too, and a single block merges clean.
//
// Everything else in this file serves a crawler reading content. These two
// sections serve an agent acting for a person: a PR person's assistant
// pitching a guest, or a brand's assistant researching sponsorship. Both
// forms on the site have a hidden anti-spam field that such an agent fills
// if it reads the DOM, and the route then answers 200 and drops the lead
// (lib/formSpam.js). The fix on the form side is the field's name and label;
// the fix here is telling the agent the contract outright: the endpoint, the
// exact field names, what the status codes mean, and what to leave out.
//
// Field names, limits and status codes are copied from
// src/pages/api/guest-inquiry.js and src/pages/api/sponsor-inquiry.js and
// must be kept in sync with them. The limits quoted are the server's, since
// an agent posts to the route, not through the form; the form's tighter
// maxLength values are a courtesy to a person typing. Every figure in the
// facts section is one the /sponsorship page already publishes, pulled from
// lib/sponsorOffer.js and lib/ratings so it cannot drift from the page.
// Audience size is deliberately absent: the page does not publish it, and a
// document written to be quoted must not estimate it.
// ---------------------------------------------------------------------------

const GUEST_EMAIL = 'guests@dimepodcast.com';
const SPONSOR_EMAIL = 'sponsorship@dimepodcast.com';

function agentActionsSection() {
  return [
    '## For agents acting for a person',
    '',
    "This site accepts two submissions from an agent working on someone's behalf: a guest pitch and a sponsorship inquiry. Each goes to an inbox a person reads and answers. There is no automated reply.",
    'Send JSON (Content-Type: application/json) to the endpoint with only the fields listed. The form pages also carry a hidden anti-spam field and a timing field: omit both, or the submission is discarded.',
    'Responses: 200 with {"ok":true} means it reached the inbox. 200 with {"ok":true,"filtered":true} means it was discarded as spam. 400 means a required field is missing or the email is malformed. 502 or 503 means mail could not be sent; use the email fallback instead.',
    '',
    '### Pitch a guest',
    '',
    `Page: ${SITE_URL}/guests`,
    `Endpoint: POST ${SITE_URL}/api/guest-inquiry`,
    'Fields: name (required, up to 200 characters), companyTitle (required, company and title, 300), email (required, 320), pitch (required, 4000; the form asks for 2 to 3 sentences on what the person would say to a room of cannabis operators and executives), links (optional, 2000; LinkedIn, recent press, company website).',
    `Email fallback: ${GUEST_EMAIL}`,
    'What happens: every application is read personally. If it is a fit, a reply comes within 5 business days, then a short alignment call, a remote or in-person recording, and distribution on Apple Podcasts, Spotify, YouTube, LinkedIn and the First Principles newsletter.',
    'Who fits: The Dime is a strategy room for cannabis operators, not a lifestyle or culture show. Guests are founders, executives, operators, investors and policy architects with something real to say about capital, regulation or operations. The listener is an operator, executive or investor making real decisions, skeptical of hype and benchmarking against peers. Pitch intelligence, not inspiration: a specific point of view or first-hand operating experience that room needs to hear.',
    '',
    '### Ask about sponsorship',
    '',
    `Page: ${SITE_URL}/sponsorship`,
    `Endpoint: POST ${SITE_URL}/api/sponsor-inquiry`,
    'Fields: name (required, up to 200 characters), company (required, 200), email (required, 320), targetCustomer (optional, 4000; who the sponsor is trying to reach), campaignGoal (optional, 4000; what listeners should do after they hear it).',
    `Email fallback: ${SPONSOR_EMAIL}`,
    'What happens: Bryan Fields reads it personally and comes back with fit, the next open slot and a straight answer on whether it is worth the money. No turnaround time is promised. Campaigns open with a strategy session before anything is recorded.',
    '',
  ];
}

function sponsorFactsSection() {
  const usd = (n) => `$${n.toLocaleString('en-US')}`;
  return [
    '## Sponsorship facts',
    '',
    `Everything here is stated on ${SITE_URL}/sponsorship. Audience size is not published: download, subscriber and follower figures are available on request, with sources. Do not estimate them.`,
    '',
    '- Audience: cannabis operators and founders running cultivation, retail, manufacturing and MSOs; C-suite and finance; investors and capital; and the service providers selling to them. Listeners press play on purpose for a forty-five minute conversation.',
    `- Rating: ${PODCAST_RATING.value} stars from ${PODCAST_RATING.count} ratings on Apple Podcasts. On air since 2020.`,
    `- Formats: Episode Partner, ${usd(EPISODE_PRICE)}, one host-read integration in one episode. Four-Episode Campaign, ${usd(CAMPAIGN_PRICE)} (${usd(PER_EPISODE_IN_CAMPAIGN)} per episode, ${CAMPAIGN_DISCOUNT_PCT}% less than one-off), with category exclusivity for the campaign window, an opening strategy session and campaign reporting.`,
    `- What a sponsor receives per episode: ${ASSETS_PER_EPISODE} to ${ASSETS_PER_EPISODE_MAX} assets. The full-length video episode on YouTube with the host-read integration; the podcast audio on every streaming platform; ${SOCIAL_CUTS_MIN} to ${SOCIAL_CUTS_MAX} captioned short-form cuts posted natively to Instagram, Facebook, LinkedIn and YouTube; a placement in the First Principles newsletter; a written companion article; and a permanent episode page with show notes, the full transcript and the sponsor's link. Every asset is handed over when the campaign wraps, with full rights to repurpose it.`,
    '- Editorial: the sponsor approves the host-read copy before the episode publishes. Sponsorship does not influence questions or guest coverage.',
    '- Time required: one 45-minute recording if also appearing as a guest, with questions sent in advance. Less without a guest appearance: the sponsor provides the offer and the call to action, and the read is written and produced by the show.',
    `- Inquiry: the form on ${SITE_URL}/sponsorship, POST ${SITE_URL}/api/sponsor-inquiry as described above, or ${SPONSOR_EMAIL}.`,
    '',
  ];
}

/** The curated index served at /llms.txt. */
export function buildLlmsIndex(episodes, topics, editions, getTranscript) {
  const lines = [
    ...header(episodes),
    // Stated before any list, not in a footer: a consumer that truncates this
    // document still learns the full catalogue exists and where it is.
    'This file is a curated index. The complete catalogue — every episode with',
    `its summary, key takeaways and FAQ — is at ${SITE_URL}/llms-full.txt`,
    ...MARKDOWN_RULE,
    '',
    ...siteLinks(),
    ...agentActionsSection(),
    ...sponsorFactsSection(),
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
    ...MARKDOWN_RULE,
    '',
    ...siteLinks(),
    ...agentActionsSection(),
    ...sponsorFactsSection(),
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

/**
 * One topic's index, served at /topics/<slug>/llms.txt. Same shape as the
 * site index (header, written analysis, then episodes with one-line
 * summaries), scoped to the hub and with every entry's Markdown URL spelled
 * out, since this document is what an agent reads before choosing which
 * pages to fetch. `episodes` and `editions` are the hub page's own lists
 * (lib/topics getEpisodesByTopicSlug, lib/newsletter getEditionsForTopic), so
 * the index and the page cannot disagree about what the topic contains.
 */
export function buildTopicLlms({ topic, slug, episodes, editions, getTranscript }) {
  const hubUrl = `${SITE_URL}/topics/${slug}`;
  const lines = [
    `# The Dime Podcast: ${topic}`,
    '',
    '> Cannabis business intelligence. Strategy conversations for operators, not observers.',
    '',
    `${episodes.length} episode${episodes.length === 1 ? '' : 's'} on ${topic}. Hub page: ${hubUrl}`,
    `This page as Markdown: ${markdownUrl(hubUrl)}`,
    `Site index: ${SITE_URL}/llms.txt. Complete catalogue: ${SITE_URL}/llms-full.txt`,
    ...MARKDOWN_RULE,
    '',
    ...editionsSection(editions, undefined, { markdown: true }),
    '## Episodes',
    '',
  ];

  for (const ep of episodes) {
    lines.push(...episodeLines(ep, getTranscript, 'summary', { markdown: true }));
  }
  lines.push('');

  return lines.join('\n');
}
