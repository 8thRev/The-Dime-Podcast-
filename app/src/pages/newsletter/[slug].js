// src/pages/newsletter/[slug].js
// A single First Principles edition. These are human-written articles, not
// AI artifacts — hence a Person byline, Article schema, and deliberately no
// <AIDisclosure> (which every transcript-derived section on the site carries).

import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';
import { getAllEditions, getEditionBySlug, getRelatedEditions, renderMarkdown, toListItem } from '@/lib/newsletter';
import { getEpisodeBySlug } from '@/lib/rss';
import { createArticleSchema, createBreadcrumbSchema } from '@/lib/schema';
import { topicToSlug } from '@/lib/topicSlug';
import { guestToSlug, getAllGuests } from '@/lib/guests';

export async function getStaticPaths() {
  return {
    paths: getAllEditions().map((e) => ({ params: { slug: e.slug } })),
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const edition = getEditionBySlug(params.slug);
  if (!edition) {
    return { notFound: true };
  }

  // Resolve the related episode at build time so the cross-link is in
  // server HTML. An edition whose episodeSlug is empty or points at an
  // episode not in the feed simply renders no episode block.
  let episode = null;
  if (edition.episodeSlug) {
    const match = await getEpisodeBySlug(edition.episodeSlug);
    if (match) {
      // Prefer the frontmatter guest name over the RSS-derived one.
      // extractGuest() in lib/rss.ts mis-parses a number of titles and
      // returns a title fragment instead of a name (e.g. "Playbook for
      // Cannabis: Building Trust Through Tech ft. Ashwin Raj"), which would
      // otherwise be published here as a person's name and as anchor text.
      // The frontmatter always carries the real name.
      const guest = edition.guest || (match.guest !== 'Guest' ? match.guest : '');
      // Only link the name when a guest entity page actually exists for it.
      // Some correct names (Ashwin Raj, Jonathan Black) have no page, because
      // extractGuest() couldn't parse them out of the episode title — linking
      // those would publish a 404. Render them as plain text instead; the link
      // appears on its own once that extraction is fixed.
      const guestSlug = guest ? guestToSlug(guest) : '';
      const hasGuestPage = guestSlug ? (await getAllGuests()).some((g) => g.slug === guestSlug) : false;
      episode = {
        slug: match.slug,
        title: match.title,
        guest,
        guestSlug: hasGuestPage ? guestSlug : '',
        date: match.date,
        num: match.num,
      };
    }
  }

  const others = getRelatedEditions(edition.slug, 4).map(toListItem);

  const { body, ...meta } = edition;

  return {
    props: {
      edition: meta,
      html: renderMarkdown(body, edition.slug),
      episode,
      others,
    },
    revalidate: 3600,
  };
}

export default function NewsletterEditionPage({ edition, html, episode, others }) {
  const articleSchema = createArticleSchema({
    title: edition.title,
    description: edition.description,
    slug: edition.slug,
    date: edition.date,
    episodeSlug: episode ? episode.slug : '',
    wordCount: edition.wordCount,
  });
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com' },
    { name: 'First Principles', url: 'https://www.dimepodcast.com/newsletter' },
    { name: edition.title, url: `https://www.dimepodcast.com/newsletter/${edition.slug}` },
  ]);

  return (
    <>
      <SeoHead
        title={edition.metaTitle}
        description={edition.description}
        path={`/newsletter/${edition.slug}`}
        ogType="article"
      />

      <Schema schema={articleSchema} />
      <Schema schema={breadcrumbSchema} />

      <Header />

      <article style={{ padding: '48px', maxWidth: '760px', margin: '0 auto' }}>
        <Link href="/newsletter" style={{ color: 'var(--text-accent)', textDecoration: 'none', marginBottom: '32px', display: 'block', fontWeight: 600 }}>
          ← First Principles
        </Link>

        <header style={{ marginBottom: '40px' }}>
          <div className="mono" style={{ fontSize: '9px', color: 'var(--text-accent)', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 16 }}>
            First Principles
          </div>

          <h1 className="syne" style={{ fontSize: 'clamp(30px, 4.5vw, 52px)', fontWeight: 800, lineHeight: 1.1, letterSpacing: '.01em', marginBottom: '24px', color: 'var(--text-headline)' }}>
            {edition.title}
          </h1>

          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
            <span>Bryan Fields</span>
            {edition.dateDisplay && <span>{edition.dateDisplay}</span>}
            {edition.wordCount > 0 && <span>{edition.wordCount} words</span>}
          </div>

          {edition.topics.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '24px' }}>
              {edition.topics.map((topic) => (
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

        {episode && (
          <section style={{ marginBottom: '48px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '20px 24px', borderRadius: '8px' }}>
            <div className="mono" style={{ fontSize: '10px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
              Written after
            </div>
            <Link href={`/episodes/${episode.slug}`} style={{ display: 'block', color: 'var(--text-headline)', textDecoration: 'none', fontSize: '17px', fontWeight: 600, lineHeight: 1.35, fontFamily: "'Crimson Pro', Georgia, serif" }}>
              {episode.title}
            </Link>
            <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '8px' }}>
              Ep. {episode.num}
              {episode.guest && (
                <>
                  {' · '}
                  {episode.guestSlug ? (
                    <Link href={`/guests/${episode.guestSlug}`} style={{ color: 'var(--text-accent)', textDecoration: 'none' }}>
                      {episode.guest}
                    </Link>
                  ) : (
                    episode.guest
                  )}
                </>
              )}
              {episode.date && ` · ${episode.date}`}
            </div>
          </section>
        )}

        <div
          className="prose-body"
          style={{ fontSize: '18px', lineHeight: 1.8, color: 'var(--text-secondary)', fontFamily: "'Crimson Pro', Georgia, serif" }}
          dangerouslySetInnerHTML={{ __html: html }}
        />

        <section style={{ marginTop: '64px', paddingTop: '32px', borderTop: '1px solid var(--border-default)' }}>
          <h2 className="syne" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: '8px' }}>
            Get the next one by email
          </h2>
          <p style={{ fontSize: '14px', lineHeight: 1.7, color: 'var(--text-secondary)', marginBottom: '20px' }}>
            One structural insight per episode. No recaps, no noise.
          </p>
          <ConvertKitEmbed location="newsletter_page" />
        </section>

        {edition.linkedinUrl && (
          <p className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '32px' }}>
            Originally published on{' '}
            <a href={edition.linkedinUrl} rel="noopener" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
              LinkedIn
            </a>
            .
          </p>
        )}

        {others.length > 0 && (
          <aside style={{ marginTop: '48px', paddingTop: '32px', borderTop: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '12px', fontWeight: 600, marginBottom: '20px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)' }}>
              More First Principles
            </h2>
            {others.map((e) => (
              <Link
                key={e.slug}
                href={`/newsletter/${e.slug}`}
                style={{ display: 'block', padding: '14px 0', borderBottom: '1px solid var(--border-subtle)', textDecoration: 'none', color: 'inherit' }}
              >
                <div className="crimson" style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-headline)', marginBottom: '4px' }}>
                  {e.title}
                </div>
                <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                  {e.dateDisplay}
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
