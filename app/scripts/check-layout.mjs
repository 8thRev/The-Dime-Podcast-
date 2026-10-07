#!/usr/bin/env node
// Build-time layout tripwire. Runs before `next build` (see package.json) and
// fails on the handful of source patterns that produced every layout and
// readability defect found in the October 2026 design audit:
//
//   1. text below 12px (the serif labels at 9-11px were illegible);
//   2. a page section or article that sets its own fixed 48px gutter instead
//      of sitting in a `.wrap` (that is what pinned /newsletter to the left
//      third of a desktop and squeezed phones to 279px of content);
//   3. an inline two-column grid with no responsive class (about, guests and
//      the home newsletter band all rendered two columns of body text on a
//      375px phone);
//   4. the display serif used below 18px (it has no counters left to read at
//      label sizes; labels are `.eyebrow`, `.meta` or `.section-label`);
//   5. a page file that never uses the layout shell at all;
//   6. a text colour token in globals.css that misses WCAG AA (4.5:1) on any
//      page background, including the link hover colour.
//
// This reads source, like check-seo.mjs. It deliberately does not render
// anything: the rendered-output suite (verify-site.mjs) is capped on purpose
// and a browser-based check would not meet its bar. Run on its own with
// `npm run checklayout`.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const ROOT = process.cwd();
const PAGES_DIR = join(ROOT, 'src', 'pages');
const COMPONENTS_DIR = join(ROOT, 'src', 'components');
const GLOBALS = join(ROOT, 'src', 'styles', 'globals.css');

const MIN_FONT_PX = 12;
const MIN_DISPLAY_PX = 18;
const MIN_CONTRAST = 4.5;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, files);
    else if (entry.endsWith('.js') || entry.endsWith('.jsx')) files.push(full);
  }
  return files;
}

const rel = (file) => relative(ROOT, file).replace(/\\/g, '/');

// Files that render no page chrome: API routes, the plain-text and feed
// endpoints, and Next's two wrapper files.
function isHtmlPage(file) {
  const r = rel(file);
  if (r.includes('/api/')) return false;
  if (/\.(txt|xml)\.js$/.test(r)) return false;
  if (/\/_(app|document)\.js$/.test(r)) return false;
  // The server rendered search page re-exports the episodes component.
  if (r.endsWith('/episodes/search.js')) return false;
  return true;
}

function lineOf(contents, index) {
  return contents.slice(0, index).split('\n').length;
}

const violations = [];
const report = (file, line, message) => violations.push(`${rel(file)}:${line}  ${message}`);

// ---------------------------------------------------------------------------
// 1 + 4: font sizes
// ---------------------------------------------------------------------------
function checkFontSizes(file, contents) {
  const patterns = [
    /fontSize: '(\d+)px'/g,
    /fontSize: (\d+)(?=[,\s}])/g,
    /font-size: (\d+)px/g,
  ];
  for (const re of patterns) {
    for (const m of contents.matchAll(re)) {
      const px = Number(m[1]);
      if (px < MIN_FONT_PX) report(file, lineOf(contents, m.index), `text at ${px}px (floor is ${MIN_FONT_PX}px)`);
    }
  }
  // The display serif on an element whose inline size is below the floor.
  for (const m of contents.matchAll(/className="(?:[^"]*\s)?syne(?:\s[^"]*)?"[^>]*fontSize: '(\d+)px'/g)) {
    const px = Number(m[1]);
    if (px < MIN_DISPLAY_PX) report(file, lineOf(contents, m.index), `display serif (.syne) at ${px}px; use .eyebrow / .meta / .section-label for labels`);
  }
}

// ---------------------------------------------------------------------------
// 2: fixed gutters on page-level containers
// ---------------------------------------------------------------------------
function checkGutters(file, contents) {
  for (const m of contents.matchAll(/<(section|article|main)\b[^>]*padding: '([^']*)'/g)) {
    const value = m[2].replace(/clamp\([^)]*\)/g, '').replace(/var\([^)]*\)/g, '');
    if (/\b48px\b/.test(value)) {
      report(file, lineOf(contents, m.index), `<${m[1]}> sets a fixed 48px gutter; put the content in <div className="wrap"> instead`);
    }
  }
}

// ---------------------------------------------------------------------------
// 3: inline two-column grids
// ---------------------------------------------------------------------------
function checkGrids(file, contents) {
  for (const m of contents.matchAll(/gridTemplateColumns: '1fr 1fr'/g)) {
    report(file, lineOf(contents, m.index), `inline two-column grid with no phone fallback; use className="grid-2" (or a class with its own @media rule)`);
  }
}

// ---------------------------------------------------------------------------
// 5: the layout shell is used
// ---------------------------------------------------------------------------
function checkShell(file, contents) {
  if (!/className="[^"]*\bwrap(?:--\w+)?\b/.test(contents)) {
    report(file, 1, 'page never uses the layout shell (className="wrap" or wrap--prose / wrap--wide / wrap--bleed)');
  }
}

// ---------------------------------------------------------------------------
// 6: colour token contrast
// ---------------------------------------------------------------------------
function luminance(hex) {
  const c = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(c.substr(i, 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

function checkTokens() {
  const css = readFileSync(GLOBALS, 'utf8');
  const tokens = {};
  for (const m of css.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) tokens[m[1]] = m[2];

  const backgrounds = ['bg-base', 'bg-surface', 'bg-overlay', 'card-bg', 'nav-bg'];
  const texts = ['text-headline', 'text-primary', 'text-secondary', 'text-muted', 'text-accent', 'nav-text', 'nav-text-hover', 'nav-text-active', 'card-text-meta', 'card-text-body', 'tag-text'];

  for (const bg of backgrounds) {
    if (!tokens[bg]) { report(GLOBALS, 1, `background token --${bg} missing or not a 6-digit hex`); continue; }
    for (const fg of texts) {
      if (!tokens[fg]) { report(GLOBALS, 1, `text token --${fg} missing or not a 6-digit hex`); continue; }
      const ratio = contrast(tokens[fg], tokens[bg]);
      if (ratio < MIN_CONTRAST) report(GLOBALS, 1, `--${fg} on --${bg} is ${ratio.toFixed(2)}:1 (needs ${MIN_CONTRAST}:1)`);
    }
  }

  // The link hover colour: `a:hover { color: var(--x) }` must resolve to a
  // token that passes on the page background. It was --blue-light (1.6:1).
  const hover = css.match(/a:hover\s*\{[^}]*color:\s*var\(--([a-z0-9-]+)\)/);
  if (!hover) report(GLOBALS, 1, 'no a:hover colour rule found (expected one using a token)');
  else {
    const token = tokens[hover[1]];
    if (!token) report(GLOBALS, 1, `a:hover uses --${hover[1]}, which is not a 6-digit hex token`);
    else {
      const ratio = contrast(token, tokens['bg-base']);
      if (ratio < MIN_CONTRAST) report(GLOBALS, 1, `a:hover colour --${hover[1]} is ${ratio.toFixed(2)}:1 on --bg-base`);
    }
  }

  // Button text on the primary button.
  if (tokens['btn-primary-bg'] && tokens['btn-primary-text']) {
    const ratio = contrast(tokens['btn-primary-text'], tokens['btn-primary-bg']);
    if (ratio < MIN_CONTRAST) report(GLOBALS, 1, `--btn-primary-text on --btn-primary-bg is ${ratio.toFixed(2)}:1`);
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------
const pageFiles = walk(PAGES_DIR);
const componentFiles = walk(COMPONENTS_DIR);

for (const file of [...pageFiles, ...componentFiles]) {
  const contents = readFileSync(file, 'utf8');
  checkFontSizes(file, contents);
  checkGrids(file, contents);
  if (isHtmlPage(file)) checkGutters(file, contents);
}
for (const file of pageFiles.filter(isHtmlPage)) {
  checkShell(file, readFileSync(file, 'utf8'));
}
{
  const css = readFileSync(GLOBALS, 'utf8');
  for (const m of css.matchAll(/font-size: (\d+)px/g)) {
    const px = Number(m[1]);
    if (px < MIN_FONT_PX) report(GLOBALS, lineOf(css, m.index), `text at ${px}px (floor is ${MIN_FONT_PX}px)`);
  }
}
checkTokens();

const checkedPages = pageFiles.filter(isHtmlPage).length;
if (violations.length) {
  console.error(`check-layout: ${violations.length} violation(s) across ${checkedPages} pages\n`);
  for (const v of violations) console.error(`  ${v}`);
  console.error('\nSee the header of scripts/check-layout.mjs for what each rule guards.');
  process.exit(1);
}
console.log(`check-layout: ${checkedPages} pages, ${componentFiles.length} components and globals.css pass (font floor ${MIN_FONT_PX}px, display floor ${MIN_DISPLAY_PX}px, contrast ${MIN_CONTRAST}:1).`);
