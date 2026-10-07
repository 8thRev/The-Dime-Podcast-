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
import { LISTEN_LINKS } from '@/lib/listenLinks';
import { trackPlatformClick } from '@/lib/platformClicks';
import ConvertKitEmbed from '@/src/components/ConvertKitEmbed';
import { showNotesMentionSponsor } from '@/lib/sponsor';
import { getAllEpisodes, getEpisodeBySlug } from '@/lib/rss';
import { getTranscriptBySlug, getAllTopicsBySlug } from '@/lib/transcripts';
import { createPodcastEpisodeSchema, createFAQSchema, createBreadcrumbSchema } from '@/lib/schema';
import { topicToSlug } from '@/lib/topicSlug';
import { guestToSlug } from '@/lib/guests';
import { getVideoIdsForEpisode } from '@/lib/videoEpisodeMap';
import { getAllVideos } from '@/lib/youtube';
import { getEditionForEpisode } from '@/lib/newsletter';
import { useAudioTracking } from '@/lib/useAudioTracking';
import { useReadTracking } from '@/lib/useReadTracking';

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

  // `raw_captions_srt` is the verbatim ASR output kept on disk for future
  // chapter/timestamp work. It is never rendered, but props are serialized
  // into __NEXT_DATA__, so shipping it put ~106KB of unrendered text into the
  // HTML of every transcribed episode (~3.6MB across the 89 that carry it).
  //
  // It is also raw machine output, so it holds the mishearings the pipeline
  // corrects downstream — guest names garbled by ASR were reaching the served
  // HTML through this field alone, where naive extractors and LLM crawlers
  // that don't strip <script> tags would read them as page content.
  const rawTranscript = getTranscriptBySlug(episode.slug);
  const transcript = rawTranscript
    ? Object.fromEntries(Object.entries(rawTranscript).filter(([k]) => k !== 'raw_captions_srt'))
    : rawTranscript;
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

  // The First Principles edition written about this episode, if one exists.
  // Only the fields the block renders are passed through — the full markdown
  // body would otherwise ship into __NEXT_DATA__ unrendered.
  const editionRecord = getEditionForEpisode(episode.slug);
  const edition = editionRecord
    ? {
        slug: editionRecord.slug,
        title: editionRecord.title,
        description: editionRecord.description,
        dateDisplay: editionRecord.dateDisplay,
      }
    : null;

  return {
    props: {
      episode,
      relatedEpisodes,
      transcript,
      episodeTopics,
      episodeVideos,
      edition,
    },
    revalidate: 3600,
  };
}

export default function EpisodePage({ episode, relatedEpisodes, transcript, episodeTopics, episodeVideos = [], edition = null }) {
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
    aiGenerated: !!transcript,
    transcript: transcript?.cleaned_transcript,
    entities: transcript?.entities,
    // "Guest" is extractGuest()'s placeholder for an unparsed title, not a
    // person, and has no guest page for the Person @id to point at.
    guest: episode.guest && episode.guest !== 'Guest'
      ? { name: episode.guest, slug: guestToSlug(episode.guest), company: episode.company, companyUrl: episode.companyUrl }
      : undefined,
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

  // Read depth, engaged time and transcript_open (Part 2.8).
  const articleRef = useRef(null);
  const transcriptRef = useRef(null);
  useReadTracking(articleRef, transcriptRef, {
    slug: episode.slug,
    guest: episode.guest,
    contentType: 'episode_audio',
  });

  return (
    <>
      <SeoHead
        title={episode.title}
        description={metaDescription}
        path={`/episodes/${episode.slug}`}
        ogType="article"
        markdownAlternate
      />

      <Schema schema={schema} />
      {faqSchema && <Schema schema={faqSchema} />}
      <Schema schema={breadcrumbSchema} />

      <Header />

      <article ref={articleRef} className="wrap wrap--prose page-body">
        <Link href="/episodes" className="back-link">
          ← All Episodes
        </Link>

        <header className="ep-header">
          <div className="meta ep-meta">
            <span className="num">Ep. {episode.num}</span>
            <span>{episode.date}</span>
            <span>{episode.duration}</span>
          </div>

          <h1 className="page-title page-title--article" style={{ marginTop: 0 }}>
            {episode.title}
          </h1>

          <p className="ep-guest">
            {episode.guest && episode.guest !== 'Guest' ? (
              <Link href={`/guests/${guestToSlug(episode.guest)}`} style={{ color: 'inherit', textDecoration: 'underline', textDecorationColor: 'var(--border-subtle)' }}>
                {episode.guest}
              </Link>
            ) : (
              episode.guest
            )}
            {episode.company ? (
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
            ) : episode.guestLink ? (
              // The show notes' guest link, labelled as the hostname it is.
              // Not presented as the guest's company: see GUEST_COMPANY_MAP.
              <span style={{ color: 'var(--text-muted)' }}>
                {' / Show notes link: '}
                <a href={episode.guestLink} rel="noopener" style={{ color: 'var(--text-muted)', textDecoration: 'underline' }}>
                  {episode.guestLinkLabel}
                </a>
              </span>
            ) : null}
          </p>

          {displayTags.length > 0 && (
            <div className="ep-tags">
              {displayTags.map((tag) => {
                return hasTopics ? (
                  <Link key={tag} href={`/topics/${topicToSlug(tag)}`} className="pill">
                    {tag}
                  </Link>
                ) : (
                  <span key={tag} className="pill">
                    {tag}
                  </span>
                );
              })}
            </div>
          )}
        </header>

        {/* The player first. A visitor from search came to hear the episode;
            everything below is what they read while it plays. */}
        <section className="card-panel ep-player">
          <span className="eyebrow" style={{ marginBottom: 12 }}>Listen</span>
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

          {/* The subscribe path. Until this row the only one was the footer
              and the homepage hero, so a listener who landed on an episode
              from search had nowhere on the page itself to follow the show,
              and the podcast feed was reachable only through a <link> in the
              head. Tracked as link_location "episode_page", which Part 1 of
              docs/analytics-spec.md already enumerates for exactly this. */}
          <div style={{ marginTop: '14px', display: 'flex', flexWrap: 'wrap', alignItems: 'baseline', gap: '6px 16px', fontSize: '13px' }}>
            <span className="mono" style={{ fontSize: '12px', fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
              Subscribe
            </span>
            {LISTEN_LINKS.map((p) => (
              <a
                key={p.label}
                href={p.href}
                onClick={() => trackPlatformClick(p.href, 'episode_page', episode.slug)}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--text-accent)', textDecoration: 'none', fontWeight: 600 }}
              >
                {p.label}
              </a>
            ))}
          </div>
          {episodeVideos.length > 0 && (
            <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ marginBottom: '12px', fontSize: '12px', fontWeight: '600', letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
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
                    <span className="mono" style={{ color: 'var(--text-muted)', fontWeight: 400, fontSize: '12px', marginLeft: '8px' }}>
                      {v.duration}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </section>

        {transcript && transcript.summary && (
          <section className="ep-section">
            <AIDisclosure />
            <h2 className="ep-h2">In brief</h2>
            <p className="ep-body">{transcript.summary}</p>
          </section>
        )}

        <section className="ep-section">
          <p className="ep-standfirst">{episode.description}</p>

          {/* The show notes carry links and the feed's boilerplate credit,
              so they fold. The text stays in the HTML for crawlers and the
              .md twin renders it in full; Chrome opens a closed <details>
              on find-in-page. */}
          {episode.showNotes && (
            <details className="ep-fold">
              <summary>Full show notes</summary>
              <div
                className="ep-fold-body ep-notes-body"
                dangerouslySetInnerHTML={{ __html: episode.showNotes }}
              />
            </details>
          )}
        </section>

        {/* Sits alongside the audio player and video link deliberately: this
            is the third format of the same episode, and it's the only
            human-written long-form text on the page. */}
        {edition && (
          <section className="ep-section ep-edition">
            <span className="eyebrow eyebrow--accent" style={{ marginBottom: 10 }}>The analysis behind this episode</span>
            <Link href={`/newsletter/${edition.slug}`} className="list-title" style={{ display: 'block', fontSize: '24px', marginBottom: 8 }}>
              {edition.title}
            </Link>
            <p className="list-desc" style={{ marginTop: 0 }}>{edition.description}</p>
            <div className="meta" style={{ marginTop: 8 }}>
              First Principles{edition.dateDisplay && ` · ${edition.dateDisplay}`}
            </div>
          </section>
        )}

        {/* Directly after the show notes: the point where a reader has
            finished the human-facing summary and before the long AI
            sections most visitors never scroll through. */}
        <section className="card-panel ep-section">
          <span className="eyebrow eyebrow--accent" style={{ marginBottom: 10 }}>First Principles Newsletter</span>
          <h2 className="ep-h2" style={{ marginTop: 0, fontSize: '24px' }}>Get the insight behind the conversation.</h2>
          <p className="list-desc" style={{ marginTop: 0, marginBottom: 20 }}>
            One structural idea from the episode, written for operators. 550 to 650 words, free.
          </p>
          <ConvertKitEmbed location="episode_inline" episodeSlug={episode.slug} />
        </section>

        {transcript && (transcript.takeaways?.length > 0 || transcript.quotes?.length > 0 || transcript.faq?.length > 0 || transcript.cleaned_transcript) && (
          <div className="ep-ai">
            {/* One banner for the whole AI block. Every section below it is
                generated from the audio, and six identical chips in a row
                taught readers to stop seeing them. */}
            <AIDisclosure>The sections below were generated by AI from the episode audio and may contain errors</AIDisclosure>
            <nav className="ep-jump" aria-label="Sections">
              {transcript.takeaways?.length > 0 && <a href="#takeaways">Takeaways</a>}
              {transcript.quotes?.length > 0 && <a href="#quotes">Quotes</a>}
              {transcript.faq?.length > 0 && <a href="#faq">Questions</a>}
              {(transcript.entities?.companies?.length > 0 || transcript.entities?.people?.length > 0) && <a href="#mentioned">Mentioned</a>}
              {transcript.cleaned_transcript && <a href="#transcript">Transcript</a>}
            </nav>

            {transcript.takeaways?.length > 0 && (
              <section className="ep-section" id="takeaways">
                <h2 className="ep-h2">Key takeaways</h2>
                <ul className="ep-takeaways">
                  {transcript.takeaways.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </section>
            )}

            {transcript.quotes?.length > 0 && (
              <section className="ep-section" id="quotes">
                <h2 className="ep-h2">Notable quotes</h2>
                {transcript.quotes.map((item, i) => (
                  <blockquote key={i} className="ep-quote">
                    “{item.quote}”
                    <footer className="meta">{item.speaker}</footer>
                  </blockquote>
                ))}
              </section>
            )}

            {transcript.faq?.length > 0 && (
              <section className="ep-section" id="faq">
                <h2 className="ep-h2">Questions this episode answers</h2>
                <dl className="ep-faq">
                  {transcript.faq.map((item, i) => (
                    <div key={i}>
                      <dt>{item.question}</dt>
                      <dd>{item.answer}</dd>
                    </div>
                  ))}
                </dl>
              </section>
            )}

            {(transcript.entities?.companies?.length > 0 || transcript.entities?.people?.length > 0) && (
              <section className="ep-section" id="mentioned">
                <h2 className="ep-h2">Mentioned in this episode</h2>
                <div className="ep-chips">
                  {[...(transcript.entities.people || []), ...(transcript.entities.companies || [])].map((name) => (
                    <span key={name} className="ep-chip">{name}</span>
                  ))}
                </div>
              </section>
            )}

            {transcript.cleaned_transcript && (
              <section className="ep-section" id="transcript">
                <h2 className="ep-h2">Full transcript</h2>
                {/* The ref is on the body, not the <details>: a closed fold
                    has no box, so transcript_open fires only once a reader
                    has opened it and scrolled it into view. */}
                <details className="ep-fold">
                  <summary>Read the transcript ({transcript.cleaned_transcript.split(/\s+/).length.toLocaleString('en-US')} words)</summary>
                  <div ref={transcriptRef} className="ep-fold-body ep-transcript">
                    {transcript.cleaned_transcript}
                  </div>
                </details>
              </section>
            )}
          </div>
        )}

        <SponsorSlot slug={episode.slug} compact={sponsorInShowNotes} />

        {relatedEpisodes.length > 0 && (
          <aside className="ep-related">
            <h2 className="section-label">More episodes</h2>
            {relatedEpisodes.map((ep) => (
              <Link key={ep.slug} href={`/episodes/${ep.slug}`} className="list-row" style={{ padding: '16px 0' }}>
                <div className="list-meta">
                  <span className="num">Ep. {ep.num}</span>
                  <span>{ep.date.split(',')[0]}</span>
                </div>
                <div>
                  <div className="list-title" style={{ fontSize: '20px' }}>{ep.title}</div>
                  {ep.guest && ep.guest !== 'Guest' && <div className="list-sub">{ep.guest}</div>}
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
