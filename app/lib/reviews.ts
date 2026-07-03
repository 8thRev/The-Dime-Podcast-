// lib/reviews.ts
// Fetches real listener reviews from Apple Podcasts at build/ISR time, the
// same pattern lib/rss.ts and lib/youtube.ts use for episodes and videos.
// Apple's customer-reviews feed is public and unauthenticated, so this
// needs no API key — the tradeoff is it only returns recent reviews (no
// full history) and no aggregate rating/count, so the "4.9 (111 ratings)"
// figure elsewhere on the site stays a manually-maintained number.

const PODCAST_ID = "1540199573"; // The Dime — verified against feeds.simplecast.com/Vnrz0StH via itunes lookup
const REVIEWS_URL = `https://itunes.apple.com/us/rss/customerreviews/id=${PODCAST_ID}/sortby=mostrecent/json`;

export type Review = {
  id: string;
  author: string;
  rating: number;
  title: string;
  content: string;
  date: string;
};

type RawEntry = {
  author?: { name?: { label?: string } };
  "im:rating"?: { label?: string };
  id?: { label?: string };
  title?: { label?: string };
  content?: { label?: string };
  updated?: { label?: string };
};

let cachedReviews: Review[] | null = null;

export async function getPodcastReviews(): Promise<Review[]> {
  if (cachedReviews) return cachedReviews;

  try {
    const res = await fetch(REVIEWS_URL);
    if (!res.ok) {
      console.error(`Apple reviews feed error: ${res.status}`);
      return [];
    }

    const data = await res.json();
    const entries: RawEntry[] = Array.isArray(data?.feed?.entry) ? data.feed.entry : [];

    const reviews = entries
      // The first "entry" in this feed is sometimes the podcast itself, not
      // a review — real reviews always carry a rating.
      .filter((e) => e["im:rating"]?.label && e.content?.label)
      .map((e) => ({
        id: e.id?.label || "",
        author: e.author?.name?.label || "A listener",
        rating: parseInt(e["im:rating"]!.label!, 10),
        title: e.title?.label || "",
        content: e.content!.label!,
        date: e.updated?.label || "",
      }))
      // Showcase the strong reviews — this is a testimonials section, not
      // a review-moderation queue.
      .filter((r) => r.rating >= 4)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 9);

    cachedReviews = reviews;
    return reviews;
  } catch (error) {
    console.error("Error fetching Apple Podcasts reviews:", error);
    return [];
  }
}
