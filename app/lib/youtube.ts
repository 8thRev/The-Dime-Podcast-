// lib/youtube.ts
// Fetches all videos from The Dime YouTube channel at build time.
// Channel: @thedime_cannabis | ID: UCcck3tzBNXrJ1WJ8EtIVq1w

const CHANNEL_ID = "UCcck3tzBNXrJ1WJ8EtIVq1w";
const API_KEY = process.env.YOUTUBE_API_KEY || "";
const BASE = "https://www.googleapis.com/youtube/v3";

export type YTVideo = {
  id: string;
  slug: string;
  title: string;
  description: string;
  thumbnail: string;
  publishedAt: string;
  date: string;
  duration: string;
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
    .slice(0, 80);
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

async function fetchAllVideoIds(): Promise<string[]> {
  if (!API_KEY) {
    console.warn("YOUTUBE_API_KEY not configured - videos will not load");
    return [];
  }

  const ids: string[] = [];
  let pageToken: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        key: API_KEY,
        channelId: CHANNEL_ID,
        part: "id",
        type: "video",
        maxResults: "50",
        ...(pageToken ? { pageToken } : {}),
      });

      const res = await fetch(`${BASE}/search?${params}`);
      if (!res.ok) {
        console.error(`YouTube API error: ${res.status}`);
        break;
      }

      const data = await res.json();

      data.items?.forEach((item: { id: { videoId: string } }) => {
        ids.push(item.id.videoId);
      });

      pageToken = data.nextPageToken;
    } while (pageToken);
  } catch (error) {
    console.error("Error fetching YouTube videos:", error);
  }

  return ids;
}

async function fetchVideoDetails(ids: string[]): Promise<YTVideo[]> {
  if (!API_KEY || ids.length === 0) return [];

  const videos: YTVideo[] = [];

  try {
    for (let i = 0; i < ids.length; i += 50) {
      const chunk = ids.slice(i, i + 50);
      const params = new URLSearchParams({
        key: API_KEY,
        id: chunk.join(","),
        part: "snippet,contentDetails,statistics",
      });

      const res = await fetch(`${BASE}/videos?${params}`);
      if (!res.ok) {
        console.error(`YouTube API error: ${res.status}`);
        break;
      }

      const data = await res.json();

      data.items?.forEach((item: {
        id: string;
        snippet: {
          title: string;
          description: string;
          publishedAt: string;
          tags?: string[];
          thumbnails: { maxres?: { url: string }; high: { url: string } };
        };
        contentDetails: { duration: string };
        statistics: { viewCount: string };
      }) => {
        // Skip Shorts (under 3 minutes)
        if (parseDurationSeconds(item.contentDetails.duration) < 180) return;

        videos.push({
          id: item.id,
          slug: slugify(item.snippet.title),
          title: item.snippet.title,
          description: item.snippet.description,
          thumbnail: item.snippet.thumbnails.maxres?.url || item.snippet.thumbnails.high.url,
          publishedAt: item.snippet.publishedAt,
          date: new Date(item.snippet.publishedAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          duration: formatDuration(item.contentDetails.duration),
          viewCount: formatViews(item.statistics.viewCount),
          embedUrl: `https://www.youtube.com/embed/${item.id}?autoplay=1&rel=0&color=white`,
          watchUrl: `https://www.youtube.com/watch?v=${item.id}`,
          tags: item.snippet.tags?.slice(0, 6) || [],
        });
      });
    }
  } catch (error) {
    console.error("Error fetching YouTube video details:", error);
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
  return videos.find((v) => v.slug === slug) || null;
}
