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

      <section className="band">
        <div className="wrap wrap--prose page-head">
          <span className="eyebrow eyebrow--accent">Answers</span>
          <h1 className="page-title">
            One question.<br />
            One answer.<br />
            Receipts attached.
          </h1>
          <p className="lede">
            Operators keep asking the same questions about capital, licensing, margin and
            regulation. This column answers one at a time, takes a position, and cites the
            episodes the answer came from so you can hear the operator say it themselves.
          </p>
          <div style={{ marginTop: 28 }}>
            <AIDisclosure>
              Written by {COLUMN_AUTHOR}, {COLUMN_AUTHOR_ROLE}. Sourced from our episodes and reviewed before publishing.
            </AIDisclosure>
          </div>
        </div>
      </section>

      {posts.length > 0 ? (
        <section>
          <div className="wrap wrap--prose page-body">
            <h2 className="section-label">
              Every question · {posts.length} answer{posts.length === 1 ? '' : 's'}
            </h2>

            {posts.map((post) => (
              <Link key={post.slug} href={`/answers/${post.slug}`} className="list-row">
                <div className="list-meta">
                  <span>{post.dateDisplay}</span>
                </div>
                <div>
                  <h3 className="list-title">{post.title}</h3>
                  <p className="list-desc">{post.summary}</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      ) : (
        <section>
          <div className="wrap wrap--prose page-body">
            <p className="lede" style={{ marginTop: 0 }}>
              The first answers are on their way. In the meantime, the{' '}
              <Link href="/episodes">episode archive</Link> and{' '}
              <Link href="/newsletter">First Principles</Link> are where the source material lives.
            </p>
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
