#!/usr/bin/env node
// Writes public/build-info.json so a running site can be asked which commit it
// was built from.
//
// This exists because "production is healthy" and "production is running the
// latest commit" are different claims, and the verification suite could only
// make the first. If a bot commit breaks the Vercel build, production keeps
// serving the previous deploy: every URL 200s, every asset resolves, the
// sitemap is coherent, the nightly run is green — and main is not live. The
// three scheduled jobs commit straight to main, so that is the un-gated path
// where it would happen.
//
// Runs before `next build` (see package.json), so the file is present in
// public/ by the time the build copies it.

import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';

function commitSha() {
  // Vercel and GitHub Actions both expose the SHA directly; the git call is
  // the local-dev fallback and is allowed to fail (shallow clone, no git, a
  // tarball deploy) without taking the build down over a diagnostic file.
  if (process.env.VERCEL_GIT_COMMIT_SHA) return process.env.VERCEL_GIT_COMMIT_SHA;
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return 'unknown';
  }
}

const info = {
  commit: commitSha(),
  builtAt: new Date().toISOString(),
};

const outDir = join(process.cwd(), 'public');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'build-info.json'), JSON.stringify(info, null, 2) + '\n');

console.log(`build-info: commit ${info.commit} at ${info.builtAt}`);
