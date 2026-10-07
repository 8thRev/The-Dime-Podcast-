import { useState, useEffect } from 'react';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Ticker from '@/src/components/Ticker';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';
import Testimonials from '@/src/components/Testimonials';
import { getAllEpisodes, getLatestEpisodeNumber } from '@/lib/rss';
import { getAllVideos } from '@/lib/youtube';
import { createPodcastSchema, createWebsiteSchema } from '@/lib/schema';
import { trackPlatformClick } from '@/lib/platformClicks';
import { trackVideoOutboundClick } from '@/lib/videoClicks';
import testimonials from '@/content/testimonials.json';
import { PODCAST_RATING } from '@/lib/ratings';
import { NEWSLETTER_PITCH, NEWSLETTER_FORMAT, NEWSLETTER_CADENCE } from '@/lib/newsletterCopy';

const GUESTS_TICKER = [
  'Aubrey Amatelli', 'Gretchen Gailey', 'Dan McDermitt', 'Margaret Brodie',
  'Micah Anderson', 'Kristin & Eric Rogers', 'Trent Woloveck', 'John Shute',
  'Brian Adams', 'Nicolas Guarino', 'Bill Morachnick', 'Ryan Crandall',
  'Tyler Robson', 'Adam Stettner', 'Chris Emerson', 'Nick Kenny',
  'Thomas Winstanley', 'Alex Kwon', 'Jared Maloof', 'Chris Ball',
  'Jim Higdon', 'Ryan Castle', 'Mitchell Osak', 'Zach Edge',
  'Dan Cook', 'Nadia Sabeh', 'David Fettner', 'Shahar Yamay',
  'Hirsh Jain', 'Socrates Rosenfeld', 'Jesse Redmond', 'Brett Puffenbarger',
];

const TOPICS = [
  'MSO Strategy', 'Capital Structure', 'State Market Dynamics',
  'Cultivation Economics', 'Extraction Margins', 'Brand Positioning',
  'Financing Structures', 'Regulatory Navigation', '280E', 'Rescheduling',
  'Federal Policy', 'Price Compression', 'Vertical Integration', 'M&A',
  'Debt Walls', 'Cash Flow', 'Operational Frameworks', 'Hemp vs Cannabis',
];

export default function Home({ latestEpisodes, episodeCount, latestEpisodeNumber, latestVideos }) {
  const topicItems = [...TOPICS, ...TOPICS];
  const schema = createPodcastSchema('https://www.dimepodcast.com', PODCAST_RATING);
  const websiteSchema = createWebsiteSchema('https://www.dimepodcast.com');

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .guest-wall-section {
            grid-template-columns: 1fr !important;
            gap: clamp(24px, 5vw, 48px) !important;
          }
          .guest-grid {
            grid-template-columns: 1fr !important;
          }
          .topic-grid {
            gap: clamp(8px, 2vw, 10px) !important;
          }
        }
        @media (max-width: 480px) {
          .topic-chip {
            padding: 8px 12px !important;
            font-size: 12px !important;
          }
        }
      `}</style>

      <SeoHead
        title="The Dime Podcast — Cannabis Business Intelligence"
        description={`Strategy conversations for cannabis operators, not observers. ${episodeCount} episodes with founders, executives, and investors shaping the cannabis industry.`}
        path="/"
        fullTitleProvided
      />

      <Schema schema={schema} />
      <Schema schema={websiteSchema} />

      <Header />

      {/* HERO */}
      <section className="hero band">
        <div className="hero-rule" aria-hidden="true" />
        <div className="hero-grid-bg" aria-hidden="true" />
        <div className="hero-watermark syne" aria-hidden="true">DIME</div>

        {/* GUEST TICKER */}
        <Ticker items={GUESTS_TICKER} />

        <div className="wrap wrap--wide hero-main-grid">
          <div className="hero-content">
            <div className="hero-kicker fade-in">
              <span className="eyebrow eyebrow--accent">Cannabis business intelligence</span>
              <span className="meta">{PODCAST_RATING.value}★ · {PODCAST_RATING.count} ratings · Top 5% globally</span>
            </div>

            <h1 className="hero-title fade-in">
              How the cannabis industry <span className="accent">actually</span> works.
            </h1>

            <p className="lede hero-subtitle fade-in">
              Conversations with founders, executives, investors, and operators on strategy, competition, and the decisions shaping cannabis.
            </p>

            <div className="hero-ctas fade-in">
              <a href="#newsletter" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Get the First Principles newsletter
              </a>
              <Link href="/episodes" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Browse all {episodeCount} episodes
              </Link>
            </div>
          </div>

          <aside className="hero-aside" aria-label="Latest episode">
            {latestEpisodes[0] && (
              <div className="card-panel hero-latest-card fade-in">
                <span className="eyebrow eyebrow--accent">
                  New episode · Ep. {latestEpisodes[0].num}{latestEpisodes[0].duration ? ` · ${latestEpisodes[0].duration}` : ''}
                </span>
                <Link href={`/episodes/${latestEpisodes[0].slug}`} className="hero-latest-title">
                  {latestEpisodes[0].title}
                </Link>
                {latestEpisodes[0].guest && latestEpisodes[0].guest !== 'Guest' && (
                  <span className="meta">with {latestEpisodes[0].guest}</span>
                )}
                <div className="listen-row" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 6 }}>
                  <Link href={`/episodes/${latestEpisodes[0].slug}`} className="listen-chip is-primary">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                    Listen now
                  </Link>
                  <a href="https://podcasts.apple.com/us/podcast/the-dime/id1540199573" onClick={(e) => trackPlatformClick(e.currentTarget.href, 'hero')} target="_blank" rel="noopener noreferrer" className="listen-chip" aria-label="Listen on Apple Podcasts">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                    Apple Podcasts
                  </a>
                  <a href="https://open.spotify.com/show/05y791a4A1vzTZ6DCZQHFz" onClick={(e) => trackPlatformClick(e.currentTarget.href, 'hero')} target="_blank" rel="noopener noreferrer" className="listen-chip" aria-label="Listen on Spotify">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                    Spotify
                  </a>
                  <a href="https://www.youtube.com/@theDime_Cannabis" onClick={(e) => trackPlatformClick(e.currentTarget.href, 'hero')} target="_blank" rel="noopener noreferrer" className="listen-chip" aria-label="Watch on YouTube">
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    YouTube
                  </a>
                </div>
              </div>
            )}
          </aside>
        </div>

        <div className="wrap wrap--wide">
          <dl className="hero-proof fade-in">
            {[
              { n: episodeCount, l: 'Episodes' },
              { n: `${PODCAST_RATING.value}★`, l: `${PODCAST_RATING.count} Ratings` },
              { n: 'Top 5%', l: 'Global Ranking' },
              { n: 'Since 2020', l: 'On Air' },
            ].map((s) => (
              <div key={s.l}>
                <dd className="n">{s.n}</dd>
                <dt className="l">{s.l}</dt>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* GUEST VIDEO TESTIMONIALS */}
      <div className="band">
        <Testimonials items={testimonials} filter="video" heading="Hear From Recent Guests" maxWidth={800} borderBottom={false} />
      </div>

      {/* LATEST EPISODES */}
      <section className="band">
        <div className="wrap wrap--wide page-body">
          <div className="page-head-row" style={{ marginBottom: 32 }}>
            <h2 className="section-label" style={{ margin: 0 }}>Latest Episodes</h2>
            <Link href="/episodes" className="meta" style={{ textDecoration: 'none' }}>All {episodeCount} episodes →</Link>
          </div>
          <div className="ep-card-grid">
            {latestEpisodes.slice(0, 6).map((ep) => (
              <Link key={ep.slug} href={`/episodes/${ep.slug}`} className="ep-card">
                <span className="eyebrow eyebrow--accent">Ep. {ep.num}</span>
                <span className="ep-card-title">{ep.title}</span>
                <span className="ep-card-foot">
                  {ep.guest && ep.guest !== 'Guest' && <span className="ep-card-guest">{ep.guest}</span>}
                  <span className="meta">{ep.duration}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURED ON VIDEO */}
      {latestVideos && latestVideos.length > 0 && (
        <section style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '64px 0', overflow: 'hidden' }}>
          <div className="wrap wrap--wide" style={{ marginBottom: 40 }}>
            <h2 className="section-label" style={{ margin: 0 }}>Watch on YouTube</h2>
          </div>
          <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingLeft: 'clamp(24px, 5vw, 48px)', paddingRight: 'clamp(24px, 5vw, 48px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {latestVideos.map((video) => (
              <a
                key={video.id}
                href={video.watchUrl}
                onClick={() => trackVideoOutboundClick(video, 'home_video_shelf')}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flexShrink: 0, width: 280, textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={{ position: 'relative', width: 280, height: 158, background: 'var(--text-headline)', borderRadius: 4, overflow: 'hidden', marginBottom: 12, border: '1px solid var(--border-subtle)' }}>
                  <img
                    src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                    alt={video.title}
                    loading="lazy"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%)' }} />
                  <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                    <span className="mono" style={{ fontSize: '12px', background: 'rgba(0,0,0,.75)', color: '#EEE', padding: '2px 6px', borderRadius: 2 }}>{video.duration}</span>
                  </div>
                </div>
                <div className="crimson" style={{ fontSize: '14px', color: 'var(--text-headline)', lineHeight: 1.4, fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {video.title}
                </div>
                {video.viewCount && (
                  <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 4 }}>{video.viewCount}</div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* SOCIAL PROOF / TESTIMONIALS */}
      <Testimonials items={testimonials} filter="quote" />

      {/* NEWSLETTER BAND */}
      <section id="newsletter" className="band" style={{ scrollMarginTop: 80 }}>
        <div className="wrap wrap--wide grid-2" style={{ paddingTop: 'clamp(56px, 8vw, 96px)', paddingBottom: 'clamp(56px, 8vw, 96px)', alignItems: 'center' }}>
          <div>
            <span className="eyebrow eyebrow--accent">First Principles Newsletter</span>
            <h2 className="page-title" style={{ fontSize: 'clamp(38px, 5vw, 64px)' }}>
              The insight<br />
              behind<br />
              the episode.
            </h2>
            <p className="lede">{NEWSLETTER_PITCH}</p>
          </div>
          <div>
            <p className="meta" style={{ marginBottom: 20, color: 'var(--text-secondary)' }}>
              {NEWSLETTER_FORMAT} {NEWSLETTER_CADENCE}
            </p>
            <ConvertKitEmbed location="home_hero" />
            <p className="meta" style={{ marginTop: 14 }}>
              Operator intelligence only. Unsubscribe anytime.{' '}
              <Link href="/newsletter">Read the archive</Link>.
            </p>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const episodes = await getAllEpisodes();
  const videos = await getAllVideos();

  // Two different numbers, kept apart on purpose. episodeCount is how many
  // episodes exist and is what every "N episodes" claim uses, so this page,
  // /episodes, /llms.txt and /llms-full.txt all state the same figure.
  // latestEpisodeNumber is Simplecast's itunes:episode on the newest one,
  // which runs ahead of the count because the numbering has gaps, and is
  // only ever shown as an "Ep. N" label. Using it as a count is how the site
  // said 307 while llms.txt said 305.
  const episodeCount = episodes.length;
  const latestEpisodeNumber = getLatestEpisodeNumber(episodes);

  return {
    props: {
      latestEpisodes: episodes.slice(0, 10),
      episodeCount,
      latestEpisodeNumber,
      latestVideos: videos.slice(0, 8),
    },
    revalidate: 3600,
  };
}
