import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import { getAllEpisodes } from '@/lib/rss';

export default function Episodes({ allEpisodes }) {
  const [query, setQuery] = useState('');

  const filtered = allEpisodes.filter((ep) =>
    ep.title.toLowerCase().includes(query.toLowerCase()) ||
    ep.guest.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>All Episodes — The Dime Podcast</title>
        <meta name="description" content={`Browse all ${allEpisodes.length} episodes of The Dime. Conversations with cannabis founders, executives, and investors on strategy, capital, and operations.`} />
        <link rel="canonical" href="https://dimepodcast.com/episodes" />
        <meta property="og:title" content="All Episodes — The Dime Podcast" />
        <meta property="og:description" content="Browse every episode. Cannabis business intelligence, operator to operator." />
        <meta property="og:url" content="https://dimepodcast.com/episodes" />
        <meta name="twitter:title" content="All Episodes — The Dime Podcast" />
        <meta name="twitter:description" content={`Browse all ${allEpisodes?.length || '295'}+ episodes. Cannabis founders, executives, and investors.`} />
      </Head>
      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Archive · {allEpisodes.length} Episodes</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,88px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.9 }}>
            All Episodes
          </h1>
          <input
            placeholder="Search guest, topic, title..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 280, background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', outline: 'none' }}
          />
        </div>

        {filtered.map((ep, i) => (
          <Link
            key={i}
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
              <div className="syne" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '.04em' }}>
                {ep.guest}
              </div>
              <p className="crimson" style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 600, fontWeight: 300 }}>
                {ep.description}
              </p>
            </div>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', paddingTop: 2 }}>
              {ep.duration}
            </div>
          </Link>
        ))}

        {!filtered.length && (
          <p className="crimson" style={{ color: 'var(--text-muted)', padding: '48px 0', fontSize: 16 }}>
            No episodes found.
          </p>
        )}
      </section>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const allEpisodes = await getAllEpisodes();
  return {
    props: {
      allEpisodes,
    },
    revalidate: 3600,
  };
}
