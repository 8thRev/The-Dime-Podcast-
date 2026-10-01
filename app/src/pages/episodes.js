import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getEpisodeIndex } from '@/lib/episodeIndex';
import { searchEpisodes } from '@/lib/episodeSearch';
import { createCollectionPageSchema } from '@/lib/schema';
import { useSearchTracking, trackSearchResultClick } from '@/lib/useSearchTracking';

// Also the component behind /episodes?q= (src/pages/episodes/search.js),
// which renders it on the server with `initialQuery` set, so the result list
// is in the HTML an agent fetches rather than filtered in the browser.
export default function Episodes({ allEpisodes, initialQuery = '', searchPage = false }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  // A count, so the length of the list, not the highest episode number:
  // see getStaticProps in src/pages/index.js for why those differ.
  const episodeCount = allEpisodes.length;

  // A request with ?q= is rewritten to the server rendered search page and
  // arrives with initialQuery already set. This covers the rest: a cached
  // static copy reached with a query some other way. On a statically
  // optimized page router.query/isReady are unreliable (isReady can stay
  // false), so read the query straight from the URL on mount.
  useEffect(() => {
    if (initialQuery) return;
    const q = new URLSearchParams(window.location.search).get('q') || '';
    if (q) setQuery(q);
  }, [initialQuery]);

  // The static page and the search page share this component, so React keeps
  // `query` across a client navigation between them. Without this, clicking
  // the header's Episodes link mid-search landed on /episodes with the list
  // still filtered. Every completed navigation re-reads q from the new URL.
  useEffect(() => {
    const onDone = (url) => {
      setQuery(new URL(url, window.location.origin).searchParams.get('q') || '');
    };
    router.events.on('routeChangeComplete', onDone);
    return () => router.events.off('routeChangeComplete', onDone);
  }, [router.events]);

  const onSearch = (value) => {
    setQuery(value);
    // Keep the URL in sync (replace, not push, so typing doesn't spam history)
    // so any filtered view can be linked to or crawled directly.
    const url = value ? `/episodes?q=${encodeURIComponent(value)}` : '/episodes';
    // history.replaceState, not router.replace. The router resolves a ?q=
    // URL through the rewrite in next.config.js to /episodes/search, a
    // different page, so even a shallow replace became a server render on the
    // first keystroke. Nothing here needs the router to know: the list is
    // driven by `query`, and Next's own fields in history.state are kept so
    // back and forward still route (to the server rendered result page).
    const state = window.history.state || {};
    window.history.replaceState({ ...state, url, as: url }, '', url);
  };

  const filtered = searchEpisodes(allEpisodes, query);

  // One search event per pause in typing (docs/analytics-spec.md Part 2.4).
  useSearchTracking(query, filtered.length);

  const collectionSchema = createCollectionPageSchema(
    {
      name: 'All Episodes — The Dime Podcast',
      description: `Browse all ${episodeCount} episodes of The Dime.`,
      url: 'https://www.dimepodcast.com/episodes',
    },
    allEpisodes.slice(0, 50).map((ep) => ({
      name: ep.title,
      url: `https://www.dimepodcast.com/episodes/${ep.slug}`,
    }))
  );

  return (
    <>
      <SeoHead
        title="All Episodes"
        description={`Browse all ${episodeCount} episodes of The Dime. Conversations with cannabis founders, executives, and investors on strategy, capital, and operations.`}
        path="/episodes"
        // A result page is for whoever asked, not for the index: one per
        // query would be endless thin near-duplicates of this archive.
        noindex={searchPage}
        markdownAlternate={`https://www.dimepodcast.com/episodes.md${query.trim() ? `?q=${encodeURIComponent(query.trim())}` : ''}`}
      />
      <Schema schema={collectionSchema} />
      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>Archive · {episodeCount} Episodes</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 40 }}>
          <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,88px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.9 }}>
            All Episodes
          </h1>
          <input
            placeholder="Search guest, topic, title..."
            value={query}
            onChange={(e) => onSearch(e.target.value)}
            style={{ width: 280, background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: 'var(--font-display)', fontSize: '13px', padding: '14px 16px', outline: 'none' }}
          />
        </div>

        {query.trim() && (
          <p className="mono" role="status" style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '.08em', marginBottom: 8 }}>
            {filtered.length} of {episodeCount} episodes match &ldquo;{query.trim()}&rdquo;
          </p>
        )}

        {filtered.map((ep, i) => (
          <Link
            key={i}
            href={`/episodes/${ep.slug}`}
            style={{
              padding: '28px 0',
              borderBottom: '1px solid var(--faint)',
              transition: 'background .15s',
              cursor: 'pointer',
              display: 'grid',
              gridTemplateColumns: '60px 1fr 80px',
              gap: 28,
              alignItems: 'start',
              textDecoration: 'none',
              color: 'inherit',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(60,184,240,.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            onClick={() => trackSearchResultClick(query, i, ep.slug)}
          >
            <div>
              <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', letterSpacing: '.12em' }}>Ep.{ep.num}</div>
              <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)', marginTop: 4 }}>
                {ep.date}
              </div>
            </div>
            <div>
              <div className="crimson" style={{ fontSize: '21px', fontWeight: 600, color: 'var(--text-headline)', marginBottom: 8, lineHeight: 1.25 }}>
                {ep.title}
              </div>
              <div className="syne" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 10, letterSpacing: '.04em' }}>
                {ep.guest}
              </div>
              <p className="crimson" style={{ fontSize: '14px', color: 'var(--text-muted)', lineHeight: 1.75, maxWidth: 600, fontWeight: 300 }}>
                {ep.description}
              </p>
            </div>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', paddingTop: 2 }}>
              {ep.duration}
            </div>
          </Link>
        ))}

        {!filtered.length && (
          <p className="crimson" style={{ color: 'var(--text-muted)', padding: '48px 0', fontSize: 16 }}>
            No episodes found.
          </p>
        )}
      </section>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  return {
    props: {
      allEpisodes: await getEpisodeIndex(),
    },
    revalidate: 3600,
  };
}
