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

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 300,
        background: scrolled ? 'rgba(11,20,32,.97)' : 'transparent',
        borderBottom: scrolled ? '1px solid #1E3050' : '1px solid transparent',
        transition: 'all .3s',
        backdropFilter: 'blur(12px)',
      }}
    >
      <div style={{ borderBottom: '1px solid #1A2A3A', padding: '6px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="mono" style={{ fontSize: '9px', color: '#3A4F66', letterSpacing: '.25em' }}>★ 4.9 · 111 RATINGS · TOP 5% MOST SHARED · EST. 2020</span>
        <div style={{ display: 'flex', gap: 32 }}>
          {['Apple Podcasts', 'Spotify', 'YouTube', 'LinkedIn'].map((p) => (
            <span key={p} className="mono" style={{ fontSize: '9px', color: '#3A4F66', letterSpacing: '.15em', cursor: 'pointer' }}>
              {p}
            </span>
          ))}
        </div>
      </div>
      <div style={{ padding: '0 48px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none' }}>
          <span className="syne" style={{ fontSize: '22px', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.14em' }}>
            THE DIME
          </span>
          <span style={{ width: 1, height: 16, background: '#1E3050' }} />
          <span className="mono" style={{ fontSize: '9px', color: '#3A4F66', letterSpacing: '.12em' }}>
            CANNABIS BUSINESS INTELLIGENCE
          </span>
        </Link>
        <nav style={{ display: 'flex', gap: 36, alignItems: 'center' }}>
          {NAV.map((nav) => (
            <Link
              key={nav.href}
              href={nav.href}
              className="nav-link"
              style={{ textDecoration: 'none' }}
            >
              {nav.label}
            </Link>
          ))}
          <Link href="/guests" className="btn-teal" style={{ padding: '10px 22px', fontSize: '10px', textDecoration: 'none', display: 'inline-block' }}>
            Apply to Guest
          </Link>
        </nav>
      </div>
    </header>
  );
}
