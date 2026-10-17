// Share controls for a First Principles edition: copy link, LinkedIn, X,
// email, and the phone's own share sheet where the browser has one.
//
// Plain links to each network's share URL, no third-party widget, so there is
// no outside script on the page and nothing that tracks the reader.
//
// The LinkedIn, X and email links carry UTMs so a reader's share is
// distinguishable from the show's own posts (docs/utm-conventions.md). The
// copied link and the native sheet stay clean: those get pasted into chats
// and texts, where a long tracked URL is what makes people trim it by hand.

import { useEffect, useState } from 'react';
import { trackEditionShare } from '@/lib/editionShare';

const SITE = 'https://www.dimepodcast.com';

function tagged(url, source, slug) {
  const u = new URL(url);
  u.searchParams.set('utm_source', source);
  u.searchParams.set('utm_medium', 'reader_share');
  u.searchParams.set('utm_campaign', `fp_${slug}`);
  return u.toString();
}

const ICONS = {
  link: <path d="M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a1 1 0 1 1 1.4 1.4L12 13.4a1 1 0 0 1-1.4 0zM8.5 19a4.5 4.5 0 0 1-3.2-7.7l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1a2.5 2.5 0 0 0 3.5 3.5l2.1-2.1a1 1 0 0 1 1.4 1.4l-2.1 2.1A4.5 4.5 0 0 1 8.5 19zm7.4-4.8a1 1 0 0 1-.7-1.7l2.1-2.1a2.5 2.5 0 0 0-3.5-3.5l-2.1 2.1a1 1 0 0 1-1.4-1.4l2.1-2.1a4.5 4.5 0 0 1 6.4 6.4l-2.1 2.1a1 1 0 0 1-.8.2z" />,
  linkedin: <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z" />,
  x: <path d="M18.24 2.25h3.31l-7.23 8.26 8.5 11.24h-6.66l-5.21-6.82-5.97 6.82H1.67l7.73-8.84L1.25 2.25h6.83l4.71 6.23 5.45-6.23zm-1.16 17.52h1.83L7.08 4.13H5.12l11.96 15.64z" />,
  email: <path d="M3 5h18a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm1 2.4V17h16V7.4l-7.4 5.4a1 1 0 0 1-1.2 0L4 7.4zM5.8 7l6.2 4.5L18.2 7H5.8z" />,
  share: <path d="M12 2.6l4.7 4.7-1.4 1.4L13 6.4V15h-2V6.4L8.7 8.7 7.3 7.3 12 2.6zM5 11h2v8h10v-8h2v10H5V11z" />,
};

const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">{ICONS[name]}</svg>
);

export default function ShareRow({ slug, title }) {
  const url = `${SITE}/newsletter/${slug}`;
  const [copied, setCopied] = useState(false);
  // Only rendered after mount: navigator.share does not exist on the server,
  // and on most desktop browsers it does not exist at all.
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(typeof navigator !== 'undefined' && typeof navigator.share === 'function');
  }, []);

  const copy = async () => {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // The async clipboard is refused in some embedded browsers and
      // permission setups. The old selection copy still works in most of them.
      const field = document.createElement('textarea');
      field.value = url;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      try {
        ok = document.execCommand('copy');
      } catch {
        ok = false;
      }
      field.remove();
    }
    // Nothing copied means nothing shared, so nothing is tracked.
    if (!ok) return;
    setCopied(true);
    trackEditionShare('copy_link');
    setTimeout(() => setCopied(false), 2000);
  };

  const nativeShare = async () => {
    try {
      await navigator.share({ title, url });
      trackEditionShare('native');
    } catch {
      // Dismissed the sheet. Not a share.
    }
  };

  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(tagged(url, 'linkedin', slug))}`;
  const x = `https://x.com/intent/post?text=${encodeURIComponent(title)}&url=${encodeURIComponent(tagged(url, 'x', slug))}`;
  const email = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`${title}\n\n${tagged(url, 'email', slug)}`)}`;

  return (
    <div className="share-row" role="group" aria-label="Share this edition">
      <span className="meta share-row-label">Share</span>
      {canNativeShare && (
        <button type="button" className="listen-chip" onClick={nativeShare}>
          <Icon name="share" />
          Share
        </button>
      )}
      <button type="button" className="listen-chip" onClick={copy} aria-live="polite">
        <Icon name="link" />
        {copied ? 'Link copied' : 'Copy link'}
      </button>
      <a href={linkedin} target="_blank" rel="noopener noreferrer" className="listen-chip" onClick={() => trackEditionShare('linkedin')}>
        <Icon name="linkedin" />
        LinkedIn
      </a>
      <a href={x} target="_blank" rel="noopener noreferrer" className="listen-chip" onClick={() => trackEditionShare('x')} aria-label="Share on X">
        <Icon name="x" />
        X
      </a>
      <a href={email} className="listen-chip" onClick={() => trackEditionShare('email')}>
        <Icon name="email" />
        Email
      </a>
    </div>
  );
}
