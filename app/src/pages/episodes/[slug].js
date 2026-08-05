// src/pages/episodes/[slug].js
// Dynamic episode detail page

import { useRef } from 'react';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import AIDisclosure from '@/src/components/AIDisclosure';
import SponsorSlot from '@/src/components/SponsorSlot';
import { showNotesMentionSponsor } from '@/lib/sponsor';
import { getAllEpisodes, getEpisodeBySlug } from '@/lib/rss';
import { getTranscriptBySlug, getAllTopicsBySlug } from '@/lib/transcripts';
import { createPodcastEpisodeSchema, createFAQSchema, createBreadcrumbSchema } from '@/lib/schema';
import { topicToSlug } from '@/lib/topicSlug';
import { guestToSlug } from '@/lib/guests';
import { getVideoIdsForEpisode } from '@/lib/videoEpisodeMap';
import { getAllVideos } from '@/lib/youtube';
import { useAudioTracking } from '@/lib/useAudioTracking';

export async function getStaticPaths() {
  const episodes = await getAllEpisodes();
  const paths = episodes.map((ep) => ({
    params: { slug: ep.slug },
  }));

  return {
    paths,
    fallback: 'blocking',
  };
}

export async function getStaticProps({ params }) {
  const episode = await getEpisodeBySlug(params.slug);
  const allEpisodes = await getAllEpisodes();

  if (!episode) {
    return { notFound: true };
  }

  // 301 redirect old truncated slug → full slug
  if (episode.legacySlug && params.slug === episode.legacySlug) {
    return {
      redirect: { destination: `/episodes/${episode.slug}`, permanent: true },
    };
  }

  const transcript = getTranscriptBySlug(episode.slug);
  const topicsBySlug = getAllTopicsBySlug();
  const episodeTopics = topicsBySlug[episode.slug] || [];

  const relatedEpisodes = allEpisodes
    .filter((e) => e.num !== episode.num)
    .sort((a, b) => {
      const sharedScore = (e) => {
        const tagOverlap = e.tags.filter((t) => episode.tags.includes(t)).length;
        const topicOverlap = (topicsBySlug[e.slug] || []).filter((t) => episodeTopics.includes(t)).length;
        return tagOverlap + topicOverlap;
      };
      const aShared = sharedScore(a);
      const bShared = sharedScore(b);
      if (bShared !== aShared) return bShared - aShared;
      return new Date(b.dateISO).getTime() - new Date(a.dateISO).getTime();
    })
    .slice(0, 5);

  // Cross-link to the YouTube video(s) for this episode. One episode can have
  // several uploads (a re-cut, a second video), so the map is many-to-one.
  // getAllVideos() needs YOUTUBE_API_KEY and the map file needs the
  // video-episode-map workflow to have run — both degrade to an empty list, in
  // which case the section simply doesn't render.
  const videoIds = getVideoIdsForEpisode(episode.slug);
  let episodeVideos = [];
  if (videoIds.length > 0) {
    const allVideos = await getAllVideos();
    const byId = new Map(allVideos.map((v) => [v.id, v]));
    episodeVideos = videoIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((v) => ({ slug: v.slug, title: v.title, duration: v.duration }));
  }

  return {
    props: {
      episode,
      relatedEpisodes,
      transcript,
      episodeTopics,
      episodeVideos,
    },
    revalidate: 3600,
  };
}

export default function EpisodePage({ episode, relatedEpisodes, transcript, episodeTopics, episodeVideos = [] }) {
  // Prefer the AI-generated fixed-taxonomy topics (crawlable hub pages
  // exist for these) over freeform RSS keywords, falling back to RSS tags
  // for episodes that don't have transcript coverage yet. Only the former
  // have a /topics/[tag] hub page to link to.
  const hasTopics = episodeTopics.length > 0;
  const displayTags = hasTopics ? episodeTopics : episode.tags;
  // The AI-generated summary is a tighter, more accurate paragraph than
  // the truncated RSS show-notes description — prefer it for meta tags
  // (and thus search/social snippets) whenever it's available.
  const metaDescription = transcript?.summary || episode.description;
  // ~48 of 303 episodes carry the Newton read inside their Simplecast show
  // notes, which render verbatim above. On those, the templated slot drops to
  // its compact form so the same pitch doesn't appear twice on one page.
  const sponsorInShowNotes = showNotesMentionSponsor(episode.showNotes);
  const schema = createPodcastEpisodeSchema(episode, undefined, {
    entities: transcript?.entities,
    guest: episode.guest ? { name: episode.guest, company: episode.company, companyUrl: episode.companyUrl } : undefined,
  });
  const faqSchema = transcript?.faq?.length ? createFAQSchema(transcript.faq) : null;
  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com' },
    { name: 'Episodes', url: 'https://www.dimepodcast.com/episodes' },
    { name: episode.title, url: `https://www.dimepodcast.com/episodes/${episode.slug}` },
  ]);

  // Listen tracking for the player below (docs/analytics-spec.md Part 2.2).
  // episode_topic carries the primary fixed-taxonomy topic in its hub-slug form,
  // matching the values Part 1 enumerates. Episodes without transcript coverage
  // fall back to freeform RSS keywords for display, and those are deliberately
  // not sent: free text fragments the dimension and makes it useless.
  // episode.num is a string off the RSS feed (lib/rss.ts), but Part 1 types
  // episode_number as a number — send it as one, or the dimension fills with
  // text values that no numeric audience condition can compare against.
  const episodeNumber = parseInt(episode.num, 10);
  const audioRef = useRef(null);
  useAudioTracking(audioRef, {
    slug: episode.slug,
    number: Number.isFinite(episodeNumber) ? episodeNumber : undefined,
    guest: episode.guest,
    topic: hasTopics ? topicToSlug(episodeTopics[0]) : undefined,
  });

  return (
    <>
      <SeoHead
        title={episode.title}
        description={metaDescription}
        path={`/episodes/${episode.slug}`}
        ogType="article"
      />

      <Schema schema={schema} />
      {faqSchema && <Schema schema={faqSchema} />}
      <Schema schema={breadcrumbSchema} />

      <Header />

      <article style={{ padding: '48px', maxWidth: '900px', margin: '0 auto' }}>
        <Link href="/episodes" style={{ color: 'var(--text-accent)', textDecoration: 'none', marginBottom: '32px', display: 'block', fontWeight: 600 }}>
          ← All Episodes
        </Link>

        <header style={{ marginBottom: '48px' }}>
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-accent)', fontWeight: 700 }}>
              Ep. {episode.num}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {episode.date}
            </span>
            <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
              {episode.duration}
            </span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 800, lineHeight: 1.2, marginBottom: '24px', fontFamily: "'Syne', sans-serif", color: 'var(--text-headline)' }}>
            {episode.title}
          </h1>

          <div style={{ fontSize: '18px', color: 'var(--text-secondary)', marginBottom: '32px', fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic', fontWeight: 500 }}>
            {episode.guest && episode.guest !== 'Guest' ? (
              <Link href={`/guests/${guestToSlug(episode.guest)}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border-subtle)' }}>
                {episode.guest}
              </Link>
            ) : (
              episode.guest
            )}
            {episode.company && (
              <span style={{ color: 'var(--text-muted)' }}>
                {' / '}
                {episode.companyUrl ? (
                  <a href={episode.companyUrl} rel="noopener" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                    {episode.company}
                  </a>
                ) : (
                  episode.company
                )}
              </span>
            )}
          </div>

          {displayTags.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '40px' }}>
              {displayTags.map((tag) => {
                const tagStyle = {
                  fontSize: '10px',
                  color: 'var(--text-accent)',
                  border: '1px solid var(--text-accent)',
                  padding: '4px 12px',
                  fontWeight: 700,
                  textDecoration: 'none',
                };
                return hasTopics ? (
                  <Link key={tag} href={`/topics/${topicToSlug(tag)}`} className="mono" style={tagStyle}>
                    {tag}
                  </Link>
                ) : (
                  <span key={tag} className="mono" style={tagStyle}>
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {transcript && transcript.summary && (
          <section style={{ marginBottom: '48px' }}>
            <AIDisclosure />
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-headline)' }}>
              TL;DR
            </h2>
            <p style={{ fontSize: '16px', lineHeight: '1.8', color: 'var(--text-secondary)' }}>
              {transcript.summary}
            </p>
          </section>
        )}

        <section style={{ marginBottom: '48px', background: 'var(--bg-surface)', border: '1px solid var(--border-default)', padding: '24px', borderRadius: '8px' }}>
          <div style={{ marginBottom: '16px', fontSize: '11px', fontWeight: '600', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Listen Now
          </div>
          <audio
            ref={audioRef}
            controls
            style={{
              width: '100%',
              height: '40px',
              accentColor: 'var(--text-accent)',
            }}
            src={episode.audioUrl}
            title={episode.title}
          />

          {episodeVideos.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ marginBottom: '12px', fontSize: '11px', fontWeight: '600', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                {episodeVideos.length > 1 ? 'Watch this episode on YouTube' : 'Watch this episode'}
              </div>
              {episodeVideos.map((v) => (
                <Link
                  key={v.slug}
                  href={`/videos/${v.slug}`}
                  style={{ display: 'block', color: 'var(--text-accent)', textDecoration: 'none', fontWeight: 600, fontSize: '15px', marginBottom: '6px' }}
                >
                  ▶ {v.title}
                  {v.duration && (
                    <span className="mono" style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '11px', marginLeft: '8px' }}>
                      {v.duration}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        <section style={{ marginBottom: '80px' }}>
          <p style={{ fontSize: '16px', lineHeight: '1.8', color: 'var(--text-secondary)', fontFamily: "'Crimson Pro', Georgia, serif", fontStyle: 'italic', fontWeight: 400 }}>
            {episode.description}
          </p>

          {episode.showNotes && (
            <div style={{ marginTop: '32px', padding: '24px', background: 'var(--bg-surface)', borderLeft: '3px solid var(--text-accent)', borderRadius: '4px' }}>
              <h2 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-headline)' }}>
                Full Show Notes
              </h2>
              <div
                style={{ fontSize: '14px', lineHeight: '1.6', color: 'var(--text-secondary)' }}
                dangerouslySetInnerHTML={{ __html: episode.showNotes }}
              />
            </div>
          )}
        </section>

        {transcript && transcript.takeaways?.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <AIDisclosure />
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-headline)' }}>
              Key Takeaways
            </h2>
            <ul style={{ paddingLeft: '20px', margin: 0 }}>
              {transcript.takeaways.map((point, i) => (
                <li key={i} style={{ fontSize: '15px', lineHeight: '1.8', color: 'var(--text-secondary)', marginBottom: '10px' }}>
                  {point}
                </li>
              ))}
            </ul>
          </section>
        )}

        {transcript && transcript.quotes?.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <AIDisclosure />
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-headline)' }}>
              Notable Quotes
            </h2>
            {transcript.quotes.map((item, i) => (
              <blockquote
                key={i}
                style={{
                  borderLeft: '3px solid var(--text-accent)',
                  paddingLeft: '20px',
                  margin: '0 0 20px 0',
                  fontSize: '17px',
                  fontStyle: 'italic',
                  fontFamily: "'Crimson Pro', Georgia, serif",
                  color: 'var(--text-headline)',
                }}
              >
                “{item.quote}”
                <footer style={{ fontSize: '13px', fontStyle: 'normal', fontFamily: "'Syne', sans-serif", color: 'var(--text-muted)', marginTop: '8px' }}>
                  — {item.speaker}
                </footer>
              </blockquote>
            ))}
          </section>
        )}

        {transcript && transcript.faq?.length > 0 && (
          <section style={{ marginBottom: '56px' }}>
            <AIDisclosure />
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-headline)' }}>
              Frequently Asked Questions
            </h2>
            {transcript.faq.map((item, i) => (
              <div key={i} style={{ marginBottom: '20px' }}>
                <div style={{ fontSize: '15px', fontWeight: '700', color: 'var(--text-headline)', marginBottom: '6px' }}>
                  {item.question}
                </div>
                <div style={{ fontSize: '15px', lineHeight: '1.75', color: 'var(--text-secondary)' }}>
                  {item.answer}
                </div>
              </div>
            ))}
          </section>
        )}

        {transcript && (transcript.entities?.companies?.length > 0 || transcript.entities?.people?.length > 0) && (
          <section style={{ marginBottom: '56px' }}>
            <AIDisclosure />
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-headline)' }}>
              Mentioned in This Episode
            </h2>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {[...(transcript.entities.people || []), ...(transcript.entities.companies || [])].map((name) => (
                <span
                  key={name}
                  className="mono"
                  style={{
                    fontSize: '11px',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-default)',
                    padding: '4px 12px',
                    borderRadius: '4px',
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          </section>
        )}

        {transcript && transcript.cleaned_transcript && (
          <section style={{ marginBottom: '80px' }}>
            <AIDisclosure />
            <h2 style={{ fontSize: '20px', fontWeight: '700', marginBottom: '20px', color: 'var(--text-headline)' }}>
              Full Transcript
            </h2>
            <div
              style={{
                fontSize: '14px',
                lineHeight: '1.8',
                color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap',
              }}
            >
              {transcript.cleaned_transcript}
            </div>
          </section>
        )}

        <SponsorSlot slug={episode.slug} compact={sponsorInShowNotes} />

        {relatedEpisodes.length > 0 && (
          <aside style={{ paddingTop: '32px', borderTop: '1px solid var(--border-default)' }}>
            <h2 style={{ fontSize: '12px', fontWeight: '600', marginBottom: '24px', textTransform: 'uppercase', letterSpacing: '.1em', color: 'var(--text-muted)' }}>
              More Episodes
            </h2>
            <div style={{ display: 'grid', gap: '0' }}>
              {relatedEpisodes.map((ep) => (
                <Link
                  key={ep.slug}
                  href={`/episodes/${ep.slug}`}
                  style={{
                    padding: '16px 0',
                    borderBottom: '1px solid var(--border-subtle)',
                    textDecoration: 'none',
                    color: 'inherit',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-surface)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px', fontFamily: "'Crimson Pro', Georgia, serif", color: 'var(--text-headline)' }}>
                    {ep.title}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: "'Syne', sans-serif" }}>
                    {ep.guest} · {ep.date.split(',')[0]}
                  </div>
                </Link>
              ))}
            </div>
          </aside>
        )}
      </article>

      <Footer />
    </>
  );
}
