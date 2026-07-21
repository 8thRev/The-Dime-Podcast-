import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllTopics } from '@/lib/topics';
import { createCollectionPageSchema } from '@/lib/schema';

export default function Topics({ topics }) {
  const collectionSchema = createCollectionPageSchema(
    {
      name: 'Topics — The Dime Podcast',
      description: 'Browse The Dime Podcast by topic.',
      url: 'https://www.dimepodcast.com/topics',
    },
    topics.map((t) => ({
      name: t.topic,
      url: `https://www.dimepodcast.com/topics/${t.slug}`,
    }))
  );

  return (
    <>
      <SeoHead
        title="Topics"
        description="Browse The Dime Podcast by topic — capital raising, M&A, regulation, rescheduling, and more cannabis business subjects covered across episodes."
        path="/topics"
      />
      <Schema schema={collectionSchema} />
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
