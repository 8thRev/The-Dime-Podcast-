// lib/episodeSearch.js
// The one episode search, shared by every surface that offers it:
//
//   /episodes?q=            server rendered result page (src/pages/episodes/search.js)
//   /episodes.md?q=         the same results as Markdown, for agents
//   the search box          client side refinement on /episodes
//   search_episodes         the MCP tool (src/pages/api/mcp.js)
//
// Pure and dependency free so it runs in the browser too. The server and the
// client call the same function on the same list, which is what keeps a
// server rendered result page from changing under the reader on hydration.
//
// Matching: every word of the query must appear somewhere in the episode's
// search text (title, guest, RSS keywords, transcript topics, AI summary).
// Word AND rather than the old whole-phrase substring, so "280e banking"
// finds an episode that mentions both without needing them adjacent. Ranking
// puts title and guest hits first; ties keep the list's own order, which is
// newest first.

export const MAX_QUERY_LENGTH = 200;

// Invisible characters go first: every format character (zero-width,
// soft hyphen, bidi marks and overrides, and the Unicode tag block, which can
// spell out a hidden instruction to an agent reading the heading), private
// use, variation selectors and the blank-looking fillers. The goal is that
// what an agent reads back is what a person would see. Then C0 and C1 control characters (NEL among them) and all
// whitespace, newlines included, collapse to one space. The query is
// echoed into the result page and the Markdown heading, and a newline there
// let a query write its own Markdown block onto a dimepodcast.com URL.
export function normalizeQuery(raw) {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\p{Cf}\p{Co}\u{E0000}-\u{E007F}\u{FE00}-\u{FE0F}\u115F\u1160\u2800\u3164\uFFA0]/gu, '')
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .slice(0, MAX_QUERY_LENGTH)
    .trim();
}

// Letters and digits in any script, plus & and ' inside words ("m&a",
// "o'brien"). Hyphens split, so "schedule-iii" and "schedule iii" agree.
function queryTerms(query) {
  return normalizeQuery(query)
    .toLowerCase()
    .split(/[^\p{L}\p{N}&']+/u)
    .map((t) => t.replace(/^['&]+|['&]+$/g, ''))
    .filter(Boolean);
}

/**
 * `items` need `searchText` (lowercased), `title` and `guest`. Returns the
 * matching items, best first. An empty query returns `items` unchanged.
 */
export function searchEpisodes(items, query) {
  // Nothing typed lists everything. Something typed that holds no searchable
  // word ("!!!", "+") matches nothing, not everything.
  if (!normalizeQuery(query)) return items;
  const terms = queryTerms(query);
  if (!terms.length) return [];

  const scored = [];
  items.forEach((item, index) => {
    const title = (item.title || '').toLowerCase();
    const guest = (item.guest || '').toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (!item.searchText.includes(term)) return;
      if (title.includes(term)) score += 3;
      if (guest.includes(term)) score += 3;
      score += 1;
    }
    scored.push({ item, index, score });
  });

  return scored
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((s) => s.item);
}
