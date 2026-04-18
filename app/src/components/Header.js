import { useState, useEffect } from 'react';
import Link from 'next/link';

const NAV = [
  { label: 'Episodes', href: '/episodes' },
  { label: 'About', href: '/about' },
  { label: 'For Guests', href: '/guests' },
  { label: 'Newsletter', href: '/newsletter' },
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
        @media (max-width: 480px) {
          .header-nav-desktop {
            display: none !important;
          }
          .header-hamburger {
            display: block !important;
          }
        }
        @media (min-width: 481px) {
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
          background: scrolled ? 'rgba(17,17,17,.98)' : 'transparent',
          borderBottom: scrolled ? '1px solid #333333' : '1px solid transparent',
          transition: 'all .3s',
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Top bar - hidden on mobile */}
        <div
          className="header-top-bar"
          style={{
            borderBottom: '1px solid #2A2A2A',
            padding: '6px clamp(12px, 5vw, 48px)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <span className="mono" style={{ fontSize: '8px', color: '#777777', letterSpacing: '.25em' }}>
            ★ 4.9 · 111 RATINGS · TOP 5%
          </span>
          <div style={{ display: 'flex', gap: 'clamp(12px, 3vw, 24px)', flexWrap: 'wrap' }}>
            {[
              { label: 'Apple', href: 'https://podcasts.apple.com/us/podcast/the-dime/id1540199573' },
              { label: 'Spotify', href: 'https://open.spotify.com/show/05y791a4A1vzTZ6DCZQHFz?si=5107fd933fa54924' },
              { label: 'YouTube', href: 'https://www.youtube.com/@theDime_Cannabis' }
            ].map((p) => (
              <a
                key={p.label}
                href={p.href}
                target="_blank"
                rel="noopener noreferrer"
                className="mono"
                style={{ fontSize: '8px', color: '#777777', letterSpacing: '.12em', cursor: 'pointer', textDecoration: 'none', transition: 'color 150ms ease' }}
                onMouseEnter={(e) => e.currentTarget.style.color = '#FFFFFF'}
                onMouseLeave={(e) => e.currentTarget.style.color = '#777777'}
              >
                {p.label}
              </a>
            ))}
          </div>
        </div>

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
            <span className="syne header-logo-text" style={{ fontSize: 'clamp(16px, 4vw, 22px)', fontWeight: 800, color: '#EEEEEE', letterSpacing: '.14em' }}>
              THE DIME
            </span>
            <span className="header-logo-divider" style={{ width: 1, height: 16, background: '#333333' }} />
            <span className="mono header-logo-tagline header-tagline" style={{ fontSize: '8px', color: '#777777', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>
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
            <Link
              href="/guests"
              className="btn-teal"
              style={{
                padding: 'clamp(10px, 2vw, 14px) clamp(16px, 3vw, 24px)',
                fontSize: 'clamp(9px, 2vw, 11px)',
                textDecoration: 'none',
                display: 'inline-block',
                whiteSpace: 'nowrap',
              }}
            >
              Apply
            </Link>
          </nav>

          {/* Mobile hamburger */}
          <button
            className="header-hamburger"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            style={{
              display: 'none',
              background: 'none',
              border: 'none',
              color: '#EEEEEE',
              fontSize: '24px',
              cursor: 'pointer',
              padding: '8px',
              marginLeft: 'auto',
            }}
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
              background: 'rgba(24,24,24,.95)',
              borderTop: '1px solid #333333',
            }}
          >
            {NAV.map((nav) => (
              <Link
                key={nav.href}
                href={nav.href}
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  padding: '12px',
                  color: '#BBBBBB',
                  textDecoration: 'none',
                  borderBottom: '1px solid #2A2A2A',
                  fontSize: '14px',
                  fontFamily: 'Syne, sans-serif',
                }}
              >
                {nav.label}
              </Link>
            ))}
            <Link
              href="/guests"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-teal"
              style={{
                padding: '12px',
                margin: '12px 0 0 0',
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center',
              }}
            >
              Apply to Guest
            </Link>
          </nav>
        )}
      </header>
    </>
  );
}
