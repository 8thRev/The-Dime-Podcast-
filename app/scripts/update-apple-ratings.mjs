// scripts/update-apple-ratings.mjs
// Writes app/content/ratings.json — the Apple Podcasts rating every page
// renders through lib/ratings.ts. Run on a schedule by
// .github/workflows/apple-ratings.yml, which commits the result.
//
// Apple has no public ratings API for podcasts (the iTunes lookup endpoint
// omits them), but every storefront's show page embeds its own
// `ratingAverage` / `totalNumberOfRatings` / `ratingCounts` in the server
// data. Ratings are per-country, so the global figure is the sum across
// storefronts — as of 2026-09-16 that was US 108, CA 3, AU 1, DE 1, PH 1.
//
// Failure policy, because a wrong number here is published on every page:
//   * A storefront that errors keeps its previous figures rather than
//     counting as zero, so a flaky request can't shrink the total.
//   * If the US storefront (~95% of ratings) can't be read, nothing is written.
//   * A total that falls by more than DROP_TOLERANCE is refused — Apple
//     rarely removes ratings, and a sudden drop is far likelier to be a page
//     format change. Set FORCE=1 to accept it after checking by hand.
//   * The file is only rewritten when the figures change, so the scheduled
//     job doesn't commit (and redeploy) every day for nothing.
//
// Usage: node scripts/update-apple-ratings.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const SHOW_ID = "1540199573";
const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "content",
  "ratings.json"
);
const DROP_TOLERANCE = 5;
const CONCURRENCY = 8;

// Every storefront Apple Podcasts serves. Unknown codes 404 and are skipped.
const STOREFRONTS = `us ca gb au de nz ie in za mx ae ag ai al am ao ar at az bb
be bf bg bh bj bm bn bo br bs bt bw by bz cg ch cl co cr cv cy cz dk dm do dz
ec ee eg es fi fj fm fr gd gh gm gr gt gw gy hk hn hr hu id il is it jm jo jp ke
kg kh kn kr kw ky kz la lb lc lk lr lt lu lv md mg mk ml mn mo mr ms mt mu mw my
mz na ne ng ni nl no np om pa pe pg ph pk pl pt pw py qa ro ru rw sa sb sc se sg
si sk sl sn sr st sv sz tc td th tj tm tn tr tt tw tz ua ug uy uz vc ve vg vn ye
zw`.split(/\s+/).filter(Boolean);

// Anchored on this show's productId so a "you might also like" shelf on the
// same page can never be read as our rating. ratingCounts is ordered 5★→1★.
const RATING_RE = new RegExp(
  `"productId":"${SHOW_ID}","ratingAverage":([\\d.]+),"totalNumberOfRatings":(\\d+)[^}]*?"ratingCounts":\\[([\\d,]*)\\]`
);

async function fetchStorefront(code) {
  const url = `https://podcasts.apple.com/${code}/podcast/the-dime/id${SHOW_ID}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; dimepodcast-ratings/1.0)" },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status === 404) return { code, status: "absent" };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const m = (await res.text()).match(RATING_RE);
      if (!m) throw new Error("rating block not found in page");
      return {
        code,
        status: "ok",
        count: Number(m[2]),
        histogram: m[3] ? m[3].split(",").map(Number) : [],
        average: Number(m[1]),
      };
    } catch (err) {
      if (attempt === 3) return { code, status: "error", error: err.message };
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function mapLimit(items, limit, fn) {
  const out = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: limit }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]);
      }
    })
  );
  return out;
}

// Prefer the star histogram: it gives the exact mean, where averaging
// Apple's already-rounded per-storefront averages would compound rounding.
function starSum({ count, histogram, average }) {
  if (histogram.length === 5 && histogram.reduce((a, b) => a + b, 0) === count) {
    return histogram.reduce((sum, n, i) => sum + n * (5 - i), 0);
  }
  return average * count;
}

function readPrevious() {
  try {
    return JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf8"));
  } catch {
    return null;
  }
}

async function main() {
  const previous = readPrevious();
  const results = await mapLimit(STOREFRONTS, CONCURRENCY, fetchStorefront);

  const us = results.find((r) => r.code === "us");
  if (us.status !== "ok") {
    console.error(`::error::US storefront unreadable (${us.error || us.status}); not writing.`);
    process.exit(1);
  }

  const storefronts = {};
  const errors = [];
  for (const r of results) {
    if (r.status === "ok" && r.count > 0) {
      storefronts[r.code] = { count: r.count, stars: starSum(r) };
    } else if (r.status === "error") {
      errors.push(`${r.code}: ${r.error}`);
      const prev = previous?.storefronts?.[r.code];
      if (prev) storefronts[r.code] = prev;
    }
  }

  const count = Object.values(storefronts).reduce((a, s) => a + s.count, 0);
  const stars = Object.values(storefronts).reduce((a, s) => a + s.stars, 0);
  const value = Math.round((stars / count) * 10) / 10;

  console.log(`Storefronts with ratings: ${Object.entries(storefronts)
    .map(([c, s]) => `${c}=${s.count}`)
    .join(" ")}`);
  console.log(`Total: ${value}★ from ${count} ratings (previous: ${previous ? `${previous.value}★ from ${previous.count}` : "none"})`);
  if (errors.length) console.log(`Unreadable storefronts, kept previous figures: ${errors.join("; ")}`);

  if (previous && count < previous.count - DROP_TOLERANCE && process.env.FORCE !== "1") {
    console.error(
      `::error::Rating count fell from ${previous.count} to ${count}. Refusing to publish; ` +
        "check podcasts.apple.com by hand and rerun with FORCE=1 if it's real."
    );
    process.exit(1);
  }

  if (
    previous &&
    previous.value === value &&
    previous.count === count &&
    JSON.stringify(previous.storefronts) === JSON.stringify(storefronts)
  ) {
    console.log("Ratings unchanged; nothing to write.");
    return;
  }

  const data = {
    value,
    count,
    source: `Apple Podcasts, summed across storefronts (id${SHOW_ID})`,
    updatedAt: new Date().toISOString().slice(0, 10),
    storefronts,
  };
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(data, null, 2) + "\n");
  console.log(`Wrote ${path.relative(process.cwd(), OUTPUT_PATH)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
