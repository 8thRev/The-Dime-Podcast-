// lib/markdownDocs.js
// Builds the Markdown variant of one content page by kind and slug. Shared by
// the .md route (src/pages/api/markdown/[kind]/[slug].js) and the MCP
// endpoint (src/pages/api/mcp.js), so an agent gets the same document either
// way. The documents themselves are written in lib/markdown.js.
//
// Server only: reads the RSS feed and the content directories.

import { getEpisodeBySlug } from './rss';
import { getTranscriptBySlug } from './transcripts';
import { getGuestBySlug } from './guests';
import { getEditionBySlug, getEditionForEpisode, getEditionsForGuest, getEditionsForTopic } from './newsletter';
import { getAnswerBySlug } from './answers';
import { getEpisodesByTopicSlug } from './topics';
import { getVideoIdsForEpisode } from './videoEpisodeMap';
import { getAllVideos } from './youtube';
import {
  buildEpisodeMarkdown,
  buildGuestMarkdown,
  buildEditionMarkdown,
  buildAnswerMarkdown,
  buildTopicMarkdown,
} from './markdown';
import { SITE_URL, episodeLines } from './llms';
import { getEpisodeIndex } from './episodeIndex';
import { normalizeQuery, searchEpisodes } from './episodeSearch';

// Each builder returns the document, null for "no such page", or
// { redirect } when the slug is an episode's retired truncated form (the HTML
// page 301s those to the full slug; the .md does the same so the two never
// answer differently for one slug).
const BUILDERS = {
  episodes: async (slug) => {
    const episode = await getEpisodeBySlug(slug);
    if (!episode) return null;
    if (episode.legacySlug && slug === episode.legacySlug) {
      return { redirect: `/episodes/${episode.slug}.md` };
    }
    const transcript = getTranscriptBySlug(episode.slug);
    const videoIds = getVideoIdsForEpisode(episode.slug);
    let videos = [];
    if (videoIds.length > 0) {
      const byId = new Map((await getAllVideos()).map((v) => [v.id, v]));
      videos = videoIds.map((id) => byId.get(id)).filter(Boolean);
    }
    return buildEpisodeMarkdown({ episode, transcript, videos, edition: getEditionForEpisode(episode.slug) });
  },

  guests: async (slug) => {
    const result = await getGuestBySlug(slug);
    if (!result) return null;
    return buildGuestMarkdown({
      guest: result.guest,
      episodes: result.episodes,
      editions: getEditionsForGuest(slug),
      getTranscript: getTranscriptBySlug,
    });
  },

  newsletter: async (slug) => {
    const edition = getEditionBySlug(slug);
    if (!edition) return null;
    const episode = edition.episodeSlug ? await getEpisodeBySlug(edition.episodeSlug) : null;
    return buildEditionMarkdown({ edition, episode });
  },

  answers: async (slug) => {
    const post = getAnswerBySlug(slug);
    if (!post) return null;
    // Same build-time resolution the HTML page does, and the same silent
    // drop for a slug that is not in the feed, so the two renderings cite
    // exactly the same episodes.
    const episodes = [];
    for (const episodeSlug of post.episodes) {
      const match = await getEpisodeBySlug(episodeSlug);
      if (match) episodes.push(match);
    }
    return buildAnswerMarkdown({ post, episodes });
  },

  topics: async (slug) => {
    const result = await getEpisodesByTopicSlug(slug);
    if (!result) return null;
    return buildTopicMarkdown({
      topic: result.topic,
      slug,
      episodes: result.episodes,
      editions: getEditionsForTopic(slug),
      getTranscript: getTranscriptBySlug,
    });
  },
};

export const MARKDOWN_KINDS = Object.keys(BUILDERS);

/**
 * The document, null when there is no such page, or { redirect } for a
 * retired slug. Unknown kinds are null rather than an error.
 */
export async function buildMarkdownDoc(kind, slug) {
  if (!Object.prototype.hasOwnProperty.call(BUILDERS, kind)) return null;
  if (typeof slug !== 'string' || !slug) return null;
  return BUILDERS[kind](slug);
}

/**
 * /episodes.md and /episodes.md?q=: the episode archive, or one search of
 * it, as Markdown. Same index and same search function as /episodes?q=
 * (lib/episodeSearch.js), so the HTML and Markdown results never disagree.
 * Returns null when the feed is unavailable, so the route can answer 503
 * instead of caching an empty archive.
 */
export async function buildEpisodeSearchMarkdown(rawQuery) {
  const index = await getEpisodeIndex();
  if (!index.length) return null;
  const query = normalizeQuery(rawQuery);
  const results = searchEpisodes(index, query);

  const lines = query
    ? [
        // In a code span so the query is shown, never interpreted. Backticks
        // would close it, and normalizeQuery already removed newlines.
        `# Episodes of The Dime Podcast matching \`${query.replace(/`/g, "'")}\``,
        '',
        `${results.length} of ${index.length} episodes match. Every word of the query has to appear in the episode's title, guest, keywords, topics or summary; title and guest matches rank first.`,
      ]
    : [
        '# Episodes of The Dime Podcast',
        '',
        `All ${index.length} episodes, newest first.`,
      ];
  lines.push(
    '',
    `Search: ${SITE_URL}/episodes.md?q=280e (any words, URL encoded). HTML version: ${SITE_URL}/episodes${query ? `?q=${encodeURIComponent(query)}` : ''}`,
    'Summaries, where present, are AI generated from the episode audio and may contain errors. Episodes without one have no transcript yet.',
    ''
  );
  for (const ep of results) lines.push(...episodeLines(ep, getTranscriptBySlug, 'short', { markdown: true }));
  if (!results.length) lines.push('No episodes match. Try fewer or broader words, or a topic index: ' + `${SITE_URL}/topics`);
  lines.push('', '---', '', `Site index: ${SITE_URL}/llms.txt`, '');
  return lines.join('\n');
}
