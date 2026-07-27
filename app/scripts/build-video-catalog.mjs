// scripts/build-video-catalog.mjs
// Writes app/content/videos.json — the whole channel catalogue the site
// renders from. Run on a schedule by .github/workflows/video-catalog.yml,
// which commits the result; the site itself never calls the YouTube API.
//
// Usage: YOUTUBE_API_KEY=... node scripts/build-video-catalog.mjs

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

import { fetchVideoCatalog, getAccessTokenFromRefreshToken } from "../lib/videoCatalog.mjs";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "content",
  "videos.json"
);

// YOUTUBE_API_KEY is what Vercel has; the OAuth trio is what GitHub Actions
// has. Either works, so this runs in both places without new secrets.
async function resolveAuth() {
  if (process.env.YOUTUBE_API_KEY) {
    console.log("Authenticating with YOUTUBE_API_KEY");
    return { apiKey: process.env.YOUTUBE_API_KEY };
  }

  const clientId = process.env.YOUTUBE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_OAUTH_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_OAUTH_REFRESH_TOKEN;
  if (clientId && clientSecret && refreshToken) {
    console.log("Authenticating with the YOUTUBE_OAUTH_* refresh token");
    return {
      accessToken: await getAccessTokenFromRefreshToken({ clientId, clientSecret, refreshToken }),
    };
  }

  return null;
}

async function main() {
  const auth = await resolveAuth();
  if (!auth) {
    console.error("Set YOUTUBE_API_KEY, or all three YOUTUBE_OAUTH_* variables");
    return 1;
  }

  console.log("Fetching the full YouTube catalogue...");
  const videos = await fetchVideoCatalog(auth);

  // Refuse to overwrite a good catalogue with an empty one. An API that
  // returns 200 with no items would otherwise unpublish every /videos/<slug>
  // page on the next deploy, and those are live indexed URLs.
  if (videos.length === 0) {
    console.error("Refusing to write an empty catalogue - leaving the existing file alone");
    return 1;
  }

  const previous = fs.existsSync(OUTPUT_PATH)
    ? JSON.parse(fs.readFileSync(OUTPUT_PATH, "utf-8"))
    : [];
  const previousSlugs = new Set(previous.map((v) => v.slug));
  const dropped = [...previousSlugs].filter(
    (slug) => !videos.some((v) => v.slug === slug)
  );

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(videos, null, 2) + "\n", "utf-8");

  console.log(`Wrote ${videos.length} videos to content/videos.json`);
  if (previous.length) {
    console.log(`Previous catalogue had ${previous.length}`);
  }
  // Slugs are URLs. A disappearing slug means a live page 404s on the next
  // deploy, so surface it in the run log rather than letting it pass silently.
  if (dropped.length) {
    console.warn(`WARNING: ${dropped.length} slug(s) no longer present:`);
    dropped.forEach((slug) => console.warn(`  /videos/${slug}`));
  }

  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
