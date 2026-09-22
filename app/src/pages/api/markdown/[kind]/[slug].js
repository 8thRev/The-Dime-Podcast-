// src/pages/api/markdown/[kind]/[slug].js
// Serves the Markdown variant of a content page as text/markdown:
//
//   /episodes/<slug>.md  /guests/<slug>.md  /newsletter/<slug>.md  /topics/<topic>.md
//
// Those public URLs are rewritten here by next.config.js (rewrites), so
// `kind` is one of the four page directories and `slug` is the page's slug
// with the .md already stripped. The documents themselves are built in
// lib/markdown.js from the same loaders the HTML pages use.
//
// Why an API route behind a rewrite, rather than a page file:
//
// - The pages router cannot express `/episodes/[slug].md`. A file segment is
//   either entirely a parameter (`[slug].js`) or entirely literal, so
//   `[slug].md.js` would be a literal segment, and `[slug]/index.md.js`
//   would serve `/episodes/<slug>/index.md`, which is not the URL agents
//   try. A rewrite from `/episodes/:slug.md` is the only way to own the
//   dotted URL.
// - A getStaticProps page cannot set a content type or write a non-HTML
//   body, so the handler has to run per request either way. An API route is
//   the plain form of that: it sets the header and ends the response, with
//   no dummy React component to export (the pattern src/pages/llms.txt.js
//   needs because it lives at a static path where a page file works).
// - ISR equivalence: the HTML pages revalidate hourly. This sets the same
//   `s-maxage=3600, stale-while-revalidate` policy /llms.txt and /rss.xml
//   use, so the CDN serves each .md from cache and refreshes it in the
//   background on the same hourly cadence, and a new transcript reaches the
//   .md within the hour just as it reaches the page.
// - outputFileTracingIncludes keys on the route file, so the transcript and
//   newsletter directories this reads at request time are bundled under
//   `/api/markdown/[kind]/[slug]` in next.config.js, alongside the existing
//   `/episodes/[slug]` entry.
// - robots.txt disallows /api for every crawler. The rewrite is internal, so
//   the crawler only ever sees and fetches `/episodes/<slug>.md`; the side
//   effect is that this handler's own path is not a second indexable copy
//   of the same text.

import { getEpisodeBySlug } from '@/lib/rss';
import { getTranscriptBySlug } from '@/lib/transcripts';
import { getGuestBySlug } from '@/lib/guests';
import { getEditionBySlug, getEditionForEpisode, getEditionsForGuest, getEditionsForTopic } from '@/lib/newsletter';
import { getEpisodesByTopicSlug } from '@/lib/topics';
import { getVideoIdsForEpisode } from '@/lib/videoEpisodeMap';
import { getAllVideos } from '@/lib/youtube';
import { buildEpisodeMarkdown, buildGuestMarkdown, buildEditionMarkdown, buildTopicMarkdown } from '@/lib/markdown';

const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate';

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

function notFound(res) {
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.status(404).end('Not found\n');
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end();
    return;
  }

  const { kind, slug } = req.query;
  const build = Object.prototype.hasOwnProperty.call(BUILDERS, kind) ? BUILDERS[kind] : null;
  if (!build || typeof slug !== 'string' || !slug) {
    notFound(res);
    return;
  }

  const result = await build(slug);
  if (!result) {
    notFound(res);
    return;
  }
  if (typeof result === 'object' && result.redirect) {
    res.setHeader('Location', result.redirect);
    res.status(301).end();
    return;
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', CACHE_CONTROL);
  res.status(200).end(result);
}
