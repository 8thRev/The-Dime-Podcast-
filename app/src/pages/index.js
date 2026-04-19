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

export default function Home({ latestEpisodes, episodeCount }) {
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
      `}</style>

      <Head>
        <title>The Dime Podcast - Cannabis Business Intelligence</title>
        <meta name="description" content="Strategy conversations for cannabis operators, not observers. Over 300 episodes of CEO, founder, and investor intelligence." />
        <meta property="og:title" content="The Dime Podcast - Cannabis Business Intelligence" />
        <meta property="og:description" content="Strategy conversations for cannabis operators, not observers." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://thedime.com" />
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
              <div style={{ width: 28, height: 2, background: 'var(--text-accent)' }} />
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-accent)', letterSpacing: '.2em', fontWeight: 700 }}>EP. {episodeCount} · NEW</span>
              <span className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '.2em', fontWeight: 700, marginLeft: 12 }}>4.9★ (111) · TOP 5% GLOBALLY</span>
            </div>

            <h1 className="syne fade-in hero-title" style={{ fontSize: 'clamp(56px,8vw,104px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '-.02em', marginBottom: 40, color: 'var(--text-headline)' }}>
              How the cannabis industry<br />
              <span style={{ color: 'var(--text-accent)' }}>actually</span> works.
            </h1>

            <p className="crimson fade-in hero-subtitle" style={{ fontSize: 'clamp(18px, 2vw, 21px)', lineHeight: 1.75, color: 'var(--text-secondary)', maxWidth: 540, marginBottom: 12, fontWeight: 400, fontStyle: 'italic' }}>
              A weekly conversation with founders, executives, investors, and operators on strategy, competition, and the decisions shaping cannabis.
            </p>
            <p className="crimson fade-in hero-subtitle" style={{ fontSize: 'clamp(15px, 1.8vw, 17px)', lineHeight: 1.75, color: 'var(--text-accent)', maxWidth: 540, marginBottom: 56, fontWeight: 400 }}>
              Where industry leaders share the strategy and what they learned.
            </p>

            <div style={{ background: 'rgba(60, 184, 240, 0.08)', border: '1px solid var(--text-accent)', borderRadius: 4, padding: '12px 16px', marginBottom: 40, maxWidth: 540 }} className="fade-in">
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                <span className="mono" style={{ fontSize: '10px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.2em', marginTop: 2, flexShrink: 0, textTransform: 'uppercase' }}>Update</span>
                <p className="crimson" style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, fontWeight: 400 }}>
                  Hero redesigned. Clearer value proposition and simpler path to latest episode.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }} className="fade-in">
              <Link href={`/episodes/${latestEpisodes[0]?.slug || '#'}`} className="btn-teal" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Listen to Latest Episode
              </Link>
              <Link href="/episodes" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Browse All Episodes →
              </Link>
            </div>

            <div className="stats-grid fade-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 40, marginTop: 60, paddingTop: 40, borderTop: '1px solid var(--border-subtle)' }}>
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
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                    {ep.duration}
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
          <div className="mono" style={{ fontSize: '9px', color: '#009E85', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 14 }}>First Principles Newsletter</div>
          <h2 className="syne" style={{ fontSize: 'clamp(36px,5vw,60px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.95, marginBottom: 24 }}>
            The insight<br />
            behind<br />
            the episode.
          </h2>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: '#7A8FA8', fontWeight: 300 }}>
            Not a recap. The structural principle underneath each conversation. Written for operators who need to understand what's actually happening before the market makes it obvious.
          </p>
        </div>
        <div>
          <p className="syne" style={{ fontSize: '11px', color: '#3A4F66', marginBottom: 24, lineHeight: 1.9, fontWeight: 500, letterSpacing: '.04em' }}>
            550-650 WORDS. ONE IDEA. NO FLUFF. FREE.<br />
            NO SPONSORSHIP CONTENT. NO PARTNER PROMOTIONS.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <input placeholder="Your email address" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none', transition: 'border-color .15s' }} />
            <button className="btn-teal" style={{ width: '100%' }}>
              Subscribe to First Principles
            </button>
          </div>
          <p className="mono" style={{ fontSize: '10px', color: '#1E3050', marginTop: 14 }}>
            Operator intelligence only. Unsubscribe anytime.
          </p>
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
      videoCount: videos.length,
    },
    revalidate: 3600,
  };
}
