"""
Spend guard: the one choke point every Anthropic call in bot/ goes through.

    client = spend_guard.make_client("guest_research")

returns a drop-in for anthropic.Anthropic (messages.create and
messages.stream) that

  * refuses to run live off main in CI (a dev branch gets a dry-run client),
  * enforces a per-run Budget (dollars, calls, searches, wall-clock) BEFORE
    each call, and stops with BudgetExceeded when a cap is hit,
  * writes one JSONL line per call (tokens, cache, searches, run id, label),
  * alerts and fails the process (exit 3) if any cap was hit, so a capped run
    is never a quiet success.

Prices are list prices per million tokens (Sep 2026). Unknown models are
priced at the most expensive tier so an estimate can only be too high.
The dollar figure is an estimate for enforcement; the Console is the bill.
"""

import atexit
import json
import os
import sys
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

import requests

# (input, output, cache_read, cache_write_5m) USD per million tokens
PRICES = {
    "claude-sonnet-5": (2.0, 10.0, 0.20, 2.50),
    "claude-sonnet-5-5": (2.0, 10.0, 0.20, 2.50),
    "claude-opus-5": (5.0, 25.0, 0.50, 6.25),
    "claude-opus-5-5": (4.0, 20.0, 0.20, 5.00),
    "claude-haiku-4-5": (1.0, 5.0, 0.10, 1.25),
}
FALLBACK_PRICE = (10.0, 50.0, 1.0, 12.5)
WEB_SEARCH_USD = 0.01  # $10 per 1,000

# Per-purpose defaults. Deliberate placeholders: about 3x what one clean run
# of each cost when the token logs began (Sep 28: one 25 question panel was
# 92 calls, 881K in, 33K out, about $2.5). Tighten after two weeks of
# data/api_usage logs. Any of them can be overridden by env, e.g.
# SPEND_MAX_USD_SEO_AI_PANEL=8.
DEFAULT_CAPS = {
    #                    usd   calls searches seconds
    "guest_research":   (2.00,  25,   40,     900),
    "seo_ai_panel":     (6.00, 150,  100,    1200),
    "transcript":       (8.00,  40,    0,    3000),
    "isaac":            (6.00,  40,    0,    1500),
}
GENERIC_CAPS = (2.00, 30, 40, 900)

CAP_EXIT_CODE = 3
_capped: list[str] = []
_lock = threading.Lock()


class BudgetExceeded(RuntimeError):
    pass


def _env_bool(name: str) -> bool:
    return os.getenv(name, "").strip().lower() in ("1", "true", "yes")


def _searches(usage) -> int:
    tools = getattr(usage, "server_tool_use", None)
    return (getattr(tools, "web_search_requests", 0) or 0) if tools else 0


def price_usd(model: str, usage) -> float:
    p_in, p_out, p_read, p_write = PRICES.get(model, FALLBACK_PRICE)
    g = lambda name: getattr(usage, name, 0) or 0
    return (
        g("input_tokens") * p_in + g("output_tokens") * p_out
        + g("cache_read_input_tokens") * p_read + g("cache_creation_input_tokens") * p_write
    ) / 1e6 + _searches(usage) * WEB_SEARCH_USD


class Budget:
    def __init__(self, purpose: str, max_usd=None, max_calls=None, max_searches=None, max_seconds=None):
        d_usd, d_calls, d_search, d_secs = DEFAULT_CAPS.get(purpose, GENERIC_CAPS)
        key = purpose.upper()
        self.purpose = purpose
        self.max_usd = max_usd if max_usd is not None else float(os.getenv(f"SPEND_MAX_USD_{key}", d_usd))
        self.max_calls = max_calls if max_calls is not None else int(os.getenv(f"SPEND_MAX_CALLS_{key}", d_calls))
        self.max_searches = max_searches if max_searches is not None else int(os.getenv(f"SPEND_MAX_SEARCHES_{key}", d_search))
        self.max_seconds = max_seconds if max_seconds is not None else float(os.getenv(f"SPEND_MAX_SECONDS_{key}", d_secs))
        self.usd = 0.0
        self.calls = 0
        self.searches = 0
        self.started = time.monotonic()
        self.label = ""
        self.tripped: str | None = None

    def check(self) -> None:
        """Called before every request. A tripped budget stays tripped."""
        with _lock:
            reason = self.tripped
            if not reason:
                if self.calls >= self.max_calls:
                    reason = f"{self.calls} calls (cap {self.max_calls})"
                elif self.max_searches and self.searches >= self.max_searches:  # 0 = purpose uses no search tool
                    reason = f"{self.searches} web searches (cap {self.max_searches})"
                elif self.usd >= self.max_usd:
                    reason = f"${self.usd:.2f} estimated (cap ${self.max_usd:.2f})"
                elif time.monotonic() - self.started >= self.max_seconds:
                    reason = f"{time.monotonic() - self.started:.0f}s wall-clock (cap {self.max_seconds:.0f}s)"
            if reason and not self.tripped:
                self.tripped = reason
                _capped.append(f"{self.purpose}: {reason}")
                first = True
            else:
                first = False
        if reason:
            if first:
                alert(f"CAPPED {self.purpose}{' [' + self.label + ']' if self.label else ''}: {reason}. "
                      f"Run {os.getenv('GITHUB_RUN_ID', 'local')} stopped; output not published.")
            raise BudgetExceeded(reason)

    def record(self, usd: float, searches: int) -> None:
        with _lock:
            self.calls += 1
            self.usd += usd
            self.searches += searches


# ---- alerts -------------------------------------------------------------

def alert(message: str) -> None:
    """Loud on every channel available: workflow annotation (and the failed
    run GitHub emails about), plus a Slack-compatible webhook if configured.
    Never raises: an alert failure must not mask the original problem."""
    print(f"::error title=API spend guard::{message}", file=sys.stderr, flush=True)
    url = os.getenv("SPEND_ALERT_WEBHOOK", "")
    if not url:
        return
    try:
        requests.post(url, json={"text": f":rotating_light: {message}"}, timeout=10)
    except Exception as e:
        print(f"[spend_guard] webhook failed: {type(e).__name__}", file=sys.stderr)


# ---- usage log ----------------------------------------------------------

def log_path() -> Path:
    return Path(os.getenv("SPEND_LOG_PATH", str(Path(__file__).resolve().parent / "logs" / "api_usage.jsonl")))


def log_call(budget: Budget, model: str, usage, usd: float, message=None, seconds: float = 0.0, error: str = "") -> None:
    """One JSONL row and one stdout line per API call, errors included."""
    stop = getattr(message, "stop_reason", "") or ""
    tools = getattr(usage, "server_tool_use", None)
    row = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "run_id": os.getenv("GITHUB_RUN_ID", "local"),
        "workflow": os.getenv("GITHUB_WORKFLOW", ""),
        "ref": os.getenv("GITHUB_REF", ""),
        "purpose": budget.purpose,
        "label": budget.label,
        "call_n": budget.calls,
        "model": model,
        "message_id": getattr(message, "id", "") or "",
        "stop_reason": stop,
        "seconds": round(seconds, 1),
        "input": getattr(usage, "input_tokens", 0) or 0,
        "output": getattr(usage, "output_tokens", 0) or 0,
        "cache_read": getattr(usage, "cache_read_input_tokens", 0) or 0,
        "cache_write": getattr(usage, "cache_creation_input_tokens", 0) or 0,
        "searches": _searches(usage),
        "fetches": (getattr(tools, "web_fetch_requests", 0) or 0) if tools else 0,
        "est_usd": round(usd, 4),
        "cum_usd": round(budget.usd, 4),
        "error": error,
    }
    print(f"[api] {budget.purpose}{' [' + budget.label + ']' if budget.label else ''} #{budget.calls} {model} "
          f"in={row['input']} out={row['output']} cache_r={row['cache_read']} searches={row['searches']} "
          f"stop={stop or '-'} {row['seconds']}s ~${usd:.3f} (run ~${budget.usd:.2f})"
          f"{' ERROR ' + error if error else ''}", flush=True)
    try:
        path = log_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        with _lock, path.open("a", encoding="utf-8") as f:
            f.write(json.dumps(row) + "\n")
    except OSError as e:
        print(f"[spend_guard] usage log write failed: {e}", file=sys.stderr)


_PROCESS_START = datetime.now(timezone.utc).isoformat(timespec="seconds")


def run_summary(label: str | None = None) -> dict:
    """Estimated spend for this workflow run (all steps share GITHUB_RUN_ID and
    the log file), or for this process when run locally. Optionally only the
    rows for one label (a guest name)."""
    out = {"usd": 0.0, "calls": 0, "searches": 0, "input": 0, "output": 0, "by_purpose": {}}
    path = log_path()
    if not path.exists():
        return out
    run = os.getenv("GITHUB_RUN_ID", "local")
    for line in path.read_text(encoding="utf-8").splitlines():
        try:
            r = json.loads(line)
        except ValueError:
            continue
        if r.get("run_id") != run or (run == "local" and r.get("ts", "") < _PROCESS_START):
            continue
        if label is not None and r.get("label") != label:
            continue
        out["usd"] += r.get("est_usd", 0)
        out["calls"] += 1
        out["searches"] += r.get("searches", 0)
        out["input"] += r.get("input", 0)
        out["output"] += r.get("output", 0)
        bp = out["by_purpose"].setdefault(r.get("purpose", "?"), {"usd": 0.0, "calls": 0})
        bp["usd"] += r.get("est_usd", 0)
        bp["calls"] += 1
    return out


def cost_note(label: str | None = None) -> str:
    """One plain sentence for an email footer. Empty when nothing was spent
    (dry run, or no API call this run)."""
    m = run_summary(label)
    if not m["calls"]:
        return ""
    return (f"Estimated API cost: ${m['usd']:.2f} ({m['calls']} calls, {m['searches']} web searches, "
            f"{m['input'] // 1000}K tokens in, {m['output'] // 1000}K out). "
            "List-price estimate; the Anthropic Console is the bill.")


# ---- guarded client -----------------------------------------------------

class _GuardedStream:
    def __init__(self, guard, manager, model):
        self._guard, self._manager, self._model = guard, manager, model
        self._stream = None
        self._t0 = 0.0

    def __enter__(self):
        self._t0 = time.monotonic()
        self._stream = self._manager.__enter__()
        return self._stream

    def __exit__(self, *exc):
        result = self._manager.__exit__(*exc)
        if exc[0] is None:
            message = self._stream.get_final_message()
            self._guard._account(self._model, message.usage, message, time.monotonic() - self._t0)
        else:
            self._guard._failed(self._model, exc[1], time.monotonic() - self._t0)
        return result


class _GuardedMessages:
    def __init__(self, inner, budget):
        self._inner, self._budget = inner, budget

    def create(self, **kwargs):
        self._budget.check()
        t0 = time.monotonic()
        try:
            message = self._inner.messages.create(**kwargs)
        except Exception as e:
            self._failed(kwargs.get("model", ""), e, time.monotonic() - t0)
            raise
        self._account(kwargs.get("model", ""), message.usage, message, time.monotonic() - t0)
        return message

    def stream(self, **kwargs):
        self._budget.check()
        return _GuardedStream(self, self._inner.messages.stream(**kwargs), kwargs.get("model", ""))

    def _account(self, model, usage, message=None, seconds=0.0):
        usd = price_usd(model, usage)
        self._budget.record(usd, _searches(usage))
        log_call(self._budget, model, usage, usd, message, seconds)

    def _failed(self, model, exc, seconds):
        # A failed or timed out request can still have been billed; count the
        # call against the cap and make it visible.
        self._budget.record(0.0, 0)
        log_call(self._budget, model, None, 0.0, None, seconds, error=f"{type(exc).__name__}: {str(exc)[:150]}")


class GuardedClient:
    def __init__(self, inner, budget: Budget):
        self.budget = budget
        self.messages = _GuardedMessages(inner, budget)


# ---- dry run ------------------------------------------------------------

class _Block:
    type = "text"

    def __init__(self, text):
        self.text = text
        self.citations = None

    def model_dump(self):
        return {"type": "text", "text": self.text}


class FakeAnthropic:
    """Offline stand in. Returns an empty-ish answer with zero usage, so a
    pipeline run in dry-run mode exercises its own code and costs nothing.
    Output is deliberately unusable as content (pipelines that need JSON
    will report a parse failure, which is the honest result)."""

    def __init__(self, text="[dry run: no API call was made]"):
        self.text = text
        self.calls = 0
        self.messages = self

    def _message(self):
        self.calls += 1
        return SimpleNamespace(
            content=[_Block(self.text)], stop_reason="end_turn",
            usage=SimpleNamespace(input_tokens=0, output_tokens=0, cache_read_input_tokens=0,
                                  cache_creation_input_tokens=0, server_tool_use=None),
        )

    def create(self, **kwargs):
        return self._message()

    def stream(self, **kwargs):
        message = self._message()

        class _S:
            def __enter__(s):
                return s

            def __exit__(s, *a):
                return False

            def get_final_message(s):
                return message

        return _S()


def live_allowed() -> tuple[bool, str]:
    """(allowed, reason). Live calls are blocked when API_DRY_RUN is set, and
    in GitHub Actions on any ref except main unless SPEND_ALLOW_OFF_MAIN=1
    (set that only on a job that uses the dev key)."""
    if _env_bool("API_DRY_RUN"):
        return False, "API_DRY_RUN is set"
    if _env_bool("GITHUB_ACTIONS"):
        ref = os.getenv("GITHUB_REF", "")
        if ref != "refs/heads/main" and not _env_bool("SPEND_ALLOW_OFF_MAIN"):
            return False, f"CI ref {ref or '(unknown)'} is not main"
    return True, ""


def make_client(purpose: str, budget: Budget | None = None, **anthropic_kwargs):
    """Guarded replacement for anthropic.Anthropic(api_key=...)."""
    from config import config

    budget = budget or Budget(purpose)
    allowed, why = live_allowed()
    if not allowed:
        print(f"[spend_guard] DRY RUN for {purpose}: {why}. No paid API call will be made.", flush=True)
        return GuardedClient(FakeAnthropic(), budget)
    import anthropic
    return GuardedClient(anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, **anthropic_kwargs), budget)


# ---- process exit -------------------------------------------------------

def _summary_line() -> None:
    step = os.getenv("GITHUB_STEP_SUMMARY")
    m = run_summary()
    if not step or not m["calls"]:
        return
    lines = ["", "### API spend (estimate)", "", "| Purpose | Calls | Est. cost |", "|---|---|---|"]
    lines += [f"| {k} | {v['calls']} | ${v['usd']:.2f} |" for k, v in sorted(m["by_purpose"].items())]
    lines += [f"| **Total** | **{m['calls']}** | **${m['usd']:.2f}** |", "",
              f"{m['searches']} web searches, {m['input'] // 1000}K tokens in, {m['output'] // 1000}K out. "
              "List-price estimate; the Anthropic Console is the bill.", ""]
    with open(step, "a", encoding="utf-8") as f:
        f.write("\n".join(lines))


@atexit.register
def _fail_if_capped() -> None:
    try:
        _summary_line()
    except Exception:
        pass
    if _capped:
        print("CAPPED: " + "; ".join(_capped), file=sys.stderr, flush=True)
        sys.stdout.flush()
        os._exit(CAP_EXIT_CODE)
