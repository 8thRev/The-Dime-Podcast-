// lib/transcripts.ts
// Reads AI-generated transcript/artifact data for episodes, written by the
// bot/transcript_pipeline.py automation, from content/transcripts/*.json.

import fs from "fs";
import path from "path";

export type TranscriptFAQ = { question: string; answer: string };
export type TranscriptQuote = { speaker: string; quote: string };
export type TranscriptEntities = { companies: string[]; people: string[] };

export type TranscriptData = {
  slug: string;
  source: string;
  generatedAt: string;
  aiGenerated: boolean;
  cleaned_transcript: string;
  summary: string;
  takeaways: string[];
  faq: TranscriptFAQ[];
  quotes: TranscriptQuote[];
  topics: string[];
  entities: TranscriptEntities;
  raw_captions_srt?: string;
};

const CONTENT_DIR = path.join(process.cwd(), "content", "transcripts");

export function getTranscriptBySlug(slug: string): TranscriptData | null {
  try {
    const filePath = path.join(CONTENT_DIR, `${slug}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(raw) as TranscriptData;
  } catch (error) {
    console.error(`Error reading transcript for ${slug}:`, error);
    return null;
  }
}

export function getAllTranscriptSlugs(): string[] {
  try {
    if (!fs.existsSync(CONTENT_DIR)) return [];
    return fs
      .readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));
  } catch {
    return [];
  }
}

// Slug -> topics, for every episode that has a transcript. Used to fold
// AI-generated topic tags into related-episode scoring alongside the
// older RSS keyword tags, without every page needing to read every
// transcript file individually.
export function getAllTopicsBySlug(): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const slug of getAllTranscriptSlugs()) {
    const data = getTranscriptBySlug(slug);
    if (data?.topics?.length) map[slug] = data.topics;
  }
  return map;
}
