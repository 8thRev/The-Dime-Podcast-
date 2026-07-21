#!/usr/bin/env node
// Build-time regression tripwire: fails the build if any page reintroduces
// the exact bugs this branch fixed (duplicate meta description, uncapped
// title/description) by bypassing the shared SeoHead component. Run before
// `next build` so a broken PR fails fast instead of shipping a page with a
// hand-rolled <Head> block that skips truncation/dedup.

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

const PAGES_DIR = join(process.cwd(), 'src', 'pages');
const ALLOWED_NEXT_HEAD_FILES = new Set(['src/components/SeoHead.js']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (entry.endsWith('.js') || entry.endsWith('.jsx')) {
      files.push(full);
    }
  }
  return files;
}

function checkFile(file) {
  const rel = relative(process.cwd(), file).replace(/\\/g, '/');
  const contents = readFileSync(file, 'utf8');
  const violations = [];

  const importsNextHead = /from ['"]next\/head['"]/.test(contents);
  if (importsNextHead && !ALLOWED_NEXT_HEAD_FILES.has(rel)) {
    violations.push(
      `imports 'next/head' directly — use <SeoHead> from '@/src/components/SeoHead' instead, so title/description length and duplicate-tag guarantees apply.`
    );
  }

  // Pages (not the shared component itself) should never hand-roll these
  // tags — that's exactly how the duplicate-description bug happened.
  if (!rel.endsWith('SeoHead.js') && !rel.endsWith('_document.js')) {
    if (/<meta\s+name=["']description["']/.test(contents)) {
      violations.push(`renders a raw <meta name="description"> tag — this bypasses SeoHead's dedup/truncation.`);
    }
    if (/<title>/.test(contents)) {
      violations.push(`renders a raw <title> tag — this bypasses SeoHead's dedup/truncation.`);
    }
  }

  return violations.map((v) => `${rel}: ${v}`);
}

const files = walk(PAGES_DIR);
const allViolations = files.flatMap(checkFile);

if (allViolations.length > 0) {
  console.error('SEO guardrail check failed:\n');
  for (const v of allViolations) console.error(`  ✗ ${v}`);
  console.error(`\n${allViolations.length} violation(s) found. See SEO_ROADMAP.md "Guardrails" section.`);
  process.exit(1);
}

console.log(`SEO guardrail check passed (${files.length} page files scanned).`);
