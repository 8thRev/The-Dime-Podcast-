// lib/guests.ts
// Guest entity page helpers. Unlike topics.ts, this needs no separate data
// source — app/lib/rss.ts already extracts guest/company/companyUrl per
// episode (from the RSS title + GUEST_COMPANY_MAP), so an entity page is
// just that data grouped by guest.
//
// Scope note: a composite credit like "Kristin & Eric Rogers" is treated as
// one entity for now rather than split into two people — splitting these
// reliably needs real name-parsing, not a quick regex, so it's left as a
// known follow-up rather than guessed at here.

import { getAllEpisodes, type Episode } from "./rss";

export type GuestSummary = {
  name: string;
  slug: string;
  company: string;
  companyUrl: string;
  episodeCount: number;
};

export function guestToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}

// extractGuest() in rss.ts falls back to the literal string "Guest" when it
// can't parse a name out of the episode title — those aren't real entities.
function isRealGuest(name: string): boolean {
  return !!name && name !== "Guest";
}

export async function getAllGuests(): Promise<GuestSummary[]> {
  const episodes = await getAllEpisodes();
  const bySlug = new Map<string, { name: string; company: string; companyUrl: string; count: number }>();

  for (const ep of episodes) {
    if (!isRealGuest(ep.guest)) continue;
    const slug = guestToSlug(ep.guest);
    const existing = bySlug.get(slug);
    if (existing) {
      existing.count += 1;
      // Prefer whichever episode actually has company info, in case an
      // earlier appearance predates a GUEST_COMPANY_MAP entry.
      if (!existing.company && ep.company) {
        existing.company = ep.company;
        existing.companyUrl = ep.companyUrl;
      }
    } else {
      bySlug.set(slug, { name: ep.guest, company: ep.company, companyUrl: ep.companyUrl, count: 1 });
    }
  }

  return Array.from(bySlug.entries())
    .map(([slug, g]) => ({ slug, name: g.name, company: g.company, companyUrl: g.companyUrl, episodeCount: g.count }))
    .sort((a, b) => b.episodeCount - a.episodeCount || a.name.localeCompare(b.name));
}

export async function getGuestBySlug(
  slug: string
): Promise<{ guest: GuestSummary; episodes: Episode[] } | null> {
  const guests = await getAllGuests();
  const guest = guests.find((g) => g.slug === slug);
  if (!guest) return null;

  const episodes = await getAllEpisodes();
  const guestEpisodes = episodes
    .filter((ep) => isRealGuest(ep.guest) && guestToSlug(ep.guest) === slug)
    .sort((a, b) => new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime());

  return { guest, episodes: guestEpisodes };
}
