export default function Testimonials({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <section style={{ padding: 'clamp(48px, 8vw, 96px) clamp(24px, 5vw, 48px)', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <span className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          What Listeners Say
        </span>
      </div>
      <div className="testimonial-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, maxWidth: 1200, margin: '0 auto' }}>
        {items.map((t, i) => {
          const initials = t.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
          const linkUrl = t.linkedinUrl || t.video || null;

          const avatar = (
            <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
              {t.photo ? (
                <img src={t.photo} alt={t.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <div className="syne" style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 700, color: 'var(--text-accent)' }}>
                  {initials}
                </div>
              )}
              {t.video && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
                </div>
              )}
            </div>
          );

          return (
            <div key={i} style={{ padding: '32px', border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column' }}>
              <span className="mono" style={{ fontSize: '20px', color: 'var(--text-accent)', display: 'block', marginBottom: 16, lineHeight: 1 }}>&ldquo;</span>
              <blockquote className="crimson" style={{ fontSize: '16px', color: 'var(--text-headline)', lineHeight: 1.7, fontWeight: 400, fontStyle: 'italic', margin: '0 0 24px', flex: 1 }}>
                {t.quote}
              </blockquote>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                {linkUrl ? (
                  <a href={linkUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t.name} on LinkedIn`} style={{ display: 'block' }}>
                    {avatar}
                  </a>
                ) : (
                  avatar
                )}
                <div>
                  <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-headline)' }}>
                    {linkUrl ? (
                      <a href={linkUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{t.name}</a>
                    ) : t.name}
                  </div>
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                    {t.title}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
