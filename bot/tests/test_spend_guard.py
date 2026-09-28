"""Guardrail tests. None of these touch the network or spend anything."""

import json
from datetime import date
from types import SimpleNamespace

import pytest

import ai_visibility
import spend_guard
import spend_watch
from spend_guard import Budget, BudgetExceeded, GuardedClient


@pytest.fixture(autouse=True)
def isolate(tmp_path, monkeypatch):
    """A tripped budget registers a process exit code; clear it so it cannot
    fail the pytest run itself."""
    monkeypatch.setenv("SPEND_LOG_PATH", str(tmp_path / "usage.jsonl"))
    for k in ("API_DRY_RUN", "GITHUB_ACTIONS", "GITHUB_REF", "SPEND_ALLOW_OFF_MAIN", "SPEND_ALERT_WEBHOOK"):
        monkeypatch.delenv(k, raising=False)
    spend_guard._capped.clear()
    yield
    spend_guard._capped.clear()


def usage(inp=0, out=0, searches=0):
    tools = SimpleNamespace(web_search_requests=searches) if searches else None
    return SimpleNamespace(input_tokens=inp, output_tokens=out, cache_read_input_tokens=0,
                           cache_creation_input_tokens=0, server_tool_use=tools)


class LoopingClient:
    """The Sep 16 failure shape: the model pauses forever and each round trip
    resends a big context. 100K in + 1K out on Sonnet 5 is about $0.21."""

    def __init__(self):
        self.calls = 0
        self.messages = self

    def create(self, **kw):
        self.calls += 1
        return SimpleNamespace(stop_reason="pause_turn", content=[], usage=usage(100_000, 1_000))


def spin(client):
    n = 0
    while True:  # what a buggy continuation loop does
        client.messages.create(model="claude-sonnet-5", messages=[])
        n += 1
        if n > 10_000:
            raise AssertionError("loop was never stopped")


def test_stuck_loop_is_capped_under_fifty_cents(monkeypatch):
    posted = []
    monkeypatch.setenv("SPEND_ALERT_WEBHOOK", "https://example.invalid/hook")
    monkeypatch.setattr(spend_guard.requests, "post", lambda url, json=None, timeout=None: posted.append(json))
    inner = LoopingClient()
    client = GuardedClient(inner, Budget("guest_research", max_usd=0.40))
    with pytest.raises(BudgetExceeded):
        spin(client)
    # Checked before each call, so the overshoot is at most one call (~$0.21).
    assert client.budget.usd <= 0.40 + 0.25
    assert inner.calls == 2
    assert len(posted) == 1 and "CAPPED guest_research" in posted[0]["text"]  # the alert fired
    assert spend_guard._capped  # so the process exits non zero at shutdown
    # once tripped it stays tripped: no more calls sneak through
    with pytest.raises(BudgetExceeded):
        client.messages.create(model="claude-sonnet-5", messages=[])
    assert inner.calls == 2


def test_call_and_search_and_clock_caps():
    inner = LoopingClient()
    with pytest.raises(BudgetExceeded, match="calls"):
        spin(GuardedClient(inner, Budget("x", max_usd=99, max_calls=3)))
    assert inner.calls == 3
    b = Budget("y", max_usd=99, max_searches=5)
    b.record(0.0, 5)
    with pytest.raises(BudgetExceeded, match="searches"):
        b.check()
    with pytest.raises(BudgetExceeded, match="wall-clock"):
        Budget("z", max_seconds=0).check()


def test_dev_branch_in_ci_never_reaches_the_api(monkeypatch):
    monkeypatch.setenv("GITHUB_ACTIONS", "true")
    monkeypatch.setenv("GITHUB_REF", "refs/heads/report-v2-phase1")
    allowed, why = spend_guard.live_allowed()
    assert not allowed and "not main" in why
    client = spend_guard.make_client("seo_ai_panel")
    assert isinstance(client.messages._inner, spend_guard.FakeAnthropic)
    for _ in range(50):
        client.messages.create(model="claude-sonnet-5", messages=[])
    assert client.budget.usd == 0.0
    monkeypatch.setenv("GITHUB_REF", "refs/heads/main")
    assert spend_guard.live_allowed()[0]
    monkeypatch.setenv("GITHUB_REF", "refs/heads/dev")
    monkeypatch.setenv("SPEND_ALLOW_OFF_MAIN", "1")  # explicit opt in, for a job using the dev key
    assert spend_guard.live_allowed()[0]
    monkeypatch.setenv("API_DRY_RUN", "1")
    assert not spend_guard.live_allowed()[0]


def test_usage_is_logged_per_call(tmp_path):
    b = Budget("guest_research")
    b.label = "Jane Doe"
    client = GuardedClient(SimpleNamespace(messages=SimpleNamespace(
        create=lambda **kw: SimpleNamespace(stop_reason="end_turn", content=[], usage=usage(1_000_000, 100_000, searches=3)))), b)
    client.messages.create(model="claude-sonnet-5", messages=[])
    row = json.loads((tmp_path / "usage.jsonl").read_text().splitlines()[0])
    assert row["purpose"] == "guest_research" and row["label"] == "Jane Doe"
    assert (row["input"], row["output"], row["searches"]) == (1_000_000, 100_000, 3)
    assert row["est_usd"] == pytest.approx(2.0 + 1.0 + 0.03)


def test_stream_usage_is_accounted():
    class Stream:
        def __enter__(s): return s
        def __exit__(s, *a): return False
        def get_final_message(s): return SimpleNamespace(usage=usage(500_000, 0), stop_reason="end_turn", content=[])
    inner = SimpleNamespace(messages=SimpleNamespace(stream=lambda **kw: Stream()))
    client = GuardedClient(inner, Budget("transcript"))
    with client.messages.stream(model="claude-sonnet-5", messages=[]) as s:
        s.get_final_message()
    assert client.budget.usd == pytest.approx(1.0) and client.budget.calls == 1


def test_capped_ai_panel_is_rejected_not_published_partial():
    prompts = [{"id": str(i), "category": "topic", "prompt": "q", "episode_slug": ""} for i in range(10)]
    client = GuardedClient(LoopingClient(), Budget("seo_ai_panel", max_usd=99, max_calls=3))
    with pytest.raises(RuntimeError, match="spend cap"):
        ai_visibility.run_panel(set(), client=client, prompts=prompts)


def test_spend_watch_flags_the_days_that_burned_money():
    buckets = [
        {"starting_at": "2026-09-22T00:00:00Z", "results": [
            {"api_key_id": "dime", "model": "claude-sonnet-5", "uncached_input_tokens": 3_000_000,
             "output_tokens": 150_000, "server_tool_use": {"web_search_requests": 200}}]},
        {"starting_at": "2026-09-24T00:00:00Z", "results": [
            {"api_key_id": "dime", "model": "claude-sonnet-5", "uncached_input_tokens": 40_000, "output_tokens": 2_000}]},
    ]
    msgs = spend_watch.cost_anomalies(spend_watch.daily_cost_by_key(buckets))
    assert len(msgs) == 1 and "2026-09-22" in msgs[0]


def test_spend_watch_flags_a_slow_run():
    hist = [{"name": "Daily", "number": n, "seconds": 25, "day": date(2026, 9, n)} for n in range(1, 10)]
    today = date(2026, 9, 16)
    slow = {"name": "Daily", "number": 234, "seconds": 24 * 60 + 33, "day": today}
    ok = {"name": "Daily", "number": 235, "seconds": 40, "day": today}
    msgs = spend_watch.duration_anomalies(hist + [slow, ok], today)
    assert len(msgs) == 1 and "#234" in msgs[0]


def test_alert_selftest_posts_to_webhook(monkeypatch):
    posted = []
    monkeypatch.setenv("SPEND_ALERT_WEBHOOK", "https://example.invalid/hook")
    monkeypatch.setattr(spend_guard.requests, "post", lambda url, json=None, timeout=None: posted.append((url, json)))
    monkeypatch.setattr("sys.argv", ["spend_watch.py", "--selftest"])
    assert spend_watch.main() == 0
    assert posted and "alerts reach you" in posted[0][1]["text"]
