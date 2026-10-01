// lib/guests.ts
// Guest entity page helpers. Unlike topics.ts, this needs no separate data
// source: app/lib/rss.ts already extracts the guest, the curated company
// (GUEST_COMPANY_MAP only) and the show notes' guest link per episode, so an
// entity page is just that data grouped by guest.
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
  guestLink: string;
  guestLinkLabel: string;
  episodeCount: number;
};

type GuestAccumulator = Omit<GuestSummary, "slug" | "episodeCount"> & { count: number };

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
  const bySlug = new Map<string, GuestAccumulator>();

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
      // No backfill for the guest link, unlike the curated company above.
      // Episodes arrive newest first, so `existing` already holds the newest
      // appearance's link, or none. An older episode's link is what someone
      // pointed to then, and on /guests/jamie-pearson that was a previous
      // firm standing in for the current one.
    } else {
      bySlug.set(slug, {
        name: ep.guest,
        company: ep.company,
        companyUrl: ep.companyUrl,
        guestLink: ep.guestLink,
        guestLinkLabel: ep.guestLinkLabel,
        count: 1,
      });
    }
  }

  return Array.from(bySlug.entries())
    .map(([slug, { count, ...g }]) => ({ slug, ...g, episodeCount: count }))
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
