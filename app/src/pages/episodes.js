import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllEpisodes, getLatestEpisodeNumber } from '@/lib/rss';
import { getTranscriptBySlug } from '@/lib/transcripts';
import { createCollectionPageSchema } from '@/lib/schema';

export default function Episodes({ allEpisodes }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const episodeCount = getLatestEpisodeNumber(allEpisodes);

  // Seed the search box from the ?q= param so the SearchAction JSON-LD
  // (lib/schema.ts) resolves to a real, shareable, crawlable result page.
  // On a statically-optimized page router.query/isReady are unreliable
  // (isReady can stay false), so read the query straight from the URL on mount.
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('q') || '';
    if (q) setQuery(q);
  }, []);

  const onSearch = (value) => {
    setQuery(value);
    // Keep the URL in sync (replace, not push, so typing doesn't spam history)
    // so any filtered view can be linked to or crawled directly.
    const url = value ? `/episodes?q=${encodeURIComponent(value)}` : '/episodes';
    router.replace(url, undefined, { shallow: true });
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? allEpisodes.filter((ep) => ep.searchText.includes(q))
    : allEpisodes;

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
            style={{ width: 280, background: 'var(--navy2)', border: '1px solid var(--border)', color: 'var(--white)', fontFamily: "'Syne', sans-serif", fontSize: '13px', padding: '14px 16px', outline: 'none' }}
          />
        </div>

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
  const episodes = await getAllEpisodes();

  // Ship only the fields this list page renders (+ a build-time search string),
  // not the full episode objects. The RSS episode carries the entire
  // `showNotes` HTML blob, which the archive list never displays — including it
  // pushed the page payload past 1.3 MB. The searchText folds in transcript
  // topics + AI summary so the client filter matches more than title/guest,
  // without shipping full transcripts to the browser. Most episodes have no
  // transcript yet (getTranscriptBySlug returns null → RSS fields only).
  const allEpisodes = episodes.map((ep) => {
    const transcript = getTranscriptBySlug(ep.slug);
    const searchText = [
      ep.title,
      ep.guest,
      ep.company,
      ...(ep.tags || []),
      ...(transcript?.topics || []),
      transcript?.summary || '',
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return {
      slug: ep.slug,
      num: ep.num,
      date: ep.date,
      title: ep.title,
      guest: ep.guest,
      description: ep.description,
      duration: ep.duration,
      searchText,
    };
  });

  return {
    props: {
      allEpisodes,
    },
    revalidate: 3600,
  };
}
