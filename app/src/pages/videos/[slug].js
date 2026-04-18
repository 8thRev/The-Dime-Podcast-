// src/pages/videos/[slug].js
// Dynamic video detail page

import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import { getAllVideos, getVideoBySlug } from '@/lib/youtube';
import { createVideoObjectSchema } from '@/lib/schema';

export async function getStaticPaths() {
  const videos = await getAllVideos();
  const paths = videos.map((v) => ({
    params: { slug: v.slug },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const video = await getVideoBySlug(params.slug);
  const allVideos = await getAllVideos();

  if (!video) {
    return { notFound: true };
  }

  const relatedVideos = allVideos
    .filter((v) => v.id !== video.id)
    .slice(0, 5);

  return {
    props: {
      video,
      relatedVideos,
    },
    revalidate: 3600,
  };
}

export default function VideoPage({ video, relatedVideos }) {
  const schema = createVideoObjectSchema(video);

  return (
    <>
      <Head>
        <title>{video.title} - The Dime Podcast</title>
        <meta name="description" content={video.description} />
        <meta property="og:title" content={video.title} />
        <meta property="og:description" content={video.description} />
        <meta property="og:type" content="video.other" />
        <meta property="og:url" content={`https://thedime.com/videos/${video.slug}`} />
        <meta property="og:image" content={video.thumbnail} />
      </Head>

      <Schema schema={schema} />

      <Header />

      <article style={{ padding: '48px', maxWidth: '900px', margin: '0 auto' }}>
        <Link href="/videos" style={{ color: 'var(--mid)', textDecoration: 'none', marginBottom: '32px', display: 'block' }}>
          ← All Videos
        </Link>

        <header style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {video.date}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {video.duration}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--muted)' }}>
              {video.viewCount}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 'normal', lineHeight: 1.2, marginBottom: '24px', fontFamily: 'Georgia, serif' }}>
            {video.title}
          </h1>

          {video.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '40px' }}>
              {video.tags.map((tag) => (
                <span
                  key={tag}
                  className="mono"
                  style={{
                    fontSize: '10px',
                    color: 'var(--teal)',
                    border: '1px solid var(--teal)',
                    padding: '4px 12px',
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <section style={{ marginBottom: '48px', background: 'var(--navy2)', borderRadius: '4px', overflow: 'hidden' }}>
          <iframe
            style={{
              width: '100%',
              aspectRatio: '16/9',
              border: 'none',
            }}
            src={video.embedUrl}
            title={video.title}
            allow="autoplay; fullscreen"
            allowFullScreen
          />
        </section>

        <section style={{ marginBottom: '80px' }}>
          <p style={{ fontSize: '16px', lineHeight: '1.8', color: 'var(--mid)', fontFamily: 'Georgia, serif', whiteSpace: 'pre-wrap' }}>
            {video.description}
          </p>

          <Link
            href={video.watchUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block',
              marginTop: '24px',
              padding: '12px 32px',
              background: 'var(--teal)',
              color: 'var(--navy)',
              textDecoration: 'none',
              fontFamily: "'Syne', sans-serif",
              fontSize: '11px',
              fontWeight: '700',
              letterSpacing: '.14em',
              textTransform: 'uppercase',
              borderRadius: '2px',
              transition: 'opacity .15s',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            Watch on YouTube
          </Link>
        </section>

        {relatedVideos.length > 0 && (
          <aside style={{ paddingTop: '32px', borderTop: '1px solid var(--border)' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>
              More Videos
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '24px' }}>
              {relatedVideos.map((v) => (
                <Link
                  key={v.slug}
                  href={`/videos/${v.slug}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'transform .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'translateY(-4px)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                >
                  <div style={{ aspectRatio: '16/9', background: 'var(--navy2)', borderRadius: '4px', overflow: 'hidden', marginBottom: '12px' }}>
                    <img
                      src={v.thumbnail}
                      alt={v.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  </div>
                  <div style={{ fontSize: '13px', fontWeight: '500', marginBottom: '4px', fontFamily: 'Georgia, serif', lineHeight: 1.3 }}>
                    {v.title}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: "'Syne', sans-serif" }}>
                    {v.date}
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </article>

      <Footer />
    </>
  );
}
