// src/pages/guests/[slug].js
// Guest entity page — one per real guest name extracted from the RSS feed
// (app/lib/guests.ts). Each name is a live, currently-invisible search
// query ("[Name] cannabis podcast") this makes indexable for the first time.

import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import GuestAvatar from '@/src/components/GuestAvatar';
import { getAllGuests, getGuestBySlug } from '@/lib/guests';
import { getEditionsForGuest, toListItem } from '@/lib/newsletter';
import { createPersonSchema, createBreadcrumbSchema } from '@/lib/schema';

export async function getStaticPaths() {
  const guests = await getAllGuests();
  return {
    paths: guests.map((g) => ({ params: { slug: g.slug } })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const result = await getGuestBySlug(params.slug);
  if (!result) {
    return { notFound: true };
  }

  return {
    props: {
      guest: result.guest,
      episodes: result.episodes,
      editions: getEditionsForGuest(params.slug).map(toListItem),
    },
    revalidate: 3600,
  };
}

export default function GuestPage({ guest, episodes, editions = [] }) {
  const personSchema = createPersonSchema({
    name: guest.name,
    slug: guest.slug,
    company: guest.company || undefined,
    companyUrl: guest.companyUrl || undefined,
  });
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com' },
    { name: 'Guests', url: 'https://www.dimepodcast.com/guests' },
    { name: guest.name, url: `https://www.dimepodcast.com/guests/${guest.slug}` },
  ]);

  const description = guest.company
    ? `${guest.name} (${guest.company}) has appeared on The Dime Podcast ${guest.episodeCount} time${guest.episodeCount === 1 ? '' : 's'} — cannabis business conversations on strategy, capital, and operations.`
    : `${guest.name} has appeared on The Dime Podcast ${guest.episodeCount} time${guest.episodeCount === 1 ? '' : 's'} — cannabis business conversations on strategy, capital, and operations.`;

  return (
    <>
      <SeoHead
        title={guest.name}
        description={description}
        path={`/guests/${guest.slug}`}
        ogType="profile"
        markdownAlternate
      />

      <Schema schema={personSchema} />
      <Schema schema={breadcrumbSchema} />

      <Header />

      <section className="band">
        <div className="wrap page-head">
        <Link href="/guests" className="back-link">
          ← All Guests
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
          <GuestAvatar name={guest.name} size={72} />
          <div>
            <span className="eyebrow">Guest · {guest.episodeCount} Episode{guest.episodeCount === 1 ? '' : 's'}</span>
            <h1 className="page-title page-title--article" style={{ marginTop: 8 }}>
              {guest.name}
            </h1>
            {guest.company ? (
              <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8 }}>
                {guest.companyUrl ? (
                  <a href={guest.companyUrl} rel="noopener" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {guest.company}
                  </a>
                ) : (
                  guest.company
                )}
              </div>
            ) : guest.guestLink ? (
              // Shown as the link it is, not as an employer: see
              // GUEST_COMPANY_MAP in lib/rss.ts.
              <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8 }}>
                {'Show notes link: '}
                <a href={guest.guestLink} rel="noopener" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
                  {guest.guestLinkLabel}
                </a>
              </div>
            ) : null}
          </div>
        </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ paddingTop: 'clamp(32px, 5vw, 48px)' }}>
        <h2 className="section-label">Episodes with {guest.name}</h2>

        {episodes.map((ep) => (
          <Link key={ep.slug} href={`/episodes/${ep.slug}`} className="list-row">
            <div className="list-meta">
              <span className="num">Ep. {ep.num}</span>
              <span>{ep.date}</span>
              {ep.duration && <span>{ep.duration}</span>}
            </div>
            <div>
              <div className="list-title">{ep.title}</div>
            </div>
          </Link>
        ))}
        </div>
      </section>

      {editions.length > 0 && (
        <section>
          <div className="wrap" style={{ paddingTop: 'clamp(32px, 5vw, 48px)', paddingBottom: 'clamp(56px, 8vw, 96px)' }}>
          <h2 className="section-label">Written analysis</h2>
          {editions.map((e) => (
            <Link
              key={e.slug}
              href={`/newsletter/${e.slug}`}
              style={{ display: 'block', padding: '20px 0', borderBottom: '1px solid var(--faint)', textDecoration: 'none', color: 'inherit' }}
              onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(60,184,240,.04)'; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            >
              <div className="list-title" style={{ fontSize: '22px' }}>
                {e.title}
              </div>
              <div className="meta" style={{ marginTop: 6 }}>
                First Principles{e.dateDisplay && ` · ${e.dateDisplay}`}
              </div>
            </Link>
          ))}
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
