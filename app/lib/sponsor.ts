// lib/sponsor.ts
// The templated episode-sponsor slot for Newton Insights.
//
// Newton is a sister company (both Newton and The Dime are owned by Eighth
// Revolution LLC) and the show's standing sponsor. Only ~48 of 303 episodes
// carry a Newton link in their Simplecast show notes. This module backs a block
// rendered on *every* episode page.
//
// Anchor text is picked deterministically from the episode slug rather than
// randomly, for two reasons: 303 byte-identical anchors read as templated
// link-building, and a per-render random pick would produce a server/client
// hydration mismatch.
//
// This block previously pointed at Newton's /request-demo page. It now points at
// Newton's homepage, deliberately:
//
//   1. Over-optimization. 303 templated site-wide links carrying keyword-rich
//      anchors into a conversion page is a recognizable manipulative-link
//      footprint. Site-wide templated links are already heavily discounted;
//      pointing them at a money page with commercial anchors is the version of
//      that pattern most likely to be treated as manipulation rather than just
//      ignored. Brand anchors into a homepage is what a real sponsorship looks
//      like.
//   2. Equity distribution. The homepage is the hub that passes authority to the
//      rest of newton-insights.com, /request-demo included. Newton's internal
//      links to /request-demo were <button onClick> handlers that no crawler
//      could follow, which is the only reason direct targeting looked necessary;
//      those are now real <a href> links, so homepage equity actually reaches it.
//   3. Conversion. A listener mid-episode is cold traffic. The homepage explains
//      the product; a demo form is a high-commitment ask for someone who just
//      heard the company's name for the first time.

import { UTM, withUtm } from "./utm";

export const SPONSOR_NAME = "Newton Insights";

// Canonical org URL. Matches the @id the Newton site emits for its own
// Organization node, so the two sites' JSON-LD graphs join up. Both of these
// stay untagged deliberately — they feed JSON-LD (lib/schema.ts), where a
// tracking param would break entity reconciliation against Newton's own graph.
export const SPONSOR_URL = "https://www.newton-insights.com/";
export const SPONSOR_ORG_ID = "https://www.newton-insights.com/#organization";

// The link target: Newton's homepage (see the rationale at the top of this file).
//
// UTM parameters, not a short `ref`: GA4 only auto-parses utm_* params, and
// rel="noreferrer" on this link strips the Referer header, so a `?ref=dime` would
// have made all 303 of these links land in GA4 as direct traffic with no way to
// attribute them. utm_source matches the "Thedime" value the existing Simplecast
// show-notes links already use, so GA4 reporting stays continuous; the distinct
// medium and campaign separate this templated slot from those hand-written reads.
//
// utm_content carries the episode slug, so Newton can tell which episodes
// actually drive traffic instead of seeing one undifferentiated
// "episode_sponsor" bucket. No SEO cost from the one-parameterized-URL-per-
// episode this produces: Newton's homepage serves a self-referencing canonical,
// so they all consolidate into the clean one.
export function sponsorCtaUrl(slug: string): string {
  return withUtm(SPONSOR_URL, { ...UTM.sponsorSlot, content: slug });
}

// Brand-led anchors. Now that this points at the homepage, the mix is deliberately
// weighted toward the company name rather than commercial keywords — that is both
// the natural way to credit a sponsor and the low-risk profile for a link repeated
// 303 times. The few descriptive variants stay honest about what Newton actually
// does (inline cannabinoid sensing during extraction runs) without reading as a
// keyword list. Each has to stand on its own as a label, since both render modes
// use it that way.
// Every variant contains the brand, and none is byte-identical to another: the block's
// eyebrow already prints "Episode Sponsor · Newton Insights" directly above the link, so a
// bare "Newton Insights" anchor would render the name twice in the same box.
const ANCHOR_VARIANTS = [
  "Visit Newton Insights",
  "Learn more about Newton Insights",
  "More from Newton Insights",
  "newton-insights.com",
  "Newton Insights, the show's sponsor",
  "Newton Insights — real-time extraction monitoring",
  "See what Newton Insights builds",
  "Newton Insights, inline cannabinoid sensing",
  "Newton Insights' extraction platform",
  "How Newton Insights measures a run",
];

// Lead-in copy for the full block, also varied off the slug so the paragraph
// around the anchor isn't identical 303 times either.
const LEAD_VARIANTS = [
  "The Dime is sponsored by Newton Insights, which builds instrumentation for cannabis extraction teams.",
  "This show is supported by Newton Insights, an instrumentation company working with cannabis extraction teams.",
  "Newton Insights sponsors The Dime. They build measurement hardware for cannabis extraction.",
];

// djb2. Deterministic, stable across rebuilds and across machines — the
// point is that a given episode always renders the same anchor, so the link
// profile doesn't churn every time the site is redeployed.
function hashSlug(slug: string): number {
  let hash = 5381;
  for (let i = 0; i < slug.length; i += 1) {
    hash = ((hash << 5) + hash + slug.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function sponsorAnchorText(slug: string): string {
  return ANCHOR_VARIANTS[hashSlug(slug) % ANCHOR_VARIANTS.length];
}

export function sponsorLeadText(slug: string): string {
  // Offset the hash so the lead and the anchor don't vary in lockstep
  // (which would collapse the two lists into 10 fixed pairings).
  return LEAD_VARIANTS[(hashSlug(slug) + 7) % LEAD_VARIANTS.length];
}

// ~48 episodes already carry the sponsor read, with a live link, inside their
// Simplecast show-notes HTML, which the episode page renders verbatim. On
// those pages the templated block renders in compact mode so the page doesn't
// show the same pitch twice.
export function showNotesMentionSponsor(showNotes: string | undefined | null): boolean {
  if (!showNotes) return false;
  return /newton-insights\.com/i.test(showNotes);
}
