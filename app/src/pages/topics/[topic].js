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
        markdownAlternate
      />

      <Schema schema={breadcrumbSchema} />
      <Schema schema={collectionSchema} />

      <Header />

      <section>
        <div className="wrap page-head" style={{ paddingBottom: 0 }}>
        <Link href="/topics" className="back-link">
          ← All Topics
        </Link>

        <span className="eyebrow">Topic · {episodes.length} Episode{episodes.length === 1 ? '' : 's'}</span>
        <h1 className="page-title" style={{ marginBottom: 40 }}>
          {topic}
        </h1>

        {/* Above the episode list on purpose: a topic hub is otherwise a bare
            list of links, and the written editions are the only prose on it —
            the part a search or answer engine can actually quote. */}
        {editions.length > 0 && (
          <div style={{ marginBottom: 48, paddingBottom: 8 }}>
            <h2 className="section-label">Analysis on {topic}</h2>
            {editions.map((e) => (
              <Link
                key={e.slug}
                href={`/newsletter/${e.slug}`}
                style={{ display: 'block', padding: '18px 0 18px 20px', borderLeft: '3px solid var(--text-accent)', marginBottom: 12, textDecoration: 'none', color: 'inherit' }}
              >
                <div className="list-title" style={{ fontSize: '22px' }}>
                  {e.title}
                </div>
                <p className="list-desc">
                  {e.description}
                </p>
                <div className="meta" style={{ marginTop: 6 }}>
                  First Principles{e.dateDisplay && ` · ${e.dateDisplay}`}
                </div>
              </Link>
            ))}
          </div>
        )}

        {episodes.map((ep) => (
          <Link key={ep.slug} href={`/episodes/${ep.slug}`} className="list-row">
            <div className="list-meta">
              <span className="num">Ep. {ep.num}</span>
              <span>{ep.date}</span>
              {ep.duration && <span>{ep.duration}</span>}
            </div>
            <div>
              <div className="list-title">{ep.title}</div>
              {ep.guest && ep.guest !== 'Guest' && <div className="list-sub">{ep.guest}</div>}
            </div>
          </Link>
        ))}
        </div>
      </section>

      <Footer />
    </>
  );
}
