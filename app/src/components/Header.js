import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV = [
  { label: 'Episodes', href: '/episodes' },
  { label: 'Videos', href: '/videos' },
  { label: 'Topics', href: '/topics' },
  { label: 'Newsletter', href: '/newsletter' },
  // "Be a Guest", not "Guests": /guests is the application form, and the
  // bare label read as a list of past guests — an outside audit concluded
  // the site had no pitch form at all.
  { label: 'Be a Guest', href: '/guests' },
  { label: 'About', href: '/about' },
  // The site's only commercial page. It lived in the footer alone, which meant
  // the highest-intent page was reachable only by scrolling to the bottom of
  // something else.
  { label: 'Sponsor', href: '/sponsorship' },
];

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <style>{`
        @media (max-width: 767px) {
          .header-top-bar {
            display: none !important;
          }
          .header-tagline {
            display: none !important;
          }
          .header-nav {
            gap: 8px !important;
          }
        }
        @media (max-width: 639px) {
          .header-logo-text {
            font-size: 18px !important;
          }
          .header-logo-divider {
            display: none !important;
          }
          .header-logo-tagline {
            display: none !important;
          }
        }
        /* 720, not 480: the seven-link nav needs ~490px plus the logo and
           padding, so between those widths it ran into the logo. */
        @media (max-width: 720px) {
          .header-nav-desktop {
            display: none !important;
          }
          .header-hamburger {
            display: block !important;
          }
        }
        @media (min-width: 721px) {
          .header-hamburger {
            display: none !important;
          }
        }
      `}</style>

      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 300,
          background: scrolled ? 'var(--nav-bg-scrolled)' : 'transparent',
          borderBottom: scrolled ? '1px solid var(--border-default)' : '1px solid transparent',
          transition: 'all .3s',
          backdropFilter: 'blur(12px)',
        }}
      >

        {/* Main header */}
        <div
          style={{
            padding: '0 clamp(12px, 5vw, 48px)',
            height: 'clamp(56px, 12vw, 72px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 'clamp(8px, 2vw, 14px)', textDecoration: 'none', flex: 1 }}>
            <span className="syne header-logo-text" style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '.14em' }}>
              THE DIME
            </span>
            <span className="header-logo-divider" style={{ width: 1, height: 16, background: 'var(--border-default)' }} />
            <span className="mono header-logo-tagline header-tagline" style={{ fontSize: '12px', color: 'var(--text-muted)', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>
              CANNABIS
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav
            className="header-nav header-nav-desktop"
            style={{
              display: 'flex',
              gap: 'clamp(16px, 3vw, 32px)',
              alignItems: 'center',
              marginLeft: 'auto',
            }}
          >
            {NAV.map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                className="nav-link"
                style={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
              >
                {nav.label}
              </Link>
            ))}
          </nav>

          {/* Mobile hamburger */}
          <button
            className="header-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              color: 'var(--text-primary)',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px 10px',
              marginLeft: 'auto',
              minWidth: 44,
              minHeight: 44,
            }}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <nav
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0',
              padding: '12px',
              background: 'var(--nav-menu-bg)',
              borderTop: '1px solid var(--border-default)',
            }}
          >
            {NAV.map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '14px 12px',
                  color: 'var(--text-primary)',
                  textDecoration: 'none',
                  borderBottom: '1px solid var(--border-subtle)',
                  fontSize: '16px',
                  fontWeight: 600,
                  fontFamily: 'var(--font-body)',
                }}
              >
                {nav.label}
              </Link>
            ))}
          </nav>
        )}
      </header>
    </>
  );
}
