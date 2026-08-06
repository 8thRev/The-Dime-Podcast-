// Episode-page sponsor slot for Newton Insights.
//
// Renders on every episode page (see SEO_ROADMAP.md), so the sponsor link
// isn't limited to the ~48 episodes whose Simplecast show notes happen to
// carry one. Deliberately followable — no rel="nofollow" — because Newton is
// a sister company under Eighth Revolution LLC, disclosed as the show's
// sponsor right here in the block.
//
// `compact` is for episodes whose show notes already render the sponsor read
// above; the block collapses to a labelled credit line so the page doesn't
// repeat the same pitch twice.

import { SPONSOR_NAME, sponsorCtaUrl, sponsorAnchorText, sponsorLeadText } from '@/lib/sponsor';

const linkStyle = {
  color: 'var(--text-accent)',
  fontWeight: 600,
  textDecoration: 'none',
};

const eyebrowStyle = {
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '.2em',
  textTransform: 'uppercase',
  color: 'var(--text-muted)',
};

export default function SponsorSlot({ slug, compact = false }) {
  const anchor = sponsorAnchorText(slug);
  const href = sponsorCtaUrl(slug);

  if (compact) {
    return (
      <aside
        style={{
          marginBottom: '56px',
          paddingTop: '20px',
          borderTop: '1px solid var(--border-subtle)',
          display: 'flex',
          gap: '8px 16px',
          flexWrap: 'wrap',
          alignItems: 'baseline',
        }}
      >
        <span className="mono" style={eyebrowStyle}>
          Episode Sponsor · {SPONSOR_NAME}
        </span>
        <a href={href} rel="noopener noreferrer" style={{ ...linkStyle, fontSize: '14px' }}>
          {anchor} →
        </a>
      </aside>
    );
  }

  return (
    <aside
      style={{
        marginBottom: '56px',
        background: 'var(--bg-surface)',
        border: '1px solid var(--border-default)',
        borderRadius: '8px',
        padding: '24px',
      }}
    >
      <div className="mono" style={{ ...eyebrowStyle, marginBottom: '12px' }}>
        Episode Sponsor · {SPONSOR_NAME}
      </div>
      <p style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--text-secondary)', margin: '0 0 14px' }}>
        {sponsorLeadText(slug)}
      </p>
      <a href={href} rel="noopener noreferrer" style={{ ...linkStyle, fontSize: '15px' }}>
        {anchor} →
      </a>
    </aside>
  );
}
