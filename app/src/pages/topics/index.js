import Head from 'next/head';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import { getAllTopics } from '@/lib/topics';

export default function Topics({ topics }) {
  return (
    <>
      <Head>
        <title>Topics — The Dime Podcast</title>
        <meta name="description" content="Browse The Dime Podcast by topic — capital raising, M&A, regulation, rescheduling, and more cannabis business subjects covered across episodes." />
        <link rel="canonical" href="https://www.dimepodcast.com/topics" />
        <meta property="og:title" content="Topics — The Dime Podcast" />
        <meta property="og:description" content="Browse every episode by subject." />
        <meta property="og:url" content="https://www.dimepodcast.com/topics" />
      </Head>
      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
          {topics.length} Topics
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,88px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.9, marginBottom: 40 }}>
          Topics
        </h1>

        {topics.length === 0 && (
          <p className="crimson" style={{ color: 'var(--text-muted)', padding: '48px 0', fontSize: 16 }}>
            No topics yet — check back as more episodes get transcript coverage.
          </p>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          {topics.map((t) => (
            <Link
              key={t.slug}
              href={`/topics/${t.slug}`}
              className="mono"
              style={{
                fontSize: '13px',
                fontWeight: 700,
                color: 'var(--text-accent)',
                border: '1px solid var(--text-accent)',
                borderRadius: '999px',
                padding: '8px 18px',
                textDecoration: 'none',
              }}
            >
              {t.topic} <span style={{ color: 'var(--text-muted)' }}>· {t.count}</span>
            </Link>
          ))}
        </div>
      </section>

      <Footer />
    </>
  );
}

export async function getStaticProps() {
  const topics = await getAllTopics();
  return {
    props: { topics },
    revalidate: 3600,
  };
}
