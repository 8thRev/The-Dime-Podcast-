#!/usr/bin/env node
// Site verification suite — runs against a built, running site and asserts
// the sitewide invariants that `check-seo.mjs` structurally cannot see.
//
// check-seo.mjs scans page *source* before the build. This runs after it, over
// *rendered output*, which is the only place bugs like the duplicate `og:type`
// (emitted once by _document.js and once by SeoHead.js) are visible at all.
//
// Usage:
//   node scripts/verify-site.mjs                                  # sample, localhost
//   node scripts/verify-site.mjs --mode=full                      # every sitemap URL
//   node scripts/verify-site.mjs --mode=full --base=https://www.dimepodcast.com
//
// Exits non-zero on any failure. Every check prints what it checked even when
// it passes, so a green run is still evidence rather than silence.
//
// The bar for adding a check here is in SEO_ROADMAP.md ("Guardrails"). Read it
// before adding one — this suite is deliberately capped.

import { readdirSync, readFileSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { RETIRED_GUEST_SLUGS, RETIRED_VIDEO_SLUGS } = require('../lib/retiredSlugs.cjs');
const { STATIC_PAGE_PATHS } = require('../next-sitemap.config.js');

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

// The canonical host is hardcoded in SeoHead.js, so canonical tags read
// `https://www.dimepodcast.com/...` even when serving from localhost. That is
// correct behaviour, and check 10 asserts against this rather than --base.
const SITE_URL = 'https://www.dimepodcast.com';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');
const MODE = flag('mode', 'sample');
if (!['sample', 'full'].includes(MODE)) {
  console.error(`--mode must be "sample" or "full", got "${MODE}"`);
  process.exit(2);
}
const IS_LOCAL = /^https?:\/\/(localhost|127\.0\.0\.1)/.test(BASE);
const PAGES_DIR = join(process.cwd(), 'src', 'pages');

// Sample mode caps the crawl; full mode is uncapped.
const CRAWL_CAP = MODE === 'full' ? Infinity : 80;
const SITEMAP_SAMPLE = 20;

// ---------------------------------------------------------------------------
// Plumbing
// ---------------------------------------------------------------------------

const failures = [];
const fail = (check, message) => failures.push({ check, message });
const log = (message) => console.log(message);

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

const url = (path) => (/^https?:\/\//.test(path) ? path : BASE + path);

async function status(path, redirect = 'manual') {
  try {
    const res = await fetch(url(path), { redirect });
    return { status: res.status, location: res.headers.get('location'), headers: res.headers };
  } catch (error) {
    return { status: 0, error: error.cause?.code || error.message };
  }
}

async function getPage(path) {
  try {
    const res = await fetch(url(path), { redirect: 'manual' });
    const body = res.status === 200 ? await res.text() : '';
    return { status: res.status, body, headers: res.headers };
  } catch (error) {
    return { status: 0, body: '', error: error.cause?.code || error.message };
  }
}

const normalise = (p) => {
  const clean = p.split('#')[0].split('?')[0];
  return clean.length > 1 ? clean.replace(/\/$/, '') : clean;
};

// ---------------------------------------------------------------------------
// Route discovery — the mechanism that keeps this suite honest as the site grows
// ---------------------------------------------------------------------------

// Same walk as check-seo.mjs:14-24.
function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (entry.endsWith('.js') || entry.endsWith('.jsx')) files.push(full);
  }
  return files;
}

// src/pages/episodes/[slug].js -> /episodes/[slug];  index.js -> its directory.
function fileToRoute(file) {
  const rel = relative(PAGES_DIR, file).replace(/\\/g, '/').replace(/\.jsx?$/, '');
  if (rel.startsWith('_') || rel.startsWith('api/')) return null;
  const route = '/' + rel.replace(/(^|\/)index$/, '');
  return route.length > 1 ? route.replace(/\/$/, '') : '/';
}

const routeToRegExp = (route) =>
  new RegExp(
    '^' +
      route
        .split('/')
        .map((seg) => (seg.startsWith('[') ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        .join('/') +
      '$'
  );

// ---------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------

log(`\nVerifying ${BASE}  (mode: ${MODE})\n${'='.repeat(60)}`);

// --- Sitemap: fetch once, reused by checks 4/5/6 and sample selection --------

const sitemapRes = await getPage('/sitemap-0.xml');
if (sitemapRes.status !== 200) {
  console.error(`FATAL: /sitemap-0.xml returned ${sitemapRes.status || sitemapRes.error}. Did the build run?`);
  process.exit(1);
}
const sitemapLocs = [...sitemapRes.body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const sitemapPaths = sitemapLocs.map((l) => normalise(l.replace(SITE_URL, '')) || '/');

// --- Sample selection -------------------------------------------------------

const STATIC_SAMPLE = ['/', '/episodes', '/guests', '/topics', '/videos', '/newsletter', '/about', '/sponsorship', '/privacy', '/terms'];
const DYNAMIC_PREFIXES = ['/episodes/', '/guests/', '/topics/', '/videos/', '/newsletter/'];
const dynamicSample = DYNAMIC_PREFIXES.map((prefix) => sitemapPaths.find((p) => p.startsWith(prefix))).filter(Boolean);

// /llms.txt is excluded from the sitemap by next-sitemap.config.js, so it has
// to be named explicitly or nothing would ever exercise it.
const htmlSample = [...STATIC_SAMPLE, ...dynamicSample];
const sampleUrls = [...htmlSample, '/llms.txt'];

// --- Check 15: route coverage (runs first — it gates the value of everything
// below it, and a new uncovered route should fail loudly, not silently pass) --

const routes = walk(PAGES_DIR).map(fileToRoute).filter(Boolean);
const uncovered = routes.filter((route) => {
  const re = routeToRegExp(route);
  return !sampleUrls.some((u) => re.test(u));
});
for (const route of uncovered) {
  fail(
    '15 route-coverage',
    `no sample URL covers route ${route} — add one to STATIC_SAMPLE or DYNAMIC_PREFIXES in this file, ` +
      `or the whole suite silently skips that page type`
  );
}
log(`[15] route coverage: ${routes.length} routes, ${routes.length - uncovered.length} covered`);

// --- Checks 1/2/3: build assets ---------------------------------------------

function assetUrls(html) {
  const scripts = [...html.matchAll(/<script[^>]+src="(\/_next\/static\/[^"]+)"/g)].map((m) => m[1]);
  const manifests = [...html.matchAll(/\/_next\/static\/[^/"]+\/_(?:buildManifest|ssgManifest)\.js/g)].map((m) => m[0]);
  return [...new Set([...scripts, ...manifests])];
}

const buildIdOf = (html) => html.match(/\/_next\/static\/([^/"]+)\/_(?:build|ssg)Manifest\.js/)?.[1] ?? null;

const localBuildId =
  IS_LOCAL && existsSync(join(process.cwd(), '.next', 'BUILD_ID'))
    ? readFileSync(join(process.cwd(), '.next', 'BUILD_ID'), 'utf8').trim()
    : null;

async function checkAssets() {
  const pages = await mapLimit(htmlSample, 6, async (path) => ({ path, ...(await getPage(path)) }));
  const buildIds = new Set(pages.map((p) => buildIdOf(p.body)).filter(Boolean));

  // Check 2: every page must reference the same build, and locally it must be
  // the build we just made — catches a page hardcoding an asset path.
  if (buildIds.size > 1) {
    fail('2 build-id', `pages reference ${buildIds.size} different build IDs: ${[...buildIds].join(', ')}`);
  }
  if (localBuildId && buildIds.size === 1 && !buildIds.has(localBuildId)) {
    fail('2 build-id', `HTML references build ${[...buildIds][0]} but .next/BUILD_ID is ${localBuildId}`);
  }

  const assets = [...new Set(pages.flatMap((p) => assetUrls(p.body)))];
  const broken = (await mapLimit(assets, 8, async (a) => ({ a, s: (await status(a)).status }))).filter((r) => r.s !== 200);
  return { pages, assets, broken, buildId: [...buildIds][0] ?? null };
}

let { pages: sampledPages, assets, broken: brokenAssets, buildId } = await checkAssets();

// Check 3: skew-tolerant retry. A production deploy landing mid-run replaces
// every changed chunk, and the assets we just enumerated 404 through no fault
// of the code. That is exactly the false positive that sent us down this hole
// in the first place (Ahrefs reported 823 of them) — so confirm the build
// didn't move under us before believing a failure.
if (brokenAssets.length > 0 && !IS_LOCAL) {
  const nowBuildId = buildIdOf((await getPage('/')).body);
  if (nowBuildId && nowBuildId !== buildId) {
    log(`[3] build changed mid-run (${buildId} -> ${nowBuildId}) — deploy skew, re-checking`);
    ({ pages: sampledPages, assets, broken: brokenAssets } = await checkAssets());
  }
}

// Check 1: asset integrity. This catches a genuinely broken build. It does NOT
// catch deploy skew and no single-run check can — a crawler that reads HTML
// under build A and fetches assets under build B will always see 404s. Do not
// weaken this check to make an external crawler's report go to zero.
for (const { a, s } of brokenAssets) fail('1 assets', `${s || 'ERR'} ${a}`);
log(`[1] assets: ${assets.length} unique JS assets across ${sampledPages.length} pages, ${brokenAssets.length} broken`);
log(`[2] build id: ${buildId ?? 'none found'}${localBuildId ? ` (.next/BUILD_ID: ${localBuildId})` : ''}`);

// --- Checks 4/5/6: sitemap ---------------------------------------------------

const dupes = sitemapPaths.filter((p, i) => sitemapPaths.indexOf(p) !== i);
for (const d of [...new Set(dupes)]) fail('5 sitemap-dupes', `${d} appears ${sitemapPaths.filter((p) => p === d).length}x`);

for (const staticPath of STATIC_PAGE_PATHS) {
  const count = sitemapPaths.filter((p) => p === normalise(staticPath)).length;
  if (count !== 1) fail('6 static-pages', `${staticPath} appears ${count}x in the sitemap, expected exactly 1`);
}

const toCheck =
  MODE === 'full'
    ? sitemapPaths
    : [...new Set([...htmlSample, ...sitemapPaths.slice(0, SITEMAP_SAMPLE)])].filter((p) => sitemapPaths.includes(p));
const badSitemap = (await mapLimit(toCheck, 10, async (p) => ({ p, s: (await status(p)).status }))).filter((r) => r.s !== 200);
for (const { p, s } of badSitemap) fail('4 sitemap-200', `${s || 'ERR'} ${p}`);
log(`[4] sitemap URLs: ${toCheck.length} of ${sitemapPaths.length} checked, ${badSitemap.length} non-200`);
log(`[5] sitemap duplicates: ${new Set(dupes).size}`);
log(`[6] static pages: ${STATIC_PAGE_PATHS.length} checked`);

// --- Check 7: redirect table -------------------------------------------------

const redirects = [
  ...Object.entries(RETIRED_GUEST_SLUGS).map(([slug, dest]) => [`/guests/${slug}`, dest]),
  ...Object.entries(RETIRED_VIDEO_SLUGS).map(([slug, dest]) => [`/videos/${slug}`, dest]),
];

await mapLimit(redirects, 6, async ([source, dest]) => {
  const res = await status(source);
  if (res.status !== 301) {
    fail('7 redirects', `${source} returned ${res.status || res.error}, expected 301`);
    return;
  }
  const got = normalise((res.location || '').replace(SITE_URL, '').replace(BASE, ''));
  if (got !== normalise(dest)) {
    fail('7 redirects', `${source} -> ${res.location}, expected ${dest}`);
    return;
  }
  const target = await status(dest);
  if (target.status !== 200) fail('7 redirects', `${source} -> ${dest} but destination returned ${target.status || target.error}`);
});
log(`[7] redirects: ${redirects.length} checked`);

// --- Check 8: internal link crawl -------------------------------------------

const crawled = new Map();
const linkedFrom = new Map();
const seeds = ['/', '/episodes', '/guests', '/topics', '/videos', '/newsletter'];
const queue = [...seeds];
const seen = new Set(seeds);

while (queue.length && crawled.size < CRAWL_CAP) {
  const batch = queue.splice(0, 8);
  await Promise.all(
    batch.map(async (path) => {
      const res = await getPage(path);
      crawled.set(path, res.status || res.error);
      if (res.status !== 200 || !(res.headers?.get('content-type') || '').includes('text/html')) return;
      for (const m of res.body.matchAll(/href="([^"]+)"/g)) {
        const href = m[1];
        if (!href.startsWith('/') || href.startsWith('//')) continue;
        const clean = normalise(href);
        if (!linkedFrom.has(clean)) linkedFrom.set(clean, new Set());
        linkedFrom.get(clean).add(path);
        if (seen.has(clean) || seen.size >= CRAWL_CAP) continue;
        seen.add(clean);
        queue.push(clean);
      }
    })
  );
}
for (const [path, s] of crawled) {
  if (s !== 200) fail('8 crawl', `${s} ${path}  <- linked from ${[...(linkedFrom.get(path) || ['(seed)'])].slice(0, 3).join(', ')}`);
}
log(`[8] internal crawl: ${crawled.size} pages, ${[...crawled.values()].filter((s) => s !== 200).length} broken`);

// --- Checks 9/10/11/12/13: rendered head invariants --------------------------

const count = (html, re) => (html.match(re) || []).length;
const attr = (html, re) => html.match(re)?.[1] ?? null;

// Lengths must be measured on the decoded string, not the raw attribute.
// An apostrophe serialises as `&#x27;` — 6 characters of markup for 1
// character of text — so a correctly-truncated 155-char description reads as
// 165 raw and fails a naive check. One pass, so `&amp;lt;` can't double-decode.
const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', mdash: '—', ndash: '–', hellip: '…' };
const decode = (s) =>
  (s ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, body) => {
    if (body[0] !== '#') return NAMED[body.toLowerCase()] ?? match;
    const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : Number(body.slice(1));
    return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
  });

const ogImages = new Set();

for (const { path, status: s, body } of sampledPages) {
  if (s !== 200) {
    fail('9 head', `${path} returned ${s} — cannot check head invariants`);
    continue;
  }
  const head = body.match(/<head[^>]*>([\s\S]*?)<\/head>/i)?.[1] ?? body;
  const label = path;

  // Check 9: exactly one of each. The duplicate og:type shipped sitewide once
  // because _document.js and SeoHead.js each emitted one and next/head does
  // not dedupe against next/document's Head.
  const singles = [
    ['<title>', /<title[^>]*>/g],
    ['meta description', /<meta[^>]+name="description"/g],
    ['canonical', /<link[^>]+rel="canonical"/g],
    ['og:type', /<meta[^>]+property="og:type"/g],
  ];
  for (const [name, re] of singles) {
    const n = count(head, re);
    if (n !== 1) fail('9 head', `${label}: ${n}x ${name}, expected exactly 1`);
  }

  // Check 10: canonical points at the production URL for this exact path.
  const canonical = attr(head, /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
  const expected = SITE_URL + (path === '/' ? '/' : path);
  if (canonical && normalise(canonical) !== normalise(expected)) {
    fail('10 canonical', `${label}: canonical is ${canonical}, expected ${expected}`);
  }

  // Check 11: length caps. NOT 60 chars — buildPageTitle() budgets 70 on
  // purpose (see the comment at lib/schema.ts:35: Google indexes the whole
  // title and only truncates for display, so cutting at 60 throws away
  // keywords to win nothing). +1 for the ellipsis truncate* appends.
  const title = decode(attr(head, /<title[^>]*>([\s\S]*?)<\/title>/));
  const desc = decode(attr(head, /<meta[^>]+name="description"[^>]+content="([^"]*)"/));
  if (!title?.trim()) fail('11 lengths', `${label}: empty <title>`);
  else if (title.length > 71) fail('11 lengths', `${label}: title is ${title.length} chars (max 71): ${title}`);
  if (!desc?.trim()) fail('11 lengths', `${label}: empty meta description`);
  else if (desc.length > 156) fail('11 lengths', `${label}: description is ${desc.length} chars (max 156)`);

  // Check 12: og:image. DEFAULT_OG_IMAGE in SeoHead.js is a documented stopgap
  // pointing at Simplecast's CDN — it breaks the day the cover art is
  // re-uploaded there, silently blanking share cards on ~586 pages.
  const ogImage = attr(head, /<meta[^>]+property="og:image"[^>]+content="([^"]+)"/);
  if (!ogImage) fail('12 og-image', `${label}: no og:image`);
  else ogImages.add(ogImage);

  // Check 13: structured data must parse.
  for (const m of body.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    let parsed;
    try {
      parsed = JSON.parse(m[1]);
    } catch (error) {
      fail('13 json-ld', `${label}: unparseable JSON-LD — ${error.message}`);
      continue;
    }
    for (const node of Array.isArray(parsed) ? parsed : [parsed]) {
      if (!node['@context'] || !node['@type']) fail('13 json-ld', `${label}: JSON-LD block missing @context or @type`);
    }
  }
}

const badImages = (await mapLimit([...ogImages], 4, async (i) => ({ i, s: (await status(i, 'follow')).status }))).filter((r) => r.s !== 200);
for (const { i, s } of badImages) fail('12 og-image', `${s || 'ERR'} ${i}`);
log(`[9-13] head invariants: ${sampledPages.length} pages, ${ogImages.size} unique og:image (${badImages.length} broken)`);

// --- Check 14: endpoints -----------------------------------------------------

const endpoints = [
  ['/robots.txt', 'text/plain'],
  ['/llms.txt', 'text/plain'],
  ['/sitemap.xml', 'xml'],
  ['/sitemap-0.xml', 'xml'],
];
for (const [path, type] of endpoints) {
  const res = await getPage(path);
  if (res.status !== 200) fail('14 endpoints', `${path} returned ${res.status || res.error}`);
  else if (!(res.headers.get('content-type') || '').includes(type)) {
    fail('14 endpoints', `${path} content-type is ${res.headers.get('content-type')}, expected ${type}`);
  }
}
const robots = (await getPage('/robots.txt')).body;
const sitemapRef = robots.match(/^Sitemap:\s*(\S+)/m)?.[1];
if (!sitemapRef) fail('14 endpoints', 'robots.txt declares no Sitemap:');
else {
  const s = (await status(sitemapRef.replace(SITE_URL, BASE))).status;
  if (s !== 200) fail('14 endpoints', `robots.txt Sitemap: ${sitemapRef} returned ${s}`);
}
log(`[14] endpoints: ${endpoints.length} checked`);

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

log('='.repeat(60));
if (failures.length === 0) {
  log(`PASS — all checks green against ${BASE}\n`);
  process.exit(0);
}

console.error(`\nFAIL — ${failures.length} problem(s):\n`);
const byCheck = new Map();
for (const f of failures) {
  if (!byCheck.has(f.check)) byCheck.set(f.check, []);
  byCheck.get(f.check).push(f.message);
}
for (const [check, messages] of [...byCheck].sort()) {
  console.error(`  ${check} (${messages.length}):`);
  for (const m of messages.slice(0, 25)) console.error(`    ✗ ${m}`);
  if (messages.length > 25) console.error(`    … and ${messages.length - 25} more`);
}
console.error('');
process.exit(1);
