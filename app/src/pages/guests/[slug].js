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
      />

      <Schema schema={personSchema} />
      <Schema schema={breadcrumbSchema} />

      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <Link href="/guests" style={{ color: 'var(--text-accent)', textDecoration: 'none', marginBottom: '32px', display: 'block', fontWeight: 600 }}>
          ← All Guests
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 24 }}>
          <GuestAvatar name={guest.name} size={72} />
          <div>
            <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>
              Guest · {guest.episodeCount} Episode{guest.episodeCount === 1 ? '' : 's'}
            </div>
            <h1 className="syne" style={{ fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 1 }}>
              {guest.name}
            </h1>
            {guest.company && (
              <div className="mono" style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: 8 }}>
                {guest.companyUrl ? (
                  <a href={guest.companyUrl} rel="noopener" target="_blank" style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {guest.company}
                  </a>
                ) : (
                  guest.company
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      <section style={{ padding: '48px' }}>
        <h2 className="mono" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 24 }}>
          Episodes with {guest.name}
        </h2>

        {episodes.map((ep) => (
          <Link
            key={ep.slug}
            href={`/episodes/${ep.slug}`}
            style={{
              padding: '28px 0',
              borderBottom: '1px solid var(--faint)',
              transition: 'background .15s',
              cursor: 'pointer',
              display: 'grid',
              gridTemplateColumns: '60px 1fr 80px',
              gap: 28,
              alignItems: 'start',
              textDecoration: 'none',
              color: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(60,184,240,.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <div>
              <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', letterSpacing: '.12em' }}>Ep.{ep.num}</div>
              <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: 4 }}>
                {ep.date}
              </div>
            </div>
            <div>
              <div className="crimson" style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-headline)', marginBottom: 8, lineHeight: 1.25 }}>
                {ep.title}
              </div>
            </div>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', paddingTop: 2 }}>
              {ep.duration}
            </div>
          </Link>
        ))}
      </section>

      {editions.length > 0 && (
        <section style={{ padding: '0 48px 48px' }}>
          <h2 className="mono" style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 24 }}>
            Written analysis
          </h2>
          {editions.map((e) => (
            <Link
              key={e.slug}
              href={`/newsletter/${e.slug}`}
              style={{ display: 'block', padding: '20px 0', borderBottom: '1px solid var(--faint)', textDecoration: 'none', color: 'inherit' }}
              onMouseEnter={(ev) => { ev.currentTarget.style.background = 'rgba(60,184,240,.04)'; }}
              onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}
            >
              <div className="crimson" style={{ fontSize: '19px', fontWeight: 600, color: 'var(--text-headline)', marginBottom: 6, lineHeight: 1.3 }}>
                {e.title}
              </div>
              <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                First Principles{e.dateDisplay && ` · ${e.dateDisplay}`}
              </div>
            </Link>
          ))}
        </section>
      )}

      <Footer />
    </>
  );
}
