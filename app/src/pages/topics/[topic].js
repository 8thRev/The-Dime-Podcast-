import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { getAllTopics, getEpisodesByTopicSlug } from '@/lib/topics';
import { getEditionsForTopic, toCard } from '@/lib/newsletter';
import { createBreadcrumbSchema, createCollectionPageSchema } from '@/lib/schema';

const SITE_URL = 'https://www.dimepodcast.com';

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
    props: {
      topic: result.topic,
      episodes: result.episodes,
      topicSlug: params.topic,
      editions: getEditionsForTopic(params.topic).map(toCard),
    },
    revalidate: 3600,
  };
}

export default function TopicPage({ topic, episodes, topicSlug, editions = [] }) {
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: SITE_URL },
    { name: 'Topics', url: `${SITE_URL}/topics` },
    { name: topic, url: `${SITE_URL}/topics/${topicSlug}` },
  ]);

  // These hubs are the site's longest pages (~24k words) and until now carried
  // only a BreadcrumbList — structurally indistinguishable from a wall of text.
  // CollectionPage + ItemList states what the page actually is: the curated
  // index of this subject, with the episodes it indexes named in order.
  //
  // Episodes only, not the First Principles editions rendered further down.
  // ItemList is an ordering claim over one kind of thing, and the two lists
  // have different types (PodcastEpisode vs Article) and different orderings
  // (this list is the topic's episodes as getEpisodesByTopicSlug returns them).
  // The editions reach crawlers through their own Article schema on
  // /newsletter/[slug], which is the page that owns them.
  const collectionSchema = createCollectionPageSchema(
    {
      name: topic,
      description: `Every episode of The Dime Podcast covering ${topic}.`,
      url: `${SITE_URL}/topics/${topicSlug}`,
    },
    episodes.map((ep) => ({
      name: ep.title,
      url: `${SITE_URL}/episodes/${ep.slug}`,
    }))
  );

  return (
    <>
      <SeoHead
        title={topic}
        description={`Episodes of The Dime Podcast covering ${topic}: cannabis business conversations with founders, executives, and investors.`}
        path={`/topics/${topicSlug}`}
      />

      <Schema schema={breadcrumbSchema} />
      <Schema schema={collectionSchema} />

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

        {/* Above the episode list on purpose: a topic hub is otherwise a bare
            list of links, and the written editions are the only prose on it —
            the part a search or answer engine can actually quote. */}
        {editions.length > 0 && (
          <div style={{ marginBottom: 48, paddingBottom: 8 }}>
            <h2 className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 20 }}>
              Analysis on {topic}
            </h2>
            {editions.map((e) => (
              <Link
                key={e.slug}
                href={`/newsletter/${e.slug}`}
                style={{ display: 'block', padding: '18px 0 18px 20px', borderLeft: '3px solid var(--text-accent)', marginBottom: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <div className="crimson" style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-headline)', marginBottom: 6, lineHeight: 1.3 }}>
                  {e.title}
                </div>
                <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {e.description}
                </div>
                <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                  First Principles{e.dateDisplay && ` · ${e.dateDisplay}`}
                </div>
              </Link>
            ))}
          </div>
        )}

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
