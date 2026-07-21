// src/components/GuestAvatar.js
// Initials-based placeholder avatar for guest entity pages — mirrors the
// fallback circle already used in Testimonials.js. No photo source exists
// for the ~180 guests (LinkedIn scraping / web-sourced headshots aren't
// something we do — copyright and right-of-publicity risk, plus no way to
// verify a photo actually matches the person at this scale). If real,
// rights-cleared guest photos are ever supplied, wire a `photo` field
// through the same way testimonials.json does and this component can grow
// an <img> branch identical to Testimonials.js's.

export default function GuestAvatar({ name, size = 56 }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <div
      className="syne"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.32,
        fontWeight: 700,
        color: 'var(--text-accent)',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}
