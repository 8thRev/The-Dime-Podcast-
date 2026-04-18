import Link from 'next/link';

const footerLinkStyle = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  fontFamily: "'Syne', sans-serif",
  fontSize: 'clamp(10px, 2vw, 12px)',
  fontWeight: 500,
  color: '#777777',
  display: 'block',
  padding: 0,
  marginBottom: 12,
  textAlign: 'left',
  letterSpacing: '.03em',
  transition: 'color .15s',
  textDecoration: 'none',
};

export default function Footer() {
  return (
    <>
      <style>{`
        .footer-grid {
          display: grid;
          gap: clamp(24px, 5vw, 48px);
          padding: clamp(24px, 5vw, 60px);
          border-top: 1px solid var(--border-default);
        }

        @media (max-width: 767px) {
          .footer-grid {
            grid-template-columns: 1fr;
          }
          .footer-about {
            border-bottom: 1px solid var(--border-default);
            padding-bottom: 24px;
            margin-bottom: 12px;
          }
          .footer-columns {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: clamp(12px, 4vw, 24px);
          }
          .footer-legal {
            grid-column: 1 / -1;
            border-top: 1px solid var(--border-default);
            padding-top: 24px;
            margin-top: 24px;
          }
        }

        @media (min-width: 768px) {
          .footer-grid {
            grid-template-columns: 2fr 1fr 1fr 1fr;
          }
          .footer-columns {
            display: contents;
          }
          .footer-about {
            grid-column: 1;
          }
        }
      `}</style>

      <footer className="footer-grid" style={{ background: 'var(--bg-surface)' }}>
        {/* About section */}
        <div className="footer-about">
          <div className="syne" style={{ fontSize: 'clamp(18px, 4vw, 22px)', fontWeight: 800, color: '#EEEEEE', letterSpacing: '.12em', marginBottom: 14 }}>
            THE DIME
          </div>
          <p className="crimson" style={{ fontSize: 'clamp(12px, 2vw, 14px)', color: '#BBBBBB', lineHeight: 1.85, maxWidth: 240, fontWeight: 300, marginBottom: 20 }}>
            Cannabis business intelligence. Operator to operator.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className="mono" style={{ fontSize: '11px', color: '#3CB8F0' }}>★★★★★</span>
            <span className="mono" style={{ fontSize: '9px', color: '#777777' }}>4.9 · 111 RATINGS</span>
          </div>
        </div>

        {/* Columns wrapper for responsive layout */}
        <div className="footer-columns">
          {/* Navigate */}
          <div>
            <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', color: '#777777', marginBottom: 16, textTransform: 'uppercase' }}>
              Navigate
            </div>
            {[
              { label: 'Episodes', href: '/episodes' },
              { label: 'About', href: '/about' },
              { label: 'Guests', href: '/guests' },
              { label: 'Newsletter', href: '/newsletter' },
            ].map((nav) => (
              <Link key={nav.href} href={nav.href} style={footerLinkStyle}>
                {nav.label}
              </Link>
            ))}
          </div>

          {/* Listen */}
          <div>
            <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', color: '#777777', marginBottom: 16, textTransform: 'uppercase' }}>
              Listen
            </div>
            {['Apple', 'Spotify', 'YouTube'].map((p) => (
              <button key={p} style={footerLinkStyle}>
                {p}
              </button>
            ))}
          </div>

          {/* Contact */}
          <div>
            <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', color: '#777777', marginBottom: 16, textTransform: 'uppercase' }}>
              Contact
            </div>
            <Link href="/guests" style={footerLinkStyle}>
              Apply
            </Link>
            <button style={footerLinkStyle}>Sponsorship</button>
            <Link href="/newsletter" style={footerLinkStyle}>
              Newsletter
            </Link>
          </div>
        </div>

        {/* Legal - spans full width on mobile */}
        <div className="footer-legal">
          <div className="mono" style={{ fontSize: '8px', color: '#777777', lineHeight: 1.7, letterSpacing: '.06em' }}>
            © 2025 THE DIME · ALL RIGHTS RESERVED
          </div>
        </div>
      </footer>
    </>
  );
}
