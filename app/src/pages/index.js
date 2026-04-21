import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Ticker from '@/src/components/Ticker';
import Schema from '@/src/components/Schema';
import { getAllEpisodes, getEpisodesByTag } from '@/lib/rss';
import { getAllVideos } from '@/lib/youtube';
import { createPodcastSchema } from '@/lib/schema';

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

export default function Home({ latestEpisodes, episodeCount, latestVideos }) {
  const topicItems = [...TOPICS, ...TOPICS];
  const schema = createPodcastSchema('https://thedime.com');

  return (
    <>
      <style>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }

        @media (max-width: 767px) {
          .hero-main-grid {
            grid-template-columns: 1fr !important;
          }
          .hero-content {
            padding: clamp(24px, 5vw, 48px) !important;
            border-right: none !important;
          }
          .hero-title {
            font-size: clamp(32px, 6vw, 52px) !important;
            line-height: 1.1 !important;
          }
          .hero-subtitle {
            font-size: clamp(14px, 3vw, 19px) !important;
          }
          .pain-points {
            grid-template-columns: 1fr !important;
          }
          .pain-point-item {
            border-right: none !important;
            border-bottom: 1px solid var(--faint);
          }
          .pain-point-item:last-child {
            border-bottom: none !important;
          }
          .newsletter-section {
            grid-template-columns: 1fr !important;
            gap: clamp(24px, 5vw, 48px) !important;
          }
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
          .stats-grid {
            gap: clamp(16px, 3vw, 32px) !important;
            flex-wrap: wrap;
          }
          .stat-item {
            padding-right: clamp(12px, 3vw, 24px) !important;
            margin-right: clamp(12px, 3vw, 24px) !important;
          }
        }

        @media (max-width: 480px) {
          .hero-content {
            padding: 16px !important;
          }
          .hero-title {
            font-size: clamp(24px, 5vw, 32px) !important;
          }
          .stats-grid {
            gap: 12px !important;
          }
          .stat-item {
            padding-right: 12px !important;
            margin-right: 12px !important;
            border-right-width: 0 !important;
          }
          .topic-chip {
            padding: 8px 12px !important;
            font-size: 9px !important;
          }
        }
        .platform-icon {
          color: var(--text-muted);
          transition: color .2s, transform .15s;
          display: inline-flex;
          align-items: center;
          text-decoration: none;
        }
        .platform-icon:hover { transform: translateY(-2px); }
        .platform-apple:hover  { color: #B150E2; }
        .platform-spotify:hover { color: #1DB954; }
        .platform-youtube:hover { color: #FF0000; }
      `}</style>

      <Head>
        <title>The Dime Podcast — Cannabis Business Intelligence</title>
        <meta name="description" content="Strategy conversations for cannabis operators, not observers. 295+ episodes with founders, executives, and investors shaping the cannabis industry." />
        <link rel="canonical" href="https://thedime.com" />
        <meta property="og:title" content="The Dime Podcast — Cannabis Business Intelligence" />
        <meta property="og:description" content="Strategy conversations for cannabis operators, not observers. The most operator-focused podcast in cannabis." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thedime.com" />
        <meta name="twitter:title" content="The Dime Podcast — Cannabis Business Intelligence" />
        <meta name="twitter:description" content="Strategy conversations for cannabis operators, not observers. 295+ episodes with founders, executives, and investors." />
      </Head>

      <Schema schema={schema} />

      <Header />

      {/* HERO */}
      <section style={{ minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,transparent,var(--text-accent) 20%,var(--text-accent) 80%,transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border-subtle) 1px,transparent 1px),linear-gradient(90deg,var(--border-subtle) 1px,transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3 }} />
        <div className="syne" style={{ position: 'absolute', bottom: -60, right: -40, fontSize: 'clamp(200px,28vw,440px)', fontWeight: 800, color: 'transparent', WebkitTextStroke: '1px #1A2A3A', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '.04em', zIndex: 0 }}>
          DIME
        </div>

        {/* GUEST TICKER */}
        <Ticker items={GUESTS_TICKER} />

        {/* MAIN HERO CONTENT */}
        <div className="hero-main-grid" style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr', gap: 0, position: 'relative', zIndex: 2 }}>
          <div className="hero-content" style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid var(--faint)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }} className="fade-in">
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-accent)', letterSpacing: '.2em', fontWeight: 700 }}>EP. {episodeCount} · NEW</span>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '.2em', fontWeight: 700, marginLeft: 12 }}>4.9★ (111) · TOP 5% GLOBALLY</span>
            </div>

            <h1 className="syne fade-in hero-title" style={{ fontSize: 'clamp(56px,8vw,104px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '-.02em', marginBottom: 32, color: 'var(--text-headline)', maxWidth: '70%' }}>
              How the cannabis industry<br />
              <span style={{ color: 'var(--text-accent)' }}>actually</span> works.
            </h1>

            <p className="crimson fade-in hero-subtitle" style={{ fontSize: 'clamp(18px, 2vw, 21px)', lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: '70%', marginBottom: 40, fontWeight: 400, fontStyle: 'normal' }}>
              A weekly conversation with founders, executives, investors, and operators on strategy, competition, and the decisions shaping cannabis.
            </p>

            <div className="stats-grid fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 40, marginBottom: 40, paddingBottom: 40, borderBottom: '1px solid var(--border-subtle)' }}>
              {[
                { n: episodeCount, l: 'Episodes' },
                { n: '4.9★', l: '111 Ratings' },
                { n: 'Top 5%', l: 'Global Ranking' },
                { n: 'Est. 2020', l: 'Weekly' },
              ].map((s) => (
                <div key={s.l} className="stat-item">
                  <div className="syne" style={{ fontSize: 'clamp(24px, 3vw, 32px)', fontWeight: 800, color: 'var(--text-accent)', marginBottom: 8 }}>
                    {s.n}
                  </div>
                  <div className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>

<div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center' }} className="fade-in">
              <Link href={`/episodes/${latestEpisodes[0]?.slug || '#'}`} className="btn-teal" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Listen · Ep. {latestEpisodes[0]?.num || episodeCount}
              </Link>
              <Link href="/episodes" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block', background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                Browse All Episodes →
              </Link>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginLeft: 24 }}>
                <span className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '.15em', textTransform: 'uppercase', fontWeight: 600 }}>On</span>
                <a href="https://podcasts.apple.com/us/podcast/the-dime/id1479320141" target="_blank" rel="noopener noreferrer" className="platform-icon platform-apple" aria-label="Listen on Apple Podcasts" title="Apple Podcasts">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/></svg>
                </a>
                <a href="https://open.spotify.com/show/3O8vp4wvOJpqJCLBPqvQpP" target="_blank" rel="noopener noreferrer" className="platform-icon platform-spotify" aria-label="Listen on Spotify" title="Spotify">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z"/></svg>
                </a>
                <a href="https://www.youtube.com/@TheDimePodcast" target="_blank" rel="noopener noreferrer" className="platform-icon platform-youtube" aria-label="Watch on YouTube" title="YouTube">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                </a>
              </div>
            </div>

          </div>

        </div>

        {/* LATEST EPISODES */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
          <div style={{ padding: '48px', maxWidth: '1200px', margin: '0 auto' }}>
            <div style={{ marginBottom: 40 }}>
              <span className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Latest Episodes</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 32 }}>
              {latestEpisodes.slice(0, 6).map((ep, i) => (
                <Link key={i} href={`/episodes/${ep.slug}`} style={{ padding: '24px', border: '1px solid var(--border-subtle)', borderRadius: 4, transition: 'all .2s', cursor: 'pointer', textDecoration: 'none', color: 'inherit', display: 'flex', flexDirection: 'column', background: 'var(--bg-surface)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-accent)'; e.currentTarget.style.background = 'rgba(60, 184, 240, 0.04)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.background = 'var(--bg-surface)'; }}>
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-accent)', letterSpacing: '.1em', marginBottom: 8, fontWeight: 700 }}>
                    Ep. {ep.num}
                  </div>
                  <div className="crimson" style={{ fontSize: '15px', color: 'var(--text-headline)', lineHeight: 1.4, marginBottom: 8, fontWeight: 600, flex: 1 }}>
                    {ep.title}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    {ep.guest && ep.guest !== 'Guest' && (
                      <div className="mono" style={{ fontSize: '10px', color: 'var(--text-secondary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ep.guest}
                      </div>
                    )}
                    <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginLeft: 'auto', flexShrink: 0 }}>
                      {ep.duration}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
            <div style={{ textAlign: 'center', marginTop: 48 }}>
              <Link href="/episodes" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
                View All {episodeCount} Episodes →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED ON VIDEO */}
      {latestVideos && latestVideos.length > 0 && (
        <section style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)', padding: '64px 0', overflow: 'hidden' }}>
          <div style={{ padding: '0 clamp(24px, 5vw, 48px)', marginBottom: 40 }}>
            <span className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Watch on YouTube</span>
          </div>
          <div style={{ display: 'flex', gap: 24, overflowX: 'auto', paddingLeft: 'clamp(24px, 5vw, 48px)', paddingRight: 'clamp(24px, 5vw, 48px)', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {latestVideos.map((video) => (
              <a
                key={video.id}
                href={video.watchUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flexShrink: 0, width: 280, textDecoration: 'none', color: 'inherit', display: 'block' }}
              >
                <div style={{ position: 'relative', width: 280, height: 158, background: '#111', borderRadius: 4, overflow: 'hidden', marginBottom: 12, border: '1px solid var(--border-subtle)' }}>
                  <img
                    src={video.thumbnail || `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`}
                    alt={video.title}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,.7) 0%, transparent 60%)' }} />
                  <div style={{ position: 'absolute', bottom: 8, right: 8 }}>
                    <span className="mono" style={{ fontSize: '10px', background: 'rgba(0,0,0,.75)', color: '#EEE', padding: '2px 6px', borderRadius: 2 }}>{video.duration}</span>
                  </div>
                </div>
                <div className="crimson" style={{ fontSize: '14px', color: 'var(--text-headline)', lineHeight: 1.4, fontWeight: 600, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                  {video.title}
                </div>
                {video.viewCount && (
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 4 }}>{video.viewCount}</div>
                )}
              </a>
            ))}
          </div>
        </section>
      )}

      {/* PAIN POINTS */}
      <section className="pain-points" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
        {[
          { icon: '◈', label: 'Capital Discipline', body: 'How operators are structuring financing to survive compression, not chase growth.' },
          { icon: '◈', label: 'Regulatory Reads', body: 'State-by-state dynamics, rescheduling timelines, and what DC actually moves on.' },
          { icon: '◈', label: 'Operational Frameworks', body: 'Cultivation economics, extraction margins, and the systems that decide who stays.' },
          { icon: '◈', label: 'Financing Structures', body: 'Debt walls, credit terms, and capital allocation decisions keeping companies alive.' },
        ].map((p, i) => (
          <div key={i} className="pain-point-item" style={{ padding: '40px 36px', borderRight: i < 3 ? '1px solid var(--border-subtle)' : 'none' }}>
            <span className="mono" style={{ fontSize: '20px', color: 'var(--text-accent)', display: 'block', marginBottom: 18, fontWeight: 700 }}>
              {p.icon}
            </span>
            <div className="syne" style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-headline)', letterSpacing: '.06em', marginBottom: 12 }}>
              {p.label}
            </div>
            <div className="crimson" style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.75, fontWeight: 400 }}>
              {p.body}
            </div>
          </div>
        ))}
      </section>

      {/* NEWSLETTER BAND */}
      <section className="newsletter-section" style={{ padding: '96px 48px', borderBottom: '1px solid var(--faint)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
        <div>
          <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 14 }}>First Principles Newsletter</div>
          <h2 className="syne" style={{ fontSize: 'clamp(36px,5vw,60px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.95, marginBottom: 24 }}>
            The insight<br />
            behind<br />
            the episode.
          </h2>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300 }}>
            Not a recap. The structural principle underneath each conversation. Written for operators who need to understand what's actually happening before the market makes it obvious.
          </p>
        </div>
        <div>
          <p className="syne" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 24, lineHeight: 1.9, fontWeight: 500, letterSpacing: '.04em' }}>
            550-650 WORDS. ONE IDEA. NO FLUFF. FREE.<br />
            NO SPONSORSHIP CONTENT. NO PARTNER PROMOTIONS.
          </p>
          <form onSubmit={(e) => { e.preventDefault(); window.location.href = '/newsletter'; }} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="Your email address" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none', transition: 'border-color .15s' }} />
            <button type="submit" className="btn-teal" style={{ width: '100%' }}>
              Subscribe to First Principles
            </button>
          </form>
          <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 14 }}>
            Operator intelligence only. Unsubscribe anytime.
          </p>
        </div>
      </section>

      {/* SOCIAL PROOF QUOTE */}
      <section style={{ padding: 'clamp(48px, 8vw, 96px) clamp(24px, 5vw, 48px)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <div style={{ maxWidth: 720 }}>
          <span className="mono" style={{ fontSize: '24px', color: 'var(--text-accent)', display: 'block', marginBottom: 24, lineHeight: 1 }}>"</span>
          <blockquote className="crimson" style={{ fontSize: 'clamp(20px, 3vw, 28px)', color: 'var(--text-headline)', lineHeight: 1.6, fontWeight: 400, fontStyle: 'italic', margin: '0 0 32px' }}>
            The Dime is the most honest conversation happening in cannabis right now. If you're building in this space, you need to be listening.
          </blockquote>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '.18em', textTransform: 'uppercase', fontWeight: 700 }}>
            — Founder &amp; CEO · Add your attribution here
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

  return {
    props: {
      latestEpisodes: episodes.slice(0, 10),
      episodeCount: episodes.length,
      latestVideos: videos.slice(0, 8),
    },
    revalidate: 3600,
  };
}
