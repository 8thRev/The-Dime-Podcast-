// lib/episodeIndex.js
// The episode list every search surface searches (lib/episodeSearch.js):
// only the fields a result list renders, plus a build-time search string.
// Server only: it reads the RSS feed and the transcript files.
//
// The RSS episode carries the entire `showNotes` HTML blob, which a result
// list never displays; shipping it pushed the /episodes payload past 1.3 MB.
// The searchText folds in transcript topics and the AI summary so a search
// matches more than title and guest without shipping full transcripts to the
// browser. Episodes without a transcript fall back to their RSS fields.

import { getAllEpisodes } from './rss';
import { getTranscriptBySlug } from './transcripts';

export async function getEpisodeIndex() {
  const episodes = await getAllEpisodes();
  return episodes.map((ep) => {
    const transcript = getTranscriptBySlug(ep.slug);
    const searchText = [
      ep.title,
      ep.guest,
      ep.company,
      ...(ep.tags || []),
      ...(transcript?.topics || []),
      transcript?.summary || '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return {
      slug: ep.slug,
      num: ep.num,
      date: ep.date,
      title: ep.title,
      guest: ep.guest,
      description: ep.description,
      duration: ep.duration,
      searchText,
    };
  });
}
