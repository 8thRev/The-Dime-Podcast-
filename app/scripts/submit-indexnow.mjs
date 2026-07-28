#!/usr/bin/env node
// IndexNow submitter — tells Bing/Yandex/Seznam/Naver that specific URLs
// changed, instead of waiting for their own recrawl schedule. Google does
// not participate in IndexNow; the payoff here is Bing, which is what feeds
// ChatGPT search and Copilot (see SEO_ROADMAP.md).
//
// The protocol explicitly asks you not to resubmit unchanged URLs, and
// engines throttle senders that do. So the default mode derives the URL
// list from a git diff and submits only what actually changed; blasting the
// whole sitemap is behind an explicit --all flag for one-time seeding.
//
// Usage:
//   node scripts/submit-indexnow.mjs                    # changed since HEAD~1
//   node scripts/submit-indexnow.mjs --changed <ref>    # changed since <ref>
//   node scripts/submit-indexnow.mjs --all              # every sitemap URL
//   node scripts/submit-indexnow.mjs /episodes/foo ...  # explicit paths/URLs
//
// Flags:
//   --dry-run          print the URL list and exit without submitting
//   --no-verify        skip the pre-submit HTTP check
//   --wait-seconds N   sleep before verifying (lets a deploy finish first)

import { execFileSync } from 'child_process';
import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const ENDPOINT = 'https://api.indexnow.org/indexnow';
const SITE_URL = (process.env.SITE_URL || 'https://www.dimepodcast.com').replace(/\/$/, '');
const HOST = new URL(SITE_URL).host;

// Per the IndexNow spec. We will never come close, but chunking keeps a
// future full-catalog seed from silently truncating.
const MAX_URLS_PER_REQUEST = 10000;

// Guard against an accidental site-wide blast from a mapping bug: anything
// this large is a deliberate seed and must say --all.
const MAX_AUTO_URLS = 200;

const APP_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

function repoRoot() {
  try {
    return execFileSync('git', ['rev-parse', '--show-toplevel'], {
      cwd: APP_DIR,
      encoding: 'utf8',
    }).trim();
  } catch {
    return join(APP_DIR, '..');
  }
}

// --- key -------------------------------------------------------------------

// The IndexNow key is public by design — ownership is proven by serving it at
// /<key>.txt, so it lives in the repo rather than in a secret. That also means
// no GitHub secret to configure: the script finds the key by looking for the
// self-naming file in public/.
function findKey() {
  if (process.env.INDEXNOW_KEY) return process.env.INDEXNOW_KEY.trim();

  const publicDir = join(APP_DIR, 'public');
  for (const entry of readdirSync(publicDir)) {
    if (!entry.endsWith('.txt')) continue;
    const name = entry.replace(/\.txt$/, '');
    if (!/^[a-f0-9-]{8,128}$/i.test(name)) continue;
    const contents = readFileSync(join(publicDir, entry), 'utf8').trim();
    if (contents === name) return name;
  }
  return null;
}

// --- URL derivation --------------------------------------------------------

function toUrl(pathOrUrl) {
  if (/^https?:\/\//.test(pathOrUrl)) return pathOrUrl;
  return `${SITE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;
}

function urlsFromSitemap() {
  const publicDir = join(APP_DIR, 'public');
  const urls = new Set();
  for (const entry of readdirSync(publicDir)) {
    // sitemap.xml is the index (it lists sitemap-N.xml, not page URLs), so
    // reading the numbered files directly is both sufficient and correct.
    if (!/^sitemap-\d+\.xml$/.test(entry)) continue;
    const xml = readFileSync(join(publicDir, entry), 'utf8');
    for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
      urls.add(match[1].trim());
    }
  }
  return [...urls];
}

// Maps a changed repo file to the page URL(s) it affects. Deliberately
// conservative: a change to a dynamic route template (episodes/[slug].js)
// affects every episode page, and resubmitting hundreds of URLs for a layout
// tweak is exactly the abuse the protocol warns about — those return only the
// hub URLs, and a real re-seed is a manual --all run.
function urlsForChangedFile(file) {
  const paths = [];

  const transcript = file.match(/^app\/content\/transcripts\/(.+)\.json$/);
  if (transcript) {
    paths.push(`/episodes/${transcript[1]}`, '/episodes', '/');
    return paths;
  }

  if (file === 'app/content/testimonials.json') {
    paths.push('/');
    return paths;
  }

  const page = file.match(/^app\/src\/pages\/(.+)\.(js|jsx)$/);
  if (page) {
    const route = page[1];
    // Not user-facing HTML routes.
    if (route.startsWith('_') || route === 'llms.txt') return paths;
    // Dynamic template — see note above.
    if (route.includes('[')) {
      const section = route.split('/')[0];
      paths.push(`/${section}`);
      return paths;
    }
    paths.push(route === 'index' ? '/' : `/${route.replace(/\/index$/, '')}`);
    return paths;
  }

  return paths;
}

function urlsFromGitDiff(ref) {
  const root = repoRoot();
  let changed;
  try {
    changed = execFileSync('git', ['diff', '--name-only', `${ref}..HEAD`], {
      cwd: root,
      encoding: 'utf8',
    })
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
  } catch (error) {
    console.error(`Could not diff against "${ref}": ${error.message}`);
    process.exit(1);
  }

  const paths = new Set();
  for (const file of changed) {
    for (const path of urlsForChangedFile(file)) paths.add(path);
  }
  return [...paths].map(toUrl);
}

// --- verification ----------------------------------------------------------

// Submitting URLs that 404 or error is what erodes a host's IndexNow standing,
// so check before sending. This also covers the deploy race: a brand-new
// episode page does not exist until the build that includes its transcript has
// gone live, and an unbuilt URL will 404 here rather than being submitted.
async function verify(urls) {
  const live = [];
  const dead = [];

  for (let i = 0; i < urls.length; i += 5) {
    const batch = urls.slice(i, i + 5);
    const results = await Promise.all(
      batch.map(async (url) => {
        try {
          let response = await fetch(url, { method: 'HEAD', redirect: 'follow' });
          if (response.status === 405) {
            response = await fetch(url, { method: 'GET', redirect: 'follow' });
          }
          return { url, status: response.status };
        } catch (error) {
          return { url, status: `error: ${error.message}` };
        }
      })
    );
    for (const { url, status } of results) {
      if (status === 200) live.push(url);
      else dead.push(`${url} (${status})`);
    }
  }

  return { live, dead };
}

// --- submission ------------------------------------------------------------

async function submit(urls, key) {
  const keyLocation = `${SITE_URL}/${key}.txt`;
  let failed = false;

  for (let i = 0; i < urls.length; i += MAX_URLS_PER_REQUEST) {
    const urlList = urls.slice(i, i + MAX_URLS_PER_REQUEST);
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation, urlList }),
    });

    // 200 = accepted, 202 = accepted but the key file has not been validated
    // yet (normal on the very first submission after deploying the key).
    if (response.status === 200 || response.status === 202) {
      console.log(`Submitted ${urlList.length} URL(s) — HTTP ${response.status}`);
      continue;
    }

    const body = await response.text().catch(() => '');
    console.error(`IndexNow rejected the submission — HTTP ${response.status}`);
    if (body) console.error(body.slice(0, 500));
    if (response.status === 403) {
      console.error(`Key not valid. Confirm ${keyLocation} is live and contains exactly "${key}".`);
    }
    failed = true;
  }

  return failed ? 1 : 0;
}

// --- main ------------------------------------------------------------------

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const flagValue = (name, fallback) => {
  const index = args.indexOf(name);
  return index !== -1 && args[index + 1] ? args[index + 1] : fallback;
};

const dryRun = flag('--dry-run');
const shouldVerify = !flag('--no-verify');
const waitSeconds = Number(flagValue('--wait-seconds', process.env.INDEXNOW_WAIT_SECONDS || 0));
const all = flag('--all');

const positional = args.filter(
  (arg, index) =>
    !arg.startsWith('--') &&
    args[index - 1] !== '--changed' &&
    args[index - 1] !== '--wait-seconds'
);

// Returns an exit code rather than calling process.exit(): killing the
// process while undici still holds sockets open crashes Node on Windows.
async function main() {
  let urls;
  if (all) {
    urls = urlsFromSitemap();
    if (!urls.length) {
      console.error('No sitemap URLs found in public/ — run `npm run build` first.');
      return 1;
    }
  } else if (positional.length) {
    urls = positional.map(toUrl);
  } else {
    urls = urlsFromGitDiff(flagValue('--changed', 'HEAD~1'));
  }

  if (!urls.length) {
    console.log('No changed URLs to submit.');
    return 0;
  }

  if (!all && urls.length > MAX_AUTO_URLS) {
    console.error(
      `Refusing to auto-submit ${urls.length} URLs (cap ${MAX_AUTO_URLS}). ` +
        'Re-run with --all if a full re-seed is really what you want.'
    );
    return 1;
  }

  const key = findKey();
  if (!key) {
    console.error('No IndexNow key found — expected a self-naming <key>.txt in app/public/ or INDEXNOW_KEY set.');
    return 1;
  }

  console.log(`${urls.length} candidate URL(s):`);
  for (const url of urls) console.log(`  ${url}`);

  if (waitSeconds > 0) {
    console.log(`Waiting ${waitSeconds}s for the deploy to go live...`);
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
  }

  if (shouldVerify) {
    const { live, dead } = await verify(urls);
    if (dead.length) {
      console.warn(`Skipping ${dead.length} URL(s) that did not return 200:`);
      for (const entry of dead) console.warn(`  ${entry}`);
    }
    urls = live;
  }

  if (!urls.length) {
    console.log('Nothing left to submit after verification.');
    return 0;
  }

  if (dryRun) {
    console.log(`[dry run] Would submit ${urls.length} URL(s) to ${ENDPOINT} as ${HOST}.`);
    return 0;
  }

  return submit(urls, key);
}

process.exitCode = await main();
