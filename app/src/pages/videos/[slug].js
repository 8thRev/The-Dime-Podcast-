// src/pages/videos/[slug].js
// Dynamic video detail page

import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllVideos, getVideoBySlug } from '@/lib/youtube';
import { createVideoObjectSchema } from '@/lib/schema';
import { getEpisodeSlugForVideo } from '@/lib/videoEpisodeMap';
import { getEpisodeBySlug } from '@/lib/rss';

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

  // 301 redirect old truncated slug → full slug (mirrors episode handling)
  if (video.legacySlug && params.slug === video.legacySlug) {
    return {
      redirect: { destination: `/videos/${video.slug}`, permanent: true },
    };
  }

  // Score by shared tags, then recency — mirroring the episode page's
  // relatedEpisodes selection. The previous `.slice(0, 5)` took the first five
  // of the catalogue for every video, so the same 5 URLs collected ~286
  // inbound links each while the other 281 had exactly one (from /videos).
  // That concentrated the whole video section's internal link equity on an
  // arbitrary five and left the rest effectively unlinked.
  //
  // 56 of 287 videos carry no tags; those score 0 against everything and fall
  // through to the recency tiebreak, which is the intended behaviour rather
  // than a degenerate case.
  const relatedVideos = allVideos
    .filter((v) => v.id !== video.id)
    .sort((a, b) => {
      const tagOverlap = (v) => (v.tags || []).filter((t) => (video.tags || []).includes(t)).length;
      const aShared = tagOverlap(a);
      const bShared = tagOverlap(b);
      if (bShared !== aShared) return bShared - aShared;
      return new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime();
    })
    .slice(0, 5);

  // Cross-link back to the episode page, which holds the transcript, FAQ and
  // show notes for this same conversation. Without this the two URLs compete
  // for the same query instead of pointing at each other. Null (not undefined
  // — props must stay JSON-serializable) when the map hasn't been generated
  // yet or this upload has no confident episode match.
  const episodeSlug = getEpisodeSlugForVideo(video.id);
  let linkedEpisode = null;
  if (episodeSlug) {
    const ep = await getEpisodeBySlug(episodeSlug);
    if (ep) {
      linkedEpisode = { slug: ep.slug, title: ep.title, num: ep.num };
    }
  }

  return {
    props: {
      video,
      relatedVideos,
      linkedEpisode,
    },
    revalidate: 3600,
  };
}

export default function VideoPage({ video, relatedVideos, linkedEpisode = null }) {
  const schema = createVideoObjectSchema(video);

  return (
    <>
      <SeoHead
        title={video.title}
        description={video.description}
        path={`/videos/${video.slug}`}
        ogType="video.other"
        ogImage={video.thumbnail}
      />

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

        {linkedEpisode && (
          <section style={{ marginBottom: '48px', background: 'var(--navy2)', border: '1px solid var(--border)', padding: '20px', borderRadius: '4px' }}>
            <div className="mono" style={{ marginBottom: '8px', fontSize: '10px', fontWeight: '700', letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)' }}>
              Episode {linkedEpisode.num}
            </div>
            <Link
              href={`/episodes/${linkedEpisode.slug}`}
              style={{ color: 'var(--teal)', textDecoration: 'none', fontWeight: 600, fontSize: '16px' }}
            >
              Full episode, transcript &amp; show notes →
            </Link>
            <div style={{ marginTop: '6px', fontSize: '13px', color: 'var(--mid)', fontFamily: 'Georgia, serif' }}>
              {linkedEpisode.title}
            </div>
          </section>
        )}

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
            <h2 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--muted)' }}>
              More Videos
            </h2>
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
                      loading="lazy"
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
