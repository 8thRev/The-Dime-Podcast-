import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';
import { getAllEditions, toCard } from '@/lib/newsletter';
import { createCollectionPageSchema } from '@/lib/schema';

export async function getStaticProps() {
  // toCard() keeps only what this page renders — date, guest, title, blurb.
  // Shipping the full markdown body (31 × ~600 words), or even the leftover
  // linkedinUrl/topics/episodeSlug fields, into __NEXT_DATA__ is the
  // payload-bloat trap already fixed on /episodes (see SEO_ROADMAP.md).
  const editions = getAllEditions().map(toCard);
  return { props: { editions }, revalidate: 3600 };
}

export default function Newsletter({ editions }) {
  const collectionSchema = editions.length
    ? createCollectionPageSchema(
        {
          name: 'First Principles',
          description:
            'Written analysis from The Dime Podcast. One structural insight per episode, for cannabis operators.',
          url: 'https://www.dimepodcast.com/newsletter',
        },
        editions.map((e) => ({
          name: e.title,
          url: `https://www.dimepodcast.com/newsletter/${e.slug}`,
        }))
      )
    : null;

  return (
    <>
      <SeoHead
        title="First Principles Newsletter"
        description="One structural insight per episode. 550-650 words, one idea, no fluff. Free weekly newsletter for cannabis operators."
        path="/newsletter"
      />

      {collectionSchema && <Schema schema={collectionSchema} />}

      <Header />

      <section style={{ padding: '80px 48px 60px', maxWidth: 680 }}>
        <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 16 }}>
          First Principles
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(52px,8vw,84px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.02em', lineHeight: 0.88, marginBottom: 32 }}>
          The insight<br />
          behind<br />
          the episode.
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', marginBottom: 16, fontWeight: 300 }}>
          Every episode produces a newsletter. Not a recap. The structural principle underneath the conversation, written for operators who need to understand what&apos;s actually happening before the market makes it obvious.
        </p>
        <p className="syne" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 48, letterSpacing: '.08em', fontWeight: 600, textTransform: 'uppercase' }}>
          550-650 WORDS · ONE IDEA · NO NOISE · FREE
        </p>

        <ConvertKitEmbed />

        <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 16 }}>
          Operator intelligence only. Unsubscribe anytime.
        </p>
      </section>

      {editions.length > 0 && (
        <section style={{ padding: '0 48px 80px', maxWidth: 860 }}>
          <h2 className="syne" style={{ fontSize: '12px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, paddingTop: 40, borderTop: '1px solid var(--border-default)' }}>
            The Archive
          </h2>
          <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: 40 }}>
            {editions.length} edition{editions.length === 1 ? '' : 's'}
          </p>

          {editions.map((edition) => (
            <Link
              key={edition.slug}
              href={`/newsletter/${edition.slug}`}
              style={{
                display: 'block',
                padding: '28px 0',
                borderBottom: '1px solid var(--border-subtle)',
                textDecoration: 'none',
                color: 'inherit',
                transition: 'background .15s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(60,184,240,.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '.12em', marginBottom: 8 }}>
                {edition.dateDisplay}
                {edition.guest && <span style={{ color: 'var(--text-accent)' }}> · {edition.guest}</span>}
              </div>
              <div className="crimson" style={{ fontSize: '22px', fontWeight: 600, color: 'var(--text-headline)', marginBottom: 8, lineHeight: 1.25 }}>
                {edition.title}
              </div>
              <div style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
                {edition.description}
              </div>
            </Link>
          ))}
        </section>
      )}

      <Footer />
    </>
  );
}
