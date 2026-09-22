// lib/answers.ts
// Reads the "Answers" column from content/answers/*.md: short, opinionated
// Q&A posts written by the Isaac Burner bot (bot/isaac_blogger.py) and
// committed by the workflow in .github/workflows/isaac-blogger.yml.
//
// Third content type on this site, and the split from the other two is the
// point (see CLAUDE.md):
//
//   content/transcripts/*.json  AI generated from audio, keyed 1:1 to an
//                               episode, rendered behind <AIDisclosure>.
//   content/newsletter/*.md     Human written by Bryan, Person byline,
//                               never a disclosure banner.
//   content/answers/*.md        AI written by a named column persona. Own
//                               URL and date like an edition, and an
//                               <AIDisclosure> banner like a transcript.
//
// The shape differs from lib/newsletter.ts in three ways that matter, all
// of them driven by what answer engines actually lift:
//
//   - `summary` is a required answer-first standfirst. An edition's opening
//     is a hook; a post's opening has to be the answer, because an
//     extraction model that reads two sentences and stops must still come
//     away with something true and attributable.
//   - `faq` is structured, not prose, and feeds createFAQSchema(). This is
//     the whole reason the column exists: FAQPage is the type most often
//     lifted into AI Overviews, and until now only episode pages had it.
//   - `episodes` is a list, not one slug. An edition is written after one
//     episode. A post answers a question the catalogue answers across
//     several, and the citations are what make it a Dime answer rather
//     than a generic one.
//
// Everything degrades to empty when content/answers/ is absent, so the site
// builds identically before the first post lands (same contract as
// lib/newsletter.ts and lib/videoEpisodeMap.ts).

import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import { topicToSlug } from "./topicSlug";
import { UTM, tagHtmlLinks } from "./utm";

// Re-exported so a server-side caller that already imports this loader does
// not need a second import for the byline. Anything rendered in a component
// must import from lib/answersColumn directly; see the note at the top of
// that file for why.
export { COLUMN_AUTHOR, COLUMN_AUTHOR_ROLE, COLUMN_NAME, COLUMN_BYLINE } from "./answersColumn";

export type AnswerFAQ = {
  question: string;
  answer: string;
};

export type AnswerPost = {
  slug: string;
  /** The question, rendered as the h1. Phrased as a question on purpose. */
  title: string;
  /** Short title for the title/OG tags only, same budget problem as an edition. */
  metaTitle: string;
  date: string;
  dateDisplay: string;
  /** Meta description. Falls back to the summary. */
  description: string;
  /**
   * Answer-first standfirst, 2 to 3 sentences, rendered above the body and
   * emitted as the description in the .md twin. Required: a post without
   * one is a post whose answer is buried, which is the one failure mode
   * this format exists to prevent.
   */
  summary: string;
  /** Slugs of episodes cited in the body, in citation order. */
  episodes: string[];
  topics: string[];
  faq: AnswerFAQ[];
  /**
   * What seeded the post: a Search Console query, or an episode slug when
   * the bot fell back to the catalogue. Provenance only, never rendered.
   */
  sourceQuery: string;
  body: string;
  wordCount: number;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "answers");

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

// Same Date-vs-string normalisation lib/newsletter.ts needs: gray-matter's
// YAML parser hands a bare YYYY-MM-DD back as a Date object.
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

function countWords(body: string): number {
  return body.split(/\s+/).filter(Boolean).length;
}

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

// Pairs missing either half are dropped rather than emitted, because a
// Question node with an empty acceptedAnswer is invalid structured data and
// Search Console reports it as an error against the whole page, not against
// the one pair.
function parseFaq(value: unknown): AnswerFAQ[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      question: String((item as AnswerFAQ)?.question ?? "").trim(),
      answer: String((item as AnswerFAQ)?.answer ?? "").trim(),
    }))
    .filter((item) => item.question && item.answer);
}

function parsePost(fileName: string): AnswerPost | null {
  try {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, fileName), "utf-8");
    const { data, content } = matter(raw);
    const slug = String(data.slug || fileName.replace(/\.md$/, "")).trim();
    const title = String(data.title || "").trim();
    const summary = String(data.summary || "").trim();

    // A post with no title has no h1 and no title tag. A post with no
    // summary has no answer above the fold, which is the format. Either one
    // is a generation bug, and publishing it would put a broken URL in the
    // sitemap, so skip the file and say why. The bot writes both fields
    // unconditionally; this is the guard for a hand-edited file.
    if (!slug || !title || !summary) {
      console.warn(`answers: skipping ${fileName} - missing slug, title or summary`);
      return null;
    }

    const body = content.trim();
    const date = normalizeDate(data.date);

    return {
      slug,
      title,
      metaTitle: String(data.metaTitle || "").trim() || title,
      date,
      dateDisplay: formatDate(date),
      description: String(data.description || "").trim() || summary,
      summary,
      episodes: toStringList(data.episodes),
      topics: toStringList(data.topics),
      faq: parseFaq(data.faq),
      sourceQuery: String(data.sourceQuery || "").trim(),
      body,
      wordCount: countWords(body),
    };
  } catch (error) {
    console.error(`answers: error reading ${fileName}:`, error);
    return null;
  }
}

// Parsed once per server process, same memoization as lib/newsletter.ts.
let cache: AnswerPost[] | null = null;

/** All posts, newest first. Undated posts sort last rather than vanish. */
export function getAllAnswers(): AnswerPost[] {
  if (cache) return cache;
  if (!fs.existsSync(CONTENT_DIR)) return [];
  cache = fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith(".md"))
    .map(parsePost)
    .filter((p): p is AnswerPost => p !== null)
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  return cache;
}

export function getAnswerBySlug(slug: string): AnswerPost | null {
  return getAllAnswers().find((p) => p.slug === slug) || null;
}

// Related posts, most-shared-topics first with a publication-order ring as
// the tie-break. Lifted wholesale from getRelatedEditions() for the reason
// given there: plain recency as the tie-break gives the newest few posts
// every inbound link and leaves the tail with none, which matters more here
// than it does for editions because this set grows every week.
export function getRelatedAnswers(slug: string, limit = 4): AnswerPost[] {
  const all = getAllAnswers();
  const selfIndex = all.findIndex((p) => p.slug === slug);
  if (selfIndex === -1) return all.slice(0, limit);
  const topics = new Set(all[selfIndex].topics);
  const n = all.length;

  return all
    .map((p, i) => ({
      p,
      i,
      shared: p.topics.filter((t) => topics.has(t)).length,
      ring: Math.min((i - selfIndex + n) % n, (selfIndex - i + n) % n),
    }))
    .filter(({ i }) => i !== selfIndex)
    .sort((a, b) => b.shared - a.shared || a.ring - b.ring)
    .slice(0, limit)
    .map(({ p }) => p);
}

/** Posts citing a given episode, for the backlink block on episode pages. */
export function getAnswersForEpisode(episodeSlug: string): AnswerPost[] {
  if (!episodeSlug) return [];
  return getAllAnswers().filter((p) => p.episodes.includes(episodeSlug));
}

export function getAnswersForTopic(topicSlug: string): AnswerPost[] {
  if (!topicSlug) return [];
  return getAllAnswers().filter((p) => p.topics.some((t) => topicToSlug(t) === topicSlug));
}

/**
 * Every question this column has answered, across all posts: the title of
 * each post plus its faq pairs. What the bot reads to avoid writing the
 * same post twice, and what /answers renders as its question index.
 */
export function getAnsweredQuestions(): { question: string; slug: string }[] {
  const seen = new Set<string>();
  const out: { question: string; slug: string }[] = [];
  for (const post of getAllAnswers()) {
    for (const question of [post.title, ...post.faq.map((f) => f.question)]) {
      const key = question.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push({ question, slug: post.slug });
    }
  }
  return out;
}

// Markdown to HTML, with outbound links tagged for attribution. Same
// contract as lib/newsletter.ts renderMarkdown: the markdown files stay
// clean and the params exist only in the rendered output. Internal links to
// /episodes/... are left alone by tagHtmlLinks (dimepodcast.com is in its
// never-tag list), which is what the body's episode citations are.
export function renderMarkdown(body: string, slug?: string): string {
  const rendered = String(remark().use(html, { sanitize: false }).processSync(body));
  return tagHtmlLinks(rendered, { ...UTM.answers, content: slug });
}

/** Title + date only, for listings and cross-links. */
export type AnswerListItem = Pick<AnswerPost, "slug" | "title" | "dateDisplay">;

export function toListItem(p: AnswerPost): AnswerListItem {
  return { slug: p.slug, title: p.title, dateDisplay: p.dateDisplay };
}

/**
 * Adds the standfirst, for surfaces that render a summary line. Allow-list
 * rather than Omit of the body, for the __NEXT_DATA__ reason documented at
 * the bottom of lib/newsletter.ts: dropping only the body still ships every
 * listed post's faq array, topics and episode slugs into the page payload
 * unrendered, and the faq array is the largest field after the body.
 */
export type AnswerCard = AnswerListItem & Pick<AnswerPost, "summary">;

export function toCard(p: AnswerPost): AnswerCard {
  return { ...toListItem(p), summary: p.summary };
}
