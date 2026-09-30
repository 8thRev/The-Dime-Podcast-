"""Topic briefs in bot/isaac_blogger.py: which topics are due one, how the
source material is fitted to the budget, what validate_brief rejects, and
that a brief is fact checked before it is written."""

from collections import Counter

import pytest

import isaac_blogger as ib
from config import config
from isaac_prompts import BRIEF_MIN_WORDS, get_brief_prompt


def episode(slug, topics, day, quotes=None, transcript=""):
    transcript = transcript or f"Guest: This is the transcript of {slug}."
    words = ib.word_seq(transcript)
    return {
        "slug": slug,
        "title": slug.replace("-", " "),
        "guest": "Guest",
        "pubDate": f"Mon, {day:02d} Jun 2026 04:00:00 +0000",
        "summary": f"Summary of {slug}.",
        "takeaways": [f"Takeaway of {slug}."],
        "faq": [{"question": "Q?", "answer": "A."}],
        "quotes": quotes or [],
        "topics": topics,
        "transcript": transcript,
        "transcript_words": words,
        "term_counts": Counter(words.split()),
        "length": len(words.split()),
    }


def brief_body(slugs, quote=None, words=BRIEF_MIN_WORDS + 50):
    """A body that passes validation: the five sections, every slug linked,
    padded to the word band."""
    links = " ".join(f"[{s}](/episodes/{s})." for s in slugs)
    filler = " ".join(["word"] * words)
    quoted = f' A guest said "{quote}" on air.' if quote else ""
    sections = [f"## {h}\n\nText.{quoted if i == 0 else ''}" for i, h in enumerate(ib.BRIEF_SECTIONS)]
    sections[0] += f" {links} {filler}"
    return "\n\n".join(sections)


@pytest.fixture(autouse=True)
def brief_settings(monkeypatch):
    monkeypatch.setattr(config, "ISAAC_BRIEF_MIN_EPISODES", 4)
    monkeypatch.setattr(config, "ISAAC_BRIEF_REFRESH_AFTER", 3)


def test_topic_slug_matches_the_site():
    # Hub URLs that exist on the live site today (lib/topicSlug.ts).
    assert ib.topic_to_slug("M&A") == "manda"
    assert ib.topic_to_slug("Taxation & 280E") == "taxation-and-280e"
    assert ib.topic_to_slug("MSOs & Multi-State Operators") == "msos-and-multi-state-operators"


def test_unpublished_episodes_are_not_sources():
    catalogue = [episode("aired", ["Real Estate"], 1), {**episode("not-aired", ["Real Estate"], 2), "pubDate": ""}]
    assert [s["slug"] for s in ib.topic_sources("Real Estate", catalogue)] == ["aired"]


def test_sources_are_newest_first_with_air_dates():
    catalogue = [episode("old", ["Real Estate"], 1), episode("new", ["Real Estate"], 20)]
    sources = ib.topic_sources("Real Estate", catalogue)
    assert [s["slug"] for s in sources] == ["new", "old"]
    assert sources[0]["date"] == "2026-06-20"


def test_unbriefed_topics_come_first_then_the_stalest():
    catalogue = (
        [episode(f"re-{i}", ["Real Estate"], i + 1) for i in range(5)]
        + [episode(f"ma-{i}", ["M&A"], i + 1) for i in range(8)]
        + [episode(f"tax-{i}", ["Taxation & 280E"], i + 1) for i in range(6)]
        + [episode(f"bank-{i}", ["Banking & Payments"], i + 1) for i in range(3)]
    )
    briefs = {
        # Four new episodes since: due.
        "manda": {"date": "2026-05-01", "sourceEpisodes": {f"ma-{i}" for i in range(4)}},
        # One new episode since: not due.
        "taxation-and-280e": {"date": "2026-05-01", "sourceEpisodes": {f"tax-{i}" for i in range(5)}},
    }
    due = ib.stale_topics(catalogue, briefs)
    # Banking has 3 episodes, under the minimum of 4.
    assert [d["topic"] for d in due] == ["Real Estate", "M&A"]
    assert due[1]["reason"].startswith("4 episodes since")


def test_forced_topic_ignores_staleness_and_minimum():
    catalogue = [episode("bank-0", ["Banking & Payments"], 1)]
    briefs = {"banking-and-payments": {"date": "2026-09-01", "sourceEpisodes": {"bank-0"}}}
    due = ib.stale_topics(catalogue, briefs, force_topic="Banking & Payments")
    assert [d["topic"] for d in due] == ["Banking & Payments"]


def test_fit_sources_keeps_every_episode_and_summary():
    sources = [episode(f"e-{i}", ["M&A"], i + 1, quotes=[{"speaker": "G", "quote": "x" * 500}]) for i in range(10)]
    full = sum(len(ib.format_brief_source(s, i + 1)) for i, s in enumerate(sources))
    fitted, trimmed = ib.fit_sources(sources, full - 1500)
    assert len(fitted) == 10
    assert all(s["summary"] for s in fitted)
    assert sum(len(ib.format_brief_source(s, i + 1)) for i, s in enumerate(fitted)) <= full - 1500
    # Oldest (last) lose their quotes first; the newest keeps everything.
    assert fitted[0]["quotes"] and not fitted[-1]["quotes"]
    assert trimmed >= 3


def test_fit_sources_untouched_under_budget():
    sources = [episode("e", ["M&A"], 1)]
    fitted, trimmed = ib.fit_sources(sources, 10**6)
    assert fitted == sources and trimmed == 0


def test_min_cited_scales_with_topic_size():
    assert ib.min_cited_for(4) == 4
    assert ib.min_cited_for(7) == 4
    assert ib.min_cited_for(20) == 5
    assert ib.min_cited_for(71) == 15


def test_valid_brief_returns_cited_slugs_in_order():
    sources = [episode(f"e-{i}", ["M&A"], i + 1) for i in range(5)]
    ok, reason, cited = ib.validate_brief(brief_body(["e-3", "e-1", "e-0", "e-2"]), sources, 4)
    assert ok, reason
    assert cited == ["e-3", "e-1", "e-0", "e-2"]


@pytest.mark.parametrize(
    "mutate, expected",
    [
        (lambda b: b.replace("(/episodes/e-0)", "(/episodes/made-up)"), "not in the source material"),
        (lambda b: b.replace("[e-0](/episodes/e-0).", ""), "needs at least 4"),
        (lambda b: b + "\n\n[x](https://example.com)", "outside the episode catalogue"),
        (lambda b: b.replace("## Where guests disagree", "## Debate"), "sections are"),
        (lambda b: "# Title\n\n" + b, "h1"),
    ],
)
def test_invalid_briefs_are_rejected(mutate, expected):
    sources = [episode(f"e-{i}", ["M&A"], i + 1) for i in range(5)]
    body = mutate(brief_body(["e-0", "e-1", "e-2", "e-3"]))
    ok, reason, _ = ib.validate_brief(body, sources, 4)
    assert not ok
    assert expected in reason


def test_short_brief_is_rejected():
    sources = [episode(f"e-{i}", ["M&A"], i + 1) for i in range(4)]
    ok, reason, _ = ib.validate_brief(brief_body([s["slug"] for s in sources], words=10), sources, 4)
    assert not ok and "words" in reason


def test_quotation_must_be_word_for_word_in_a_cited_transcript():
    real = "Nobody in this industry has pricing power anymore"
    said = "Guest: Honestly — nobody in this industry has pricing power anymore."
    sources = [episode(f"e-{i}", ["M&A"], i + 1, transcript=said) for i in range(4)]
    slugs = [s["slug"] for s in sources]

    ok, reason, _ = ib.validate_brief(brief_body(slugs, quote=real), sources, 4)
    assert ok, reason

    ok, reason, _ = ib.validate_brief(brief_body(slugs, quote="Nobody in this industry has any leverage left"), sources, 4)
    assert not ok and "word for word" in reason

    # A stored "verbatim" quote that is not in the transcript no longer counts.
    paraphrased = [episode(f"e-{i}", ["M&A"], i + 1, quotes=[{"speaker": "G", "quote": real}]) for i in range(4)]
    ok, reason, _ = ib.validate_brief(brief_body(slugs, quote=real), paraphrased, 4)
    assert not ok

    # Two word quoted terms are terms, not quotations.
    ok, reason, _ = ib.validate_brief(brief_body(slugs, quote="pricing power"), sources, 4)
    assert ok, reason


def test_a_brief_citing_more_than_the_fact_check_can_read_is_rejected(monkeypatch):
    monkeypatch.setattr(config, "ISAAC_BRIEF_MAX_CITED", 4)
    sources = [episode(f"e-{i}", ["M&A"], i + 1) for i in range(5)]
    ok, reason, _ = ib.validate_brief(brief_body([s["slug"] for s in sources]), sources, 4)
    assert not ok and "fact check can read" in reason


class FakeClaude:
    def __init__(self, claims, checked=True):
        self.claims, self.checked = claims, checked
        self.checks = []

    def generate_brief(self, topic, sources, min_cited, today):
        assert today and all("passages" in s for s in sources)
        return True, {"insufficient": False, "body": brief_body([s["slug"] for s in sources[:4]])}

    def check_post(self, post, sources, today, label="fact check", max_tokens=None):
        self.checks.append([s["slug"] for s in sources])
        return self.checked, self.claims


def run_briefs(monkeypatch, tmp_path, fake):
    monkeypatch.setattr(ib, "BRIEF_DIR", tmp_path)
    monkeypatch.setattr(config, "ISAAC_MAX_BRIEFS", 1)
    monkeypatch.setattr(config, "ISAAC_FORCE_TOPIC", "")
    catalogue = [episode(f"e-{i}", ["M&A"], i + 1) for i in range(5)]
    return ib.run_briefs(fake, catalogue), list(tmp_path.glob("*.md"))


def test_brief_is_checked_against_the_episodes_it_cites_and_written_when_it_passes(monkeypatch, tmp_path):
    fake = FakeClaude([{"verdict": "supported"}, {"verdict": "opinion"}])
    topics, files = run_briefs(monkeypatch, tmp_path, fake)
    assert topics == ["M&A"] and [f.name for f in files] == ["manda.md"]
    assert fake.checks == [["e-4", "e-3", "e-2", "e-1"]]


def test_brief_that_fails_the_fact_check_is_not_written(monkeypatch, tmp_path):
    fake = FakeClaude([{"verdict": "supported"}, {"verdict": "misattributed", "claim": "x", "note": "y"}])
    assert run_briefs(monkeypatch, tmp_path, fake) == ([], [])


def test_brief_whose_check_did_not_run_is_not_written(monkeypatch, tmp_path):
    assert run_briefs(monkeypatch, tmp_path, FakeClaude([], checked=False)) == ([], [])


def test_brief_too_large_to_check_is_not_written_or_checked(monkeypatch, tmp_path):
    monkeypatch.setattr(config, "ISAAC_BRIEF_CHECK_MAX_CHARS", 10)
    fake = FakeClaude([{"verdict": "supported"}])
    assert run_briefs(monkeypatch, tmp_path, fake) == ([], [])
    assert fake.checks == []


def test_prompt_names_every_required_section():
    prompt = get_brief_prompt("M&A", [episode("e", ["M&A"], 1)], 4, "2026-09-30", 18)
    for heading in ib.BRIEF_SECTIONS:
        assert f"## {heading}" in prompt
