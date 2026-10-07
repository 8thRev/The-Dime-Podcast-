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

      <section className="band">
        <div className="wrap page-head">
          <span className="eyebrow">Archive · {episodeCount} Episodes</span>
          <div className="page-head-row">
            <h1 className="page-title">All Episodes</h1>
            <label style={{ flex: '1 1 280px', maxWidth: 360 }}>
              <span className="sr-only" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>Search episodes</span>
              <input
                type="search"
                className="search-input"
                placeholder="Search guest, topic, title..."
                value={query}
                onChange={(e) => onSearch(e.target.value)}
                style={{ maxWidth: '100%' }}
              />
            </label>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ paddingBottom: 'clamp(56px, 8vw, 96px)' }}>
          {query.trim() && (
            <p className="meta" role="status" style={{ paddingTop: 24 }}>
              {filtered.length} of {episodeCount} episodes match &ldquo;{query.trim()}&rdquo;
            </p>
          )}

          {filtered.map((ep, i) => (
            <Link
              key={ep.slug}
              href={`/episodes/${ep.slug}`}
              className="list-row"
              onClick={() => trackSearchResultClick(query, i, ep.slug)}
            >
              <div className="list-meta">
                <span className="num">Ep. {ep.num}</span>
                <span>{ep.date}</span>
                {ep.duration && <span>{ep.duration}</span>}
              </div>
              <div>
                <div className="list-title">{ep.title}</div>
                {ep.guest && ep.guest !== 'Guest' && <div className="list-sub">{ep.guest}</div>}
                <p className="list-desc">{ep.description}</p>
              </div>
            </Link>
          ))}

          {!filtered.length && (
            <p className="lede" style={{ padding: '48px 0', color: 'var(--text-muted)' }}>
              No episodes found.
            </p>
          )}
        </div>
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
