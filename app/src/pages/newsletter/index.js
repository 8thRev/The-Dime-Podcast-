import { Fragment } from 'react';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';
import { getAllEditions, toCard } from '@/lib/newsletter';
import { createCollectionPageSchema } from '@/lib/schema';
import { NEWSLETTER_PITCH, NEWSLETTER_CADENCE } from '@/lib/newsletterCopy';

export async function getStaticProps() {
  // toCard() keeps only what this page renders — date, guest, title, blurb.
  // Shipping the full markdown body (31 × ~600 words), or even the leftover
  // linkedinUrl/topics/episodeSlug fields, into __NEXT_DATA__ is the
  // payload-bloat trap already fixed on /episodes (see SEO_ROADMAP.md).
  const editions = getAllEditions().map(toCard);
  return { props: { editions }, revalidate: 3600 };
}

// "Aug 4, 2026": the archive's meta column is 104px wide, and the prose
// form ("August 4, 2026") wrapped the year onto its own line in every row.
// `date` is the full ISO timestamp normalizeDate() produces, read in UTC so
// a midnight date does not slip a day on a server west of Greenwich.
function shortDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
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

  const latest = editions[0] || null;
  const firstYear = editions.length ? editions[editions.length - 1].date.slice(0, 4) : '';

  // Group by year, newest first. getAllEditions() already sorts by date
  // descending, so the first edition seen in each year is its newest.
  const byYear = [];
  for (const edition of editions) {
    const year = edition.date.slice(0, 4);
    const group = byYear[byYear.length - 1];
    if (group && group.year === year) group.items.push(edition);
    else byYear.push({ year, items: [edition] });
  }

  return (
    <>
      <SeoHead
        title="First Principles Newsletter"
        description="One structural insight per episode. 550-650 words, one idea, no fluff. Free newsletter for cannabis operators."
        path="/newsletter"
      />

      {collectionSchema && <Schema schema={collectionSchema} />}

      <Header />

      <section className="band">
        <div className="wrap page-head nl-hero">
          <div>
            <span className="eyebrow eyebrow--accent">First Principles</span>
            <h1 className="page-title">
              The insight<br />
              behind<br />
              the episode.
            </h1>
            <p className="lede">{NEWSLETTER_PITCH}</p>
            {/* The byline is on this page, not only on each edition, because
                /answers has an archive index that names its author and
                labels him AI. Two archive pages where only the AI one is
                attributed reads backwards. Says "written by", not just the
                name, so the contrast with the Answers banner is explicit. */}
            <p className="meta" style={{ marginTop: 24 }}>
              Written by Bryan Fields. Every edition by hand.
            </p>
            <p className="meta">
              {NEWSLETTER_CADENCE}
              {editions.length > 0 && (
                <>
                  {' '}{editions.length} editions since {firstYear}.{' '}
                  <Link href="/newsletter/rss.xml">RSS feed</Link>
                </>
              )}
            </p>
          </div>

          <div className="card-panel">
            <span className="eyebrow" style={{ marginBottom: 14 }}>Free, by email</span>
            <ul className="nl-benefits">
              <li>One structural idea per edition, 550 to 650 words.</li>
              <li>Written after the episode, not transcribed from it.</li>
              <li>Every edition links back to the episode it came from.</li>
            </ul>
            <ConvertKitEmbed location="newsletter_page" />
            <p className="meta" style={{ marginTop: 14 }}>
              Operator intelligence only. Unsubscribe anytime.
            </p>
            {latest && (
              <p className="meta">
                Not sure yet? <Link href={`/newsletter/${latest.slug}`}>Read the latest edition</Link> first.
              </p>
            )}
          </div>
        </div>
      </section>

      {editions.length > 0 && (
        <section>
          <div className="wrap page-body archive-grid">
            <div>
              <h2 className="section-label" style={{ marginBottom: 0 }}>
                The archive · {editions.length} edition{editions.length === 1 ? '' : 's'}
              </h2>

              {byYear.map((group) => (
                <Fragment key={group.year}>
                  <div className="archive-year" id={`year-${group.year}`}>{group.year}</div>
                  {group.items.map((edition) => (
                    <Link key={edition.slug} href={`/newsletter/${edition.slug}`} className="list-row">
                      <div className="list-meta">
                        <span>{shortDate(edition.date)}</span>
                        {edition.guest && <span>{edition.guest}</span>}
                      </div>
                      <div>
                        <div className="list-title">
                          {edition.title}
                          {latest && edition.slug === latest.slug && <>{' '}<span className="is-latest">Latest</span></>}
                        </div>
                        <p className="list-desc">{edition.description}</p>
                      </div>
                    </Link>
                  ))}
                </Fragment>
              ))}
            </div>

            <aside className="archive-aside" aria-label="Browse the archive">
              <div className="archive-aside-inner">
                <span className="eyebrow" style={{ marginBottom: 12 }}>Jump to</span>
                <nav className="year-nav">
                  {byYear.map((group) => (
                    <a key={group.year} href={`#year-${group.year}`}>
                      {group.year} <span className="count">· {group.items.length}</span>
                    </a>
                  ))}
                </nav>
                <span className="eyebrow" style={{ margin: '28px 0 12px' }}>Also on The Dime</span>
                <nav className="year-nav">
                  <Link href="/answers">Answers, the AI-written column</Link>
                  <Link href="/topics">Browse by topic</Link>
                  <Link href="/episodes">All episodes</Link>
                </nav>
              </div>
            </aside>
          </div>
        </section>
      )}

      <Footer />
    </>
  );
}
