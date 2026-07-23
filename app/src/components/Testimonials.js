function getYoutubeEmbedUrl(url) {
  const shortsMatch = url.match(/shorts\/([\w-]+)/);
  if (shortsMatch) return { id: shortsMatch[1], vertical: true };
  const beMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (beMatch) return { id: beMatch[1], vertical: false };
  const vMatch = url.match(/[?&]v=([\w-]+)/);
  if (vMatch) return { id: vMatch[1], vertical: false };
  return null;
}

export default function Testimonials({ items, heading = 'What Listeners Say', filter = 'all', maxWidth = 1200, borderBottom = true }) {
  if (!items || items.length === 0) return null;

  const filtered = filter === 'video' ? items.filter((t) => t.video) : filter === 'quote' ? items.filter((t) => !t.video) : items;
  if (filtered.length === 0) return null;

  return (
    <section style={{ padding: 'clamp(48px, 8vw, 96px) clamp(24px, 5vw, 48px)', borderBottom: borderBottom ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-base)' }}>
      <div style={{ textAlign: 'center', marginBottom: 56 }}>
        <span className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {heading}
        </span>
      </div>
      <div className="testimonial-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, maxWidth, margin: '0 auto' }}>
        {filtered.map((t, i) => {
          const initials = t.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
          const linkUrl = t.video || t.linkedinUrl || null;

          if (t.video && !t.quote) {
            const embed = getYoutubeEmbedUrl(t.video);
            return (
              <div key={i} style={{ border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'var(--bg-surface)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {embed && (
                  <div style={{ position: 'relative', width: '100%', paddingTop: embed.vertical ? '177.78%' : '56.25%', background: '#000' }}>
                    <iframe
                      src={`https://www.youtube.com/embed/${embed.id}`}
                      title={`${t.name} testimonial`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      loading="lazy"
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                    />
                  </div>
                )}
                <div style={{ padding: '20px 24px' }}>
                  <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-headline)' }}>
                    {t.linkedinUrl ? (
                      <a href={t.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{t.name}</a>
                    ) : t.name}
                  </div>
                  <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                    {t.title}
                  </div>
                </div>
              </div>
            );
          }

          const avatar = (
            <div style={{ position: 'relative', width: 56, height: 56, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-surface)' }}>
              {t.photo ? (
                <img src={t.photo} alt={t.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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
              {t.quote && (
                <>
                  <span className="mono" style={{ fontSize: '20px', color: 'var(--text-accent)', display: 'block', marginBottom: 16, lineHeight: 1 }}>&ldquo;</span>
                  <blockquote className="crimson" style={{ fontSize: '16px', color: 'var(--text-headline)', lineHeight: 1.7, fontWeight: 400, fontStyle: 'italic', margin: '0 0 24px', flex: 1 }}>
                    {t.quote}
                  </blockquote>
                </>
              )}
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
