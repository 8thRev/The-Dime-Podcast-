// src/pages/api/markdown/[kind]/[slug].js
// Serves the Markdown variant of a content page as text/markdown:
//
//   /episodes/<slug>.md  /guests/<slug>.md  /newsletter/<slug>.md
//   /answers/<slug>.md   /topics/<topic>.md
//
// Those public URLs are rewritten here by next.config.js (rewrites), so
// `kind` is one of the five page directories and `slug` is the page's slug
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

import { buildMarkdownDoc } from '@/lib/markdownDocs';

const CACHE_CONTROL = 's-maxage=3600, stale-while-revalidate';

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
  const result = await buildMarkdownDoc(kind, slug);
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
