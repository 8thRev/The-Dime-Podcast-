import csv
import json
from datetime import date

import pytest

import baselines
import weekly_data
import weekly_report
from tests import fakes


@pytest.fixture(autouse=True)
def offline(monkeypatch):
    monkeypatch.setattr(weekly_data, "load_video_catalog", lambda: fakes.CATALOG)
    monkeypatch.setattr(weekly_data, "load_video_map", lambda: fakes.VIDEO_MAP)
    monkeypatch.setattr(weekly_data.simplecast_feed, "fetch_episodes", lambda: [
        {"title": "Episode 9", "slug": "episode-9", "guest": "", "pubDate": "Wed, 16 Sep 2026 04:00:00 +0000"},
    ])


def snapshot(clients=None):
    return weekly_data.build_snapshot(clients if clients is not None else fakes.all_clients(), today=fakes.TODAY)


def by_slug(snap, slug):
    return next(e for e in snap["episodes"] if e["slug"] == slug)


# ------------------------------------------------------------ baselines

def test_day_n_counts_publish_day_as_day_one():
    daily = {"2026-09-01": 10, "2026-09-02": 5, "2026-09-07": 1, "2026-09-08": 100}
    out = baselines.day_n_values(daily, date(2026, 9, 1), as_of=date(2026, 9, 20))
    assert out["day_1"] == 10
    assert out["day_7"] == 16  # Sep 1 through Sep 7, not Sep 8


def test_day_n_is_null_until_the_window_is_complete():
    out = baselines.day_n_values({"2026-09-16": 50}, date(2026, 9, 16), as_of=date(2026, 9, 21))
    assert out["day_3"] == 50
    assert out["day_7"] is None


def test_baseline_is_median_of_previous_eight_excluding_self():
    values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 1000]
    baseline, n = baselines.compute_baseline(values, 9)
    assert n == 8
    assert baseline == 5.5  # median of 2..9; the 1000 itself and the first value are excluded


def test_baseline_null_with_fewer_than_four_prior_values():
    baseline, n = baselines.compute_baseline([None, 3, None, 5, 7, 99], 5)
    assert (baseline, n) == (None, 3)
    rec = baselines.baseline_record(99, None, baseline, n)
    assert rec["ratio"] is None and rec["reason"].startswith("fewer_than_4")


def test_views_weighted_average():
    daily = {"2026-09-01": {"views": 30, "p": 10.0}, "2026-09-02": {"views": 10, "p": 50.0}}
    assert baselines.weighted_average(daily, date(2026, 9, 1), 2, date(2026, 9, 5), "p") == 20.0


# ------------------------------------------------------------ snapshot

def test_full_snapshot_validates_against_schema():
    snap = snapshot()
    assert weekly_report.validate(snap) == []
    assert all(s["status"] == "ok" for s in snap["sources"].values())


def test_every_episode_since_april_has_day7_ratio_or_reason():
    snap = snapshot()
    for ep in snap["episodes"]:
        if ep["published_at"] >= "2026-04-01":
            rec = ep["baselines"]["downloads_day_7"]
            assert rec["ratio"] is not None or rec["reason"], ep["slug"]


def test_newest_episode_at_day_six_is_null_with_reason():
    ep = by_slug(snapshot(), "episode-9")  # published Sep 16, run Sep 22
    assert ep["downloads"]["day_3"] is not None
    assert ep["downloads"]["day_7"] is None
    assert ep["baselines"]["downloads_day_7"]["reason"] == "not_yet_day_7"


def test_older_episode_gets_a_real_ratio():
    ep = by_slug(snapshot(), "episode-8")
    rec = ep["baselines"]["downloads_day_7"]
    assert rec["sample_size"] == 8 and rec["ratio"] is not None


def test_episode_without_mapped_video_is_explained():
    ep = by_slug(snapshot(), "episode-9")
    assert ep["youtube"] is None
    assert ep["baselines"]["youtube_views_day_7"]["reason"] == "no_mapped_video"


def test_unmapped_recent_video_is_flagged():
    snap = snapshot()
    assert [v["video_id"] for v in snap["youtube_channel"]["unmapped_recent_videos"]] == ["stray"]


def test_broadcasts_match_by_date_and_strays_are_flagged():
    snap = snapshot()
    assert by_slug(snap, "episode-9")["newsletter"]["click_rate"] == 7.93
    assert [b["id"] for b in snap["kit"]["unmatched_broadcasts"]] == [2]


def test_search_opportunities_filter_on_position_and_impressions():
    ep = by_slug(snapshot(), "episode-9")
    assert [o["query"] for o in ep["search"]["opportunities"]] == ["guest 9"]


def test_ga4_flags_bot_traffic_and_ignores_query_strings_on_homepage():
    ga4 = snapshot()["ga4"]
    assert ga4["suspect_bot_traffic"] is True  # 148 of 164 land on "/", 2.8s engagement
    assert ga4["stale_pageview_bug"] is False  # "/?utm_source=x" is still the homepage
    assert ga4["key_events"]["newsletter_signup"] == 0
    assert ga4["key_events"]["audio_progress_50"] == 0


def test_stale_pageview_detected(monkeypatch):
    clients = fakes.all_clients()
    monkeypatch.setattr(clients["ga4"], "homepage_path_page_views", lambda s, e: [
        {"page_location": "https://www.dimepodcast.com/episodes/foo", "count": 4},
    ])
    ga4 = snapshot(clients)["ga4"]
    assert ga4["stale_pageview_bug"] is True and ga4["stale_pageview_count"] == 4


# ------------------------------------------------------------ degradation

def test_one_bad_token_does_not_stop_the_run(monkeypatch):
    monkeypatch.setenv("KIT_API_KEY", "kit_secret_value_123")
    clients = fakes.all_clients()
    clients["kit"] = fakes.Broken("401 Unauthorized for key kit_secret_value_123")
    snap = snapshot(clients)
    assert snap["sources"]["kit"]["status"] == "unavailable"
    assert "kit_secret_value_123" not in snap["sources"]["kit"]["error"]
    assert snap["kit"] is None
    assert snap["sources"]["simplecast"]["status"] == "ok"
    assert by_slug(snap, "episode-8")["baselines"]["newsletter_click_rate"]["reason"] == "source_unavailable"
    assert weekly_report.validate(snap) == []


def test_every_source_failing_still_produces_a_valid_snapshot():
    broken = {name: fakes.Broken() for name in ("simplecast", "youtube", "kit", "gsc", "ga4")}
    snap = snapshot(broken)
    assert all(snap["sources"][n]["status"] == "unavailable" for n in broken)
    assert snap["sources"]["rss_feed"]["status"] == "ok"  # episode list fell back to the feed
    assert weekly_report.validate(snap) == []


def test_missing_credentials_are_reported_not_raised():
    snap = snapshot({})
    assert snap["sources"]["kit"] == {"status": "unavailable", "error": "credentials not configured"}
    assert weekly_report.validate(snap) == []


# ------------------------------------------------------------ outputs

def test_reach_csv_one_row_per_date(tmp_path):
    snap = snapshot()
    weekly_report.write_outputs(snap, tmp_path)
    weekly_report.write_outputs(snap, tmp_path)
    rows = list(csv.DictReader((tmp_path / "reach.csv").open()))
    assert len(rows) == 1
    assert rows[0] == {"date": "2026-09-22", "podcast_listeners_28d": "393", "youtube_subscribers": "6720",
                       "kit_active_subscribers": "1230", "search_impressions_28d": "500"}


def test_json_written_to_dated_file(tmp_path):
    path = weekly_report.write_outputs(snapshot(), tmp_path)
    assert path.name == "2026-09-22.json"
    assert json.loads(path.read_text())["run_date"] == "2026-09-22"


def test_refuses_to_write_a_credential(tmp_path, monkeypatch):
    monkeypatch.setenv("SIMPLECAST_API_TOKEN", "sc_token_abcdef")
    snap = snapshot()
    snap["episodes"][0]["title"] = "leak sc_token_abcdef"
    with pytest.raises(RuntimeError):
        weekly_report.write_outputs(snap, tmp_path)
