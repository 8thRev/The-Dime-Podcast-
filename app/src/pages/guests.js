import Head from 'next/head';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';

const GUESTS_TICKER = [
  'Gretchen Gailey', 'Jonathan Black', 'Dan McDermitt', 'Margaret Brodie',
  'Aubrey Amatelli', 'Micah Anderson', 'Trent Woloveck', 'Boris Jordan',
  'Ben Kovler', 'Jim Belushi', 'Steve White', 'Matt Hawkins', 'Karan Wadhera',
  'Rachel Gillette', 'Jason Vedadi', 'Rick Thompson', 'Niccolo Aieta',
  'Hirsh Jain', 'Matt Karnes', 'Socrates Rosenfeld', 'Ryan Crandall',
];

export default function ForGuests() {
  return (
    <>
      <Head>
        <title>Apply to Guest - The Dime Podcast</title>
      </Head>
      <Header />

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
          Guest Application
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(44px,7vw,92px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.88, maxWidth: 760, marginBottom: 36 }}>
          This is the room<br />
          serious operators<br />
          <span style={{ color: '#00C9A7' }}>want to be in.</span>
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: '#7A8FA8', maxWidth: 600, fontWeight: 300 }}>
          The Dime listener is an operator, executive, or investor making real decisions in cannabis. They are not looking for inspiration. They are looking for intelligence. If you have something real to say to that room, this is where you say it.
        </p>
      </section>

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 20 }}>
            Who's Listening
          </div>
          {[
            ['Primary Audience', 'Cannabis operators, CEOs, founders, VPs, and strategic advisors across the full supply chain.'],
            ['Investors', 'Family offices, cannabis-focused funds, and institutional capital allocators.'],
            ['Credibility', '4.9 stars, 111 ratings, top 5% most shared globally. 299 episodes.'],
            ['Geography', 'NY, FL, MI, CA, CO, IL, MA and every emerging state market with capital at stake.'],
            ['Mindset', 'Survival-focused. Risk-aware. Skeptical of hype. Benchmarking against peers.'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '22px 0', borderTop: '1px solid var(--faint)' }}>
              <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 8 }}>
                {label}
              </div>
              <div className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.8, fontWeight: 300 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 20 }}>
            What Works Here
          </div>
          <div style={{ borderLeft: '2px solid #00C9A7', paddingLeft: 28, marginBottom: 48 }}>
            <p className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.9, fontWeight: 300, marginBottom: 18 }}>
              This is not a brand awareness play. The guests who land well on The Dime bring something real: a hard decision they made, a structural insight, a contrarian view on where the market is going.
            </p>
            <p className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.9, fontWeight: 300 }}>
              We do not do puff pieces. We do not do product launches dressed as conversations. The room will notice, and it will cost you credibility, not build it.
            </p>
          </div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
            Past Guests Include
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {GUESTS_TICKER.slice(0, 16).map((g) => (
              <div key={g} style={{ fontSize: '12px', fontWeight: 500, color: '#3A4F66', padding: '12px 0', borderBottom: '1px solid var(--faint)', transition: 'color .15s', letterSpacing: '.02em' }}>
                {g}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 48px' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 32 }}>
          Submit Your Application
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <input placeholder="Full Name" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <input placeholder="Company and Title" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <input placeholder="Email Address" style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none' }} />
            <textarea placeholder="What would you say to a room of cannabis operators and executives? 2-3 sentences." rows={4} style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none', resize: 'vertical' }} />
            <textarea placeholder="Links: LinkedIn, recent press, company website" rows={2} style={{ background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', width: '100%', outline: 'none', resize: 'none' }} />
            <button className="btn-teal" style={{ alignSelf: 'flex-start' }}>
              Submit Application
            </button>
          </div>
          <div>
            <div className="mono" style={{ fontSize: '9px', color: '#009E85', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 20 }}>
              What Happens Next
            </div>
            {[
              ['Review', 'We review every application personally. If it\'s a fit, we\'ll reach out within 5 business days.'],
              ['Pre-Call', 'A short alignment call to agree on angle, framing, and what the room needs to hear from you.'],
              ['Recording', 'Remote or in-person. We handle all production. You show up with something real to say.'],
              ['Distribution', 'Apple Podcasts, Spotify, YouTube, LinkedIn, and the First Principles newsletter.'],
            ].map(([step, detail]) => (
              <div key={step} style={{ marginBottom: 28 }}>
                <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 6 }}>
                  {step}
                </div>
                <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.82, fontWeight: 300 }}>
                  {detail}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
