// lib/newsletter.ts
// Reads the "First Principles" newsletter editions from
// content/newsletter/*.md — hand-written markdown with YAML frontmatter,
// originally published to LinkedIn and re-homed here.
//
// Deliberately *not* the same shape as lib/transcripts.ts, despite the
// similar read-a-content-dir job: transcripts are AI-generated artifacts
// keyed 1:1 to an episode slug and rendered with an AIDisclosure banner.
// These are human-authored articles with their own URL, byline, publish
// date, and Article schema, and they must never carry that banner. The
// `episodeSlug` field is what relates the two — see getEditionForEpisode.
//
// Everything here degrades to empty when content/newsletter/ is absent, so
// the site builds identically before any editions land (same contract as
// lib/videoEpisodeMap.ts).

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { guestToSlug } from "./guests";
import { topicToSlug } from "./topicSlug";

export type NewsletterEdition = {
  slug: string;
  title: string;
  /** ISO date the edition was originally published (on LinkedIn). */
  date: string;
  /** Human-formatted date for display. */
  dateDisplay: string;
  /** Meta description. Falls back to an excerpt of the body when absent. */
  description: string;
  /** Slug of the episode this edition was written about. May be empty. */
  episodeSlug: string;
  /** Guest credited on the related episode. May be empty. */
  guest: string;
  /** Fixed-taxonomy topics, matching the ones on /topics hub pages. */
  topics: string[];
  /** The original LinkedIn URL. Kept for provenance, not rendered as canonical. */
  linkedinUrl: string;
  /** Raw markdown body. */
  body: string;
  /** Rough word count of the body, for display. */
  wordCount: number;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "newsletter");

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// Frontmatter `date` may be a bare YYYY-MM-DD, which gray-matter's YAML
// parser hands back as a Date object rather than a string. Normalize both
// forms to an ISO date so the sitemap and JSON-LD get a consistent value.
function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value.trim());
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return "";
}

// First ~155 characters of real prose, for editions whose frontmatter has no
// explicit description. Strips the markdown syntax that would otherwise leak
// into a meta tag (headings, emphasis, link brackets, blockquote markers).
function excerptFromBody(body: string, maxLength = 155): string {
  const plain = body
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= maxLength) return plain;
  const cut = plain.slice(0, maxLength);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + "…";
}

function countWords(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

function parseEdition(fileName: string): NewsletterEdition | null {
  try {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, fileName), "utf-8");
    const { data, content } = matter(raw);
    const slug = String(data.slug || fileName.replace(/\.md$/, "")).trim();
    const title = String(data.title || "").trim();
    // An edition with no title has nothing to render as an <h1> or a
    // <title>, and would publish a blank page into the sitemap. Skip it
    // rather than emit a broken URL.
    if (!slug || !title) {
      console.warn(`newsletter: skipping ${fileName} — missing title or slug`);
      return null;
    }
    const body = content.trim();
    const date = normalizeDate(data.date);

    return {
      slug,
      title,
      date,
      dateDisplay: formatDate(date),
      description: String(data.description || "").trim() || excerptFromBody(body),
      episodeSlug: String(data.episodeSlug || "").trim(),
      guest: String(data.guest || "").trim(),
      topics: Array.isArray(data.topics) ? data.topics.map((t: unknown) => String(t).trim()).filter(Boolean) : [],
      linkedinUrl: String(data.linkedinUrl || "").trim(),
      body,
      wordCount: countWords(body),
    };
  } catch (error) {
    console.error(`newsletter: error reading ${fileName}:`, error);
    return null;
  }
}

// All editions, newest first. Editions with no parseable date sort last
// rather than being dropped — a missing date is a frontmatter bug worth
// seeing on the page, not a reason to hide the writing.
export function getAllEditions(): NewsletterEdition[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parseEdition)
    .filter((e): e is NewsletterEdition => e !== null)
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

export function getEditionBySlug(slug: string): NewsletterEdition | null {
  return getAllEditions().find((e) => e.slug === slug) || null;
}

// The edition written about a given episode, for the cross-link block on
// episode pages. One edition per episode is the norm; if several point at
// the same episode the newest wins, since getAllEditions() is sorted.
export function getEditionForEpisode(episodeSlug: string): NewsletterEdition | null {
  if (!episodeSlug) return null;
  return getAllEditions().find((e) => e.episodeSlug === episodeSlug) || null;
}

// Editions relating to a guest. Matches on the frontmatter `guest` field
// through the same slugifier the guest entity pages use, so "Hirsh Jain"
// and "hirsh-jain" resolve to the same person regardless of which form the
// frontmatter carries.
export function getEditionsForGuest(guestSlug: string): NewsletterEdition[] {
  if (!guestSlug) return [];
  return getAllEditions().filter((e) => e.guest && guestToSlug(e.guest) === guestSlug);
}

export function getEditionsForTopic(topicSlug: string): NewsletterEdition[] {
  if (!topicSlug) return [];
  return getAllEditions().filter((e) => e.topics.some((t) => topicToSlug(t) === topicSlug));
}

// Markdown -> HTML. Synchronous because getStaticProps callers already
// await, and remark's processSync is fine for 600-word documents.
export function renderMarkdown(body: string): string {
  return String(remark().use(html, { sanitize: false }).processSync(body));
}

// Slim projection for list/cross-link contexts — drops `body`, which would
// otherwise ship every edition's full text into __NEXT_DATA__ on pages that
// only render a title and date. Same payload-bloat trap already fixed on
// /episodes (see SEO_ROADMAP.md).
export type EditionSummary = Omit<NewsletterEdition, "body">;

export function toSummary(edition: NewsletterEdition): EditionSummary {
  const { body: _body, ...summary } = edition;
  return summary;
}
