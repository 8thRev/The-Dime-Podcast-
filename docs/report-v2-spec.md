# Weekly Report v2 (Growth, Reach, Actions)

Written: Sep 22, 2026. Scope: replace the current "SEO report" email job
(`bot/seo_report.py`, `.github/workflows/seo-report.yml`) with an episode
normalized growth report that ends in actions. Run the phases in order. One
PR each. Verify between them.

## Why v2 exists

The current email compares this week to last week. On a bi-weekly show that
comparison is meaningless: every release week shows +300%, every quiet week
shows -70%, and the report never answers whether the audience is growing. It
also has no subscriber counts, no per episode curves, no baseline, and no
newsletter data.

v2 answers four questions every Monday: Is the podcast growing? Is reach
growing? What is working? What is not? Then it turns the answers into three
to five actions.

The show did not release over the summer. Jamie Pearson (Sep 16) is the first
episode back and the cadence is now bi-weekly. Every comparison must be
episode age normalized, never calendar normalized.

## Amendments, Sep 22 2026 (after the first real data pull)

The goal is growth through search, and above all through AI search results.
Episode download ratios measure whether the existing audience holds (Apple is
70 percent of downloads and mostly follower auto downloads), not whether
search is bringing new people. So the report now answers, in priority order:

1. **Is AI citing us more?** A weekly panel of fixed questions
   (`data/ai_prompts.csv`, edited by Bryan) asked to Claude with web search;
   headline metric is the citation rate. Plus AI assistant referrals to the
   site (GA4, with landing pages) and to YouTube videos (external referrers).
   AI assistants do not share what users ask; landing pages, question style
   Google queries and YouTube search terms are the observable traces.
2. **Is search finding us?** YouTube search views (49 percent of episode video
   views in the first pull) trended weekly and per episode at day 7 and day
   30 against baseline; Google split into branded and non branded queries;
   YouTube thumbnail impressions and CTR from a Reporting API job
   (`channel_reach_combined_a1`, created on first run, approved by Bryan).
3. **Is the base holding?** Day 7 and day 30 downloads against baseline, and
   Apple and Spotify follower counts entered by hand in
   `data/platform_followers.csv` (neither platform has an API).

Other changes from the original text below:
- Video to episode mapping reuses the automatic
  `app/content/video-episode-map.json`, with `data/video_episode_overrides.csv`
  for corrections, instead of a hand kept `data/video_episode_map.csv`.
- YouTube OAuth reuses the existing `YOUTUBE_OAUTH_*` secrets and
  `bot/get_youtube_refresh_token.py`.
- Search opportunities use position 5 to 30 and 10 or more impressions until
  site volume grows; the thresholds are constants in `bot/weekly_data.py`.
- Search Console data only exists from Apr 20, 2026.
- GA4 total sessions are dominated by bot traffic; Organic Search and AI
  Assistant sessions are the site numbers the report relies on.
- Phase 2 rules and the Phase 3 headline should lead with the AI and search
  questions above, not with downloads.

## Order of work after Phase 1 (decided Sep 22 2026)

Agent readiness comes before Phases 2 and 3. Agents acting for people (a
PR person pitching a guest, a brand researching sponsorships, an analyst
pulling everything the show has said on a topic) are a growth channel the
site was not built for. Sequence:

1. **Fix the inquiry form honeypots.** Both lead forms hide a field labeled
   "Website" that agents and autofill will complete, and the submission is
   then silently discarded. In progress in a separate branch.
2. **Log agent visits.** Record page fetches by ChatGPT-User, Claude-User,
   Perplexity-User and the other live browsing agents (GA4 cannot see them)
   and feed the counts and top pages into the Monday snapshot as a new
   source. Small website PR.
3. **Plain text pages.** `/episodes/<slug>.md`, `/guests/<slug>.md`,
   `/newsletter/<slug>.md`, linked from each page head and from `llms.txt`.
   Plus a per topic `llms.txt` so an agent researching one subject reads
   20 KB, not the 861 KB full catalogue.
4. **List the agent actions in `llms.txt`**: how to pitch a guest and how to
   ask about sponsorship, with the fields each needs; sponsor facts
   (audience size, formats) in machine readable form.
5. **Phase 2 rules and Phase 3 email**, leading with AI citation rate, AI
   referrals, agent visits and search growth.
6. **A Dime MCP server** (search episodes, get takeaways and transcript, list
   guests, latest First Principles, topic summary) once the agent visit
   logs show demand.

## Standing rules

1. Never print, log, or commit a credential. Secrets come from environment
   variables only. If a new secret is needed, name it exactly and Bryan adds
   it to the repository secrets.
2. No em dashes anywhere: code comments, email copy, docs.
3. Keep the existing email sending path. Do not replace the mailer.
4. Every new pull must degrade gracefully. If one source fails the email
   still sends, with that section marked "unavailable" and the error in the
   log.

## Phase 1: data layer and baselines (PR 1)

Build the data layer only. No email changes yet. The output of this phase is
a single JSON file written to `data/weekly/YYYY-MM-DD.json` and committed by
the workflow, so every week's snapshot is kept and the follower series builds
up over time.

1. **Simplecast, per episode daily downloads.** Use the analytics endpoints
   for the podcast (the podcast id already in the script). For every episode
   published in the last 400 days, pull downloads by day since publish. Store
   for each episode: id, title, published_at, and downloads at day 1, 3, 7,
   14, 30, 60, 90 (null where the episode is not that old yet), plus
   lifetime. Also pull podcast level downloads by app and by country for the
   trailing 28 days. If Simplecast's analytics endpoints return only
   aggregate totals, store the daily series in the JSON so the day N values
   can be derived on the next run, and report exactly which endpoint gave
   what.

2. **YouTube Analytics API** (not the Data API already in use). Per video,
   trailing 28 days and lifetime: views, impressions,
   impressionClickThroughRate, averageViewDuration, averageViewPercentage,
   subscribersGained, and the traffic source breakdown
   (insightTrafficSourceType). Also channel level: subscriber count and
   subscribersGained for the week. Requires OAuth with the channel owner's
   consent; an API key will not work. The workflow exchanges a refresh token
   for an access token on every run. Map each video to its episode. Video
   titles and episode titles diverge on purpose, so match on a maintained
   lookup and flag any video published in the last 60 days that is missing
   from it.

3. **Kit (ConvertKit) API v4.** Secret name `KIT_API_KEY`. Pull: total active
   subscribers (weekly snapshot), new subscribers this week, unsubscribes
   this week, and for each broadcast sent in the last 90 days: sent, opens,
   clicks, open rate, click rate, and the subject line. Match broadcasts to
   episodes by date proximity and flag unmatched ones.

4. **Search Console.** Keep the existing service account. Change the pull to:
   16 months by page and by query, with clicks, impressions, position.
   Aggregate to the page level so each episode page has a trailing 28 day
   impressions and clicks figure and an opportunity list: queries where that
   page sits at position 8 to 20 with 20 or more impressions in the trailing
   28 days.

5. **GA4 Data API.** Keep the existing pull but add:
   - a. sessions by default channel group and by session source for the
     week, so untagged Direct is visible as its own number
   - b. a bot check: if more than 70 percent of sessions land on "/" with
     average engagement time under 15 seconds, set
     `ga4.suspect_bot_traffic = true`
   - c. a stale pageview check: count page_view events whose page_path is
     "/" while page_location is not the homepage. Any nonzero count means the
     section 2.1 fix in `docs/analytics-spec.md` is not live, set
     `ga4.stale_pageview_bug = true`
   - d. key events for the week: newsletter_signup, platform_subscribe_click,
     audio_progress at 50, video_progress, sponsor_inquiry_submit,
     guest_inquiry_submit. Zero is a valid value and must be shown as zero,
     not omitted.

6. **Baselines.** For every episode metric at age N (downloads day 7, YouTube
   views day 7, CTR, average view percentage, newsletter click rate), compute
   the median of the previous 8 episodes at the same age, excluding the
   episode itself. Store baseline and ratio_to_baseline on the episode
   record. If fewer than 4 prior episodes have a value at that age, store
   null and do not compare.

7. **Reach series.** Append one row per run to `data/reach.csv`: date,
   simplecast_followers_or_best_proxy, youtube_subscribers,
   kit_active_subscribers. If Simplecast does not expose a follower count,
   use trailing 28 day unique listeners and name the column accordingly.

Acceptance:
- `--dry-run` writes the JSON and sends nothing
- the JSON validates against `schemas/weekly.schema.json`
- every episode published since 2026-04-01 has day 7 downloads and a
  baseline ratio or an explicit null with a reason
- one source deliberately failed (bad token) does not stop the run
- no credential appears in logs or in the committed JSON
- show the JSON for the current week before opening the PR

## Phase 2: rules and actions (PR 2)

`rules.py`: a list of rules that read the weekly JSON and emit action
objects. Each action has: rule_id, severity (act_now, this_week, watch),
episode or page it applies to, the evidence (the numbers that fired it), and
a one line owner tag (bryan, editor, social). Thresholds are constants at the
top of the file.

- **R1 over_performer:** episode day 7 downloads OR YouTube day 7 views at
  1.3x or more of baseline. Action: cut two more clips, resend in the
  newsletter to non openers, pin on YouTube and X. Owner: editor and social.
- **R2 under_performer:** both at 0.7x or less of baseline at day 7. Action:
  review title and thumbnail against the top four YouTube performers, retitle
  the audio if the topic is still live. Owner: bryan.
- **R3 low_ctr:** YouTube impressions 1,000 or more and CTR under 4 percent.
  Action: run a YouTube thumbnail and title test. Owner: bryan.
- **R4 early_dropoff:** averageViewPercentage under 25 percent or the 30
  second retention below 60 percent when available. Action: the intro hook
  missed, re-cut the cold open using the Step 1 hook options from the episode
  package. Owner: editor.
- **R5 query_in_reach:** any page with a query at position 8 to 20 and 20 or
  more impressions. Action: add a short section to that page that answers the
  query directly, then request reindexing. Owner: bryan.
- **R6 old_episode_wakes_up:** an episode older than 60 days whose trailing 7
  day downloads or search impressions are 2x its trailing 28 day weekly
  average. Action: recycle its clips into the Publer queue. Owner: social.
- **R7 newsletter_weak:** a broadcast with open rate under the trailing 6
  broadcast median by 20 percent or more. Action: subject line was the
  problem, list the three highest open subjects for comparison. Owner: bryan.
- **R8 list_shrinking:** Kit net subscribers negative for two consecutive
  weeks. Action: check what the last two broadcasts had in common. Owner:
  bryan.
- **R9 attribution_gap:** Direct is over 60 percent of GA4 sessions. Action:
  the UTM discipline from `docs/analytics-spec.md` section 5.2 is not being
  followed, list the last three off site links that were untagged if the
  source data allows. Owner: bryan.
- **R10 data_integrity:** suspect_bot_traffic or stale_pageview_bug is true,
  or a source was unavailable. Severity act_now, because every other rule is
  reading corrupted input. Owner: bryan.

Then a Claude step (secret `ANTHROPIC_API_KEY`, model from an env var with a
sensible default) given the weekly JSON summary, the fired actions, and the
voice rules below. It writes the Monday email body in three parts:

1. **Headline:** two sentences on growth and reach with the numbers, compared
   to baseline, never to last week.
2. **Episode ramp:** one line per episode released in the last 45 days, day 7
   and day 30 vs baseline with the ratio.
3. **Actions:** the fired actions rewritten in Bryan's voice, three to five,
   most severe first, evidence under each. If nothing fired, say "No rules
   fired. Keep shipping." and stop.

**Voice rules:** short declarative sentences, operator to operator, no
hedging, no hype, no em dashes, no bullets inside a sentence, numbers always
with their baseline beside them.

Acceptance:
- `python rules.py data/weekly/<latest>.json` prints the fired actions with
  evidence
- each rule has a unit test with one firing and one non firing fixture
- the Claude step, given a JSON with zero fired rules, produces the "No rules
  fired" output and nothing else
- the Claude step never invents a number that is not in the JSON; tested by
  passing a JSON with a known set of numbers and checking every number in the
  output appears in the input

## Phase 3: the email (PR 3)

Subject: "The Dime weekly: <headline metric> vs baseline", for example "The
Dime weekly: Pearson day 7 at 1.1x baseline".

Body, in order:
1. Headline (from the Claude step)
2. Reach: four numbers with the 4 week change. Podcast listeners, YouTube
   subscribers, Kit subscribers, Search Console impressions.
3. Episode ramp table: episode, published, day 7, baseline, ratio, day 30,
   baseline, ratio. Ratios at 1.3x or above and 0.7x or below get a visible
   marker.
4. Actions (from the Claude step)
5. Data health: one line per source, ok or unavailable, plus the bot and
   stale pageview flags.
6. A single line: "Full tables attached." The raw tables that used to be in
   the body go in `weekly-tables.csv`. Nothing else in the body.

Keep the plain text and HTML alternatives as the current mailer does.
Schedule: keep Monday. Add a second run the morning after each episode
publishes if the workflow can be triggered by the Simplecast RSS feed
changing; if not, leave the Monday run only and say so.

Acceptance:
- one test email to Bryan from a local run with `--send`
- every number in the email traces to a field in the weekly JSON
- an email with all sources failing still sends and says so
- no em dash anywhere in the output, with a test that greps for it

## What to expect from the first month

The first two weekly runs will have thin baselines because the summer gap
leaves the trailing 8 episodes spread across May to September. The ratios
become reliable around the third bi-weekly release. Do not tune thresholds
before that.

The number to watch is not weekly downloads. It is whether each new
episode's day 7 and day 30 land above the previous 8 episode median, and
whether the reach series (listeners, YouTube subscribers, Kit list) slopes up
week over week. If both are true for six weeks, the show is growing.
