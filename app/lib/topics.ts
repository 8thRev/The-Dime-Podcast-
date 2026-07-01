// lib/topics.ts
// Topic hub helpers. "Topics" are the AI-generated, fixed-taxonomy tags
// written per episode by bot/transcript_pipeline.py (app/content/transcripts/*.json),
// as opposed to the freeform itunes:keywords "tags" on the RSS feed in lib/rss.ts.
// Using the fixed taxonomy is what lets hub pages actually cluster episodes
// instead of fragmenting into one-off tag spellings.

import { getAllEpisodes, type Episode } from "./rss";
import { getAllTopicsBySlug } from "./transcripts";
import { topicToSlug } from "./topicSlug";

export { topicToSlug };

export type TopicSummary = { topic: string; slug: string; count: number };

// All distinct topics currently assigned to at least one *published*
// episode, with how many episodes carry each — only topics with content
// get a hub page. The transcript pipeline can run ahead of an episode's
// RSS publish date (pre-generating content so it's ready at launch), so
// transcripts must be cross-checked against the live RSS feed here —
// otherwise a not-yet-published episode's topics would show up in counts
// with no matching episode to actually list on the hub page.
export async function getAllTopics(): Promise<TopicSummary[]> {
  const topicsBySlug = getAllTopicsBySlug();
  const episodes = await getAllEpisodes();
  const publishedSlugs = new Set(episodes.map((ep) => ep.slug));
  const counts = new Map<string, number>();

  for (const [slug, topics] of Object.entries(topicsBySlug)) {
    if (!publishedSlugs.has(slug)) continue;
    for (const topic of topics) {
      counts.set(topic, (counts.get(topic) || 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .map(([topic, count]) => ({ topic, slug: topicToSlug(topic), count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

export async function getEpisodesByTopicSlug(
  topicSlug: string
): Promise<{ topic: string; episodes: Episode[] } | null> {
  const topicsBySlug = getAllTopicsBySlug();
  const allTopics = await getAllTopics();
  const match = allTopics.find((t) => t.slug === topicSlug);
  if (!match) return null;

  const matchingSlugs = new Set(
    Object.entries(topicsBySlug)
      .filter(([, topics]) => topics.includes(match.topic))
      .map(([slug]) => slug)
  );

  const allEpisodes = await getAllEpisodes();
  const episodes = allEpisodes
    .filter((ep) => matchingSlugs.has(ep.slug))
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

  return { topic: match.topic, episodes };
}
