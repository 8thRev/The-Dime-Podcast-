// lib/rss.ts
// Fetches and parses The Dime RSS feed from Simplecast at build time.

import Parser from "rss-parser";

const FEED_URL = "https://feeds.simplecast.com/Vnrz0StH";

type CustomItem = {
  title: string;
  pubDate: string;
  "content:encoded": string;
  enclosure: { url: string; length: string; type: string };
  guid: string;
  link: string;
  itunes: {
    duration: string;
    summary: string;
    image?: string;
    episode?: string;
    keywords?: string;
  };
  "simplecast:episode_id"?: string;
};

export type Episode = {
  id: string;
  slug: string;
  legacySlug: string;
  num: string;
  title: string;
  guest: string;
  company: string;
  companyUrl: string;
  date: string;
  dateISO: string;
  duration: string;
  durationISO: string;
  description: string;
  showNotes: string;
  audioUrl: string;
  tags: string[];
  playerUrl: string;
};

const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["itunes:duration", "itunes.duration"],
      ["itunes:summary", "itunes.summary"],
      ["itunes:image", "itunes.image"],
      ["itunes:episode", "itunes.episode"],
      ["itunes:keywords", "itunes.keywords"],
    ],
  },
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}

function extractGuest(title: string): { guest: string; company: string } {
  // Patterns: "Title ft. Guest Name", "Title with Guest Name", "Guest Name: Title"
  const ftMatch = title.match(/ft\.?\s+([^,\n]+?)(?:\s*,|\s*$)/i);
  const withMatch = title.match(/with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  const colonMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+):\s/);

  const guest = ftMatch?.[1] || withMatch?.[1] || colonMatch?.[1] || "Guest";
  return { guest: guest.trim(), company: "" };
}

function formatDuration(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }
  if (parts.length === 2) {
    const [m] = parts;
    return `${m} min`;
  }
  const mins = Math.floor(Number(raw) / 60);
  return `${mins} min`;
}

// schema.org/Google structured data requires ISO 8601 duration (PT1H23M45S),
// not the "1h 23m" display string from formatDuration().
function formatDurationISO(raw: string): string {
  if (!raw) return "";
  let totalSeconds: number;
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    totalSeconds = h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    totalSeconds = m * 60 + s;
  } else {
    totalSeconds = Number(raw) || 0;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 ? `${m}M` : ""}${s > 0 || (h === 0 && m === 0) ? `${s}S` : ""}`;
}

function extractSimplecastId(guid: string, link: string): string {
  // Extract UUID from guid (Simplecast uses UUID format)
  const guidMatch = guid?.match(/([a-f0-9-]{36})/);
  if (guidMatch) return guidMatch[1];
  // Fallback to short code from link
  const linkMatch = link?.match(/-([a-zA-Z0-9]{8})(?:\?|$)/);
  if (linkMatch) return linkMatch[1];
  return guid || "";
}

// Domains to skip when auto-detecting company links from show notes
const SKIP_DOMAINS = [
  "linkedin.com", "twitter.com", "x.com", "instagram.com", "youtube.com",
  "facebook.com", "tiktok.com", "spotify.com", "podcasts.apple.com",
  "dimepodcast.com", "thedimepodcast.com", "8threv.com", "eighthrev.com",
  "simplecast.com", "anchor.fm", "buzzsprout.com",
];

// "organigram.ca" -> "Organigram", "cryocure.com" -> "Cryocure". Multi-word
// domains with no separator (e.g. "ajnabiosciences.com") stay mashed
// together — imperfect, but still a correct link with a readable-enough
// label, which is what matters for an auto-detected fallback.
function hostnameToCompanyName(hostname: string): string {
  const dot = hostname.lastIndexOf(".");
  const base = dot === -1 ? hostname : hostname.slice(0, dot);
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Company links are only auto-detected from the show notes' "Guest Links"
// section (heading text varies a little: "Guest Links:", "Guest Links",
// "Follow Guest Links"). About half of episodes don't have one — those get
// no auto-detected company rather than a guessed one. Scanning the *whole*
// show notes (the old approach) reliably picked up the "Newton Insights"
// sponsor read or the "Eighth Revolution" footer link instead, since both
// appear in every episode's boilerplate and neither is on SKIP_DOMAINS.
function extractCompanyFromShowNotes(html: string): { company: string; companyUrl: string } {
  const headingMatch = html.match(/guest\s*links?\s*:?\s*<\/(?:strong|b)>\s*<\/p>/i);
  if (!headingMatch || headingMatch.index === undefined) return { company: "", companyUrl: "" };

  const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);
  // The "Our Links" heading text varies ("Our Links:", "Follow us: Our
  // Links.") and a few episodes skip it entirely, going straight into the
  // boilerplate — but every episode's boilerplate links Bryan's Twitter/X
  // and the "Eighth Revolution" sponsor site, so those are more reliable
  // end-of-guest-links boundaries than the heading itself.
  const headingEndMatch = afterHeading.match(/our\s*links?/i);
  const boilerplateMatch = afterHeading.match(
    /href=["']https?:\/\/(?:www\.)?(?:(?:x|twitter)\.com\/BryanFields24|eighthrevolution\.com)/i
  );
  const endIndex = [headingEndMatch?.index, boilerplateMatch?.index]
    .filter((i): i is number => i !== undefined)
    .sort((a, b) => a - b)[0];
  const section = endIndex !== undefined ? afterHeading.slice(0, endIndex) : afterHeading;

  // Guest links show up both as <a href> tags and as bare text URLs
  // (some episodes never wrap them in an anchor at all).
  const urlRe = /(https?:\/\/[^\s"'<>)]+)|(\bwww\.[^\s"'<>)]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(section)) !== null) {
    let raw = (match[1] || `https://${match[2]}`).replace(/[.,;)]+$/, "");
    // A few episodes' show notes have the guest link literally pasted twice
    // in a row with no separator (e.g. "https://x.com/https://x.com/") —
    // truncate at the second scheme so we don't publish the glued-together
    // string as a link.
    const secondScheme = raw.indexOf("http", 8);
    if (secondScheme > 0) raw = raw.slice(0, secondScheme);
    try {
      const url = new URL(raw);
      const hostname = url.hostname.replace(/^www\./, "");
      if (SKIP_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d))) continue;
      return { company: hostnameToCompanyName(hostname), companyUrl: raw };
    } catch {
      continue;
    }
  }
  return { company: "", companyUrl: "" };
}

// Manual overrides — takes precedence over auto-detection.
// Use when the show notes don't link the company or the wrong link is detected.
const GUEST_COMPANY_MAP: Record<string, { company: string; companyUrl: string }> = {
  "Aubrey Amatelli": { company: "PayRio", companyUrl: "https://www.payrio.co" },
};

let cachedEpisodes: Episode[] | null = null;

export async function getAllEpisodes(): Promise<Episode[]> {
  if (cachedEpisodes) return cachedEpisodes;

  try {
    const feed = await parser.parseURL(FEED_URL);

    cachedEpisodes = feed.items.map((item, index) => {
      const { guest, company: extractedCompany } = extractGuest(item.title || "");
      const showNotesRaw = item["content:encoded"] || item.itunes?.summary || "";
      const companyOverride = GUEST_COMPANY_MAP[guest];
      const autoDetected = companyOverride ? { company: "", companyUrl: "" } : extractCompanyFromShowNotes(showNotesRaw);
      const company = companyOverride?.company || autoDetected.company || extractedCompany;
      const companyUrl = companyOverride?.companyUrl || autoDetected.companyUrl || "";
      const id = extractSimplecastId(item.guid || "", item.link || "");
      const epNum = item.itunes?.episode || String(feed.items.length - index);
      const tags = item.itunes?.keywords?.split(",").map((k) => k.trim()).filter(Boolean) || [];
      const showNotes = showNotesRaw;
      const description = showNotes.replace(/<[^>]+>/g, "").slice(0, 220) + "...";

      const fullSlug = slugify(item.title || "");
      const truncatedSlug = fullSlug.slice(0, 80).replace(/-+$/, "");

      return {
        id,
        slug: fullSlug,
        legacySlug: truncatedSlug !== fullSlug ? truncatedSlug : "",
        num: epNum,
        title: item.title || "",
        guest,
        company,
        companyUrl,
        date: new Date(item.pubDate || "").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        dateISO: new Date(item.pubDate || "").toISOString(),
        duration: formatDuration(item.itunes?.duration || ""),
        durationISO: formatDurationISO(item.itunes?.duration || ""),
        description,
        showNotes,
        audioUrl: item.enclosure?.url || "",
        tags: tags.slice(0, 5),
        playerUrl: `https://player.simplecast.com/${id}?dark=true&color=00C9A7`,
      };
    });

    return cachedEpisodes;
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return [];
  }
}

// Simplecast's itunes:episode numbering has a few duplicate/skipped
// numbers, so it doesn't equal episodes.length. Use the highest episode
// number so displayed counts match the "Ep. N" badges shown elsewhere.
export function getLatestEpisodeNumber(episodes: Episode[]): number {
  return episodes.reduce((max, ep) => {
    const n = parseInt(ep.num, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, episodes.length);
}

export async function getEpisodeBySlug(slug: string): Promise<Episode | null> {
  const episodes = await getAllEpisodes();
  return episodes.find((ep) => ep.slug === slug || ep.legacySlug === slug) || null;
}

export async function getEpisodesByTag(tag: string): Promise<Episode[]> {
  const episodes = await getAllEpisodes();
  return episodes.filter((ep) =>
    ep.tags.some((t) => t.toLowerCase().includes(tag.toLowerCase())) ||
    ep.title.toLowerCase().includes(tag.toLowerCase()) ||
    ep.showNotes.toLowerCase().includes(tag.toLowerCase())
  );
}
