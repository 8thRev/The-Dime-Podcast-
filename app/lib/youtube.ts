// lib/youtube.ts
// Serves the video catalog to pages. Prefers the pre-built artifact at
// content/videos.json and only calls the YouTube API if it is missing.
//
// Why the artifact exists: getAllVideos() returns the WHOLE channel, and
// four pages call it from getStaticProps — /, /videos, /videos/[slug] (one
// page per video) and /episodes/[slug] (303 pages). The cachedVideos memo
// below only dedupes within a single warm lambda, so on Vercel every cold
// instance repeated the entire ~16-request catalogue pull. With per-page ISR
// at revalidate: 3600 that multiplied by the page count and exhausted the
// 10k/day YouTube quota, which then took the bot pipelines down with it
// (they share the same GCP project) and failed production builds outright —
// `next build` calls getStaticPaths, so a spent quota broke deploys.
//
// Reading a committed file instead makes the site cost zero quota. The
// catalogue is refreshed by scripts/build-video-catalog.mjs on a schedule
// (.github/workflows/video-catalog.yml), which spends ~16 units once a day.

import fs from "fs";
import path from "path";

import { fetchVideoCatalog } from "./videoCatalog.mjs";

const API_KEY = process.env.YOUTUBE_API_KEY || "";
const CATALOG_FILE = path.join(process.cwd(), "content", "videos.json");

export type YTVideo = {
  id: string;
  slug: string;
  legacySlug: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  date: string;
  duration: string;
  durationISO: string;
  viewCount: string;
  embedUrl: string;
  watchUrl: string;
  tags: string[];
};

// Returns null (not []) when the artifact is absent, so callers can tell
// "not generated yet, fall back to the API" apart from "generated, and the
// channel legitimately has no qualifying videos".
// The YouTube descriptions carry the same co-host surname typo as the
// Simplecast notes ("Kellen" for "Kellan Finney" — see normalizeCohostName in
// lib/rss.ts). Normalising on read rather than patching content/videos.json
// keeps the fix in place: that file is a generated artifact, rewritten daily
// by .github/workflows/video-catalog.yml, so an edit to it would be reverted.
function normalizeCohostName(text: string): string {
  return text
    .replace(/\bKellen\b/g, "Kellan")
    .replace(/\bKellan Finny\b/g, "Kellan Finney")
    .replace(/\bKellan Finn\b(?![ey])/g, "Kellan Finney");
}

function readCatalogFile(): YTVideo[] | null {
  try {
    if (!fs.existsSync(CATALOG_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(CATALOG_FILE, "utf-8"));
    if (!Array.isArray(parsed)) return null;
    return (parsed as YTVideo[]).map((v) => ({
      ...v,
      title: normalizeCohostName(v.title || ""),
      description: normalizeCohostName(v.description || ""),
    }));
  } catch (error) {
    console.error("Error reading videos.json:", error);
    return null;
  }
}

let cachedVideos: YTVideo[] | null = null;

export async function getAllVideos(): Promise<YTVideo[]> {
  if (cachedVideos) return cachedVideos;

  const fromFile = readCatalogFile();
  if (fromFile) {
    cachedVideos = fromFile;
    return cachedVideos;
  }

  // Fallback path: the artifact has not been generated yet. Kept so that
  // landing this change cannot black out /videos before the first scheduled
  // catalogue run, but it is the expensive path — once videos.json is
  // committed this never runs again.
  if (!API_KEY) {
    console.warn("videos.json missing and YOUTUBE_API_KEY not configured - videos will not load");
    return [];
  }
  console.warn("videos.json missing - falling back to a live YouTube API pull");
  cachedVideos = (await fetchVideoCatalog(API_KEY)) as YTVideo[];
  return cachedVideos;
}

export async function getVideoBySlug(slug: string): Promise<YTVideo | null> {
  const videos = await getAllVideos();
  return videos.find((v) => v.slug === slug || v.legacySlug === slug) || null;
}
