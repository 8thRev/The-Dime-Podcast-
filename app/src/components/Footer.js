import Link from 'next/link';

export default function Footer() {
  return (
    <footer style={{ borderTop: '1px solid var(--faint)', padding: '60px 48px', display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 48, background: '#0F1C2E' }}>
      <div>
        <div className="syne" style={{ fontSize: '22px', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.12em', marginBottom: 14 }}>
          THE DIME
        </div>
        <p className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.85, maxWidth: 240, fontWeight: 300, marginBottom: 20 }}>
          Cannabis business intelligence. Operator to operator. 299 episodes deep.
        </p>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="mono" style={{ fontSize: '11px', color: '#00C9A7' }}>★★★★★</span>
          <span className="mono" style={{ fontSize: '10px', color: '#3A4F66' }}>4.9 · 111 RATINGS</span>
        </div>
      </div>
      <div>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', color: '#3A4F66', marginBottom: 18, textTransform: 'uppercase' }}>Navigate</div>
        {[
          { label: 'Episodes', href: '/episodes' },
          { label: 'About', href: '/about' },
          { label: 'For Guests', href: '/guests' },
          { label: 'Newsletter', href: '/newsletter' },
        ].map((nav) => (
          <Link key={nav.href} href={nav.href} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 500, color: '#3A4F66', display: 'block', padding: 0, marginBottom: 12, textAlign: 'left', letterSpacing: '.03em', transition: 'color .15s', textDecoration: 'none' }}>
            {nav.label}
          </Link>
        ))}
      </div>
      <div>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', color: '#3A4F66', marginBottom: 18, textTransform: 'uppercase' }}>Listen</div>
        {['Apple Podcasts', 'Spotify', 'YouTube', 'LinkedIn'].map((p) => (
          <button key={p} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 500, color: '#3A4F66', display: 'block', padding: 0, marginBottom: 12, textAlign: 'left', letterSpacing: '.03em', transition: 'color .15s' }}>
            {p}
          </button>
        ))}
      </div>
      <div>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', color: '#3A4F66', marginBottom: 18, textTransform: 'uppercase' }}>Contact</div>
        <Link href="/guests" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 500, color: '#3A4F66', display: 'block', padding: 0, marginBottom: 12, textAlign: 'left', letterSpacing: '.03em', transition: 'color .15s', textDecoration: 'none' }}>
          Guest Inquiry
        </Link>
        <button style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 500, color: '#3A4F66', display: 'block', padding: 0, marginBottom: 12, textAlign: 'left', letterSpacing: '.03em', transition: 'color .15s' }}>
          Sponsorship
        </button>
        <Link href="/newsletter" style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Syne', sans-serif", fontSize: '12px', fontWeight: 500, color: '#3A4F66', display: 'block', padding: 0, marginBottom: 12, textAlign: 'left', letterSpacing: '.03em', transition: 'color .15s', textDecoration: 'none' }}>
          Newsletter
        </Link>
        <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--faint)' }}>
          <div className="mono" style={{ fontSize: '9px', color: '#1E3050', lineHeight: 1.7, letterSpacing: '.06em' }}>© 2025 THE DIME PODCAST<br />ALL RIGHTS RESERVED.</div>
        </div>
      </div>
    </footer>
  );
}
