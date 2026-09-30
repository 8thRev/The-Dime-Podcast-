"""The Answers column's grounding and fact check gates, offline.

Each gate exists because the Sep 30, 2026 batch of posts got past review
with that fault: a paraphrase in quotation marks, a June 2025 special
session described as upcoming, a host's line credited to a guest, and a
detail no guest said. These tests pin the gates, not the prose.
"""

import json
from collections import Counter

import pytest

import isaac_blogger as ib
from config import config
from transcript_prompts import CANONICAL_TOPICS

TODAY = "2026-09-30"


def entry(slug, transcript, published="2026-08-01", summary="", title=None, quotes=()):
    words = ib.word_seq(transcript)
    return {
        "slug": slug,
        "title": title or slug.replace("-", " "),
        "guest": "",
        "pubDate": "",
        "published": published,
        "summary": summary,
        "takeaways": [],
        "faq": [],
        "quotes": list(quotes),
        "topics": [],
        "transcript": transcript,
        "transcript_words": words,
        "term_counts": Counter(words.split()),
        "length": len(words.split()),
    }


ZORN = entry(
    "tax-episode",
    "Bryan Fields: Let's talk taxes.\n\n"
    "Matt Zorn: For cannabis companies 280E is the whole story. 280E means you pay tax on gross profit. "
    "Every dispensary I know is crushed by 280E, and 280E is why margins are thin.",
    summary="280E tax on cannabis companies explained",
)
PASSING = entry(
    "passing-episode",
    "Guest Person: Cannabis companies pay a lot of tax. 280E comes up once.\n\n"
    "Bryan Fields: It's financial pornography, the projections these companies make.",
    summary="280E tax on cannabis companies, briefly",
)


def post(**overrides):
    body = (
        "Operators pay tax on gross profit. [The tax episode](/episodes/tax-episode) covers it. "
        + "word " * 400
    ).strip()
    data = {
        "unanswerable": False,
        "timeSensitive": False,
        "title": "How does 280E hurt cannabis companies?",
        "metaTitle": "How does 280E hurt?",
        "slug": "how-280e-hurts",
        "summary": "It taxes gross profit.",
        "description": "It taxes gross profit.",
        "body": body,
        "topics": list(CANONICAL_TOPICS[:2]),
        "episodes": ["tax-episode"],
        "faq": [{"question": "A?", "answer": "B."}, {"question": "C?", "answer": "D."}],
    }
    data.update(overrides)
    return data


# --- Excerpts and ranking ----------------------------------------------------


def test_split_passages_keeps_the_speaker_on_every_piece_of_a_long_turn():
    turn = "Jamie Pearson: " + " ".join(f"Sentence number {i} is here." for i in range(40))
    pieces = ib.split_passages("Bryan Fields: Welcome.\n\n" + turn, max_chars=200)
    assert pieces[0] == "Bryan Fields: Welcome."
    assert len(pieces) > 3
    assert all(p.startswith("Jamie Pearson: ") for p in pieces[1:])
    assert all(len(p) < 260 for p in pieces)


def test_excerpts_come_back_in_episode_order_and_favour_the_rare_term():
    passages = ib.transcript_passages(ZORN, "How does 280E hurt cannabis companies?", limit=1, max_chars=90)
    assert len(passages) == 1 and "280E" in passages[0]


def test_ranking_prefers_the_episode_that_keeps_coming_back_to_the_question():
    # BM25 needs a catalogue in which 280E is rare, as it is in the real one.
    others = [entry(f"other-{i}", "Guest: Brand building and retail design in Ohio.") for i in range(6)]
    ranked = ib.rank_sources("How does the 280E tax rule hurt cannabis companies?", [PASSING, ZORN, *others], 2)
    assert [e["slug"] for e in ranked] == ["tax-episode", "passing-episode"]


def test_catalogue_keeps_only_quotes_that_are_in_the_transcript(tmp_path, monkeypatch):
    (tmp_path / "ep.json").write_text(
        json.dumps(
            {
                "slug": "ep",
                "cleaned_transcript": "Dan McDermitt: I'd rather sell early — and leave profit on the table.",
                "quotes": [
                    {"speaker": "Dan McDermitt", "quote": "I'd rather sell early, and leave profit on the table."},
                    {"speaker": "Dan McDermitt", "quote": "I would rather sell early than give it back."},
                ],
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(ib, "TRANSCRIPT_DIR", tmp_path)
    monkeypatch.setattr(
        ib.simplecast_feed,
        "fetch_episodes",
        lambda: [{"slug": "ep", "title": "Ep", "guest": "", "pubDate": "Thu, 26 Jun 2025 04:00:00 +0000"}],
    )
    [loaded] = ib.load_catalogue()
    assert [q["quote"] for q in loaded["quotes"]] == ["I'd rather sell early, and leave profit on the table."]
    assert loaded["published"] == "2025-06-26"


# --- Quote gate --------------------------------------------------------------


def test_a_paraphrase_in_quotation_marks_is_caught():
    data = post(body=post()["body"] + ' Zorn said "280E is the only story in cannabis."')
    assert ib.unverified_quotes(data, [ZORN]) == ["280E is the only story in cannabis."]


def test_a_verbatim_quote_passes_despite_punctuation_differences():
    data = post(summary='Zorn: “280E means you pay tax on gross profit”')
    assert ib.unverified_quotes(data, [ZORN]) == []


def test_a_quote_only_counts_against_episodes_the_post_cites():
    # The words are in PASSING, but the post only cites tax-episode.
    data = post(summary='"It\'s financial pornography, the projections"')
    assert ib.unverified_quotes(data, [ZORN, PASSING]) != []


def test_two_word_terms_in_quotes_are_left_to_the_fact_check():
    assert ib.unverified_quotes(post(summary='a "total THC" standard'), [ZORN]) == []


# --- Staleness gate ----------------------------------------------------------


def test_time_sensitive_post_from_an_old_episode_is_stale():
    old = entry("tax-episode", ZORN["transcript"], published="2025-06-26")
    reason = ib.stale_reason(post(timeSensitive=True), [old], TODAY)
    assert "2025-06-26" in reason


def test_time_sensitive_post_from_a_recent_episode_is_fine():
    assert ib.stale_reason(post(timeSensitive=True), [ZORN], TODAY) == ""


def test_an_old_episode_is_fine_when_the_answer_does_not_hang_on_timing():
    old = entry("tax-episode", ZORN["transcript"], published="2023-01-01")
    assert ib.stale_reason(post(), [old], TODAY) == ""


def test_time_sensitive_post_with_an_undated_episode_is_refused():
    undated = entry("tax-episode", ZORN["transcript"], published="")
    assert "no publication date" in ib.stale_reason(post(timeSensitive=True), [undated], TODAY)


# --- Fact check gate ---------------------------------------------------------


def test_only_supported_and_opinion_pass_and_unknown_verdicts_fail():
    claims = [
        {"verdict": "supported"},
        {"verdict": "Opinion"},
        {"verdict": "misattributed"},
        {"verdict": "probably fine"},
    ]
    assert [c["verdict"] for c in ib.fact_check_failures(claims)] == ["misattributed", "probably fine"]


class FakeClaude:
    """Writes `data`, then returns `claims` from the fact check."""

    def __init__(self, data, claims, checked=True):
        self.data, self.claims, self.checked = data, claims, checked
        self.checks = 0

    def generate_post(self, question, origin, sources, answered, today):
        assert today and all("passages" in s for s in sources)
        return True, self.data

    def check_post(self, data, sources, today):
        self.checks += 1
        assert [s["slug"] for s in sources] == data["episodes"]
        return self.checked, self.claims


def run(monkeypatch, tmp_path, fake):
    monkeypatch.setattr(ib, "OUTPUT_DIR", tmp_path)
    monkeypatch.setattr(ib, "load_catalogue", lambda: [ZORN, PASSING])
    monkeypatch.setattr(ib, "IsaacClaudeClient", lambda: fake)
    monkeypatch.setattr(type(config), "ANTHROPIC_API_KEY", "test")
    monkeypatch.setattr(config, "ISAAC_FORCE_QUESTION", "How does 280E hurt cannabis companies?")
    monkeypatch.setattr(config, "ISAAC_MAX_POSTS", 1)
    assert ib.main() == 0
    return list(tmp_path.glob("*.md"))


def test_a_post_that_fails_the_fact_check_is_not_written(monkeypatch, tmp_path):
    fake = FakeClaude(post(), [{"verdict": "supported"}, {"verdict": "unsupported", "claim": "x", "note": "y"}])
    assert run(monkeypatch, tmp_path, fake) == []
    assert fake.checks == 1


def test_a_fact_check_that_does_not_run_is_a_rejection_not_a_pass(monkeypatch, tmp_path):
    assert run(monkeypatch, tmp_path, FakeClaude(post(), [], checked=False)) == []


def test_a_stale_post_is_rejected_before_paying_for_the_fact_check(monkeypatch, tmp_path):
    old = {**ZORN, "published": "2025-01-01"}
    monkeypatch.setattr(ib, "rank_sources", lambda q, c, n: [old])
    fake = FakeClaude(post(timeSensitive=True), [{"verdict": "supported"}])
    assert run(monkeypatch, tmp_path, fake) == []
    assert fake.checks == 0


def test_a_post_that_clears_every_gate_is_written(monkeypatch, tmp_path):
    fake = FakeClaude(post(), [{"verdict": "supported"}, {"verdict": "opinion"}])
    [written] = run(monkeypatch, tmp_path, fake)
    assert written.name == "how-280e-hurts.md"
