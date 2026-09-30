// lib/topicBriefs.ts
// Reads content/topic-briefs/<topic-slug>.md: one synthesized brief per topic
// hub, written by Isaac Burner (bot/isaac_blogger.py) from the AI summaries,
// takeaways, FAQ and quotes of every transcribed episode tagged with that
// topic, and merged through the same pull request gate as a column post.
//
// Fourth content type, and deliberately the narrowest. A brief has no HTML
// page of its own: it is rendered only into /topics/<slug>/llms.txt, the
// document an agent reads before deciding which episodes to fetch. Without
// it that file is a list of 71 one-line summaries and the agent has to read
// all 71 pages to learn what the catalogue actually says about the subject.
// With it the synthesis is at the top, every claim linked to its episode.
//
// It is AI written, so it carries the same disclosure as the Answers column
// wherever it renders (buildTopicLlms in lib/llms.js), and like a column post
// it is an opinion under the show's name and goes through a human review.
//
// Degrades to null when the directory or the file is absent, so a topic
// without a brief yet renders its index exactly as before.

import fs from "fs";
import path from "path";
import matter from "gray-matter";

export type TopicBrief = {
  topic: string;
  slug: string;
  /** ISO date the brief was last written. */
  date: string;
  /** Every episode slug the brief was written from, cited or not. */
  sourceEpisodes: string[];
  /** Episode slugs linked in the body. */
  episodes: string[];
  /** Markdown, with root-relative /episodes/<slug> links. */
  body: string;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "topic-briefs");

function toStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((v) => String(v).trim()).filter(Boolean);
}

function normalizeDate(value: unknown): string {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "string" && value.trim()) return value.trim().slice(0, 10);
  return "";
}

export function getTopicBrief(topicSlug: string): TopicBrief | null {
  // The slug comes from the URL. Topic slugs are [a-z0-9-] by construction
  // (lib/topicSlug.ts), so anything else is not a topic and never reaches
  // the filesystem as a path.
  if (!/^[a-z0-9-]+$/.test(topicSlug)) return null;
  const file = path.join(CONTENT_DIR, `${topicSlug}.md`);
  if (!fs.existsSync(file)) return null;

  try {
    const { data, content } = matter(fs.readFileSync(file, "utf8"));
    const body = content.trim();
    if (!body) return null;
    return {
      topic: String(data.topic || ""),
      slug: topicSlug,
      date: normalizeDate(data.date),
      sourceEpisodes: toStringList(data.sourceEpisodes),
      episodes: toStringList(data.episodes),
      body,
    };
  } catch (e) {
    // Same tolerance as the other loaders: one unparseable file drops that
    // brief, it does not take the topic index down with it.
    console.error(`Could not read topic brief ${file}:`, e);
    return null;
  }
}
