// lib/videoCatalog.mjs
// The YouTube fetch + transform that produces the site's video catalog.
// Channel: @thedime_cannabis | ID: UCcck3tzBNXrJ1WJ8EtIVq1w
//
// Plain .mjs rather than TypeScript so scripts/build-video-catalog.mjs can
// run it under bare `node` with no loader, while lib/youtube.ts imports the
// exact same functions. Slugs here decide live /videos/<slug> URLs, so a
// second reimplementation of slugify() for the generator would be an SEO
// hazard the first time the two drifted — there is only ever one copy.

const CHANNEL_ID = "UCcck3tzBNXrJ1WJ8EtIVq1w";
// A channel's "uploads" playlist ID is its channel ID with the "UC" prefix
// swapped for "UU". Listing it via playlistItems.list costs 1 quota unit per
// page of 50, versus 100 units per page for search.list — a full back-catalog
// pull drops from ~600 units to ~6, well under the 10k/day quota.
const UPLOADS_PLAYLIST_ID = "UU" + CHANNEL_ID.slice(2);
const BASE = "https://www.googleapis.com/youtube/v3";

// The Feb 28 2024 bulk re-upload of the old audio-only back catalogue (54
// episodes uploaded within the same minute, static show-logo thumbnail
// instead of real video) is not real video content. bot/video_episode_map.py
// mirrors this date — keep the two in sync.
const AUDIO_ONLY_REUPLOAD_DATE = "2024-02-28";
const MIN_DURATION_SECONDS = 180; // below this it's a Short

// Auth is either an API key (what Vercel has) or an OAuth access token (what
// GitHub Actions has, via the same refresh token the bot pipelines use).
// Supporting both is what lets the scheduled generator run without adding a
// YOUTUBE_API_KEY secret to the repo.
function authQuery(auth) {
  return auth.apiKey ? { key: auth.apiKey } : {};
}

function authHeaders(auth) {
  return auth.accessToken ? { Authorization: `Bearer ${auth.accessToken}` } : {};
}

export function slugify(title) {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}

function parseDurationSeconds(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return parseInt(match[1] || "0") * 3600 + parseInt(match[2] || "0") * 60 + parseInt(match[3] || "0");
}

function formatDuration(iso) {
  if (!iso) return "";
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return "";
  const h = parseInt(match[1] || "0");
  const m = parseInt(match[2] || "0");
  return h > 0 ? `${h}h ${m}m` : `${m} min`;
}

function formatViews(count) {
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
async function fetchAllVideoIds(auth) {
  const ids = [];
  let pageToken;

  do {
    const params = new URLSearchParams({
      ...authQuery(auth),
      playlistId: UPLOADS_PLAYLIST_ID,
      part: "contentDetails",
      maxResults: "50",
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(`${BASE}/playlistItems?${params}`, { headers: authHeaders(auth) });
    if (!res.ok) {
      throw new Error(`YouTube playlistItems API error: ${res.status}`);
    }

    const data = await res.json();

    data.items?.forEach((item) => {
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
async function fetchVideoDetails(auth, ids) {
  if (ids.length === 0) return [];

  const videos = [];

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    const params = new URLSearchParams({
      ...authQuery(auth),
      id: chunk.join(","),
      part: "snippet,contentDetails,statistics",
    });

    const res = await fetch(`${BASE}/videos?${params}`, { headers: authHeaders(auth) });
    if (!res.ok) {
      throw new Error(`YouTube videos API error: ${res.status}`);
    }

    const data = await res.json();

    data.items?.forEach((item) => {
      // A single video with an unexpected shape (e.g. view count hidden by
      // the creator, an unusual thumbnail set) must not take the rest of
      // this chunk and every later chunk down with it — forEach re-throws
      // synchronously into the enclosing scope, which previously had
      // nothing but the outer try/catch to stop that cascade.
      try {
        if (parseDurationSeconds(item.contentDetails.duration) < MIN_DURATION_SECONDS) return;
        if (item.snippet.publishedAt.startsWith(AUDIO_ONLY_REUPLOAD_DATE)) return;

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
          // The unrounded count, kept alongside the display string because
          // VideoObject's interactionStatistic needs a real number and
          // formatViews() is lossy above 1,000 ("1.2K views"). Creators can
          // hide view counts, in which case statistics.viewCount is absent
          // and this is 0 — the schema builder omits the node rather than
          // publishing a zero-view claim.
          viewCountRaw: parseInt(item.statistics?.viewCount || "0", 10) || 0,
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

// One full pass over the channel: ~2 requests per 50 uploads, so roughly 16
// quota units for the whole back catalogue. This is the ONLY function that
// spends YouTube quota for the website.
export async function fetchVideoCatalog(auth) {
  const resolved = typeof auth === "string" ? { apiKey: auth } : auth || {};
  if (!resolved.apiKey && !resolved.accessToken) {
    throw new Error("fetchVideoCatalog needs either an apiKey or an accessToken");
  }
  const ids = await fetchAllVideoIds(resolved);
  return fetchVideoDetails(resolved, ids);
}

// Exchanges the bot pipelines' stored refresh token for an access token, so
// the scheduled catalogue build can reuse the YOUTUBE_OAUTH_* secrets that
// already exist in Actions instead of needing a separate API key.
export async function getAccessTokenFromRefreshToken({ clientId, clientSecret, refreshToken }) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    throw new Error(`OAuth token refresh failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()).access_token;
}
