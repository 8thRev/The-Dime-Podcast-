// src/pages/episodes/search.js
// /episodes?q=<query>, rendered on the server.
//
// /episodes itself is a static page, so before this a ?q= request returned
// the same 765 KB list of every episode whatever the query, and the filter
// only ran in the browser. Agents and crawlers run no JavaScript, so the
// SearchAction in the home page JSON-LD (lib/schema.ts) pointed them at a
// search that did nothing. next.config.js rewrites any /episodes request
// carrying a q param here; /episodes without one stays static.
//
// Same component and same search function as the static page
// (lib/episodeSearch.js), so the server rendered list is exactly what the
// browser computes after hydration and typing in the box keeps working.
// Result pages are noindex (see episodes.js). This URL is not linked
// anywhere; it is reached only through the rewrite.

import Episodes from '../episodes';
import { getEpisodeIndex } from '@/lib/episodeIndex';
import { normalizeQuery } from '@/lib/episodeSearch';

export default Episodes;

export async function getServerSideProps({ query, res }) {
  const allEpisodes = await getEpisodeIndex();
  // getAllEpisodes() answers [] when the feed fetch fails. Caching a page
  // that says "0 of 0 episodes match" for an hour would be worse than an
  // error the next request retries.
  if (!allEpisodes.length) throw new Error('Episode feed unavailable');

  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return {
    props: {
      allEpisodes,
      searchPage: true,
      initialQuery: normalizeQuery(Array.isArray(query.q) ? query.q[0] : query.q),
    },
  };
}
