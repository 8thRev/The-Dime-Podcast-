// src/pages/answers/[slug].js
// One Answers post. These are AI-written by the Isaac Burner bot, so the
// page is the mirror image of src/pages/newsletter/[slug].js: same article
// furniture, but an <AIDisclosure> banner above the byline, a column byline
// instead of Bryan's, and Organization authorship in the schema.
//
// Three blocks here exist for answer engines specifically and should not be
// rearranged without reading SEO_ROADMAP.md first:
//
//   1. The standfirst directly under the h1. First real prose on the page,
//      and the passage an extraction model quotes when it quotes anything.
//   2. The cited-episodes list, resolved at build time so the citations are
//      in server HTML rather than behind a fetch.
//   3. The visible FAQ, rendered from the same `faq` array that feeds the
//      FAQPage JSON-LD. Google requires the markup's answers to be visible
//      on the page; emitting the schema alone is a structured-data
//      violation, not a shortcut.

import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import AIDisclosure from '@/src/components/AIDisclosure';
import { getAllAnswers, getAnswerBySlug, getRelatedAnswers, renderMarkdown, toListItem } from '@/lib/answers';
import { COLUMN_AUTHOR, COLUMN_AUTHOR_ROLE } from '@/lib/answersColumn';
import { getEpisodeBySlug } from '@/lib/rss';
import { createAnswerSchema, createBreadcrumbSchema, createFAQSchema } from '@/lib/schema';
import { topicToSlug } from '@/lib/topicSlug';

export async function getStaticPaths() {
  return {
    paths: getAllAnswers().map((p) => ({ params: { slug: p.slug } })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const post = getAnswerBySlug(params.slug);
  if (!post) {
    return { notFound: true };
  }

  // Resolve every cited episode at build time, in the order the frontmatter
  // lists them. A slug that is not in the feed (renamed episode, a slug the
  // bot hallucinated) drops out here rather than rendering a 404 link, and
  // the post still publishes with the citations that do resolve.
  const cited = [];
  for (const slug of post.episodes) {
    const match = await getEpisodeBySlug(slug);
    if (!match) continue;
    cited.push({
      slug: match.slug,
      title: match.title,
      num: match.num,
      guest: match.guest && match.guest !== 'Guest' ? match.guest : '',
      date: match.date || '',
    });
  }

  const others = getRelatedAnswers(post.slug, 4).map(toListItem);

  const { body, sourceQuery, ...meta } = post;

  return {
    props: {
      post: meta,
      html: renderMarkdown(body, post.slug),
      cited,
      others,
    },
    revalidate: 3600,
  };
}

export default function AnswerPostPage({ post, html, cited, others }) {
  const articleSchema = createAnswerSchema({
    title: post.title,
    description: post.description,
    slug: post.slug,
    date: post.date,
    episodes: cited.map((e) => e.slug),
    wordCount: post.wordCount,
    author: COLUMN_AUTHOR,
  });
  // The post's own question is the first pair. It is the page's h1 and its
  // answer is the standfirst, so leaving it out would emit a FAQPage whose
  // mainEntity omits the one question the URL is actually about.
  const faqSchema = createFAQSchema([
    { question: post.title, answer: post.summary },
    ...post.faq,
  ]);
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com' },
    { name: 'Answers', url: 'https://www.dimepodcast.com/answers' },
    { name: post.title, url: `https://www.dimepodcast.com/answers/${post.slug}` },
  ]);

  return (
    <>
      <SeoHead
        title={post.metaTitle}
        description={post.description}
        path={`/answers/${post.slug}`}
        ogType="article"
        markdownAlternate
      />

      <Schema schema={articleSchema} />
      <Schema schema={faqSchema} />
      <Schema schema={breadcrumbSchema} />

      <Header />

      <article style={{ padding: '48px', maxWidth: '760px', margin: '0 auto' }}>
        <Link href="/answers" style={{ color: 'var(--text-accent)', textDecoration: 'none', marginBottom: '32px', display: 'block', fontWeight: 600 }}>
          &larr; Answers
        </Link>

        <header style={{ marginBottom: '40px' }}>
          <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 16 }}>
            Answers
          </div>

          <h1 className="syne" style={{ fontSize: 'clamp(28px, 4.2vw, 46px)', fontWeight: 800, lineHeight: 1.12, letterSpacing: '.01em', marginBottom: '24px', color: 'var(--text-headline)' }}>
            {post.title}
          </h1>

          <AIDisclosure>
            Written by {COLUMN_AUTHOR}, {COLUMN_AUTHOR_ROLE}. Sourced from our episodes and reviewed before publishing.
          </AIDisclosure>

          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span>{COLUMN_AUTHOR}</span>
            {post.dateDisplay && <span>{post.dateDisplay}</span>}
            {post.wordCount > 0 && <span>{post.wordCount} words</span>}
          </div>

          {post.topics.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '24px' }}>
              {post.topics.map((topic) => (
                <Link
                  key={topic}
                  href={`/topics/${topicToSlug(topic)}`}
                  className="mono"
                  style={{ fontSize: '10px', color: 'var(--text-accent)', border: '1px solid var(--text-accent)', padding: '4px 12px', fontWeight: 700, textDecoration: 'none' }}
                >
                  {topic}
                </Link>
              ))}
            </div>
          )}
        </header>

        <section
          style={{
            marginBottom: '40px',
            borderLeft: '3px solid var(--text-accent)',
            paddingLeft: '20px',
          }}
        >
          <div className="mono" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
            Short answer
          </div>
          <p className="crimson" style={{ fontSize: '19px', lineHeight: 1.7, color: 'var(--text-headline)', margin: 0, fontWeight: 400 }}>
            {post.summary}
          </p>
        </section>

        <div
          className="prose-body"
          style={{ fontSize: '18px', lineHeight: 1.8, color: 'var(--text-secondary)', fontFamily: "'Crimson Pro', Georgia, serif" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {cited.length > 0 && (
          <section style={{ marginTop: '56px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px 24px', borderRadius: '8px' }}>
            <div className="mono" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Where this comes from
            </div>
            {cited.map((episode) => (
              <div key={episode.slug} style={{ marginBottom: '14px' }}>
                <Link href={`/episodes/${episode.slug}`} style={{ display: 'block', color: 'var(--text-headline)', textDecoration: 'none', fontSize: '16px', fontWeight: 600, lineHeight: 1.35, fontFamily: "'Crimson Pro', Georgia, serif" }}>
                  {episode.title}
                </Link>
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Ep. {episode.num}
                  {episode.guest && ` · ${episode.guest}`}
                  {episode.date && ` · ${episode.date}`}
                </div>
              </div>
            ))}
          </section>
        )}

        {post.faq.length > 0 && (
          <section style={{ marginTop: '56px', paddingTop: '32px', borderTop: '1px solid var(--border-default)' }}>
            <h2 className="syne" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: '24px' }}>
              Related questions
            </h2>
            {post.faq.map((pair) => (
              <div key={pair.question} style={{ marginBottom: '28px' }}>
                <h3 className="syne" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: '8px', lineHeight: 1.4 }}>
                  {pair.question}
                </h3>
                <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.75, color: 'var(--text-secondary)', margin: 0 }}>
                  {pair.answer}
                </p>
              </div>
            ))}
          </section>
        )}

        {others.length > 0 && (
          <aside style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)' }}>
              More answers
            </h2>
            {others.map((p) => (
              <Link
                key={p.slug}
                href={`/answers/${p.slug}`}
                style={{ display: 'block', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none', color: 'inherit' }}
              >
                <div className="crimson" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-headline)', marginBottom: '4px' }}>
                  {p.title}
                </div>
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {p.dateDisplay}
                </div>
              </Link>
            ))}
          </aside>
        )}
      </article>

      <Footer />
    </>
  );
}
