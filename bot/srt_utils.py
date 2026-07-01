"""Small helper to strip SRT caption formatting down to plain text."""

import re

_TIMESTAMP_RE = re.compile(r"^\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}")


def srt_to_text(srt: str) -> str:
    """Strip index numbers and timestamp lines from an SRT file, returning
    the spoken text as a single block."""
    lines = []
    for raw_line in srt.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        if line.isdigit():
            continue
        if _TIMESTAMP_RE.match(line):
            continue
        lines.append(line)
    return " ".join(lines)
