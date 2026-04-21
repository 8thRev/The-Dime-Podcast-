import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import { getAllVideos } from '@/lib/youtube';

export default function Videos({ allVideos }) {
  const [query, setQuery] = useState('');

  const filtered = allVideos.filter((v) =>
    v.title.toLowerCase().includes(query.toLowerCase()) ||
    v.description.toLowerCase().includes(query.toLowerCase()) ||
    v.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <>
      <Head>
        <title>Video Library — The Dime Podcast</title>
        <meta name="description" content={`Full video library from The Dime Podcast YouTube channel. ${allVideos.length} videos featuring cannabis founders, operators, and executives.`} />
        <link rel="canonical" href="https://thedime.com/videos" />
        <meta property="og:title" content="Video Library — The Dime Podcast" />
        <meta property="og:description" content="Every conversation on video. Cannabis business intelligence from The Dime Podcast YouTube channel." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thedime.com/videos" />
        <meta name="twitter:title" content="Video Library — The Dime Podcast" />
        <meta name="twitter:description" content="Every conversation on video. Cannabis founders, operators, and executives." />
      </Head>
      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
          Video Library · {allVideos.length} Videos
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,88px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.9 }}>
            Video Library
          </h1>
          <input
            placeholder="Search title, topic..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: 280, background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', outline: 'none' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 24, marginBottom: 60 }}>
          {filtered.map((v) => (
            <Link
              key={v.slug}
              href={`/videos/${v.slug}`}
              style={{ textDecoration: 'none', color: 'inherit', transition: 'transform .15s', cursor: 'pointer', display: 'block' }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ aspectRatio: '16/9', background: 'var(--bg-elevated)', overflow: 'hidden' }}>
                  <img src={v.thumbnail} alt={v.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
                <div style={{ padding: '16px' }}>
                  <div className="crimson" style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-headline)', marginBottom: 8, lineHeight: 1.3 }}>
                    {v.title}
                  </div>
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {v.date} · {v.duration}
                  </div>
                  <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                    {v.viewCount}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {!filtered.length && (
          <p className="crimson" style={{ color: 'var(--text-muted)', padding: '48px 0', fontSize: 16 }}>
            No videos found.
          </p>
        )}
      </section>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const allVideos = await getAllVideos();
  return {
    props: {
      allVideos: allVideos.length > 0 ? allVideos : [],
    },
    revalidate: 3600,
  };
}
