import { useCallback, useEffect, useRef, useState } from 'react';

// Guest testimonials, two kinds: written quotes (a card grid) and short
// videos. The videos are a mix of formats (one landscape upload, one
// YouTube Short), so they are not embedded in the grid: each one is a
// same-size square poster with a play button, and the video opens in a
// lightbox sized to its own aspect. That keeps the tiles equal whatever
// shape the next clip arrives in, and keeps two YouTube iframes off the
// home page's first paint.

function parseYoutube(url) {
  const shortsMatch = url.match(/shorts\/([\w-]+)/);
  if (shortsMatch) return { id: shortsMatch[1], vertical: true };
  const beMatch = url.match(/youtu\.be\/([\w-]+)/);
  if (beMatch) return { id: beMatch[1], vertical: false };
  const vMatch = url.match(/[?&]v=([\w-]+)/);
  if (vMatch) return { id: vMatch[1], vertical: false };
  return null;
}

// YouTube serves a vertical frame for Shorts at oar2.jpg and a 16:9 frame
// at maxresdefault.jpg; hqdefault.jpg exists for every video and is the
// fallback when the larger one is missing. A `poster` field on the
// testimonial overrides both.
function posterFor(embed, override) {
  if (override) return { src: override, fallback: override, position: '50% 50%' };
  const base = `https://i.ytimg.com/vi/${embed.id}`;
  return embed.vertical
    ? { src: `${base}/oar2.jpg`, fallback: `${base}/hqdefault.jpg`, position: '50% 12%' }
    : { src: `${base}/maxresdefault.jpg`, fallback: `${base}/hqdefault.jpg`, position: '50% 50%' };
}

function PlayGlyph({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  );
}

function NameLine({ t }) {
  return (
    <div>
      <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-headline)' }}>
        {t.linkedinUrl ? (
          <a href={t.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{t.name}</a>
        ) : t.name}
      </div>
      <div className="mono" style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: 2 }}>
        {t.title}
      </div>
    </div>
  );
}

function VideoTile({ t, embed, onOpen }) {
  const poster = posterFor(embed, t.poster);
  return (
    <div className="vt-tile">
      <button type="button" className="vt-poster" onClick={onOpen} aria-label={`Play the testimonial from ${t.name}`}>
        <img
          src={poster.src}
          alt=""
          loading="lazy"
          style={{ objectPosition: poster.position }}
          onError={(e) => { if (e.currentTarget.src !== poster.fallback) e.currentTarget.src = poster.fallback; }}
        />
        <span className="vt-play"><span><PlayGlyph /></span></span>
      </button>
      <div className="vt-caption">
        <NameLine t={t} />
        <span className="mono vt-watch">Watch</span>
      </div>
    </div>
  );
}

function VideoLightbox({ t, embed, onClose }) {
  const closeRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    if (closeRef.current) closeRef.current.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  const src = `https://www.youtube.com/embed/${embed.id}?autoplay=1&rel=0&playsinline=1`;

  return (
    <div className="vt-lightbox" role="dialog" aria-modal="true" aria-label={`${t.name} testimonial`} onClick={onClose}>
      <button ref={closeRef} type="button" className="vt-lightbox-close" onClick={onClose} aria-label="Close video">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {/* The body spans the full width so the frame can size itself from it;
          only the frame and caption swallow the click, so the dim margin
          either side still closes the dialog. */}
      <div className="vt-lightbox-body">
        <div className={`vt-lightbox-frame ${embed.vertical ? 'is-portrait' : 'is-landscape'}`} onClick={(e) => e.stopPropagation()}>
          <iframe
            src={src}
            title={`${t.name} testimonial`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
        <div className="mono vt-lightbox-name">{t.name} &middot; {t.title}</div>
      </div>
    </div>
  );
}

// `audience` picks who the quote is addressed to: 'listener' quotes sell the
// show, 'guest' quotes sell the guest chair. Cards show the short `pull`
// (a verbatim, contiguous excerpt) and fall back to the full `quote`; the
// sponsorship page reads the full text itself, so `quote` stays complete.
export default function Testimonials({ items, heading = 'What Listeners Say', filter = 'all', audience = null, borderBottom = true }) {
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);

  if (!items || items.length === 0) return null;

  const byKind = filter === 'video' ? items.filter((t) => t.video) : filter === 'quote' ? items.filter((t) => !t.video) : items;
  const filtered = audience ? byKind.filter((t) => t.audience === audience) : byKind;
  if (filtered.length === 0) return null;

  // A video-only testimonial becomes a poster tile. A quote that also has a
  // video keeps the written card, with a play mark on the avatar.
  const videos = filtered
    .filter((t) => t.video && !t.quote)
    .map((t) => ({ t, embed: parseYoutube(t.video) }))
    .filter((v) => v.embed);
  const quotes = filtered.filter((t) => !(t.video && !t.quote));

  return (
    <section style={{ paddingBlock: 'clamp(48px, 8vw, 96px)', borderBottom: borderBottom ? '1px solid var(--border-subtle)' : 'none', background: 'var(--bg-base)' }}>
      <div className="wrap">
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <span className="section-label" style={{ marginBottom: 0 }}>{heading}</span>
        </div>

        {videos.length > 0 && (
          <div className="vt-grid">
            {videos.map(({ t, embed }, i) => (
              <VideoTile key={t.name} t={t} embed={embed} onOpen={() => setOpen(i)} />
            ))}
          </div>
        )}

        {quotes.length > 0 && (
          <div className="tq-grid">
            {quotes.map((t, i) => {
              const initials = t.name.split(' ').map((p) => p[0]).slice(0, 2).join('');
              const linkUrl = t.video || t.linkedinUrl || null;

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
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
                      <PlayGlyph size={16} />
                    </div>
                  )}
                </div>
              );

              return (
                <div key={i} className="tq-card">
                  {(t.pull || t.quote) && (
                    <blockquote className="crimson tq-quote">
                      &ldquo;{t.pull || t.quote}&rdquo;
                    </blockquote>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {linkUrl ? (
                      <a href={linkUrl} target="_blank" rel="noopener noreferrer" aria-label={`${t.name} on LinkedIn`} style={{ display: 'block' }}>
                        {avatar}
                      </a>
                    ) : (
                      avatar
                    )}
                    <NameLine t={t} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {open !== null && videos[open] && (
        <VideoLightbox t={videos[open].t} embed={videos[open].embed} onClose={close} />
      )}
    </section>
  );
}
