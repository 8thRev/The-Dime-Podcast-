// lib/utm.ts
// Attribution tagging for every outbound link the site renders.
//
// The problem this solves is the one already written up in lib/sponsor.ts:
// GA4 only auto-parses utm_* params, and links here carry rel="noopener
// noreferrer", which strips the Referer header. An untagged outbound link from
// this site is therefore completely invisible on the destination's analytics —
// it lands in the Direct bucket with no way to attribute it. Before this
// module, exactly one URL on the whole site (SPONSOR_CTA_URL) was tagged;
// every Newton link in the newsletter, every link inside the Simplecast show
// notes, and every guest company link was unattributable.
//
// Most of those links live in show-notes HTML fetched from Simplecast at build
// time, so tagging them here means the website is fully tagged without editing
// 303 episodes in Simplecast. See docs/utm-conventions.md for the strings to
// use when tagging new episodes there going forward.

export const UTM_SOURCE = "Thedime";

// Hosts that never get tagged, and why. Two groups:
//
//   1. Our own domains — an internal link with a campaign param would start a
//      new GA4 session and overwrite the real acquisition source of the
//      visitor we already have.
//   2. Destinations that strip, ignore, or never report utm_* — the big
//      podcast and social platforms give publishers no campaign reporting on
//      inbound params, so tagging buys nothing and just makes the URL uglier
//      in the one place (show notes) where readers see the raw link.
//
// Matched on the registrable domain, so subdomains are covered: an entry of
// "apple.com" also skips podcasts.apple.com.
const NEVER_TAG_HOSTS = [
  // Ours
  "dimepodcast.com",
  "thedimepodcast.com",
  // Podcast platforms
  "apple.com",
  "spotify.com",
  "simplecast.com",
  "simplecastcdn.com",
  "anchor.fm",
  // Video
  "youtube.com",
  "youtu.be",
  "ytimg.com",
  // Social
  "linkedin.com",
  "lnkd.in",
  "twitter.com",
  "x.com",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "tiktok.com",
  // Email platform (its own links, and the signup form action)
  "kit.com",
  "convertkit.com",
];

export type UtmParams = {
  medium: string;
  campaign: string;
  /** Usually the episode or edition slug, so a click resolves to one page. */
  content?: string;
};

// Exported for scripts/audit-outbound-links.mjs, which has to tell a link that
// was skipped on purpose from one the tagging pass simply missed. The auditor
// importing this predicate rather than keeping its own copy of the host list is
// the point — a duplicated list would drift and the audit would then be
// checking the tagging against itself.
export function isNeverTagHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return NEVER_TAG_HOSTS.some((d) => host === d || host.endsWith("." + d));
}

/**
 * Append UTM params to an outbound URL, or return it untouched.
 *
 * Returns `raw` unchanged when it is not a taggable outbound link: empty,
 * unparseable (relative paths, mailto:, tel:, bare #anchors), a non-http(s)
 * scheme, a NEVER_TAG_HOSTS destination, or — importantly — a URL that already
 * carries any utm_ param.
 *
 * That last rule is what lets the build-time show-notes pass coexist with
 * hand-tagged links: once a link is tagged in Simplecast it is left alone
 * rather than double-tagged, so the hand-written value always wins. It also
 * protects params that arrived with the data, e.g. share-sheet URLs that
 * already carry their own utm_source.
 *
 * Existing non-UTM query params and the hash are preserved.
 */
export function withUtm(raw: string | null | undefined, params: UtmParams): string {
  if (!raw || typeof raw !== "string") return raw || "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") return raw;
  if (isNeverTagHost(url.hostname)) return raw;

  for (const key of url.searchParams.keys()) {
    if (key.toLowerCase().startsWith("utm_")) return raw;
  }

  // Set in this order so the serialized string matches the hand-written form
  // the sponsor slot has been using since before this module existed.
  url.searchParams.set("utm_source", UTM_SOURCE);
  url.searchParams.set("utm_medium", params.medium);
  url.searchParams.set("utm_campaign", params.campaign);
  if (params.content) url.searchParams.set("utm_content", params.content);

  return url.toString();
}

// Ampersands are the only entity that realistically shows up inside an href,
// but both sources encode them and they encode them differently: the
// Simplecast feed ships "&amp;" while remark-html emits "&#x26;". Decoding
// before new URL() and re-encoding on the way out keeps the attribute valid —
// the output of this function goes straight into dangerouslySetInnerHTML.
function decodeHrefEntities(href: string): string {
  return href.replace(/&(?:amp|#38|#x26);/gi, "&");
}

function encodeHrefEntities(href: string): string {
  return href.replace(/&/g, "&amp;");
}

// Matched in two steps — the whole opening tag first, then the href inside it.
// Doing it in one pass and capturing only the attributes *before* the href
// misses a rel= that comes after it, which produces a second rel attribute on
// the tag; browsers honour the first one, so an existing rel="noopener
// noreferrer" would have been silently downgraded to rel="noopener".
//
// Quoted hrefs only. Neither the feed nor remark-html emits unquoted
// attributes, and keeping the pattern narrow is the same scoping discipline as
// unescapeMarkdownUnderscores in lib/rss.ts: a broader regex over third-party
// HTML is strictly more risk for no additional fix.
const ANCHOR_TAG_RE = /<a\b[^>]*>/gi;
const HREF_RE = /(\shref\s*=\s*)("([^"]*)"|'([^']*)')/i;

/**
 * Tag every outbound link in a block of HTML, leaving the markup otherwise
 * intact. Only the href attribute value is rewritten — tag structure, anchor
 * text and every other attribute are untouched, which is what lets callers
 * keep deriving plain-text descriptions from the result unchanged.
 *
 * Also adds rel="noopener" to anchors that get tagged and have no rel yet:
 * remark-html emits bare <a href> with no rel at all. Deliberately does not
 * add target="_blank" — the sponsor slot navigates in place and these should
 * match it.
 */
export function tagHtmlLinks(html: string, params: UtmParams): string {
  if (!html) return html;

  return html.replace(ANCHOR_TAG_RE, (tag) => {
    const found = tag.match(HREF_RE);
    if (!found) return tag;

    const [, , , doubleQuoted, singleQuoted] = found;
    const quote = doubleQuoted !== undefined ? '"' : "'";
    const original = doubleQuoted !== undefined ? doubleQuoted : singleQuoted || "";

    const href = encodeHrefEntities(withUtm(decodeHrefEntities(original), params));

    // withUtm declined this one (internal, social, already tagged, …).
    if (href === original) return tag;

    // Function replacements throughout: a URL containing "$&" or "$1" would
    // otherwise be interpreted as a replacement pattern.
    let out = tag.replace(HREF_RE, (_m, prefix: string) => `${prefix}${quote}${href}${quote}`);
    if (!/\srel\s*=/i.test(tag)) out = out.replace(/^<a\b/i, () => '<a rel="noopener"');
    return out;
  });
}

// Campaign taxonomy. Kept here rather than at each call site so the audit
// script (scripts/audit-outbound-links.mjs) can check a rendered link against
// the surface it was found on, and flag a show-notes link that somehow carries
// the sponsor-slot medium. A mislabelled link is worse than an untagged one —
// it silently pollutes a campaign the numbers get trusted from later.
export const UTM = {
  sponsorSlot: { medium: "referral", campaign: "episode_sponsor" },
  showNotes: { medium: "show_notes", campaign: "episode_show_notes" },
  guestLink: { medium: "referral", campaign: "guest_link" },
  newsletter: { medium: "newsletter", campaign: "first_principles" },
} as const;
