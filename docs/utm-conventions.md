# UTM conventions

How outbound links from The Dime get tagged, and the exact strings to paste
when writing new show notes or YouTube descriptions.

## Why this exists

GA4 only auto-parses `utm_*` parameters, and links from the site carry
`rel="noopener noreferrer"`, which strips the `Referer` header. An untagged
outbound link is therefore **completely invisible** on the destination's
analytics — it arrives as Direct with no way to attribute it. That is the
reasoning already written up in `app/lib/sponsor.ts`; this file extends it to
every outbound link.

`docs/analytics-spec.md` Part 5.2 makes the same argument at site level: 86% of
sessions were Direct with 16.6% engagement, against 90% for Organic — a pool of
untagged newsletter, LinkedIn and show-note clicks.

## The rule that makes this safe

**A link that already has any `utm_` parameter is never touched.**

The site tags links automatically at build time (`app/lib/utm.ts`), including
the ones inside show-notes HTML pulled from the Simplecast feed. If you tag a
link by hand in Simplecast, the build-time pass leaves it exactly as you wrote
it. Hand-written always wins; nothing is ever double-tagged.

So there is no migration and no ordering problem. Tag new episodes as you write
them, leave the old ones alone, and the website is fully attributed either way.

This is not hypothetical: **41 Newton links already in the Simplecast show
notes carry `utm_source=Thedime&utm_medium=pod&utm_campaign=simple_link`**, and
the build-time pass leaves every one of them exactly as written. If you keep
using `pod`/`simple_link` going forward, that keeps working and those clicks
stay in the campaign you have history for. If you switch to
`show_notes`/`episode_show_notes`, hand-written and automatic reads land in the
same bucket and become indistinguishable. Either is defensible — just pick one
and be consistent, because the two cannot be reconciled retroactively.

## Taxonomy

`utm_source` is **`Thedime`** — capital T, no space. It matches the value the
existing Simplecast show notes already use, which is the only reason GA4
reporting stays continuous across the change. Do not "correct" the casing.

| Surface | `utm_medium` | `utm_campaign` | `utm_content` |
|---|---|---|---|
| Episode sponsor slot (site, automatic) | `referral` | `episode_sponsor` | episode slug |
| Links in show notes (site, automatic) | `show_notes` | `episode_show_notes` | episode slug |
| Guest company link (site, automatic) | `referral` | `guest_link` | episode slug |
| Newsletter body links (site, automatic) | `newsletter` | `first_principles` | edition slug |
| **Show notes you write in Simplecast** | `show_notes` | `episode_show_notes` | episode slug |
| **YouTube descriptions** | `youtube` | `video_description` | video slug |

The first four are applied by the site with no action from you. The last two are
manual — see below.

## What the site does *not* tag

Two surfaces are outside the repo's reach, because readers there get the
original copy rather than the site's rendering:

1. **Apple / Spotify / other podcast apps** — they render Simplecast's show
   notes directly. Only hand-tagging in Simplecast reaches those listeners.
2. **YouTube descriptions** — `app/content/videos.json` holds these, but they
   render as inert plain text on `/videos/[slug]` and the file is regenerated
   from the YouTube API. Editing it changes nothing clickable and would be
   overwritten on the next sync. Tag these in YouTube Studio.

## Copy-paste strings

**Newton Insights — homepage**

```
https://www.newton-insights.com/?utm_source=Thedime&utm_medium=show_notes&utm_campaign=episode_show_notes
```

**Newton Insights — benchmark (the conversion page)**

```
https://www.newton-insights.com/benchmark?utm_source=Thedime&utm_medium=show_notes&utm_campaign=episode_show_notes
```

**First Principles newsletter** — this replaces the retired 8th Rev monthly
report. Do not write `8threv.com/monthly-report/` or
`eighthrevolution.com/monthly-report/` into new show notes; both 404.

```
https://www.dimepodcast.com/newsletter
```

No UTM on that one — it is an internal link, and tagging it would start a new
GA4 session and overwrite the visitor's real acquisition source.

For YouTube descriptions, swap `utm_medium=show_notes&utm_campaign=episode_show_notes`
for `utm_medium=youtube&utm_campaign=video_description`.

Adding `&utm_content=<episode-slug>` to any of these is optional but is what
lets you tell which episode actually drove the traffic. Use the slug from the
episode's URL on dimepodcast.com.

## Dead links the site strips

`eighthrevolution.com/the-dime/`, `eighthrevolution.com/the-dime-podcast`, and
`/monthly-report/` on both `eighthrevolution.com` and `8threv.com` all **404**.
Those domains resolve to an AWS load balancer that 301s its own root to
dimepodcast.com but 404s every deeper path, so nothing in this repo can repair
the destination.

The build repairs them at render time (`repairDeadLinks` in `app/lib/rss.ts`),
handling the two cases differently because the copy differs:

- **`/the-dime/` is unlinked, text kept.** "At Eighth Revolution (8th Rev), we
  provide services from capital to cannabinoid…" is descriptive credit copy
  that reads fine as prose, so it stays on the page without a link.
- **`/monthly-report/` is retargeted to `/newsletter`.** "Sign up for our
  playbook here:" is a call to action — unlinking it would leave a sentence
  promising a link that isn't there on ~216 pages. It now points at the First
  Principles signup, the monthly report's successor.

The bare domain root is left alone — it still resolves.

**This only fixes the website.** The same links are live in Apple and Spotify
show notes, in the YouTube descriptions, and in old LinkedIn posts, and none of
those can be reached from here. The one change that fixes all of them at once
is a 301 on that load balancer for `/the-dime/` and `/monthly-report/`. Worth
doing if anyone still has access to it.

## Never tagged, deliberately

Apple Podcasts, Spotify, YouTube, LinkedIn, X/Twitter, Instagram, Facebook,
TikTok, Simplecast, Kit/ConvertKit, and dimepodcast.com itself. These strip or
ignore `utm_*` and give publishers no campaign reporting on inbound params, so
tagging only makes the URL uglier in the one place readers see it raw. The list
lives in `NEVER_TAG_HOSTS` in `app/lib/utm.ts`.

Tagging an internal dimepodcast.com link is actively harmful: it starts a new
GA4 session and overwrites the real acquisition source of a visitor you already
have.

## Checking it

```bash
node scripts/audit-outbound-links.mjs --base=http://localhost:3000
```

Run from `app/` against a **built** site (`npm run build && npx next start`) —
show-notes tagging happens at build time, so the dev server is not the artifact
that ships. It classifies every outbound link as tagged, hand-tagged, skipped
by design, or **unexplained**, and fails if anything lands in that last bucket
or carries the wrong campaign for the page it renders on.
