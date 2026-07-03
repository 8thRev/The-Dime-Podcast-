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

function extractCompanyFromShowNotes(html: string): { company: string; companyUrl: string } {
  const linkRe = /<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRe.exec(html)) !== null) {
    const href = match[1].trim();
    const text = match[2].replace(/<[^>]+>/g, "").trim();
    if (!href.startsWith("http") || !text) continue;
    try {
      const hostname = new URL(href).hostname.replace(/^www\./, "");
      if (SKIP_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d))) continue;
    } catch {
      continue;
    }
    return { company: text, companyUrl: href };
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
      const plainShowNotes = showNotes.replace(/<[^>]+>/g, "").trim();
      const description = plainShowNotes.length > 220 ? `${plainShowNotes.slice(0, 220)}...` : plainShowNotes;

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
