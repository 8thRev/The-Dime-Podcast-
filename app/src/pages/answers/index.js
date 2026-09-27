// src/pages/answers/index.js
// The Answers archive. Deliberately plainer than /newsletter: no signup
// form, no hero pitch. This is a question index, and the job of the page is
// to put as many real questions in server HTML as possible, each one a link
// to the page that answers it.
//
// No ConvertKitEmbed here on purpose. `signup_location` is an enumerated
// GA4 dimension (docs/analytics-spec.md Part 1) and adding a sixth value
// fragments it until it is registered, so the signup surface waits for that
// registration rather than shipping ahead of it.

import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import AIDisclosure from '@/src/components/AIDisclosure';
import { getAllAnswers, toCard } from '@/lib/answers';
import { COLUMN_AUTHOR, COLUMN_AUTHOR_ROLE } from '@/lib/answersColumn';
import { createCollectionPageSchema } from '@/lib/schema';

export async function getStaticProps() {
  // toCard() keeps slug, title, date and the standfirst. The faq arrays and
  // bodies are the bulk of this content type and none of it renders here;
  // shipping them into __NEXT_DATA__ is the payload trap already fixed on
  // /episodes and /newsletter.
  const posts = getAllAnswers().map(toCard);
  return { props: { posts }, revalidate: 3600 };
}

export default function AnswersIndex({ posts }) {
  const collectionSchema = posts.length
    ? createCollectionPageSchema(
        {
          name: 'Answers',
          description:
            'Short answers to the questions cannabis operators ask, drawn from The Dime Podcast episode catalogue.',
          url: 'https://www.dimepodcast.com/answers',
        },
        posts.map((p) => ({
          name: p.title,
          url: `https://www.dimepodcast.com/answers/${p.slug}`,
        }))
      )
    : null;

  return (
    <>
      <SeoHead
        title="Answers"
        description="Short answers to the questions cannabis operators ask, drawn from 300+ episodes of The Dime Podcast."
        path="/answers"
      />

      {collectionSchema && <Schema schema={collectionSchema} />}

      <Header />

      <section style={{ padding: '80px 48px 60px', maxWidth: 680 }}>
        <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 16 }}>
          Answers
        </div>
        {/* The 34px floor is set by the longest word in the headline, not by
            taste. At 48px, "question." and "attached." are 384px wide inside a
            279px content box at 375px viewport, which gave the whole page a
            horizontal scroll. Re-measure before raising it. */}
        <h1 className="syne" style={{ fontSize: 'clamp(34px,7.5vw,78px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.9, marginBottom: 32 }}>
          One question.<br />
          One answer.<br />
          Receipts attached.
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', marginBottom: 24, fontWeight: 300 }}>
          Operators keep asking the same questions about capital, licensing, margin and
          regulation. This column answers one at a time, takes a position, and cites the
          episodes the answer came from so you can hear the operator say it themselves.
        </p>

        <AIDisclosure>
          Written by {COLUMN_AUTHOR}, {COLUMN_AUTHOR_ROLE}. Sourced from our episodes and reviewed before publishing.
        </AIDisclosure>
      </section>

      {posts.length > 0 ? (
        <section style={{ padding: '0 48px 80px', maxWidth: 860 }}>
          <h2 className="syne" style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, paddingTop: 40, borderTop: '1px solid var(--border-default)' }}>
            Every question
          </h2>
          <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 40 }}>
            {posts.length} answer{posts.length === 1 ? '' : 's'}
          </p>

          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/answers/${post.slug}`}
              style={{ display: 'block', padding: '24px 0', borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none', color: 'inherit' }}
            >
              <h3 className="syne" style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: '10px', lineHeight: 1.35 }}>
                {post.title}
              </h3>
              <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--text-secondary)', margin: '0 0 10px' }}>
                {post.summary}
              </p>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                {post.dateDisplay}
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <section style={{ padding: '0 48px 80px', maxWidth: 680 }}>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-muted)' }}>
            The first answers are on their way. In the meantime, the{' '}
            <Link href="/episodes" style={{ color: 'var(--text-accent)' }}>
              episode archive
            </Link>{' '}
            and{' '}
            <Link href="/newsletter" style={{ color: 'var(--text-accent)' }}>
              First Principles
            </Link>{' '}
            are where the source material lives.
          </p>
        </section>
      )}

      <Footer />
    </>
  );
}
