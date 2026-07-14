// Apple Podcasts rating isn't exposed via any feed we pull, so it's
// tracked here as the single source of truth — update this when the
// rating count changes rather than editing each page/component.
export const PODCAST_RATING = {
  value: 4.9,
  count: 115,
};
