#!/usr/bin/env python3
"""Add timestamped segments to a Dime transcript JSON.

Parses the `raw_captions_srt` field (SubRip cues) and writes a top-level
`segments` array: one {"start", "end", "text"} entry per cue, in order,
with millisecond precision dropped from the timestamps.

Usage:
    python3 add-transcript-segments.py <transcript-json-path>

Writes the JSON back in place (indent=2, ensure_ascii=False, no trailing
newline, matching the existing transcript files) and preserves all other
keys and their order. Idempotent: running it twice changes nothing the
second time.
"""

import json
import re
import sys

# Same timestamp-line approach as bot/srt_utils.py: a line holding only a
# start/end timestamp pair (comma or period millisecond separator).
_TIMESTAMP_RE = re.compile(
    r"^(\d{2}:\d{2}:\d{2})[,.]\d{3}\s*-->\s*(\d{2}:\d{2}:\d{2})[,.]\d{3}"
)


def parse_segments(srt):
    """Split SubRip text into [{"start", "end", "text"}] cue dicts, in order."""
    segments = []
    # A cue is a block of (index line, timestamp line, one or more text
    # lines); blocks are separated by blank lines.
    for block in re.split(r"\r?\n[ \t]*\r?\n", srt.strip()):
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        if len(lines) < 2:
            continue
        ts_idx = next(
            (i for i, ln in enumerate(lines) if _TIMESTAMP_RE.match(ln)), None
        )
        if ts_idx is None:
            continue
        m = _TIMESTAMP_RE.match(lines[ts_idx])
        segments.append(
            {
                "start": m.group(1),
                "end": m.group(2),
                "text": " ".join(lines[ts_idx + 1:]),
            }
        )
    return segments


def main(path):
    with open(path, encoding="utf-8") as f:
        data = json.load(f)

    segments = parse_segments(data.get("raw_captions_srt", ""))

    # Insert (or re-insert) `segments` directly after `raw_captions_srt` so
    # the derived field sits next to its source; every other key keeps its
    # place and order.
    new_data = {}
    placed = False
    for key, value in data.items():
        if key == "segments":
            continue
        new_data[key] = value
        if key == "raw_captions_srt" and not placed:
            new_data["segments"] = segments
            placed = True
    if not placed:
        new_data["segments"] = segments

    with open(path, "w", encoding="utf-8") as f:
        json.dump(new_data, f, indent=2, ensure_ascii=False)
        # No trailing newline, matching the existing transcript files.

    print("Wrote %d segments to %s" % (len(segments), path))


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: %s <transcript-json-path>" % sys.argv[0], file=sys.stderr)
        sys.exit(2)
    main(sys.argv[1])
