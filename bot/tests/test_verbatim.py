"""Pull quote verbatim checks. Pure string work, nothing touches the network."""

from backfill_verbatim_quotes import repair_quotes
from verbatim import closest_span, filter_verbatim, is_verbatim, verified_quotes, word_seq

TRANSCRIPT = """Bryan Fields: Where does the industry go from here? Is rescheduling the catalyst?

Dan McDermitt: Both, honestly. I'd say it's a little bit of both. I would rather sell early and leave profit on the table than give it back. That's been my approach for a very long time.

Bryan Fields: And the capital side? Nobody wants to lend.

Dan McDermitt: The banks won't touch us \u2014 not until the plumbing is fixed, and that's years away."""


def q(text, speaker="Dan McDermitt"):
    return {"speaker": speaker, "quote": text}


def test_word_seq_ignores_case_punctuation_and_dashes():
    assert word_seq("The banks won\u2019t touch us \u2014 NOT until...") == "the banks won t touch us not until"


def test_filter_keeps_verbatim_despite_punctuation_differences():
    kept, dropped = filter_verbatim(
        [q("the banks won't touch us, not until the plumbing is fixed")], TRANSCRIPT
    )
    assert len(kept) == 1 and not dropped


def test_filter_drops_paraphrase_ellipsis_and_malformed():
    quotes = [
        q("I would rather sell early than give it back."),  # words removed
        q("Both, honestly... I would rather sell early"),  # two passages joined
        q("I'd say it's a little bit of both."),  # verbatim
        {"speaker": "Dan McDermitt"},  # no quote text
        "not a dict",
    ]
    kept, dropped = filter_verbatim(quotes, TRANSCRIPT)
    assert [k["quote"] for k in kept] == ["I'd say it's a little bit of both."]
    assert len(dropped) == 4


def test_verified_quotes_logs_drop_count(capsys):
    artifacts = {
        "cleaned_transcript": TRANSCRIPT,
        "quotes": [q("I'd say it's a little bit of both."), q("Banks are the whole problem.")],
    }
    assert verified_quotes(artifacts) == [artifacts["quotes"][0]]
    assert "Dropped 1 of 2 quotes" in capsys.readouterr().out


def test_verified_quotes_handles_missing_quotes():
    assert verified_quotes({"cleaned_transcript": TRANSCRIPT}) == []


def test_closest_span_returns_speakers_own_sentence():
    text, ratio = closest_span(
        "I would rather sell early and leave profit on the table than give it all back.",
        "Dan McDermitt",
        TRANSCRIPT,
    )
    assert text == "I would rather sell early and leave profit on the table than give it back."
    assert ratio > 0.9
    assert is_verbatim(text, TRANSCRIPT)


def test_closest_span_never_crosses_to_another_speaker():
    # Bryan said this, so a search in Dan's turns must not find it.
    text, ratio = closest_span("Is rescheduling really the catalyst?", "Dan McDermitt", TRANSCRIPT)
    assert "rescheduling" not in text.lower()
    assert closest_span("anything at all here", "Someone Else", TRANSCRIPT) is None


def test_repair_replaces_close_paraphrase_and_drops_the_rest():
    quotes = [
        q("I'd say it's a little bit of both."),
        q("I would rather sell early and leave profit on the table than give it all back."),
        q("Cannabis stocks will triple by next year."),
    ]
    out, counts = repair_quotes(quotes, TRANSCRIPT)
    assert counts == {"verbatim": 1, "replaced": 1, "dropped": 1}
    assert out[1]["speaker"] == "Dan McDermitt"
    assert all(is_verbatim(o["quote"], TRANSCRIPT) for o in out)


def test_repair_drops_replacement_that_duplicates_a_kept_quote():
    quotes = [
        q("I would rather sell early and leave profit on the table than give it back."),
        q("I would rather sell early and leave profit on the table than give it all back."),
    ]
    out, counts = repair_quotes(quotes, TRANSCRIPT)
    assert len(out) == 1
    assert counts == {"verbatim": 1, "replaced": 0, "dropped": 1}
