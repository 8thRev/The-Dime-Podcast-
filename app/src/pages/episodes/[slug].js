// src/pages/episodes/[slug].js
// Dynamic episode detail page

import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import { getAllEpisodes, getEpisodeBySlug } from '@/lib/rss';
import { createPodcastEpisodeSchema } from '@/lib/schema';

export async function getStaticPaths() {
  const episodes = await getAllEpisodes();
  const paths = episodes.map((ep) => ({
    params: { slug: ep.slug },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const episode = await getEpisodeBySlug(params.slug);
  const allEpisodes = await getAllEpisodes();

  if (!episode) {
    return { notFound: true };
  }

  const relatedEpisodes = allEpisodes
    .filter((e) => e.num !== episode.num)
    .slice(0, 5);

  return {
    props: {
      episode,
      relatedEpisodes,
    },
    revalidate: 3600,
  };
}

export default function EpisodePage({ episode, relatedEpisodes }) {
  const schema = createPodcastEpisodeSchema(episode);

  return (
    <>
      <Head>
        <title>{episode.title} - The Dime Podcast</title>
        <meta name="description" content={episode.description} />
        <meta property="og:title" content={episode.title} />
        <meta property="og:description" content={episode.description} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://thedime.com/episodes/${episode.slug}`} />
      </Head>

      <Schema schema={schema} />

      <Header />

      <article style={{ padding: '48px', maxWidth: '900px', margin: '0 auto' }}>
        <Link href="/episodes" style={{ color: 'var(--text-accent)', textDecoration: 'none', marginBottom: '32px', display: 'block', fontWeight: 600 }}>
          ← All Episodes
        </Link>

        <header style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-accent)', fontWeight: 700 }}>
              Ep. {episode.num}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {episode.date}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {episode.duration}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, lineHeight: 1.2, marginBottom: '24px', fontFamily: "'Syne', sans-serif", color: 'var(--text-headline)' }}>
            {episode.title}
          </h1>

          <div style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '32px', fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic', fontWeight: 500 }}>
            {episode.guest}
            {episode.company && <span style={{ color: 'var(--text-muted)' }}> / {episode.company}</span>}
          </div>

          {episode.tags.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '40px' }}>
              {episode.tags.map((tag) => (
                <span
                  key={tag}
                  className="mono"
                  style={{
                    fontSize: '10px',
                    color: 'var(--text-accent)',
                    border: '1px solid var(--text-accent)',
                    padding: '4px 12px',
                    fontWeight: 700,
                  }}
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <section style={{ marginBottom: '48px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '24px', borderRadius: '8px' }}>
          <div style={{ marginBottom: '16px', fontSize: '11px', fontWeight: '600', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Listen Now
          </div>
          <audio
            controls
            style={{
              width: '100%',
              height: '40px',
              accentColor: 'var(--text-accent)',
            }}
            src={episode.audioUrl}
            title={episode.title}
          />
        </section>

        <section style={{ marginBottom: '80px' }}>
          <p style={{ fontSize: '16px', lineHeight: '1.8', color: 'var(--text-secondary)', fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic', fontWeight: 400 }}>
            {episode.description}
          </p>

          {episode.showNotes && (
            <div style={{ marginTop: '32px', padding: '24px', background: 'var(--bg-surface)', borderLeft: '3px solid var(--text-accent)', borderRadius: '4px' }}>
              <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-headline)' }}>
                Full Show Notes
              </h3>
              <div
                style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: episode.showNotes }}
              />
            </div>
          )}
        </section>

        {relatedEpisodes.length > 0 && (
          <aside style={{ paddingTop: '32px', borderTop: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)' }}>
              More Episodes
            </h3>
            <div style={{ display: 'grid', gap: '0' }}>
              {relatedEpisodes.map((ep) => (
                <Link
                  key={ep.slug}
                  href={`/episodes/${ep.slug}`}
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', fontFamily: "'Crimson Pro', Georgia, serif", color: 'var(--text-headline)' }}>
                    {ep.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Syne', sans-serif" }}>
                    {ep.guest} · {ep.date.split(',')[0]}
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
