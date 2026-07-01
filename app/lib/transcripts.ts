// lib/transcripts.ts
// Reads AI-generated transcript/artifact data for episodes, written by the
// bot/transcript_pipeline.py automation, from content/transcripts/*.json.

import fs from "fs";
import path from "path";

export type TranscriptFAQ = { question: string; answer: string };

export type TranscriptData = {
  slug: string;
  source: string;
  generatedAt: string;
  aiGenerated: boolean;
  cleaned_transcript: string;
  takeaways: string[];
  faq: TranscriptFAQ[];
  quotes: string[];
  topics: string[];
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
