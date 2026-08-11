#!/usr/bin/env node
// scripts/audit-outbound-links.mjs
//
// Audits every outbound link the site renders and proves each one is either
// tagged for attribution or skipped for a named reason.
//
// Deliberately NOT part of `npm run verify`. SEO_ROADMAP.md sets a three-part
// bar for that suite — sitewide invariant, already broken in production, and
// cheap — and caps it at ~20 checks / 6 minutes. This makes a network request
// per distinct third-party destination, so it fails the "cheap" test. It runs
// on demand, against a built site:
//
//   npm run build && npx next start
//   node scripts/audit-outbound-links.mjs --base=http://localhost:3000
//
// Against a *built* site specifically: the show-notes tagging happens at build
// time in lib/rss.ts, so dev-server output is not the artifact that ships.
//
// Requires Node >= 22.6 — it imports lib/utm.ts directly via native type
// stripping so the classification is checked against the real never-tag list
// rather than a copy that would drift.

import { parse } from 'node-html-parser';
import { UTM, UTM_SOURCE, isNeverTagHost } from '../lib/utm.ts';

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

// Same argument discipline as verify-site.mjs: a silently ignored `--base
// https://…` would audit localhost while reporting production.
const BAD_ARGS = argv.filter((a) => !/^--(base|mode|no-liveness)(=|$)/.test(a));
if (BAD_ARGS.length) {
  console.error(`Unrecognised argument(s): ${BAD_ARGS.join(' ')}`);
  console.error('Use --name=value form, e.g. --base=https://www.dimepodcast.com --mode=sample');
  process.exit(2);
}

const BASE = flag('base', 'http://localhost:3000').replace(/\/$/, '');
const MODE = flag('mode', 'full');
const SKIP_LIVENESS = argv.includes('--no-liveness');
if (!['sample', 'full'].includes(MODE)) {
  console.error(`--mode must be "sample" or "full", got "${MODE}"`);
  process.exit(2);
}

const PAGE_CONCURRENCY = 10;
const LIVENESS_CONCURRENCY = 8;
const SAMPLE_PER_FAMILY = 12;

// Which campaigns are legitimate on which route family. A show-notes link that
// somehow carries the sponsor-slot medium is worse than an untagged link: it
// silently pollutes a campaign the numbers get trusted from later, and nothing
// downstream would ever surface it.
const ALLOWED_CAMPAIGNS = {
  '/episodes/': [UTM.sponsorSlot.campaign, UTM.showNotes.campaign, UTM.guestLink.campaign],
  '/newsletter/': [UTM.newsletter.campaign],
  '/guests/': [UTM.guestLink.campaign],
};
const CAMPAIGN_MEDIUM = Object.fromEntries(
  Object.values(UTM).map((u) => [u.campaign, u.medium])
);

async function mapLimit(items, limit, fn) {
  const out = [];
  for (let i = 0; i < items.length; i += limit) {
    out.push(...(await Promise.all(items.slice(i, i + limit).map(fn))));
  }
  return out;
}

async function getText(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(30000) });
    return res.status === 200 ? await res.text() : '';
  } catch {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Page discovery
// ---------------------------------------------------------------------------

async function sitemapUrls() {
  const index = await getText(`${BASE}/sitemap.xml`);
  if (!index) {
    console.error(`Could not read ${BASE}/sitemap.xml — is the site running?`);
    process.exit(2);
  }
  const children = [...index.matchAll(/<sitemap>[\s\S]*?<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const sources = children.length ? children : [`${BASE}/sitemap.xml`];

  const paths = new Set();
  for (const src of sources) {
    const xml = src === `${BASE}/sitemap.xml` ? index : await getText(src);
    for (const m of xml.matchAll(/<url>[\s\S]*?<loc>([^<]+)<\/loc>/g)) {
      try {
        paths.add(new URL(m[1]).pathname);
      } catch {
        /* malformed <loc>, ignore */
      }
    }
  }

  const all = [...paths].sort();
  if (MODE === 'full') return all;

  // Sample mode: keep every static page plus a slice of each dynamic family,
  // so a quick run still touches all four tagging surfaces.
  const families = new Map();
  const kept = [];
  for (const p of all) {
    const family = p.split('/').length > 2 ? p.split('/').slice(0, 2).join('/') + '/' : p;
    if (family === p) { kept.push(p); continue; }
    const n = families.get(family) || 0;
    if (n < SAMPLE_PER_FAMILY) { families.set(family, n + 1); kept.push(p); }
  }
  return kept;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

const buckets = {
  tagged: [],
  preTagged: [],
  neverTag: [],
  parseFailure: [],
  unexplained: [],
};
const mismatches = [];

function classify(href, page) {
  // Anything the browser would resolve against our own origin is internal and
  // out of scope; new URL with a base makes that determination the same way a
  // browser does, including protocol-relative and relative hrefs.
  let url;
  try {
    url = new URL(href, BASE);
  } catch {
    // Not resolvable at all. Only counts as a parse failure if it looked like
    // an absolute link — mailto:/tel:/javascript: are legitimately unlinkable.
    if (/^https?:/i.test(href)) buckets.parseFailure.push({ href, page });
    return;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.host === new URL(BASE).host) return;

  const record = { href: url.toString(), host: url.hostname, page };

  if (isNeverTagHost(url.hostname)) {
    buckets.neverTag.push(record);
    return;
  }

  const source = url.searchParams.get('utm_source');
  const medium = url.searchParams.get('utm_medium');
  const campaign = url.searchParams.get('utm_campaign');

  if (!source && !medium && !campaign) {
    buckets.unexplained.push(record);
    return;
  }

  // Hand-tagged, and left alone by the precedence rule in lib/utm.ts.
  //
  // Detected by campaign rather than by source: the show notes already carry
  // ~41 hand-written Newton links using utm_source=Thedime with
  // utm_medium=pod&utm_campaign=simple_link. Keying this off the source would
  // classify those as ours and then flag every one of them as a taxonomy
  // violation — which is backwards, since leaving them untouched is exactly
  // the behaviour that is supposed to happen.
  //
  // Our pass only ever emits the campaigns in UTM, so anything else came from
  // a human in Simplecast.
  const ourCampaigns = Object.values(UTM).map((u) => u.campaign);
  if (source !== UTM_SOURCE || !ourCampaigns.includes(campaign)) {
    buckets.preTagged.push({ ...record, campaign, medium });
    return;
  }

  buckets.tagged.push({ ...record, campaign, medium });

  const family = Object.keys(ALLOWED_CAMPAIGNS).find((f) => page.startsWith(f));
  if (family && !ALLOWED_CAMPAIGNS[family].includes(campaign)) {
    mismatches.push({ ...record, reason: `campaign "${campaign}" not valid on ${family}*` });
  }
  if (CAMPAIGN_MEDIUM[campaign] && CAMPAIGN_MEDIUM[campaign] !== medium) {
    mismatches.push({
      ...record,
      reason: `campaign "${campaign}" expects medium "${CAMPAIGN_MEDIUM[campaign]}", got "${medium}"`,
    });
  }
  if (!url.searchParams.get('utm_content')) {
    mismatches.push({ ...record, reason: 'missing utm_content' });
  }
}

// ---------------------------------------------------------------------------
// Liveness
// ---------------------------------------------------------------------------

// Hosts routinely answer an unattended HEAD with a challenge rather than the
// truth. These are reported separately from genuine breakage — a 403 to a bot
// is not evidence the link is dead for a reader.
const BLOCKED_STATUSES = new Set([401, 403, 405, 406, 429, 999]);

async function checkLiveness(urls) {
  return mapLimit(urls, LIVENESS_CONCURRENCY, async (u) => {
    for (const method of ['HEAD', 'GET']) {
      try {
        const res = await fetch(u, {
          method,
          redirect: 'follow',
          signal: AbortSignal.timeout(20000),
          headers: { 'user-agent': 'dimepodcast-link-audit/1.0' },
        });
        // Some servers reject HEAD but serve GET; retry once before believing.
        if (method === 'HEAD' && (res.status === 405 || res.status === 501)) continue;
        return { url: u, status: res.status };
      } catch (error) {
        if (method === 'GET') return { url: u, status: 0, error: error.cause?.code || error.message };
      }
    }
    return { url: u, status: 0, error: 'unreachable' };
  });
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const pages = await sitemapUrls();
console.log(`Auditing ${BASE} — ${pages.length} pages (${MODE} mode)\n`);

let crawled = 0;
await mapLimit(pages, PAGE_CONCURRENCY, async (path) => {
  const body = await getText(BASE + path);
  if (!body) return;
  crawled += 1;
  for (const a of parse(body).querySelectorAll('a[href]')) {
    classify(a.getAttribute('href'), path);
  }
});

const total =
  buckets.tagged.length +
  buckets.preTagged.length +
  buckets.neverTag.length +
  buckets.parseFailure.length +
  buckets.unexplained.length;

const distinct = [...new Set([...buckets.tagged, ...buckets.preTagged, ...buckets.neverTag].map((r) => r.href))];

const tally = (rows, key) =>
  Object.entries(rows.reduce((acc, r) => ({ ...acc, [r[key]]: (acc[r[key]] || 0) + 1 }), {}))
    .sort((a, b) => b[1] - a[1]);

const pad = (n) => String(n).padStart(6);
console.log(`Pages crawled:          ${pad(crawled)}`);
console.log(`Outbound links found:   ${pad(total)}   (${distinct.length} distinct destinations)`);
console.log(`  tagged                ${pad(buckets.tagged.length)}`);
for (const [campaign, n] of tally(buckets.tagged, 'campaign')) {
  console.log(`      ${campaign.padEnd(24)} ${pad(n)}`);
}
console.log(`  pre-tagged (by hand)  ${pad(buckets.preTagged.length)}`);
for (const [campaign, n] of tally(buckets.preTagged, 'campaign')) {
  console.log(`      ${String(campaign).padEnd(24)} ${pad(n)}`);
}
console.log(`  never-tag (by design) ${pad(buckets.neverTag.length)}`);
for (const [host, n] of tally(buckets.neverTag, 'host').slice(0, 10)) {
  console.log(`      ${host.padEnd(24)} ${pad(n)}`);
}
console.log(`  parse failures        ${pad(buckets.parseFailure.length)}${buckets.parseFailure.length ? '   <- must be zero' : ''}`);
console.log(`  unexplained           ${pad(buckets.unexplained.length)}${buckets.unexplained.length ? '   <- must be zero' : ''}`);

const show = (rows, label) => {
  if (!rows.length) return;
  console.log(`\n${label}:`);
  const byHost = tally(rows, 'host');
  for (const [host, n] of byHost) {
    const example = rows.find((r) => r.host === host);
    console.log(`  ${host} (${n})  e.g. ${example.href}  on ${example.page}`);
  }
};
show(buckets.unexplained, 'UNEXPLAINED — outbound, untagged, and on no skip list');
if (buckets.parseFailure.length) {
  console.log('\nPARSE FAILURES — hrefs that looked absolute but would not parse:');
  for (const r of buckets.parseFailure) console.log(`  ${r.href}  on ${r.page}`);
}
if (mismatches.length) {
  console.log('\nTAXONOMY MISMATCHES:');
  for (const m of mismatches) console.log(`  ${m.reason}\n      ${m.href}  on ${m.page}`);
} else {
  console.log('\nTaxonomy mismatches:         0');
}

if (!SKIP_LIVENESS) {
  console.log(`\nChecking ${distinct.length} distinct destinations…`);
  const results = await checkLiveness(distinct);
  const ok = results.filter((r) => r.status >= 200 && r.status < 400);
  const blocked = results.filter((r) => BLOCKED_STATUSES.has(r.status));
  const dead = results.filter((r) => !ok.includes(r) && !blocked.includes(r));

  console.log(`Destinations reachable: ${pad(ok.length)} / ${distinct.length}`);
  console.log(`  blocked to bots       ${pad(blocked.length)}   (not evidence of breakage)`);
  console.log(`  not reachable         ${pad(dead.length)}`);
  for (const r of dead) console.log(`      ${r.status || r.error}  ${r.url}`);
  if (dead.length) {
    console.log('\n  Note: dead guest links in older show notes are pre-existing rot,');
    console.log('  not a regression from tagging. Compare against a run on the previous');
    console.log('  commit before treating any of these as caused by this change.');
  }
}

const failed = buckets.unexplained.length + buckets.parseFailure.length + mismatches.length;
console.log(
  failed
    ? `\nFAIL — ${buckets.unexplained.length} unexplained, ${buckets.parseFailure.length} parse failures, ${mismatches.length} taxonomy mismatches\n`
    : '\nPASS — every outbound link is tagged, hand-tagged, or skipped for a named reason\n'
);
process.exit(failed ? 1 : 0);
