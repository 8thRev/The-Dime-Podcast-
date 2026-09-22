import ai_visibility

VIDEOS = {"NTzJBk-atDc"}


def test_is_ours_matches_site_channel_and_our_videos_only():
    assert ai_visibility.is_ours("https://www.dimepodcast.com/episodes/x", VIDEOS)
    assert ai_visibility.is_ours("https://www.youtube.com/watch?v=NTzJBk-atDc", VIDEOS)
    assert ai_visibility.is_ours("https://youtube.com/@thedime_cannabis", VIDEOS)
    assert ai_visibility.is_ours("https://podcasts.apple.com/us/podcast/the-dime/id123", VIDEOS)
    assert not ai_visibility.is_ours("https://www.youtube.com/watch?v=someoneelse", VIDEOS)
    assert not ai_visibility.is_ours("https://notdimepodcast.com.evil.io/", VIDEOS)


def test_extract_separates_citations_from_search_results():
    blocks = [
        {"type": "server_tool_use", "name": "web_search", "input": {"query": "q"}},
        {"type": "web_search_tool_result", "content": [
            {"type": "web_search_result", "url": "https://www.dimepodcast.com/episodes/a", "title": "A"},
            {"type": "web_search_result", "url": "https://mjbizdaily.com/b", "title": "B"},
        ]},
        {"type": "text", "text": "The Dime covered this.", "citations": [
            {"type": "web_search_result_location", "url": "https://mjbizdaily.com/b", "cited_text": "..."},
        ]},
    ]
    row = {"id": "t1", "category": "topic", "prompt": "q", "episode_slug": ""}
    r = ai_visibility.score(row, blocks, VIDEOS)
    assert r["cited"] is False  # seen in results but not cited
    assert r["in_search_results"] is True
    assert r["mentioned"] is True
    assert r["cited_domains"] == ["mjbizdaily.com"]


def test_summarize_rates_and_competitors():
    results = [
        {"id": "1", "category": "topic", "cited": True, "mentioned": True, "in_search_results": True,
         "cited_domains": ["dimepodcast.com", "a.com"], "error": None},
        {"id": "2", "category": "topic", "cited": False, "mentioned": False, "in_search_results": False,
         "cited_domains": ["a.com"], "error": None},
        {"id": "3", "category": "guest", "cited": False, "mentioned": False, "in_search_results": False,
         "cited_domains": [], "error": "boom"},
    ]
    s = ai_visibility.summarize(results, "m")
    assert s["answered"] == 2 and s["citation_rate"] == 50.0
    assert s["top_cited_domains"] == [{"domain": "a.com", "questions": 2}]


def test_prompts_file_is_well_formed():
    prompts = ai_visibility.load_prompts()
    assert len(prompts) >= 20
    assert len({p["id"] for p in prompts}) == len(prompts)
    assert {p["category"] for p in prompts} == {"category", "topic", "guest"}


def test_partial_panel_is_unavailable_not_zero_percent():
    import pytest
    ok = {"id": "1", "category": "topic", "cited": False, "mentioned": False, "in_search_results": False,
          "cited_domains": [], "error": None}
    bad = {**ok, "id": "2", "error": "BadRequestError: credit balance is too low"}
    with pytest.raises(RuntimeError, match="only 2 of 5"):
        ai_visibility.summarize([ok, ok, bad, bad, bad], "m")
    # One failure in five is within tolerance.
    assert ai_visibility.summarize([ok, ok, ok, ok, bad], "m")["answered"] == 4
