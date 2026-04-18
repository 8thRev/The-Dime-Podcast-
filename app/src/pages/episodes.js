import { useState } from 'react';
import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import { fetchEpisodes } from '@/src/lib/simplecast';

export default function Episodes({ allEpisodes }) {
  const [query, setQuery] = useState('');

  const filtered = allEpisodes.filter((ep) =>
    ep.title.toLowerCase().includes(query.toLowerCase()) ||
    ep.guest.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <>
      <Head>
        <title>Episodes - The Dime Podcast</title>
      </Head>
      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 12 }}>Archive · {allEpisodes.length} Episodes</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,88px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.9 }}>
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
          <div
            key={i}
            style={{
              padding: '28px 0',
              borderBottom: '1px solid var(--faint)',
              transition: 'background .15s',
              cursor: 'default',
              display: 'grid',
              gridTemplateColumns: '60px 1fr 80px',
              gap: 28,
              alignItems: 'start',
            }}
          >
            <div>
              <div className="mono" style={{ fontSize: '9px', color: '#00C9A7', letterSpacing: '.12em' }}>Ep.{ep.id}</div>
              <div className="mono" style={{ fontSize: '9px', color: '#3A4F66', marginTop: 4 }}>
                {new Date(ep.pubDate).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="crimson" style={{ fontSize: '21px', fontWeight: 600, color: '#E8E4DC', marginBottom: 8, lineHeight: 1.25 }}>
                {ep.title}
              </div>
              <div className="syne" style={{ fontSize: '11px', fontWeight: 600, color: '#7A8FA8', marginBottom: 10, letterSpacing: '.04em' }}>
                {ep.guest}
              </div>
              <p className="crimson" style={{ fontSize: '14px', color: '#3A4F66', lineHeight: 1.75, maxWidth: 600, fontWeight: 300 }}>
                {ep.description}
              </p>
            </div>
            <div className="mono" style={{ fontSize: '10px', color: '#3A4F66', textAlign: 'right', paddingTop: 2 }}>
              {ep.duration}
            </div>
          </div>
        ))}

        {!filtered.length && (
          <p className="crimson" style={{ color: '#3A4F66', padding: '48px 0', fontSize: 16 }}>
            No episodes found.
          </p>
        )}
      </section>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const allEpisodes = await fetchEpisodes();
  return {
    props: {
      allEpisodes,
    },
    revalidate: 3600,
  };
}
