// lib/topicSlug.ts
// Pure string helper, split out of lib/topics.ts so client components can
// import it without pulling in transcripts.ts's `fs` dependency into the
// browser bundle.

export function topicToSlug(topic: string): string {
  return topic
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}
