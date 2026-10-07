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

      <section className="band">
        <div className="wrap page-head">
          <span className="eyebrow">{topics.length} Topics</span>
          <h1 className="page-title">Topics</h1>
          <p className="lede">
            Every episode with a transcript is tagged against one fixed taxonomy. Pick a
            subject to get the episodes, the written analysis and the questions answered on it.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap page-body">
          {topics.length === 0 && (
            <p className="lede" style={{ marginTop: 0, color: 'var(--text-muted)' }}>
              No topics yet — check back as more episodes get transcript coverage.
            </p>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {topics.map((t) => (
              <Link key={t.slug} href={`/topics/${t.slug}`} className="pill" style={{ fontSize: '14px', padding: '10px 18px' }}>
                {t.topic} <span className="count">· {t.count}</span>
              </Link>
            ))}
          </div>
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
