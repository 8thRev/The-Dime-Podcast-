# data/

Written by `bot/weekly_report.py` every Monday via
[.github/workflows/seo-report.yml](../.github/workflows/seo-report.yml).
Spec: [docs/report-v2-spec.md](../docs/report-v2-spec.md).

- `weekly/YYYY-MM-DD.json`: one snapshot per run, validated against
  [schemas/weekly.schema.json](../schemas/weekly.schema.json). Every episode
  metric is normalized by episode age (day 7, day 30) and compared to the
  median of the previous 8 episodes at the same age, never to last week.
- `reach.csv`: one row per run date. `podcast_listeners_28d` is Simplecast's
  unique listeners over the trailing 28 days, because Simplecast exposes no
  follower count.
- `video_episode_overrides.csv`: hand fixes for the video to episode mapping.
  The mapping itself is built automatically into
  `app/content/video-episode-map.json`; add a row here only when that map
  gets an episode wrong. A row replaces the map's video list for that
  `episode_slug`.
