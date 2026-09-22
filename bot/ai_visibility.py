"""
Weekly AI answer check: asks a fixed panel of questions (data/ai_prompts.csv)
to Claude with web search and records whether each answer cites The Dime.

AI assistants do not share what people ask them, so this is the direct way
to measure AI search visibility: the same questions every week, trended.
Answers vary run to run, so read the citation rate over several weeks.

Cost: up to MAX_SEARCHES_PER_PROMPT web searches per question at $10 per
1,000, plus tokens; roughly $1 to $2 per weekly run for 25 questions.
"""

import csv
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlparse

import anthropic

from config import config

PROMPTS_PATH = Path(__file__).resolve().parent.parent / "data" / "ai_prompts.csv"
MAX_SEARCHES_PER_PROMPT = 3
MAX_TOKENS = 1500
# Web search turns take 1 to 3 minutes each; 25 questions at 5 workers ran
# 16 minutes on Sep 22 2026, with 4 of them timing out at 180 seconds.
WORKERS = 8
REQUEST_TIMEOUT_SECONDS = 240
MAX_FAILURE_SHARE = 0.2
SYSTEM = (
    "You are a search assistant. Answer the user's question the way a helpful "
    "AI search product would: search the web, give a concise answer, and cite "
    "the sources you relied on."
)
OUR_DOMAINS = ("dimepodcast.com",)
CHANNEL_MARKERS = ("UCcck3tzBNXrJ1WJ8EtIVq1w", "@thedime_cannabis")
MENTION = re.compile(r"\bThe Dime\b")


def load_prompts(path: Path = PROMPTS_PATH) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        return [r for r in csv.DictReader(f) if (r.get("prompt") or "").strip()]


def _domain(url: str) -> str:
    host = urlparse(url).netloc.lower()
    return host[4:] if host.startswith("www.") else host


def is_ours(url: str, video_ids: set[str]) -> bool:
    domain = _domain(url)
    if any(domain == d or domain.endswith("." + d) for d in OUR_DOMAINS):
        return True
    if domain in ("youtube.com", "m.youtube.com", "youtu.be"):
        if any(m in url for m in CHANNEL_MARKERS):
            return True
        return any(vid in url for vid in video_ids)
    if domain == "podcasts.apple.com" and "/the-dime" in url:
        return True
    return False


def _walk_urls(obj, out: list[str]) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == "url" and isinstance(v, str):
                out.append(v)
            else:
                _walk_urls(v, out)
    elif isinstance(obj, list):
        for v in obj:
            _walk_urls(v, out)


def extract(content_blocks: list) -> tuple[str, list[str], list[str]]:
    """(answer_text, cited_urls, all_urls). cited_urls come from citations on
    the answer's text blocks; all_urls is every URL anywhere in the response,
    search results included. Walks the raw block data rather than relying on
    one block layout, since search tool result shapes change between tool
    versions."""
    text_parts, cited, everything = [], [], []
    for block in content_blocks:
        data = block.model_dump() if hasattr(block, "model_dump") else block
        if data.get("type") == "text":
            text_parts.append(data.get("text") or "")
            for c in data.get("citations") or []:
                if c.get("url"):
                    cited.append(c["url"])
        _walk_urls(data, everything)
    return "".join(text_parts), cited, everything


def ask(client, model: str, prompt: str) -> list:
    tools = [{"type": "web_search_20260209", "name": "web_search", "max_uses": MAX_SEARCHES_PER_PROMPT}]
    messages = [{"role": "user", "content": prompt}]
    message = client.messages.create(model=model, max_tokens=MAX_TOKENS, system=SYSTEM, tools=tools, messages=messages)
    content = list(message.content)
    for _ in range(2):
        if message.stop_reason != "pause_turn":
            break
        messages = [{"role": "user", "content": prompt}, {"role": "assistant", "content": message.content}]
        message = client.messages.create(model=model, max_tokens=MAX_TOKENS, system=SYSTEM, tools=tools, messages=messages)
        content.extend(message.content)
    return content


def score(prompt_row: dict, blocks: list, video_ids: set[str]) -> dict:
    text, cited, everything = extract(blocks)
    ours_cited = sorted({u for u in cited if is_ours(u, video_ids)})
    ours_seen = sorted({u for u in everything if is_ours(u, video_ids)})
    return {
        "id": prompt_row["id"],
        "category": prompt_row["category"],
        "prompt": prompt_row["prompt"],
        "episode_slug": prompt_row.get("episode_slug") or None,
        "cited": bool(ours_cited),
        "in_search_results": bool(ours_seen),
        "mentioned": bool(MENTION.search(text)),
        "our_cited_urls": ours_cited,
        "cited_domains": sorted({_domain(u) for u in cited}),
        "error": None,
    }


def run_panel(video_ids: set[str], client=None, prompts: list[dict] | None = None) -> dict:
    # A question that hangs is recorded as an error, not allowed to stall
    # the whole Monday run.
    client = client or anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, timeout=REQUEST_TIMEOUT_SECONDS, max_retries=1)
    model = config.AI_VISIBILITY_MODEL
    prompts = prompts if prompts is not None else load_prompts()

    def one(row):
        try:
            return score(row, ask(client, model, row["prompt"]), video_ids)
        except Exception as e:
            return {
                "id": row["id"], "category": row["category"], "prompt": row["prompt"],
                "episode_slug": row.get("episode_slug") or None, "cited": False,
                "in_search_results": False, "mentioned": False, "our_cited_urls": [],
                "cited_domains": [], "error": f"{type(e).__name__}: {str(e)[:200]}",
            }

    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        results = list(pool.map(one, prompts))
    return summarize(results, model)


def summarize(results: list[dict], model: str) -> dict:
    answered = [r for r in results if r["error"] is None]
    # A citation rate from a half finished panel is not comparable week to
    # week (a billing lapse answered 10 of 25 once), so a run that loses
    # more than MAX_FAILURE_SHARE of its questions is unavailable, not 0%.
    failed = [r for r in results if r["error"]]
    if results and len(failed) > MAX_FAILURE_SHARE * len(results):
        raise RuntimeError(
            f"only {len(answered)} of {len(results)} questions answered; first error: {failed[0]['error']}"
        )

    def rate(rows, key):
        return round(100 * sum(r[key] for r in rows) / len(rows), 1) if rows else None

    by_category = {}
    for cat in sorted({r["category"] for r in answered}):
        rows = [r for r in answered if r["category"] == cat]
        by_category[cat] = {"questions": len(rows), "citation_rate": rate(rows, "cited"), "mention_rate": rate(rows, "mentioned")}

    competitors = Counter(d for r in answered for d in r["cited_domains"] if not any(d.endswith(o) for o in OUR_DOMAINS))
    return {
        "model": model,
        "questions": len(results),
        "answered": len(answered),
        "citation_rate": rate(answered, "cited"),
        "mention_rate": rate(answered, "mentioned"),
        "in_search_results_rate": rate(answered, "in_search_results"),
        "by_category": by_category,
        "top_cited_domains": [{"domain": d, "questions": n} for d, n in competitors.most_common(15)],
        "results": results,
    }
