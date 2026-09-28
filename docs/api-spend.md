# API spend: audit and guardrails (Sep 2026)

## Verdict on the Sep 22 spend ($14.62, "Report v2 dev")

Seven runs of the temporary `Report v2 dev` workflow on `report-v2-phase1`,
every push. Only three called the Anthropic API (the AI visibility panel:
25 questions, web search on). The other four never reached it.

| Run | Commit | What changed | Panel | Verdict |
|---|---|---|---|---|
| #1 | f4af06c | spec plus a probe | none | free |
| #2 | 1c5e0e8 | data layer | none (panel did not exist yet) | free |
| #3 | 526696a | one docstring | none | free |
| #4 | e1287dc | **introduced the panel** | ran 11.6 min, cancelled by the next push | paid, output thrown away. The one legitimate first run, wasted by pushing again |
| #5 | 743f988 | a request timeout, step timing | full, 323 s | redundant. Testing a timeout needs 1 question, not 25 |
| #6 | bd5466e | retry and partial-panel rejection | none (unit tests failed in 3 s, cancelled by #7) | free |
| #7 | 267d969 | a **test fixture** fix | full, 954 s | redundant. Zero change to the paid path |

So 2 of the 3 paid runs (and about 2/3 of the panel spend) bought nothing that
a fixture or a 1 to 2 question run would not have. Run #7 reran the whole
panel because a unit test fixture was wrong.

What shipped: PR #64, squash merged at 16:35Z as `d08f7ce`. The last commit on the
branch, `8926eef` (rewrites `data/ai_prompts.csv` into natural questions), was
pushed after the merge and is **still only on `origin/report-v2-phase1`**. The
first real scheduled panel (SEO Report #25, Sep 28) therefore ran the old
prompts, and 3 of 25 questions errored. Nothing ever ran the rewritten prompts.

Cost accounting, with the limits of what is known: a panel is not the "$1 to
$2" in the docstring. The Sep 28 run is the only measured one: 92 calls,
881K input, 33K output, up to 75 searches, about **$2.1 to $2.8** at Sonnet 5
list prices. Three panels is about $6 to $8. The Console showed $14.62, so
roughly half of Sep 22 is **not attributable** from the logs: run #7's 954 s
(against 323 s for #5) points at timeouts and retries that bill for calls whose
answers were discarded, and pause_turn continuations resend the whole search
history, but no token logs existed then, so this is inference. Sep 16 ($7.25)
and Sep 23 ($3.40) are the same story: real runs, no per call data, cause a
hypothesis. Keys other than the Dime key are not explained by any Actions run;
they came from somewhere else (unknown; check where those keys are configured).

The design mistake, plainly: the key and the full paid path were reachable
from every push to a dev branch, with no cap and no logging.

## What is now in place

| Guard | Where | Proven by |
|---|---|---|
| One choke point for every Anthropic call | `bot/spend_guard.py`, used by all four clients and the AI panel | `test_spend_guard.py` |
| Per run caps: dollars, calls, searches, wall-clock; stops before the call that would exceed them | `Budget` (defaults in `DEFAULT_CAPS`, env override `SPEND_MAX_USD_<PURPOSE>` etc.) | `test_stuck_loop_is_capped_under_fifty_cents`: a forever pausing loop stops at 2 calls, under $0.65, alerts once |
| Capped run is loud: alert, `::error`, process exits 3, AI panel refuses to record a partial panel | `alert()`, `_fail_if_capped`, `run_panel` | same test, `test_capped_ai_panel_is_rejected_not_published_partial` |
| Off main in CI never calls the API (dry-run client, $0) unless `SPEND_ALLOW_OFF_MAIN=1` | `live_allowed()` | `test_dev_branch_in_ci_never_reaches_the_api` |
| `API_DRY_RUN=1` for local and test runs | same | same |
| Per call usage log (tokens, cache, searches, run id, label), uploaded as the `api-usage` artifact, total in the job summary | `log_call`, workflows | `test_usage_is_logged_per_call`, `test_stream_usage_is_accounted` |
| `timeout-minutes` on every paid job (10 guest, 20 Isaac, 30 SEO and transcript; SEO snapshot step 35 to 20) | workflows | n/a |
| Daily watchdog: any key over $4/day (est.), any run over 5x its workflow median and 5 min | `bot/spend_watch.py`, `spend-watch.yml` | `test_spend_watch_*`, `test_alert_selftest_posts_to_webhook` |

Limits, stated honestly:

* Caps are checked before a call, so one call can overshoot (about $0.2 to
  $0.5 for a big search call). They stop a loop; they are not a ledger.
* The dollar figure is an estimate from list prices. The Console is the bill.
* The default caps are placeholders at about 3x one clean run. Tighten them
  after two weeks of `api-usage` artifacts.
* `spend_watch.py`'s Admin API call is written from the documented
  `usage_report/messages` shape but has **not been run against the live API**
  (no admin key here, and calls were off limits). Run the workflow once by
  hand after adding the secret and read the log.
* The $4 daily limit is deliberately above your suggested $2: a normal Monday
  (one panel) is about $2.5 and would alert every week. Lower it if you move
  the panel to a cheaper setup.
* A dev key with a workspace limit is the real ceiling; the code gate only
  keeps dev branches away from the production key.

## Needs Bryan (Console and GitHub; none of this can be done from code)

1. **Balance is -$0.96 with auto-reload off.** Production stops when it
   hits an empty balance. Turn on auto-reload (about $25 when under $10) and
   settle the balance first.
2. **Monthly limit** is $200,000, i.e. none. Set about $60 org wide
   (current run rate about $35 plus headroom).
3. **Workspaces:** create `dime-dev` with its own key and a workspace limit of
   about $5. Put that key in a repo secret `ANTHROPIC_API_KEY_DEV`. A dev job
   that truly needs the live API sets `SPEND_ALLOW_OFF_MAIN=1` and uses that
   key, never the production one.
4. **Restrict the production secret to main.** Move `ANTHROPIC_API_KEY` to an
   environment secret with "deployment branches: main only". Do **not** just
   add `environment:` to the workflows: a job that references an environment
   creates a deployment, and `Index New Pages` triggers on `deployment_status`.
   That needs its own change if you want it.
5. **Secrets to add:** `ANTHROPIC_ADMIN_KEY` (an `sk-ant-admin...` key, read
   only use) and `SPEND_ALERT_WEBHOOK` (Slack incoming webhook or compatible).
   Then run *Spend Watch* by hand, and run
   `cd bot && SPEND_ALERT_WEBHOOK=... python spend_watch.py --selftest`
   once to see the alert arrive.
6. Retire the legacy "The Dime AI" key after rotating: it was used by three
   pipelines plus whatever else, which is why per key spend cannot separate
   them. One key per pipeline makes the watchdog useful.
7. Merge or discard `8926eef` (the prompt rewrite stranded on
   `report-v2-phase1`).

## Not done (Task 3, measure first)

Nothing here changes unit cost. The usage log now records `cache_read` and
`cache_write`, so after a week you can see whether prompt caching, batch, or a
cheaper model for the panel is worth it. Untested guesses until then. One
that needs no measurement: the panel does not need `max_uses: 3` on 25
questions weekly at full price; cutting to 2 searches or 15 questions is a
product decision, not an engineering one.
