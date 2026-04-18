import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import { fetchEpisodes } from '@/src/lib/simplecast';

const GUESTS_TICKER = [
  'Gretchen Gailey', 'Jonathan Black', 'Dan McDermitt', 'Margaret Brodie',
  'Aubrey Amatelli', 'Micah Anderson', 'Trent Woloveck', 'Boris Jordan',
  'Ben Kovler', 'Jim Belushi', 'Steve White', 'Matt Hawkins', 'Karan Wadhera',
  'Rachel Gillette', 'Jason Vedadi', 'Rick Thompson', 'Niccolo Aieta',
  'Hirsh Jain', 'Matt Karnes', 'Socrates Rosenfeld', 'Ryan Crandall',
  'Shahar Yamay', 'Wendy Bronfein', 'Colin Keeler', 'Chris Violas',
];

const TOPICS = [
  'MSO Strategy', 'Capital Structure', 'State Market Dynamics',
  'Cultivation Economics', 'Extraction Margins', 'Brand Positioning',
  'Financing Structures', 'Regulatory Navigation', '280E', 'Rescheduling',
  'Federal Policy', 'Price Compression', 'Vertical Integration', 'M&A',
  'Debt Walls', 'Cash Flow', 'Operational Frameworks', 'Hemp vs Cannabis',
];

export default function Home({ latestEpisodes }) {
  const tickerItems = [...GUESTS_TICKER, ...GUESTS_TICKER];
  const topicItems = [...TOPICS, ...TOPICS];

  return (
    <>
      <Head>
        <title>The Dime Podcast - Cannabis Business Intelligence</title>
        <meta name="description" content="Strategy conversations for cannabis operators, not observers. 299 episodes of CEO, founder, and investor intelligence." />
      </Head>

      <Header />

      {/* HERO */}
      <section style={{ minHeight: '100vh', background: 'var(--navy)', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden', borderBottom: '1px solid var(--border)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,transparent,#00C9A7 20%,#00C9A7 80%,transparent)' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--faint) 1px,transparent 1px),linear-gradient(90deg,var(--faint) 1px,transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3 }} />
        <div className="syne" style={{ position: 'absolute', bottom: -60, right: -40, fontSize: 'clamp(200px,28vw,440px)', fontWeight: 800, color: 'transparent', WebkitTextStroke: '1px #1A2A3A', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '.04em', zIndex: 0 }}>
          DIME
        </div>

        {/* GUEST TICKER */}
        <div style={{ background: '#0F1C2E', borderBottom: '1px solid var(--faint)', padding: '10px 0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 0, animation: 'ticker 40s linear infinite', width: 'max-content' }}>
            {tickerItems.map((g, i) => (
              <span key={i} className="mono" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: i % 7 === 0 ? '#00C9A7' : '#3A4F66', padding: '0 28px', borderRight: '1px solid var(--faint)', whiteSpace: 'nowrap', transition: 'color .2s' }}>
                {g}
              </span>
            ))}
          </div>
        </div>

        {/* MAIN HERO CONTENT */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', gap: 0, position: 'relative', zIndex: 2 }}>
          <div style={{ padding: '64px 48px', display: 'flex', flexDirection: 'column', justifyContent: 'center', borderRight: '1px solid var(--faint)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }} className="fade-in">
              <div style={{ width: 28, height: 2, background: '#00C9A7' }} />
              <span className="mono" style={{ fontSize: '9px', color: '#009E85', letterSpacing: '.2em' }}>EP. 299 · UPDATED WEEKLY</span>
            </div>

            <h1 className="syne fade-in" style={{ fontSize: 'clamp(52px,7vw,96px)', fontWeight: 800, lineHeight: 0.92, letterSpacing: '.01em', marginBottom: 36, color: '#E8E4DC' }}>
              THE CANNABIS<br />
              INDUSTRY'S<br />
              <span style={{ color: '#00C9A7' }}>STRATEGY</span><br />
              CONVERSATION.
            </h1>

            <p className="crimson fade-in" style={{ fontSize: '19px', lineHeight: 1.75, color: '#7A8FA8', maxWidth: 520, marginBottom: 16, fontWeight: 300, fontStyle: 'italic' }}>
              CEOs, founders, investors, and policy architects. MSO strategy, capital structure, state market dynamics, cultivation economics, and the financing decisions keeping companies alive.
            </p>
            <p className="crimson fade-in" style={{ fontSize: '16px', lineHeight: 1.75, color: '#3A4F66', maxWidth: 480, marginBottom: 52, fontWeight: 300 }}>
              Hosted by Bryan Fields and Kellan Finney. Nearly 300 episodes. Built for operators, not observers.
            </p>

            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }} className="fade-in">
              <Link href="/episodes" className="btn-teal" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Browse All Episodes
              </Link>
              <Link href="/guests" className="btn-outline" style={{ textDecoration: 'none', display: 'inline-block' }}>
                Apply to Guest
              </Link>
            </div>

            <div style={{ display: 'flex', gap: 48, marginTop: 60, paddingTop: 40, borderTop: '1px solid var(--faint)' }} className="fade-in">
              {[
                { n: '299', l: 'Episodes' },
                { n: '4.9★', l: '111 Ratings' },
                { n: 'Top 5%', l: 'Most Shared' },
                { n: '2020', l: 'Est.' },
              ].map((s) => (
                <div key={s.l}>
                  <div className="syne" style={{ fontSize: '22px', fontWeight: 800, color: '#E8E4DC', marginBottom: 4 }}>
                    {s.n}
                  </div>
                  <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66' }}>
                    {s.l}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Latest episodes */}
          <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', background: '#0F1C2E', overflowY: 'auto', maxHeight: 'calc(100vh - 100px)' }}>
            <div style={{ marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid var(--faint)' }}>
              <span className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66' }}>Latest Episodes</span>
            </div>
            {latestEpisodes.slice(0, 8).map((ep, i) => (
              <div key={i} style={{ padding: '14px 0', borderBottom: '1px solid var(--faint)', transition: 'background .15s', cursor: 'default' }}>
                <div className="mono" style={{ fontSize: '9px', color: '#00C9A7', letterSpacing: '.1em', marginBottom: 2 }}>
                  {ep.title.substring(0, 30)}
                </div>
                <div className="crimson" style={{ fontSize: '12px', color: '#E8E4DC', lineHeight: 1.2, marginBottom: 4 }}>
                  {ep.title.substring(0, 40)}...
                </div>
                <div className="mono" style={{ fontSize: '9px', color: '#3A4F66' }}>
                  {ep.duration}
                </div>
              </div>
            ))}
            <button className="btn-ghost" style={{ marginTop: 20, background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '10px', fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', color: '#3A4F66', padding: '8px 18px', transition: 'all .15s' }}>
              View All 299 →
            </button>
          </div>
        </div>

        {/* TOPIC TICKER */}
        <div style={{ background: '#0F1C2E', borderTop: '1px solid var(--faint)', padding: '10px 0', overflow: 'hidden' }}>
          <div style={{ display: 'flex', gap: 0, animation: 'ticker 35s linear infinite reverse', width: 'max-content' }}>
            {topicItems.map((t, i) => (
              <span key={i} className="mono" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.18em', textTransform: 'uppercase', color: i % 5 === 0 ? '#009E85' : '#3A4F66', padding: '0 28px', borderRight: '1px solid var(--faint)', whiteSpace: 'nowrap' }}>
                {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* PAIN POINTS */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', borderBottom: '1px solid var(--faint)', background: '#0F1C2E' }}>
        {[
          { icon: '◈', label: 'Capital Discipline', body: 'How operators are structuring financing to survive compression, not chase growth.' },
          { icon: '◈', label: 'Regulatory Reads', body: 'State-by-state dynamics, rescheduling timelines, and what DC actually moves on.' },
          { icon: '◈', label: 'Operational Frameworks', body: 'Cultivation economics, extraction margins, and the systems that decide who stays.' },
          { icon: '◈', label: 'Financing Structures', body: 'Debt walls, credit terms, and capital allocation decisions keeping companies alive.' },
        ].map((p, i) => (
          <div key={i} style={{ padding: '36px 32px', borderRight: i < 3 ? '1px solid var(--faint)' : 'none' }}>
            <span className="mono" style={{ fontSize: '18px', color: '#00C9A7', display: 'block', marginBottom: 16 }}>
              {p.icon}
            </span>
            <div className="syne" style={{ fontSize: '13px', fontWeight: 700, color: '#E8E4DC', letterSpacing: '.06em', marginBottom: 10 }}>
              {p.label}
            </div>
            <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.75, fontWeight: 300 }}>
              {p.body}
            </div>
          </div>
        ))}
      </section>

      {/* NEWSLETTER BAND */}
      <section style={{ padding: '96px 48px', borderBottom: '1px solid var(--faint)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
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

      <style jsx>{`
        @keyframes ticker {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </>
  );
}

export async function getStaticProps() {
  const latestEpisodes = await fetchEpisodes();
  return {
    props: {
      latestEpisodes: latestEpisodes.slice(0, 10),
    },
    revalidate: 3600, // Revalidate every hour
  };
}
