// scripts/import-linkedin-editions.mjs
// Converts the "Articles" folder from a LinkedIn data export into
// app/content/newsletter/*.md, one markdown file per edition, with the
// frontmatter lib/newsletter.ts expects.
//
// Usage:
//   node scripts/import-linkedin-editions.mjs <path-to-Articles-folder>
//   node scripts/import-linkedin-editions.mjs <folder> --dry-run
//   node scripts/import-linkedin-editions.mjs <folder> --force
//
// This is an assistive importer, not an authority. It guesses the episode
// each edition belongs to by matching against the live RSS feed and writes
// its confidence into the file, but every `episodeSlug` it produces is meant
// to be read by a human before merge — a wrong one publishes a cross-link
// pointing at the wrong conversation. Run with --dry-run first and read the
// report.
//
// Existing files are never overwritten without --force, so re-running after
// hand-editing frontmatter is safe.

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import Parser from "rss-parser";
import TurndownService from "turndown";
import { parse as parseHtml } from "node-html-parser";

const FEED_URL = "https://feeds.simplecast.com/Vnrz0StH";
const OUTPUT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "content",
  "newsletter"
);

// Confidence below this is reported but still written, with the guess moved
// into a `# review:` comment rather than the live episodeSlug field — a
// blank cross-link is recoverable, a confidently wrong one is not.
const MATCH_THRESHOLD = 0.45;

// Mirrors slugify() in app/lib/rss.ts. Duplicated for the same reason
// next-sitemap.config.js duplicates it: this is a plain-Node script that
// can't import the TypeScript module.
function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}

// Words too common across a cannabis-podcast catalogue to carry any signal
// about *which* episode an edition is about.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "of", "to", "in", "on", "for", "with",
  "is", "are", "was", "were", "be", "been", "it", "its", "this", "that", "at",
  "by", "from", "as", "how", "why", "what", "when", "who", "will", "can",
  "ft", "feat", "featuring", "episode", "podcast", "dime", "cannabis",
]);

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
}

// Inverse-document-frequency weighting over episode titles, so a rare word
// ("rescheduling", a guest surname) counts far more than a word that shows
// up in eighty titles. Same principle as the Python Matcher in
// bot/simplecast_feed.py, reimplemented small rather than shared — the two
// run in different languages on different inputs.
function buildIdf(episodes) {
  const docFreq = new Map();
  for (const ep of episodes) {
    for (const word of new Set(tokenize(ep.title))) {
      docFreq.set(word, (docFreq.get(word) || 0) + 1);
    }
  }
  const total = episodes.length;
  return (word) => Math.log(total / (1 + (docFreq.get(word) || 0)));
}

function scoreMatch(editionText, episode, idf) {
  const editionWords = new Set(tokenize(editionText));
  const titleWords = new Set(tokenize(episode.title));
  if (titleWords.size === 0) return 0;

  let overlap = 0;
  let possible = 0;
  for (const word of titleWords) {
    const weight = idf(word);
    possible += weight;
    if (editionWords.has(word)) overlap += weight;
  }
  let score = possible > 0 ? overlap / possible : 0;

  // A guest's full name appearing verbatim in the edition is far stronger
  // evidence than scattered title-word overlap, so it can carry a match on
  // its own. Requires both name parts, so a bare first name can't trigger it.
  if (episode.guest && episode.guest !== "Guest") {
    const parts = episode.guest.toLowerCase().split(/\s+/).filter((p) => p.length > 2);
    if (parts.length >= 2) {
      const haystack = editionText.toLowerCase();
      if (parts.every((p) => haystack.includes(p))) {
        score = Math.max(score, 0.9);
      }
    }
  }

  return score;
}

// Guest extraction here only needs to be good enough for match scoring —
// lib/rss.ts owns the real parsing that the site renders from.
function guestFromTitle(title) {
  const ft = title.match(/\b(?:ft\.?|feat\.?|featuring|with)\s+(.+)$/i);
  if (ft) return ft[1].replace(/[|—–-].*$/, "").trim();
  return "";
}

async function loadEpisodes() {
  const parser = new Parser();
  const feed = await parser.parseURL(FEED_URL);
  return feed.items.map((item) => ({
    title: (item.title || "").trim(),
    slug: slugify(item.title || ""),
    guest: guestFromTitle(item.title || ""),
    date: item.pubDate ? new Date(item.pubDate) : null,
  }));
}

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
  bulletListMarker: "-",
  emDelimiter: "*",
});

// LinkedIn wraps article bodies in tracking/layout chrome that carries no
// content. Dropping it here keeps the markdown clean rather than leaving it
// for a hand pass over 31 files.
turndown.remove(["script", "style", "noscript", "iframe"]);

// Extracts title, date, and body from one exported article. LinkedIn's
// export markup has changed shape more than once, so every field has a
// fallback chain and the caller reports whatever came back empty rather
// than this throwing.
function extractArticle(html, fileName) {
  const root = parseHtml(html);

  const titleEl = root.querySelector("h1") || root.querySelector("title");
  let title = titleEl ? titleEl.text.trim() : "";
  // Export filenames are commonly "<unix-ms>_<Title>.html" or
  // "<YYYY-MM-DD>-<title-slug>.html".
  const nameWithoutExt = fileName.replace(/\.html?$/i, "");
  if (!title) {
    title = nameWithoutExt.replace(/^\d+[_-]/, "").replace(/[-_]+/g, " ").trim();
  }

  let date = "";
  const timeEl = root.querySelector("time");
  const dateAttr = timeEl?.getAttribute("datetime") || timeEl?.text?.trim();
  if (dateAttr && !Number.isNaN(new Date(dateAttr).getTime())) {
    date = new Date(dateAttr).toISOString().slice(0, 10);
  } else {
    const epochMatch = nameWithoutExt.match(/^(\d{10,13})[_-]/);
    const isoMatch = nameWithoutExt.match(/(\d{4}-\d{2}-\d{2})/);
    if (epochMatch) {
      const ms = epochMatch[1].length === 10 ? Number(epochMatch[1]) * 1000 : Number(epochMatch[1]);
      date = new Date(ms).toISOString().slice(0, 10);
    } else if (isoMatch) {
      date = isoMatch[1];
    }
  }

  // Strip the <h1> before converting so the title isn't repeated as the
  // first line of the body — the page template already renders it.
  if (titleEl && titleEl.tagName === "H1") titleEl.remove();

  const bodyEl = root.querySelector("article") || root.querySelector("body") || root;
  const body = turndown.turndown(bodyEl.innerHTML || "").trim();

  return { title, date, body };
}

function frontmatterValue(value) {
  // Quote everything that could be misread as YAML structure. Titles
  // routinely contain colons, and an unquoted colon silently turns the line
  // into a nested map.
  return `"${String(value).replace(/"/g, '\\"')}"`;
}

function buildMarkdown({ title, slug, date, description, episodeSlug, guest, topics, linkedinUrl, body, reviewNotes }) {
  const lines = ["---"];
  lines.push(`title: ${frontmatterValue(title)}`);
  lines.push(`slug: ${slug}`);
  lines.push(`date: ${date}`);
  lines.push(`description: ${frontmatterValue(description)}`);
  lines.push(`episodeSlug: ${episodeSlug}`);
  lines.push(`guest: ${frontmatterValue(guest)}`);
  lines.push(`topics: [${topics.map((t) => frontmatterValue(t)).join(", ")}]`);
  lines.push(`linkedinUrl: ${linkedinUrl}`);
  lines.push("---");
  lines.push("");
  for (const note of reviewNotes) lines.push(`<!-- REVIEW: ${note} -->`);
  if (reviewNotes.length) lines.push("");
  lines.push(body);
  lines.push("");
  return lines.join("\n");
}

function excerpt(body, maxLength = 155) {
  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");
  const sourceDir = args.find((a) => !a.startsWith("--"));

  if (!sourceDir) {
    console.error("Usage: node scripts/import-linkedin-editions.mjs <Articles-folder> [--dry-run] [--force]");
    return 1;
  }
  if (!fs.existsSync(sourceDir)) {
    console.error(`No such folder: ${sourceDir}`);
    return 1;
  }

  const files = fs.readdirSync(sourceDir).filter((f) => /\.html?$/i.test(f));
  if (files.length === 0) {
    console.error(`No .html files in ${sourceDir}`);
    return 1;
  }
  console.log(`Found ${files.length} exported article(s)\n`);

  console.log("Fetching the RSS feed for episode matching...");
  const episodes = await loadEpisodes();
  const idf = buildIdf(episodes);
  console.log(`Loaded ${episodes.length} published episodes\n`);

  if (!dryRun) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  let written = 0;
  let skipped = 0;
  const needsReview = [];

  for (const file of files.sort()) {
    const html = fs.readFileSync(path.join(sourceDir, file), "utf-8");
    const { title, date, body } = extractArticle(html, file);
    const reviewNotes = [];

    if (!title) {
      console.warn(`SKIP ${file} — could not extract a title`);
      skipped += 1;
      continue;
    }
    if (!body) {
      console.warn(`SKIP ${file} — extracted an empty body`);
      skipped += 1;
      continue;
    }

    const slug = slugify(title);
    const outPath = path.join(OUTPUT_DIR, `${slug}.md`);

    if (fs.existsSync(outPath) && !force) {
      console.log(`SKIP ${slug}.md — already exists (use --force to overwrite)`);
      skipped += 1;
      continue;
    }

    // Match against the title plus the first ~1500 characters of the body:
    // guest names and company references cluster near the top of these
    // pieces, and using the whole body lets long tangents outvote the lede.
    const matchText = `${title}\n${body.slice(0, 1500)}`;
    const scored = episodes
      .map((ep) => ({ ep, score: scoreMatch(matchText, ep, idf) }))
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    const runnerUp = scored[1];

    let episodeSlug = "";
    let guest = "";
    if (best && best.score >= MATCH_THRESHOLD) {
      episodeSlug = best.ep.slug;
      guest = best.ep.guest;
      if (runnerUp && best.score - runnerUp.score < 0.15) {
        reviewNotes.push(
          `ambiguous episode match (${best.score.toFixed(2)} vs ${runnerUp.score.toFixed(2)}); runner-up: ${runnerUp.ep.slug}`
        );
        needsReview.push(slug);
      }
    } else {
      reviewNotes.push(
        best
          ? `no confident episode match (best ${best.score.toFixed(2)}): ${best.ep.slug} — set episodeSlug by hand if correct`
          : "no episode match found — set episodeSlug by hand"
      );
      needsReview.push(slug);
    }

    if (!date) {
      reviewNotes.push("could not extract a publish date — set `date` by hand (YYYY-MM-DD)");
      needsReview.push(slug);
    }

    // topics is left empty on purpose. It has to come from the fixed
    // taxonomy that /topics hub pages are built on, and inventing a tag
    // here would create a hub-less topic that links nowhere.
    const markdown = buildMarkdown({
      title,
      slug,
      date: date || "",
      description: excerpt(body),
      episodeSlug,
      guest,
      topics: [],
      linkedinUrl: "",
      body,
      reviewNotes,
    });

    const words = body.split(/\s+/).filter(Boolean).length;
    const matchLabel = episodeSlug ? `→ ${episodeSlug} (${best.score.toFixed(2)})` : "→ UNMATCHED";
    console.log(`${dryRun ? "WOULD WRITE" : "WROTE"} ${slug}.md  ${words}w  ${matchLabel}`);

    if (!dryRun) fs.writeFileSync(outPath, markdown, "utf-8");
    written += 1;
  }

  console.log(`\n${dryRun ? "Would write" : "Wrote"} ${written} file(s), skipped ${skipped}`);
  if (needsReview.length) {
    const unique = [...new Set(needsReview)];
    console.log(`\n${unique.length} file(s) need a human look — search for "REVIEW:" in:`);
    unique.forEach((s) => console.log(`  content/newsletter/${s}.md`));
  }
  console.log("\nStill to fill in by hand on every file: `topics` (must come from the");
  console.log("fixed taxonomy on /topics) and `linkedinUrl`.");

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
