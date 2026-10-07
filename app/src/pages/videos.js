import { useState } from 'react';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllVideos } from '@/lib/youtube';
import { createCollectionPageSchema } from '@/lib/schema';
import { trackPlatformClick } from '@/lib/platformClicks';
import { useSearchTracking, trackSearchResultClick } from '@/lib/useSearchTracking';

export default function Videos({ allVideos }) {
  const [query, setQuery] = useState('');

  const filtered = allVideos.filter((v) =>
    v.title.toLowerCase().includes(query.toLowerCase()) ||
    v.description.toLowerCase().includes(query.toLowerCase()) ||
    v.tags.some((t) => t.toLowerCase().includes(query.toLowerCase()))
  );

  // One search event per pause in typing (docs/analytics-spec.md Part 2.10).
  // 'video_library' is what separates these from the episode archive's searches
  // in the search_location dimension.
  useSearchTracking(query, filtered.length, 'video_library');

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
      <style>{`
        .video-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: 24px;
        }
        .video-card {
          display: block;
          text-decoration: none;
          color: inherit;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color var(--transition-fast), box-shadow var(--transition-fast), transform var(--transition-fast);
        }
        .video-card:hover {
          border-color: var(--card-border-hover);
          box-shadow: var(--shadow-card);
          transform: translateY(-2px);
          text-decoration: none;
        }
        .video-card .thumb {
          aspect-ratio: 16 / 9;
          background: var(--bg-overlay);
          overflow: hidden;
        }
        .video-card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .video-card .body {
          padding: 16px;
        }
        .video-card .title {
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          line-height: 1.35;
          color: var(--text-headline);
          margin-bottom: 8px;
        }
        .yt-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 16px;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          margin-bottom: 32px;
          background: var(--bg-surface);
          border: 1px solid var(--border-default);
          border-radius: var(--radius-md);
        }
      `}</style>

      <SeoHead
        title="Video Library"
        description={`Full video library from The Dime Podcast YouTube channel. ${allVideos.length} videos featuring cannabis founders, operators, and executives.`}
        path="/videos"
      />
      <Schema schema={collectionSchema} />
      <Header />

      <section className="band">
        <div className="wrap page-head">
          <span className="eyebrow">Video Library · {allVideos.length} Videos</span>
          <div className="page-head-row">
            <h1 className="page-title">Video Library</h1>
            <label style={{ flex: '1 1 280px', maxWidth: 360 }}>
              <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search videos</span>
              <input
                type="search"
                className="search-input"
                placeholder="Search title, topic..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ maxWidth: '100%' }}
              />
            </label>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap page-body">
          <div className="yt-bar">
            <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>
              Subscribe on YouTube and never miss a new episode.
            </span>
            <a
              href="https://www.youtube.com/@theDime_Cannabis?sub_confirmation=1"
              onClick={(e) => trackPlatformClick(e.currentTarget.href, 'video_library')}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-teal"
              style={{ textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, whiteSpace: 'nowrap' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
              Subscribe on YouTube
            </a>
          </div>

          <div className="video-grid">
            {filtered.map((v, i) => (
              // The catalogue can carry the same slug twice (a video re-uploaded
              // under one title), so the YouTube id is the key, not the slug.
              <Link
                key={v.id || v.slug}
                href={`/videos/${v.slug}`}
                className="video-card"
                onClick={() => trackSearchResultClick(query, i, v.slug, 'video_library')}
              >
                <div className="thumb">
                  <img src={v.thumbnail} alt="" loading="lazy" />
                </div>
                <div className="body">
                  <div className="title">{v.title}</div>
                  <div className="meta">{v.date} · {v.duration}{v.viewCount ? ` · ${v.viewCount}` : ''}</div>
                </div>
              </Link>
            ))}
          </div>

          {!filtered.length && (
            <p className="lede" style={{ padding: '48px 0', color: 'var(--text-muted)' }}>
              No videos found.
            </p>
          )}
        </div>
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
