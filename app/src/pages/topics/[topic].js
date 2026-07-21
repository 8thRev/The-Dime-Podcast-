import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllTopics, getEpisodesByTopicSlug } from '@/lib/topics';
import { createBreadcrumbSchema } from '@/lib/schema';

export async function getStaticPaths() {
  const topics = await getAllTopics();
  return {
    paths: topics.map((t) => ({ params: { topic: t.slug } })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const result = await getEpisodesByTopicSlug(params.topic);
  if (!result) {
    return { notFound: true };
  }

  return {
    props: { topic: result.topic, episodes: result.episodes, topicSlug: params.topic },
    revalidate: 3600,
  };
}

export default function TopicPage({ topic, episodes, topicSlug }) {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com' },
    { name: 'Topics', url: 'https://www.dimepodcast.com/topics' },
    { name: topic, url: `https://www.dimepodcast.com/topics/${topicSlug}` },
  ]);

  return (
    <>
      <SeoHead
        title={topic}
        description={`Episodes of The Dime Podcast covering ${topic}: cannabis business conversations with founders, executives, and investors.`}
        path={`/topics/${topicSlug}`}
      />

      <Schema schema={breadcrumbSchema} />

      <Header />

      <section style={{ padding: '72px 48px 60px', borderBottom: '1px solid var(--faint)' }}>
        <Link href="/topics" style={{ color: 'var(--text-accent)', textDecoration: 'none', marginBottom: '32px', display: 'block', fontWeight: 600 }}>
          ← All Topics
        </Link>

        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 12 }}>
          Topic · {episodes.length} Episode{episodes.length === 1 ? '' : 's'}
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(40px,6vw,72px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.95, marginBottom: 40 }}>
          {topic}
        </h1>

        {episodes.map((ep) => (
          <Link
            key={ep.slug}
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
              <div className="syne" style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', letterSpacing: '.04em' }}>
                {ep.guest}
              </div>
            </div>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', textAlign: 'right', paddingTop: 2 }}>
              {ep.duration}
            </div>
          </Link>
        ))}
      </section>

      <Footer />
    </>
  );
}
