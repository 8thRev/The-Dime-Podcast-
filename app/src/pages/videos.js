import { useState } from 'react';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllVideos } from '@/lib/youtube';
import { createCollectionPageSchema } from '@/lib/schema';

export default function Videos({ allVideos }) {
  const [query, setQuery] = useState('');

  const filtered = allVideos.filter((v) =>
    v.title.toLowerCase().includes(query.toLowerCase()) ||
    v.description.toLowerCase().includes(query.toLowerCase()) ||
    v.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  const collectionSchema = createCollectionPageSchema(
    {
      name: 'Video Library — The Dime Podcast',
      description: `Full video library from The Dime Podcast YouTube channel. ${allVideos.length} videos.`,
      url: 'https://www.dimepodcast.com/videos',
    },
    allVideos.slice(0, 50).map((v) => ({
      name: v.title,
      url: `https://www.dimepodcast.com/videos/${v.slug}`,
    }))
  );

  return (
    <>
      <SeoHead
        title="Video Library"
        description={`Full video library from The Dime Podcast YouTube channel. ${allVideos.length} videos featuring cannabis founders, operators, and executives.`}
        path="/videos"
      />
      <Schema schema={collectionSchema} />
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px', marginBottom: 48, background: 'var(--navy2)', border: '1px solid var(--border)', borderRadius: '4px' }}>
          <span className="crimson" style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            New episode every week — never miss one.
          </span>
          <a
            href="https://www.youtube.com/@theDime_Cannabis?sub_confirmation=1"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-teal"
            style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            Subscribe on YouTube
          </a>
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
                  <img src={v.thumbnail} alt={v.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
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
