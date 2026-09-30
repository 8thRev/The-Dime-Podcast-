"""
One-off repair for pull quotes already written to app/content/transcripts.

Before verbatim.filter_verbatim() ran in the pipeline, Claude's quotes were
kept as returned, and most were paraphrases rendered as blockquotes. For
each quote that is not word for word in the file's cleaned_transcript:

  - if the same speaker's turns contain a span that is clearly the same
    statement (verbatim.closest_span() at REPLACE_MIN_RATIO or above), the
    quote text becomes that span, cut from the transcript;
  - otherwise the quote is dropped.

No API calls and nothing regenerated. Only the `quotes` key changes. Run
from bot/:

    python backfill_verbatim_quotes.py            # rewrite files
    python backfill_verbatim_quotes.py --dry-run  # report only
"""

import json
import sys
from pathlib import Path

from verbatim import REPLACE_MIN_RATIO, closest_span, filter_verbatim, is_verbatim, word_seq

TRANSCRIPTS_DIR = Path(__file__).resolve().parent.parent / "app" / "content" / "transcripts"


def repair_quotes(quotes: list, transcript: str) -> tuple[list, dict]:
    """Returns (new quotes, counts). Order is kept, and a replacement that
    duplicates a quote already kept is dropped rather than shown twice."""
    counts = {"verbatim": 0, "replaced": 0, "dropped": 0}
    out, seen = [], set()
    for q in quotes or []:
        kept, _ = filter_verbatim([q], transcript)
        if kept:
            new, outcome = q, "verbatim"
        else:
            text = q.get("quote", "") if isinstance(q, dict) else ""
            speaker = q.get("speaker", "") if isinstance(q, dict) else ""
            match = closest_span(text, speaker, transcript) if text else None
            if not match or match[1] < REPLACE_MIN_RATIO or not is_verbatim(match[0], transcript):
                counts["dropped"] += 1
                continue
            new, outcome = {**q, "quote": match[0]}, "replaced"
        key = word_seq(new["quote"])
        if key in seen:
            counts["dropped"] += 1
            continue
        seen.add(key)
        counts[outcome] += 1
        out.append(new)
    return out, counts


def main(argv: list[str]) -> int:
    dry_run = "--dry-run" in argv
    totals = {"verbatim": 0, "replaced": 0, "dropped": 0}
    files_changed = 0
    emptied = []

    for path in sorted(TRANSCRIPTS_DIR.glob("*.json")):
        raw = path.read_text(encoding="utf-8")
        record = json.loads(raw)
        quotes = record.get("quotes")
        if not quotes:
            continue
        new_quotes, counts = repair_quotes(quotes, record.get("cleaned_transcript", ""))
        for k in totals:
            totals[k] += counts[k]
        if new_quotes == quotes:
            continue
        files_changed += 1
        if not new_quotes:
            emptied.append(path.name)
        print(f"{path.name}: {counts['verbatim']} verbatim, {counts['replaced']} replaced, {counts['dropped']} dropped")
        if not dry_run:
            record["quotes"] = new_quotes
            # Same serialization the pipeline writes, and the file's own
            # trailing newline kept, so the diff is the quotes and nothing
            # else.
            out = json.dumps(record, indent=2, ensure_ascii=False)
            if raw.endswith("\n"):
                out += "\n"
            path.write_text(out, encoding="utf-8")

    print()
    print(f"Quotes: {totals['verbatim']} already verbatim, {totals['replaced']} replaced "
          f"with the transcript's own words, {totals['dropped']} dropped")
    print(f"Files {'that would change' if dry_run else 'changed'}: {files_changed}")
    if emptied:
        print(f"Left with no quotes ({len(emptied)}): the Notable Quotes section is hidden on these pages")
        for name in emptied:
            print(f"  {name}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
