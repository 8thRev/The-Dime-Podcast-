// The Apple Podcasts rating shown across the site (home, about, guests,
// sponsorship, footer, and the podcast JSON-LD). Apple exposes no ratings
// API, so content/ratings.json is refreshed daily from the public show pages
// by scripts/update-apple-ratings.mjs (.github/workflows/apple-ratings.yml).
// Don't hand-edit the number here — change it in that file or rerun the script.
import ratings from "@/content/ratings.json";

export const PODCAST_RATING = {
  value: ratings.value,
  count: ratings.count,
};
