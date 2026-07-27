// lib/youtube.ts
// Fetches all videos from The Dime YouTube channel at build time.
// Channel: @thedime_cannabis | ID: UCcck3tzBNXrJ1WJ8EtIVq1w

const CHANNEL_ID = "UCcck3tzBNXrJ1WJ8EtIVq1w";
// A channel's "uploads" playlist ID is its channel ID with the "UC" prefix
// swapped for "UU". Listing it via playlistItems.list costs 1 quota unit per
// page of 50, versus 100 units per page for search.list — a full back-catalog
// pull drops from ~600 units to ~6, well under the 10k/day quota.
const UPLOADS_PLAYLIST_ID = "UU" + CHANNEL_ID.slice(2);
const API_KEY = process.env.YOUTUBE_API_KEY || "";
const BASE = "https://www.googleapis.com/youtube/v3";

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

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}

function parseDurationSeconds(iso: string): number {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0") * 3600 + parseInt(match[2] || "0") * 60 + parseInt(match[3] || "0");
}

function formatDuration(iso: string): string {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function formatViews(count: string): string {
  const n = parseInt(count);
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M views`;
  if (n >= 1000) return `${(n / 1000).toFixed(0)}K views`;
  return `${n} views`;
}

// Throws on any API/network failure instead of silently truncating the
// result. A partial ID list would look identical to "the rest of the
// channel doesn't exist" to callers, so a transient quota/network error
// here must not be swallowed into a shorter-but-still-valid-looking list —
// see the matching note on fetchVideoDetails for why that distinction
// matters all the way up to getStaticProps.
async function fetchAllVideoIds(): Promise<string[]> {
  if (!API_KEY) {
    console.warn("YOUTUBE_API_KEY not configured - videos will not load");
    return [];
  }

  const ids: string[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      key: API_KEY,
      playlistId: UPLOADS_PLAYLIST_ID,
      part: "contentDetails",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(`${BASE}/playlistItems?${params}`);
    if (!res.ok) {
      throw new Error(`YouTube playlistItems API error: ${res.status}`);
    }

    const data = await res.json();

    data.items?.forEach((item: { contentDetails: { videoId: string } }) => {
      if (item.contentDetails?.videoId) ids.push(item.contentDetails.videoId);
    });

    pageToken = data.nextPageToken;
  } while (pageToken);

  return ids;
}

// Throws on any API/network failure rather than returning whatever was
// collected so far. getStaticProps for /videos/[slug] treats "video missing
// from this list" as proof the video doesn't exist and 404s it — which is
// correct when the list is complete, but was previously also happening on
// a bare API hiccup (quota, transient 5xx) that silently truncated the
// list. Because Next.js keeps the last good ISR page when getStaticProps
// throws (instead of overwriting it with the notFound result), a real
// video's page no longer gets permanently replaced by a 404 that only
// heals itself if some future revalidation happens to succeed.
async function fetchVideoDetails(ids: string[]): Promise<YTVideo[]> {
  if (!API_KEY || ids.length === 0) return [];

  const videos: YTVideo[] = [];

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const params = new URLSearchParams({
      key: API_KEY,
      id: chunk.join(","),
      part: "snippet,contentDetails,statistics",
    });

    const res = await fetch(`${BASE}/videos?${params}`);
    if (!res.ok) {
      throw new Error(`YouTube videos API error: ${res.status}`);
    }

    const data = await res.json();

    data.items?.forEach((item: {
      id: string;
      snippet: {
        title: string;
        description: string;
        publishedAt: string;
        tags?: string[];
        thumbnails: { maxres?: { url: string }; high?: { url: string }; medium?: { url: string }; default?: { url: string } };
      };
      contentDetails: { duration: string };
      statistics?: { viewCount?: string };
    }) => {
      // A single video with an unexpected shape (e.g. view count hidden by
      // the creator, an unusual thumbnail set) must not take the rest of
      // this chunk and every later chunk down with it — forEach re-throws
      // synchronously into the enclosing scope, which previously had
      // nothing but the outer try/catch to stop that cascade.
      try {
        // Skip Shorts (under 3 minutes)
        if (parseDurationSeconds(item.contentDetails.duration) < 180) return;

        // Skip the Feb 28, 2024 bulk re-upload of the old audio-only back
        // catalog (54 episodes uploaded within the same minute, static
        // show-logo thumbnail instead of real video) — not real video content.
        if (item.snippet.publishedAt.startsWith("2024-02-28")) return;

        const fullSlug = slugify(item.snippet.title);
        const truncatedSlug = fullSlug.slice(0, 80).replace(/-+$/, "");
        const thumbnail =
          item.snippet.thumbnails.maxres?.url ||
          item.snippet.thumbnails.high?.url ||
          item.snippet.thumbnails.medium?.url ||
          item.snippet.thumbnails.default?.url ||
          "";

        videos.push({
          id: item.id,
          slug: fullSlug,
          legacySlug: truncatedSlug !== fullSlug ? truncatedSlug : "",
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail,
          publishedAt: item.snippet.publishedAt,
          date: new Date(item.snippet.publishedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          duration: formatDuration(item.contentDetails.duration),
          durationISO: item.contentDetails.duration,
          viewCount: formatViews(item.statistics?.viewCount || "0"),
          embedUrl: `https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0&color=white`,
          watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
          tags: item.snippet.tags?.slice(0, 6) || [],
        });
      } catch (error) {
        console.error(`Skipping malformed YouTube video item ${item?.id}:`, error);
      }
    });
  }

  return videos.sort((a, b) =>
    new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );
}

let cachedVideos: YTVideo[] | null = null;

export async function getAllVideos(): Promise<YTVideo[]> {
  if (cachedVideos) return cachedVideos;
  if (!API_KEY) return [];

  const ids = await fetchAllVideoIds();
  cachedVideos = await fetchVideoDetails(ids);
  return cachedVideos;
}

export async function getVideoBySlug(slug: string): Promise<YTVideo | null> {
  const videos = await getAllVideos();
  return videos.find((v) => v.slug === slug || v.legacySlug === slug) || null;
}
