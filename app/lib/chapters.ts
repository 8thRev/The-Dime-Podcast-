// lib/chapters.ts
// Parses YouTube chapter markers out of a video description.
//
// These are the source for the `hasPart` Clip nodes on VideoObject schema
// (lib/schema.ts), which is what makes Google eligible to show key moments —
// the expandable list of jump-to sections beside a video result.
//
// Why the description and not the caption file: 263 of 287 uploads already
// carry a hand/AI-authored chapter list in their YouTube description, with
// real section names, and it ships in content/videos.json at no extra API
// cost. The stored `raw_captions_srt` on transcripts is caption cues, not
// chapters — it has timings but no section titles, and inventing titles by
// chunking cues would produce Clip names that describe nothing.

export type Chapter = {
  /** Seconds from the start of the video. */
  startOffset: number;
  /** Seconds from the start; the next chapter's start, or the video's end. */
  endOffset: number;
  name: string;
};

// A chapter line: an optionally bracketed timestamp at the start of the line,
// an optional separator, then the title. Anchored to the line so a timestamp
// mentioned mid-sentence ("around 12:30 he explains…") cannot match.
const CHAPTER_LINE = /^[^\S\n]*[([]?(\d{1,2}:\d{2}(?::\d{2})?)[)\]]?[^\S\n]*[-–—:|)]?[^\S\n]*(\S.*?)[^\S\n]*$/;

// 61 of 287 descriptions write ranges — "00:00 - 03:04 Introduction to …" —
// rather than a single start time. The line regex above captures only the
// first timestamp, so without this the *end* timestamp is left glued to the
// front of the title and every one of those chapters gets a name beginning
// with a second, contradicting time. The offsets were always right; the
// labels were not.
const RANGE_END = /^\d{1,2}:\d{2}(?::\d{2})?[^\S\n]*[-–—:|]?[^\S\n]*/;

// Some descriptions put a whole summary sentence after the section title,
// separated by a dash: "Hemp Market Exploration - Colin discusses Kiva's
// entry into …". `Clip.name` is a title, not a paragraph, so keep the part
// before the dash when the tail is prose. Only applied over the length
// threshold, so ordinary hyphenated titles ("Q&A - Part 2") are untouched.
const TITLE_TAIL = /\s[-–—]\s/;
const NAME_MAX = 110;

// Google wants a meaningful list, not two sections. This also guards against
// a stray pair of timestamp-looking lines being read as a chapter list.
const MIN_CHAPTERS = 3;

function cleanName(raw: string): string {
  let name = raw.replace(RANGE_END, '').trim();

  if (name.length > NAME_MAX && TITLE_TAIL.test(name)) {
    const head = name.split(TITLE_TAIL)[0].trim();
    if (head) name = head;
  }

  if (name.length > NAME_MAX) {
    const cut = name.slice(0, NAME_MAX);
    const lastSpace = cut.lastIndexOf(' ');
    name = (lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd() + '…';
  }

  return name;
}

export function parseDurationSeconds(iso: string | undefined): number {
  const match = (iso || "").match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

function timestampToSeconds(stamp: string): number {
  const parts = stamp.split(":").map(Number);
  return parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts[0] * 60 + parts[1];
}

/**
 * Chapters for a video, or [] when the description has no usable chapter list.
 *
 * Returning [] rather than a partial guess is the point: a Clip node with a
 * wrong startOffset sends a viewer to the wrong moment, which is worse than
 * having no key moments at all.
 */
export function parseChapters(description: string, durationISO: string | undefined): Chapter[] {
  const duration = parseDurationSeconds(durationISO);
  if (!duration) return [];

  const marks: { start: number; name: string }[] = [];
  for (const line of (description || "").split(/\r?\n/)) {
    const match = line.match(CHAPTER_LINE);
    if (match) {
      const name = cleanName(match[2]);
      // A line that was nothing but a timestamp range has no title left once
      // cleaned, and a Clip needs a name.
      if (name) marks.push({ start: timestampToSeconds(match[1]), name });
    }
  }

  if (marks.length < MIN_CHAPTERS) return [];

  // A real YouTube chapter list must open at 0:00 — that is YouTube's own
  // rule for enabling chapters, and here it doubles as the check that what we
  // matched is the chapter block rather than, say, a list of timestamped
  // corrections or a tracklist further down the description.
  if (marks[0].start !== 0) return [];

  // Strictly increasing. Anything else means the matched lines are not one
  // ordered list, and picking a subset would be guessing which.
  for (let i = 1; i < marks.length; i++) {
    if (marks[i].start <= marks[i - 1].start) return [];
  }

  // 31 of 287 descriptions carry chapters that run past the upload's own
  // duration, typically by a minute or two — the list was written against a
  // longer cut than the one published here. Dropping the overrunning tail
  // keeps the valid prefix instead of discarding an otherwise good list;
  // schema.org requires every offset to fall inside the video.
  const inRange = marks.filter((m) => m.start < duration);
  if (inRange.length < MIN_CHAPTERS) return [];

  return inRange.map((mark, i) => ({
    startOffset: mark.start,
    endOffset: i + 1 < inRange.length ? inRange[i + 1].start : duration,
    name: mark.name,
  }));
}
