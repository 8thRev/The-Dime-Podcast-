// src/pages/api/markdown/episode-search.js
// /episodes.md and /episodes.md?q=<words>, rewritten here by next.config.js.
// The archive index and its search as text/markdown, the Markdown twin of
// /episodes and /episodes?q= (src/pages/episodes/search.js). The document is
// built by buildEpisodeSearchMarkdown in lib/markdownDocs.js.

import { buildEpisodeSearchMarkdown } from '@/lib/markdownDocs';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    res.status(405).end();
    return;
  }

  const q = Array.isArray(req.query.q) ? req.query.q[0] : req.query.q;
  const doc = await buildEpisodeSearchMarkdown(q);
  if (doc === null) {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Retry-After', '60');
    res.status(503).end('Episode feed unavailable, try again shortly\n');
    return;
  }

  res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.status(200).end(doc);
}
