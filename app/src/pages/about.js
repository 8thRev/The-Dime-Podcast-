import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

export default function About() {
  return (
    <>
      <Head>
        <title>About - The Dime Podcast</title>
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
          About the Show
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(48px,7.5vw,100px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.88, maxWidth: 820, marginBottom: 56 }}>
          Built for<br />
          operators.<br />
          <span style={{ color: '#00C9A7' }}>Not observers.</span>
        </h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72 }}>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.85, color: '#7A8FA8', fontWeight: 300 }}>
            The Dime is not a cannabis lifestyle show. It is not a culture podcast. It is a strategy room, open to the public. Nearly 300 episodes in, Bryan Fields and Kellan Finney have built the most operator-focused conversation in cannabis. CEOs, investors, founders, and policy architects. The conversations that don't happen in earnings calls.
          </p>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.85, color: '#7A8FA8', fontWeight: 300 }}>
            The listener is making decisions under margin compression, regulatory uncertainty, and capital scarcity. They tune in because The Dime gives them intelligence they cannot get anywhere else, before the market makes it obvious. Rated 4.9 stars by 111 reviewers. Top 5% most shared globally. Updated every week.
          </p>
        </div>
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px', background: 'var(--border)', borderBottom: '1px solid var(--faint)' }}>
        {[
          {
            name: 'Bryan Fields',
            role: 'Host',
            handle: '@Bryanfields24',
            bio: 'Operator-first. Strategy-driven. Bryan built The Dime as the show he wished existed when he entered the industry. He asks the questions operators need answered, to the people who have the real answers.',
          },
          {
            name: 'Kellan Finney',
            role: 'Co-Host',
            handle: '@Kellan_Finney',
            bio: 'Deep technical and scientific background across cannabis operations. Kellan brings the precision layer: cultivation science, extraction economics, and the operational systems that separate operators.',
          },
        ].map((host) => (
          <div key={host.name} style={{ background: '#0B1420', padding: '64px 48px' }}>
            <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 14 }}>
              Host
            </div>
            <h3 className="syne" style={{ fontSize: '44px', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.04em', marginBottom: 6 }}>
              {host.name}
            </h3>
            <div className="mono" style={{ fontSize: '10px', color: '#00C9A7', letterSpacing: '.12em', marginBottom: 6 }}>
              {host.role} · The Dime
            </div>
            <div className="mono" style={{ fontSize: '10px', color: '#3A4F66', marginBottom: 28 }}>
              {host.handle}
            </div>
            <p className="crimson" style={{ fontSize: '15px', lineHeight: 1.85, color: '#7A8FA8', fontWeight: 300 }}>
              {host.bio}
            </p>
          </div>
        ))}
      </section>

      <Footer />
    </>
  );
}
