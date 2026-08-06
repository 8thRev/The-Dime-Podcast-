import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { track } from '@/lib/analytics';
import {
  trackSponsorCtaClick,
  trackSponsorFormStart,
  trackSponsorInquirySubmit,
} from '@/lib/sponsorFunnel';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { createBreadcrumbSchema, createFAQSchema } from '@/lib/schema';
import { PODCAST_RATING } from '@/lib/ratings';
import { getAllEditions } from '@/lib/newsletter';
import { getVideoIdsForEpisode } from '@/lib/videoEpisodeMap';
import { getAllTranscriptSlugs } from '@/lib/transcripts';
import testimonials from '@/content/testimonials.json';
import videos from '@/content/videos.json';

// The "Where It Lands" proof section traces one real episode across every
// surface it was published to, with live links. Resolved at build time rather
// than hard-coded so it always shows the newest fully-covered episode and
// cannot rot into a set of dead links.
//
// "Fully covered" means the episode has all four owned surfaces on file: a
// newsletter edition, that edition's LinkedIn Pulse republication, a mapped
// YouTube video, and an episode page. 30 of 31 linked editions qualify.
// videos.json is 287 entries and must never reach the browser — it is read
// only inside getStaticProps so Next strips it from the client bundle. This is
// the payload-bloat trap already documented on /episodes and /newsletter;
// computing these at module scope shipped the whole catalogue to every
// visitor and roughly tripled the page weight.
function durationSeconds(v) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(v.durationISO || '');
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

function libraryStats() {
  // videos.json is a YouTube catalogue, not an episode list — a handful of
  // entries are short excerpts rather than full episodes. Counting the raw
  // array overstated the episode count by three. Anything under four minutes
  // is not an episode of a show that averages forty-five.
  const episodes = videos.filter((v) => durationSeconds(v) >= 240);
  const seconds = episodes.reduce((total, v) => total + durationSeconds(v), 0);
  return { libraryEpisodes: episodes.length, libraryHours: Math.round(seconds / 3600) };
}

export async function getStaticProps() {
  const transcriptSlugs = new Set(getAllTranscriptSlugs());
  const videoTitleById = new Map(videos.map((v) => [v.id, v.title]));

  const trail = getAllEditions()
    .filter((e) => e.linkedinUrl && e.episodeSlug)
    .map((e) => {
      const videoId = getVideoIdsForEpisode(e.episodeSlug).find((id) => videoTitleById.has(id));
      return {
        editionSlug: e.slug,
        editionTitle: e.title,
        dateDisplay: e.dateDisplay,
        guest: e.guest || '',
        episodeSlug: e.episodeSlug,
        linkedinUrl: e.linkedinUrl,
        videoId: videoId || null,
        hasTranscript: transcriptSlugs.has(e.episodeSlug),
      };
    })
    // getAllEditions() is already newest-first, so the first complete one wins.
    .find((e) => e.videoId) || null;

  return { props: { trail, ...libraryStats() }, revalidate: 3600 };
}

// ---------------------------------------------------------------------------
// Numbers on this page fall into two buckets, kept apart on purpose.
//
// LIBRARY_* is derived at build time from content/videos.json, so it cannot
// drift from what the site actually publishes.
//
// Everything else must be verifiable on request. This page deliberately
// carries NO unaudited audience metrics — see the "Who Is Listening" section
// below for why. Downloads, email subscribers, and LinkedIn followers used to
// live here as hand-maintained constants; they were removed rather than
// re-stated, because they are material representations in a paid advertising
// sale and a prospect can check the LinkedIn one in a single click.
//
// Framing: the hero leads with authority and with what a sponsor *receives*,
// not with reach. The show's per-episode numbers are respectable for cannabis
// B2B but modest in absolute terms, and the public YouTube counts are one
// click away. Leading with volume invites that comparison and loses it.
// ---------------------------------------------------------------------------

// Assets produced per sponsored episode: 1 video + 1 audio + 3-5 social cuts
// + newsletter + article + episode page. That is 8 at the floor and 10 at the
// ceiling, so 8 is what gets quoted and what drives the per-asset math below.
//
// Quote the floor, not the ceiling. This page argues that it does not publish
// numbers it cannot show you, and the first sum a buyer can check by hand is
// this one — "3-5 clips plus five other things" does not reach 10 at the low
// end. A smaller honest number is worth more here than a bigger padded one.
const ASSETS_PER_EPISODE = 8;
const ASSETS_PER_EPISODE_MAX = 10;
const EPISODE_PRICE = 1000;
const CAMPAIGN_PRICE = 3000;
const CAMPAIGN_EPISODES = 4;
const PER_EPISODE_IN_CAMPAIGN = CAMPAIGN_PRICE / CAMPAIGN_EPISODES;
const CAMPAIGN_DISCOUNT_PCT = Math.round((1 - PER_EPISODE_IN_CAMPAIGN / EPISODE_PRICE) * 100);
// Per-asset cost is a RANGE, because the asset count is. Dividing by the
// count floor gives the highest price per asset, not the lowest — say "from
// $100", never "under $125", or the first division a buyer does contradicts
// the page.
const COST_PER_ASSET = Math.round(EPISODE_PRICE / ASSETS_PER_EPISODE);
const COST_PER_ASSET_MIN = Math.round(EPISODE_PRICE / ASSETS_PER_EPISODE_MAX);

// Built from props rather than module scope so videos.json stays server-side.
function heroStats(libraryEpisodes, libraryHours) {
  return [
    { value: `${libraryEpisodes}+`, label: 'Episodes Published' },
    { value: '6 Yrs', label: 'Publishing Weekly' },
    { value: `${PODCAST_RATING.value} ★`, label: `${PODCAST_RATING.count} Listener Ratings` },
    { value: `${libraryHours}`, label: 'Hours of Archive' },
  ];
}

// The core of the offer: one recording, distributed six ways, all of it
// carrying the same sponsor message.
const ENGINE = [
  {
    n: '01',
    tag: 'Video',
    asset: 'Full-length video episode',
    channel: 'YouTube',
    detail:
      'Host-read integration inside the conversation — read by Bryan and Kellan, in context, not a pre-roll drop-in. Linked in the description permanently.',
  },
  {
    n: '02',
    tag: 'Audio',
    asset: 'Podcast episode',
    channel: 'Apple · Spotify · Amazon · iHeart · everywhere else',
    detail:
      'The same host-read ships to every audio platform the show distributes to, and stays in the feed for good.',
  },
  {
    n: '03',
    tag: 'Social',
    asset: '3–5 short-form cuts',
    // Instagram first, because that is where the clips primarily run.
    //
    // "YouTube Shorts" is deliberately not named as a channel here. The Shorts
    // tab does carry cuts, but far fewer than one per episode, so promising
    // Shorts specifically sets up a per-episode cadence the tab cannot
    // evidence. Naming YouTube generally is accurate and not checkable against
    // a count. Do not re-add the word "Shorts" without confirming the cadence.
    channel: 'Instagram · Facebook · LinkedIn · YouTube',
    detail:
      'Each moment cut, captioned, and posted natively to four platforms — the same clip sized for each feed rather than one upload cross-posted.',
  },
  {
    n: '04',
    tag: 'Email',
    asset: 'Newsletter placement',
    channel: 'First Principles',
    detail:
      'Your message inside the weekly email that operators open on purpose — written by hand, not an automated episode blast.',
  },
  {
    n: '05',
    tag: 'Written',
    asset: 'Companion article',
    channel: 'dimepodcast.com',
    detail:
      'A written piece built from the episode. Indexed by Google, and structured to be quoted by AI search when someone asks about your category.',
  },
  {
    n: '06',
    tag: 'Web',
    asset: 'Permanent episode page',
    channel: 'dimepodcast.com',
    detail:
      'Show notes, the full transcript, and your link — live and crawlable indefinitely. The campaign keeps working after the launch week ends.',
  },
];

const ENGINE_SUMMARY = [
  { value: `${ASSETS_PER_EPISODE}–${ASSETS_PER_EPISODE_MAX}`, label: 'Assets Per Episode' },
  { value: '6', label: 'Surfaces' },
  { value: '1', label: 'Message' },
  { value: '∞', label: 'Shelf Life' },
];

const REPURPOSE_USES = [
  'Run them as paid social creative',
  'Drop them into sales decks and pitch materials',
  'Embed the episode on your own site',
  'Send the article to your list',
  'Post the clips from your own brand accounts',
  'Use the transcript as sales-enablement copy',
];

// The itemised inventory. This is the single thing a sponsor most wants to
// see and the old page never showed: not a description of the work, a count
// of the deliverables.
//
// The quantities sum exactly to the ASSETS_PER_EPISODE range above — 8 with
// three cuts, 10 with five — so a buyer who adds up this list gets the same
// number the page quotes. Change one, change the other. The transcript is
// deliberately NOT a line item: it lives on the episode page, so counting it
// separately would inflate the total by double-counting.
const MANIFEST = [
  { qty: '1', item: 'Full-length video episode', note: 'YouTube, host-read integrated' },
  { qty: '1', item: 'Podcast audio episode', note: 'Every streaming platform' },
  { qty: '3–5', item: 'Short-form cuts', note: 'Captioned, sized per feed' },
  { qty: '1', item: 'Newsletter placement', note: 'The weekly edition' },
  { qty: '1', item: 'Companion article', note: 'Written from the episode' },
  { qty: '1', item: 'Episode page', note: 'Show notes, transcript, and your links' },
];

const ALSO_INCLUDED = [
  { t: 'Full transcript', d: 'Searchable and quotable, published on the episode page.' },
  { t: 'One consistent CTA', d: 'A single message carried across every touchpoint — never split.' },
  { t: 'Permanent links', d: 'Show notes and episode-page links stay live indefinitely.' },
  { t: 'Category exclusivity', d: 'On multi-episode campaigns, no competitor runs alongside you.' },
];

// Sample clips shown in the "Where It Lands" section.
//
// All three are cuts from the SAME episode (Hirsh Jain, who is already on the
// recognizable-guests list). That is deliberate on two counts: it demonstrates
// the "3-5 cuts per episode" line in the manifest literally rather than
// asserting it, and these were the clips that survived a frame-by-frame check.
//
// Clips from the Chris Guthrie episode are excluded on purpose — every one of
// them carries an oversized hook overlay that is clipped off both edges of the
// 608px frame and renders as "hat wasn't very / ata driven". That is an editing
// template bug, not a YouTube artifact.
//
// The offending IDs, so this warning is checkable rather than just cautionary:
//   3DFTvPdUUNo  AI Coding Creates Tech Debt
//   0NOpoJxrp5o  Building a Data Driven Cannabis Business
//   -rJGRU5vx-A  Using AI for Cannabis Cost Analysis
// Do not add any of them until the overlay is re-cut inside the safe area.
const CLIPS = [
  { id: 'pdbyH16rIIc', title: 'Rescheduled, Not Legalized: What Schedule III Actually Means' },
  { id: '_WlDUt_ZNg8', title: 'Arkansas Outsells Florida in Weed, Per Capita' },
  { id: '-NtKjLAuNyg', title: "Guns and Weed: Why Patients Won't Register" },
];

const AUDIENCE_COMPOSITION = [
  { role: 'Operators & Founders', desc: 'Running cultivation, retail, manufacturing, and MSOs under real margin pressure.' },
  { role: 'C-Suite & Finance', desc: 'CEOs, COOs, and CFOs making budget and vendor decisions, not researching them.' },
  { role: 'Investors & Capital', desc: 'Funds and private capital underwriting the sector and tracking who is executing.' },
  { role: 'Service Providers', desc: 'Technology, legal, accounting, and consulting firms selling into the same buyers you are.' },
];

const TIERS = [
  {
    name: 'Episode Partner',
    price: `$${EPISODE_PRICE.toLocaleString()}`,
    priceSub: `${ASSETS_PER_EPISODE}–${ASSETS_PER_EPISODE_MAX} assets · from $${COST_PER_ASSET_MIN} each`,
    description: 'One integrated episode, distributed across the full engine.',
    inclusions: [
      'Host-read integration in one episode',
      'Video, audio, and 3–5 social cuts',
      'Newsletter, article, and episode-page placement',
      'Full asset handoff with repurpose rights',
    ],
    featured: false,
  },
  {
    name: 'Four-Episode Campaign',
    price: `$${CAMPAIGN_PRICE.toLocaleString()}`,
    priceSub: `$${PER_EPISODE_IN_CAMPAIGN.toLocaleString()} per episode — ${CAMPAIGN_DISCOUNT_PCT}% less than one-off`,
    description:
      'Four integrated episodes across a quarter. Repetition is what moves a B2B buyer — one read gets noticed, four gets remembered.',
    inclusions: [
      'Everything in Episode Partner, four times over',
      `${ASSETS_PER_EPISODE * CAMPAIGN_EPISODES}–${ASSETS_PER_EPISODE_MAX * CAMPAIGN_EPISODES} assets across a full quarter`,
      'Category exclusivity for the campaign window',
      'Opening strategy session and campaign reporting',
    ],
    featured: true,
  },
];

const STRATEGY_INCLUDES = ['Audience definition', 'Offer & CTA', 'Landing page plan', 'Tracking plan'];

const RECOGNIZABLE_GUESTS = [
  'Hirsh Jain', 'Trent Woloveck', 'John Shute', 'Thomas Winstanley', 'Nadia Sabeh', 'George DeNardo',
];

// Objection handling, in roughly the order a cannabis marketer thinks them.
// Rendered visibly AND as FAQPage schema — this is the structured-data type
// most likely to get lifted into AI answer engines, which matters on the one
// page where a captured answer has direct revenue value.
//
// Scope note: every answer here restates something the page already commits
// to elsewhere. Questions that need a business policy answer (payment terms,
// turnaround time, plant-touching eligibility) are deliberately absent rather
// than guessed at — see the handover notes for the list.
const FAQ = [
  {
    question: 'How many people will hear my sponsorship?',
    answer:
      'The Dime is a concentrated cannabis business audience — operators, founders, investors and the service providers selling to them — that shows up weekly for forty-five minutes at a time. Current download, subscriber and follower figures are available on request, with sources.',
  },
  {
    question: 'What do I actually receive?',
    answer:
      `At least ${ASSETS_PER_EPISODE} assets per sponsored episode: the full-length video, the podcast audio on every streaming platform, 3–5 captioned short-form cuts posted natively to Instagram, Facebook, LinkedIn and YouTube, a placement in the newsletter, a written companion article, and a permanent episode page with the full transcript and your link.`,
  },
  {
    question: 'Can I use the content on my own channels?',
    answer:
      'Yes. Every asset produced for your sponsorship is handed over when the campaign wraps, with full rights to repurpose it — paid social creative, sales decks, your own website, your own brand accounts, for as long as you want.',
  },
  {
    question: 'Do I get to approve the read before it airs?',
    answer:
      'Yes. You approve the host-read copy before the episode publishes. We are not going to run something you do not want your name on.',
  },
  {
    question: 'How much of my time does this take?',
    answer:
      'If you are also joining as a guest, one 45-minute recording, with questions sent in advance. Sponsorship without a guest appearance takes less — you provide the offer and the CTA, and the read is written and produced here.',
  },
  {
    question: 'Does sponsoring get me softer questions?',
    answer:
      'No. Sponsorship does not influence editorial questions or guest coverage. That independence is exactly why a read on this show carries weight with the audience.',
  },
  {
    question: 'What does it cost?',
    answer:
      `A single integrated episode is $${EPISODE_PRICE.toLocaleString()}. A four-episode campaign is $${CAMPAIGN_PRICE.toLocaleString()}, which works out to $${PER_EPISODE_IN_CAMPAIGN.toLocaleString()} per episode — ${CAMPAIGN_DISCOUNT_PCT}% less than booking one at a time — and includes category exclusivity for the campaign window.`,
  },
];

const FORM_FIELDS = [
// maxLength mirrors MAX_LEN in src/pages/api/sponsor-inquiry.js. Without it
// the server truncates silently and the sender never learns what was cut.
  { name: 'name', label: 'Name', type: 'text', span: 1, required: true, maxLength: 200 },
  { name: 'company', label: 'Company', type: 'text', span: 1, required: true, maxLength: 200 },
  { name: 'email', label: 'Email', type: 'email', span: 2, required: true, maxLength: 320 },
  {
    name: 'targetCustomer',
    maxLength: 4000,
    label: 'Who are you trying to reach?',
    hint: 'Optional — one line is fine',
    type: 'textarea',
    span: 2,
    required: false,
  },
  {
    name: 'campaignGoal',
    maxLength: 4000,
    label: 'What should they do after they hear it?',
    hint: 'Optional',
    type: 'textarea',
    span: 2,
    required: false,
  },
];

const EMPTY_FORM = FORM_FIELDS.reduce((acc, f) => ({ ...acc, [f.name]: '' }), { website: '' });

// No turnaround promise here on purpose — see the FAQ scope note. These
// describe what happens, not how fast.
const NEXT_STEPS = [
  'Bryan reads it personally',
  'We come back with fit, the next open slot, and a straight answer on whether it is worth your money',
  'Campaigns open with a strategy session before anything is recorded',
];

const SPONSOR_EMAIL = 'sponsorship@dimepodcast.com';

function CheckIcon({ color = 'var(--text-accent)' }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }}>
      <circle cx="12" cy="12" r="10" opacity="0.18" fill={color} stroke="none" />
      <path d="M7.5 12.5l3 3 6-6.5" />
    </svg>
  );
}

function Eyebrow({ children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <span style={{ width: 16, height: 1.5, background: 'var(--text-accent)', display: 'inline-block' }} />
      <span className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
        {children}
      </span>
    </div>
  );
}

// Click-to-play facade: nothing reaches Google until the visitor clicks.
//
// The posters are served from app/public/clips/ rather than i.ytimg.com on
// purpose. i.ytimg.com is YouTube infrastructure, so hotlinking the thumbnail
// would ship the visitor IP and a /sponsorship referer to Google on scroll and
// defeat the whole point of the youtube-nocookie embed below. Re-download with:
//   curl -s https://i.ytimg.com/vi/<id>/oar2.jpg -o public/clips/<id>.jpg
//
// No view counts anywhere in the UI: this page argues on production quality,
// not on how many people watched.
function ClipFacade({ id, title }) {
  const [playing, setPlaying] = useState(false);
  const frameRef = useRef(null);

  // The play button unmounts on activation, which would otherwise drop focus
  // to <body> and dump a keyboard user back to the top of the tab order.
  useEffect(() => {
    if (playing) frameRef.current?.focus();
  }, [playing]);

  return (
    <figure className="sp-clip">
      <div className="sp-clip-frame">
        {playing ? (
          <iframe
            ref={frameRef}
            tabIndex={-1}
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0&modestbranding=1&playsinline=1`}
            title={title}
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        ) : (
          <button
            type="button"
            className="sp-clip-btn"
            aria-label={`Play clip: ${title}`}
            onClick={() => {
              setPlaying(true);
              track('sponsor_clip_play', { clip: id });
            }}
          >
            <img src={`/clips/${id}.jpg`} alt="" loading="lazy" width="1080" height="1920" />
            <span className="sp-clip-play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor">
                <path d="M8 5.5v13l11-6.5z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption className="crimson">{title}</figcaption>
    </figure>
  );
}

function SectionTitle({ children, maxWidth = 760 }) {
  return (
    <h2 className="syne" style={{ fontSize: 'clamp(28px,4.2vw,46px)', fontWeight: 800, color: 'var(--text-headline)', lineHeight: 1.06, letterSpacing: '.01em', maxWidth, marginBottom: 24 }}>
      {children}
    </h2>
  );
}

// `location` must be one of the CtaLocation values in lib/sponsorFunnel.ts
// (hero | pricing | inline | footer) — those strings are registered GA4
// custom dimensions, not free labels.
function CtaRow({ location, align = 'flex-start', style }) {
  return (
    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: align, ...style }}>
      <a
        href="#sponsor-inquiry"
        className="btn-teal syne"
        style={{ textDecoration: 'none', display: 'inline-block' }}
        onClick={() => trackSponsorCtaClick('request_a_sponsorship', location)}
      >
        Request a Sponsorship
      </a>
    </div>
  );
}

function Quote({ person, paragraphs, accent = false, caption }) {
  return (
    <figure
      style={{
        margin: 0,
        padding: 'clamp(28px,4vw,40px)',
        border: '1px solid',
        borderColor: accent ? 'var(--border-accent)' : 'var(--border-subtle)',
        borderRadius: 4,
        background: 'var(--bg-surface)',
        boxShadow: accent ? 'var(--shadow-card-hover)' : 'var(--shadow-card)',
      }}
    >
      <span className="mono" aria-hidden="true" style={{ fontSize: '32px', color: 'var(--text-accent)', display: 'block', lineHeight: 1, marginBottom: 10 }}>&ldquo;</span>
      <blockquote style={{ margin: 0 }}>
        {paragraphs.map((p) => (
          <p key={p} className="crimson" style={{ fontSize: 'clamp(16px,1.9vw,18px)', color: 'var(--text-headline)', lineHeight: 1.7, fontWeight: 400, fontStyle: 'italic', marginBottom: 14 }}>
            {p}
          </p>
        ))}
      </blockquote>
      {caption && (
        <p className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '4px 0 0' }}>
          {caption}
        </p>
      )}
      <figcaption style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 22, paddingTop: 22, borderTop: '1px solid var(--border-subtle)' }}>
        <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-elevated)' }}>
          <img src={person.photo} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        </div>
        <div>
          <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-headline)' }}>
            {person.linkedinUrl ? (
              <a href={person.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{person.name}</a>
            ) : person.name}
          </div>
          <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.4 }}>
            {person.title}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}

export default function Sponsorship({ trail, libraryEpisodes, libraryHours }) {
  const HERO_STATS = heroStats(libraryEpisodes, libraryHours);
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | invalid | fallback
  const [formStarted, setFormStarted] = useState(false);

  const bobart = testimonials.find((t) => t.name === 'Brandon Bobart');
  const brett = testimonials.find((t) => t.name === 'Brett Puffenbarger');
  const kuczeruk = testimonials.find((t) => t.name === 'Jake Kuczeruk');

  // Bobart's testimonial covers three different things in three paragraphs.
  // Paragraph 2 is his results as a *guest*; paragraph 3 is about a client of
  // his who bought a *sponsorship*. They are deliberately rendered as two
  // separately-labelled claims: the page sells sponsorships, so presenting the
  // guest-appearance lead numbers as sponsorship proof would be overclaiming,
  // and a prospect who reads the full quote would catch it.
  //
  // Matched on content, not array index. An index-based split silently
  // relabels a guest outcome as sponsorship proof the moment anyone edits or
  // reorders a paragraph in testimonials.json — which is precisely the
  // overclaim this split exists to prevent.
  const bobartParas = bobart?.quote?.split('\n\n') ?? [];
  const bobartSponsorResult = bobartParas.find((p) => /sponsorship/i.test(p));
  const bobartGuestResult = bobartParas.find(
    (p) => /inbound leads/i.test(p) && p !== bobartSponsorResult
  );

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com/' },
    { name: 'Sponsorship', url: 'https://www.dimepodcast.com/sponsorship' },
  ]);
  const faqSchema = createFAQSchema(FAQ);

  function handleChange(e) {
    const { name, value } = e.target;
    if (!formStarted) {
      setFormStarted(true);
      trackSponsorFormStart();
    }
    setForm((f) => ({ ...f, [name]: value }));
  }

  // Opening the user's mail client is the fallback, not the happy path — see
  // the header comment in src/pages/api/sponsor-inquiry.js.
  function openMailFallback() {
    const subject = encodeURIComponent(`Sponsorship Inquiry: ${form.company || form.name}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Company: ${form.company}`,
        `Email: ${form.email}`,
        `Who they want to reach: ${form.targetCustomer}`,
        `What listeners should do: ${form.campaignGoal}`,
      ].join('\n')
    );
    window.location.href = `mailto:${SPONSOR_EMAIL}?subject=${subject}&body=${body}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');

    try {
      const res = await fetch('/api/sponsor-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      // A 400 means the server rejected the input, not that transport failed.
      // Falling back to mailto here would hand the user a prefilled draft
      // containing the same bad address and tell them nothing.
      if (res.status === 400) {
        setStatus('invalid');
        track('sponsor_form_invalid');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setStatus('sent');
      // The API answers honeypot hits with 200 so bots believe they got
      // through; `filtered` lets the real submissions stay countable.
      // Deliberately no company/email in the payload — this goes to a
      // third-party analytics service and the lead detail belongs in the
      // inbox, not there.
      if (!data.filtered) trackSponsorInquirySubmit(Boolean(form.company));
    } catch {
      // Never strand the lead: fall back to the old mailto behaviour.
      setStatus('fallback');
      track('sponsor_form_fallback');
      openMailFallback();
    }
  }

  return (
    <>
      <SeoHead
        title="Sponsorship"
        // SeoHead truncates at 150 characters, so the qualifying facts — price,
        // rating, asset count — go first. The channel list is the part that can
        // afford to be cut.
        description={`From $${EPISODE_PRICE.toLocaleString()}: one episode becomes ${ASSETS_PER_EPISODE}–${ASSETS_PER_EPISODE_MAX} finished assets you keep and repurpose. Cannabis B2B, ${libraryEpisodes}+ episodes, ${PODCAST_RATING.value}★.`}
        path="/sponsorship"
      />
      <Schema schema={breadcrumbSchema} />
      <Schema schema={faqSchema} />
      <Header />

      <style>{`
        .sp-section {
          padding: clamp(64px,9vw,120px) clamp(24px,5vw,48px);
        }
        /* Small uppercase mono labels carry a lot of the proof on this page.
           9px at .18em tracking in --text-muted was legible on a big monitor
           and not much else; 11px on --text-secondary keeps the look and
           clears AA at a realistic reading distance.
           NOTE: keep this block ASCII. React escapes angle brackets, quotes
           and ampersands server-side only, which mismatches on hydrate. */
        .sp-label {
          font-size: 11px;
        }
        .sp-hero-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 32px;
        }
        .sp-engine-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1px;
          background: var(--border-subtle);
          border: 1px solid var(--border-subtle);
        }
        .sp-engine-cell {
          background: var(--bg-base);
          padding: clamp(24px,3vw,32px);
          display: flex;
          flex-direction: column;
          min-height: 260px;
          transition: background .2s ease;
        }
        .sp-engine-cell:hover {
          background: var(--bg-surface);
        }
        .sp-engine-sum {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 1px;
          background: var(--border-accent);
          border: 1px solid var(--border-accent);
          margin-top: 40px;
        }
        /* Uses an explicit class rather than a child combinator on purpose.
           React escapes an angle bracket inside this template literal on the
           server but not on the client, so any child selector here causes a
           hydration mismatch that silently re-renders the whole page. Keep
           angle brackets out of this style block entirely, comments included. */
        .sp-engine-sum-cell {
          background: var(--bg-base);
          padding: 28px 24px;
          text-align: center;
        }
        .sp-split {
          display: grid;
          grid-template-columns: 1.15fr 1fr;
          gap: clamp(40px,6vw,72px);
          align-items: start;
        }
        .sp-trail-head {
          display: grid;
          grid-template-columns: 1.1fr 1fr;
          gap: clamp(24px,4vw,48px);
          align-items: end;
          padding-bottom: 28px;
          margin-bottom: 28px;
          border-bottom: 1px solid var(--border-subtle);
        }
        .sp-trail-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 1px;
          background: var(--border-subtle);
          border: 1px solid var(--border-subtle);
        }
        .sp-trail-cell {
          background: var(--bg-base);
          padding: clamp(20px,2.6vw,26px);
          display: block;
          text-decoration: none;
          transition: background .2s ease;
        }
        .sp-trail-cell:hover {
          background: var(--bg-elevated);
        }
        .sp-audience-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 1px;
          background: var(--border-subtle);
          border: 1px solid var(--border-subtle);
        }
        .sp-clip-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: clamp(16px,2.4vw,28px);
          max-width: 780px;
        }
        .sp-clip {
          margin: 0;
        }
        .sp-clip-frame {
          position: relative;
          aspect-ratio: 9 / 16;
          background: var(--bg-elevated);
          border: 1px solid var(--border-subtle);
          border-radius: 4px;
          overflow: hidden;
        }
        .sp-clip-frame iframe {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          border: 0;
        }
        .sp-clip-btn {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          padding: 0;
          border: 0;
          background: none;
          cursor: pointer;
          display: block;
        }
        .sp-clip-btn img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .sp-clip-play {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 54px;
          height: 54px;
          border-radius: var(--radius-full);
          background: rgba(10,10,10,.72);
          border: 1px solid rgba(255,255,255,.5);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background .2s ease, transform .2s ease;
        }
        .sp-clip-btn:hover .sp-clip-play {
          background: var(--btn-primary-bg);
          color: var(--btn-primary-text);
          transform: translate(-50%, -50%) scale(1.06);
        }
        .sp-clip-btn:focus-visible .sp-clip-play {
          outline: 2px solid var(--text-accent);
          outline-offset: 3px;
        }
        .sp-clip figcaption {
          font-size: 13.5px;
          line-height: 1.55;
          color: var(--text-secondary);
          font-weight: 300;
          margin-top: 12px;
        }
        .sp-manifest-row {
          display: grid;
          grid-template-columns: 48px 1fr;
          gap: 14px;
          align-items: baseline;
          padding: 14px clamp(24px,3vw,30px);
          border-bottom: 1px solid var(--border-subtle);
        }
        .sp-manifest-row:last-child {
          border-bottom: none;
        }
        .sp-manifest-qty {
          font-size: 15px;
          font-weight: 800;
          color: var(--text-accent);
          text-align: right;
          letter-spacing: .02em;
        }
        .sp-repurpose-list {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 14px 28px;
          list-style: none;
        }
        .sp-tier-grid {
          display: grid;
          gap: 28px;
          grid-template-columns: 1fr 1fr;
        }
        /* globals.css strips .card borders below 768px. The accent border on
           the featured tier is what marks it as the recommended option, so it
           is restored here rather than losing the pricing hierarchy on the
           viewport where most of this page is read. */
        .sp-tier-featured {
          border: 1px solid var(--text-accent) !important;
        }
        .sp-faq-list {
          display: grid;
          gap: 1px;
          background: var(--border-subtle);
          border: 1px solid var(--border-subtle);
          max-width: 860px;
        }
        .sp-faq-item {
          background: var(--bg-surface);
          padding: clamp(22px,3vw,30px) clamp(22px,3vw,32px);
        }
        .sp-form-layout {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 56px;
          align-items: start;
        }
        .sp-form-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: 1fr 1fr;
        }
        .sp-form-grid textarea {
          resize: vertical;
        }
        .sp-field-span-2 {
          grid-column: span 2;
        }
        .sp-honeypot {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
        .sp-chip {
          display: inline-flex;
          align-items: center;
          padding: 7px 14px;
          border-radius: var(--radius-full);
          background: var(--tag-bg);
          border: 1px solid var(--tag-border);
          color: var(--tag-text);
          font-size: 11px;
          font-weight: 600;
          letter-spacing: .02em;
          white-space: nowrap;
        }
        .sp-sidebar {
          position: sticky;
          top: 24px;
        }
        @media (max-width: 1024px) {
          .sp-engine-grid,
          .sp-trail-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 900px) {
          .sp-split,
          .sp-trail-head,
          .sp-form-layout {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .sp-trail-head {
            gap: 20px;
            align-items: start;
          }
          .sp-sidebar {
            position: static;
          }
        }
        @media (max-width: 767px) {
          .sp-hero-stats,
          .sp-engine-sum {
            grid-template-columns: repeat(2, 1fr);
          }
          .sp-hero-stats {
            gap: 24px;
          }
          .sp-engine-grid,
          .sp-trail-grid,
          .sp-audience-grid,
          .sp-repurpose-list,
          .sp-tier-grid,
          .sp-form-grid {
            grid-template-columns: 1fr;
          }
          /* Clips stay 2-up on phones: one 9:16 clip per row would be taller
             than the viewport and push the rest of the section off-screen. */
          .sp-clip-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
          .sp-engine-cell {
            min-height: 0;
          }
          .sp-field-span-2 {
            grid-column: span 1;
          }
        }
      `}</style>

      {/* ---------------------------------------------------------------- */}
      {/* HERO — lead with the mechanism, carry authority underneath        */}
      {/* ---------------------------------------------------------------- */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,transparent,var(--text-accent) 20%,var(--text-accent) 80%,transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border-subtle) 1px,transparent 1px),linear-gradient(90deg,var(--border-subtle) 1px,transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3, pointerEvents: 'none' }} />
        <div className="syne" aria-hidden="true" style={{ position: 'absolute', bottom: -40, right: -20, fontSize: 'clamp(110px,16vw,240px)', fontWeight: 800, color: 'transparent', WebkitTextStroke: '1px #1A2A3A', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '.04em', zIndex: 0 }}>
          SPONSOR
        </div>

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(64px,10vw,120px) clamp(24px,5vw,48px) 0' }}>
          <div className="fade-in" style={{ marginBottom: 32 }}>
            <Eyebrow>Sponsorship</Eyebrow>
          </div>
          <h1 className="syne fade-in" style={{ fontSize: 'clamp(40px,6.4vw,86px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.01em', lineHeight: 0.95, maxWidth: 960, marginBottom: 30 }}>
            Sponsor one episode.<br />
            Leave with <span style={{ color: 'var(--text-accent)' }}>a quarter&apos;s worth of content</span>.
          </h1>
          <p className="crimson fade-in" style={{ fontSize: 'clamp(17px,2.1vw,20px)', lineHeight: 1.75, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 680, marginBottom: 36 }}>
            Six years in the room with the operators, founders, and investors
            running cannabis. Sponsor an episode and you don&apos;t rent thirty
            seconds — you commission {ASSETS_PER_EPISODE}–{ASSETS_PER_EPISODE_MAX} finished
            assets across six surfaces, and you keep every file.
          </p>

          <div className="fade-in" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 20 }}>
            <a
              href="#sponsor-inquiry"
              className="btn-teal syne"
              style={{ textDecoration: 'none', display: 'inline-block' }}
              onClick={() => trackSponsorCtaClick('request_a_sponsorship', 'hero')}
            >
              Request a Sponsorship
            </a>
            <a href="#engine" className="btn-outline syne" style={{ textDecoration: 'none', display: 'inline-block', background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
              See What You Get ↓
            </a>
          </div>
          {/* Price in the hero is deliberate: it self-qualifies instantly and
              stops wasting everyone's time further down the funnel. */}
          {/* Links to #pricing so the anchor is reachable — pricing sits seven
              screens down and is the fact that qualifies the buyer fastest. */}
          <p className="mono fade-in" style={{ fontSize: '12px', color: 'var(--text-secondary)', letterSpacing: '.08em', marginBottom: 56 }}>
            <a
              href="#pricing"
              style={{ color: 'var(--text-secondary)' }}
              onClick={() => trackSponsorCtaClick('view_pricing', 'hero')}
            >
              From ${EPISODE_PRICE.toLocaleString()} per episode
            </a>{' '}
            · Category exclusivity on campaigns
          </p>

          <div className="sp-hero-stats fade-in" style={{ paddingTop: 32, paddingBottom: 40, borderTop: '1px solid var(--border-subtle)' }}>
            {HERO_STATS.map((s) => (
              <div key={s.label}>
                <div className="syne" style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, color: 'var(--text-accent)', marginBottom: 8 }}>
                  {s.value}
                </div>
                <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* THE REFRAME                                                       */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <div className="sp-split">
          <div>
            <Eyebrow>The Difference</Eyebrow>
            <SectionTitle>
              Most podcast sponsorships are an ad. This one is a production deal.
            </SectionTitle>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 20 }}>
              The standard arrangement: you pay for a read, it airs once, it disappears
              into a back catalog, and you have nothing to show for it but a line
              on an invoice.
            </p>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 20 }}>
              Here, one recording gets cut, captioned, written up, emailed, published,
              and posted natively to every platform your buyers already use. Then the
              finished files are handed to you — to run as ads, put in a deck, or post
              from your own accounts.
            </p>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-primary)', fontWeight: 400 }}>
              You&apos;re not renting thirty seconds of attention. You&apos;re
              commissioning a content library that happens to arrive with an audience
              already attached.
            </p>
          </div>
          {/* Brett was a guest, not a sponsor. Labelled as such for the same
              reason the Bobart quote is split below — his line about clips is
              the best evidence on the page that the production is real, and it
              only stays credible if the page is straight about who said it. */}
          {brett && (
            <Quote
              person={brett}
              paragraphs={brett.quote.split('\n\n')}
              caption="Guest appearance, not a paid sponsorship — but the clip package he describes is the same one a sponsor receives."
            />
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* THE ENGINE — the centerpiece                                      */}
      {/* ---------------------------------------------------------------- */}
      <section id="engine" className="sp-section" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>What One Sponsorship Produces</Eyebrow>
        <SectionTitle>One recording. Six surfaces. Eight to ten assets.</SectionTitle>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 660, marginBottom: 48 }}>
          Every sponsored episode runs through the same production pipeline. Your
          message is carried through all of it — one CTA, repeated cleanly, never
          diluted.
        </p>

        <div className="sp-engine-grid">
          {ENGINE.map((item) => (
            <div key={item.n} className="sp-engine-cell">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
                <span className="syne" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-accent)', letterSpacing: '.1em' }}>
                  {item.n}
                </span>
                <span className="sp-chip">{item.tag}</span>
              </div>
              <h3 className="syne" style={{ fontSize: '19px', fontWeight: 700, color: 'var(--text-headline)', lineHeight: 1.25, marginBottom: 8, letterSpacing: '.01em' }}>
                {item.asset}
              </h3>
              <div className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '.06em', marginBottom: 16, lineHeight: 1.6 }}>
                {item.channel}
              </div>
              <p className="crimson" style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
                {item.detail}
              </p>
            </div>
          ))}
        </div>

        <div className="sp-engine-sum">
          {ENGINE_SUMMARY.map((s) => (
            <div key={s.label} className="sp-engine-sum-cell">
              <div className="syne" style={{ fontSize: 'clamp(28px,3.6vw,40px)', fontWeight: 800, color: 'var(--text-accent)', lineHeight: 1, marginBottom: 10 }}>
                {s.value}
              </div>
              <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 680, marginTop: 28 }}>
          A four-episode campaign produces {ASSETS_PER_EPISODE * CAMPAIGN_EPISODES}–{ASSETS_PER_EPISODE_MAX * CAMPAIGN_EPISODES} assets
          in a quarter. You&apos;ll be posting this content long after the campaign
          closes.
        </p>

        <CtaRow location="inline" style={{ marginTop: 40 }} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* WHERE IT LANDS — the placement argument, with live links          */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Where It Lands</Eyebrow>
        <SectionTitle>Making the video is easy. Placing it is the hard part.</SectionTitle>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 700, marginBottom: 20 }}>
          Any agency can hand you a file. Getting that file cut to the right
          dimensions for four different feeds, captioned, scheduled, and posted
          natively — every week, on accounts that already have an audience — is
          the part that needs a team you probably do not want to hire.
        </p>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-primary)', fontWeight: 400, maxWidth: 700, marginBottom: 44 }}>
          That machinery already exists here. You are renting the distribution,
          not just the production.
        </p>

        <div style={{ marginBottom: 56 }}>
          <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: 10 }}>
            Three cuts from one episode
          </div>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 640, marginBottom: 28 }}>
            Real clips, not mockups — captioned, cut vertical, and sized for the
            feed. This is what the short-form line on the manifest looks like.
          </p>
          <div className="sp-clip-grid">
            {CLIPS.map((c) => (
              <ClipFacade key={c.id} id={c.id} title={c.title} />
            ))}
          </div>
        </div>

        {trail ? (
          <>
            <div className="sp-trail-head">
              <div>
                <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: 10 }}>
                  One real episode · {trail.dateDisplay}
                </div>
                <div className="syne" style={{ fontSize: 'clamp(19px,2.4vw,24px)', fontWeight: 800, color: 'var(--text-headline)', lineHeight: 1.25 }}>
                  {trail.editionTitle}
                </div>
                {trail.guest && (
                  <div className="mono" style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: 8 }}>
                    with {trail.guest}
                  </div>
                )}
              </div>
              <p className="crimson" style={{ fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
                Every link below is live. Follow them and you are looking at the
                exact surfaces a sponsored episode of yours would land on.
              </p>
            </div>

            <div className="sp-trail-grid">
              {[
                {
                  n: '01',
                  label: 'YouTube',
                  what: 'Full video episode',
                  href: `https://www.youtube.com/watch?v=${trail.videoId}`,
                  external: true,
                },
                {
                  n: '02',
                  label: 'dimepodcast.com',
                  what: `Show notes, your links${trail.hasTranscript ? ', and the full transcript' : ''}`,
                  href: `/episodes/${trail.episodeSlug}`,
                  external: false,
                },
                {
                  n: '03',
                  label: 'First Principles',
                  what: 'Written companion edition',
                  href: `/newsletter/${trail.editionSlug}`,
                  external: false,
                },
                {
                  n: '04',
                  label: 'LinkedIn',
                  what: 'Republished as a Pulse article',
                  href: trail.linkedinUrl,
                  external: true,
                },
                // No transcript card: it lives on the episode page above, so a
                // fifth card would send a prospect to a URL they have already
                // clicked — on the one section that invites them to check.
              ].map((item) => {
                const inner = (
                  <>
                    <span className="syne" style={{ fontSize: '12px', fontWeight: 800, color: 'var(--text-accent)', letterSpacing: '.1em', display: 'block', marginBottom: 12 }}>
                      {item.n}
                    </span>
                    <span className="syne" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-headline)', display: 'block', marginBottom: 6 }}>
                      {item.label}
                    </span>
                    <span className="crimson" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', fontWeight: 300, display: 'block', marginBottom: 14 }}>
                      {item.what}
                    </span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--text-accent)' }}>
                      See it live →
                    </span>
                  </>
                );
                return item.external ? (
                  <a
                    key={item.n}
                    className="sp-trail-cell"
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => track('sponsor_proof_click', { surface: item.label })}
                  >
                    {inner}
                  </a>
                ) : (
                  <Link
                    key={item.n}
                    className="sp-trail-cell"
                    href={item.href}
                    onClick={() => track('sponsor_proof_click', { surface: item.label })}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>

            <p className="crimson" style={{ fontSize: '15px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 700, marginTop: 28 }}>
              Plus the 3–5 short-form cuts from this same conversation, posted
              natively to Instagram, Facebook, LinkedIn and YouTube. On a
              sponsored episode, your message runs through all of it.
            </p>
          </>
        ) : null}
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* REPURPOSE RIGHTS + PER-ASSET MATH                                 */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <div className="sp-split">
          <div>
            <Eyebrow>You Keep the Files</Eyebrow>
            <SectionTitle>The campaign ends. The content is still yours.</SectionTitle>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 24 }}>
              Every asset produced for your sponsorship is handed over when the
              campaign wraps — the cuts, the captions, the article, the episode
              embed. Full rights to repurpose them however you want, for as long
              as you want.
            </p>

            {/* The per-asset number is derived from the published price and the
                conservative asset count, so it can't drift from the pricing
                section below. */}
            <div style={{ borderLeft: '2px solid var(--text-accent)', paddingLeft: 24, marginBottom: 32 }}>
              <div className="syne" style={{ fontSize: 'clamp(24px,3vw,32px)', fontWeight: 800, color: 'var(--text-headline)', lineHeight: 1.2, marginBottom: 10 }}>
                {ASSETS_PER_EPISODE}–{ASSETS_PER_EPISODE_MAX} assets. From ${COST_PER_ASSET_MIN} each.
              </div>
              <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.75, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
                ${COST_PER_ASSET} an asset at eight, ${COST_PER_ASSET_MIN} at ten —
                and that is the most you pay per asset, not the least. Commission
                the same package from a production studio and you pay for the
                production alone. Here the audience is the part you are not paying
                extra for.
              </p>
            </div>

            <ul className="sp-repurpose-list">
              {REPURPOSE_USES.map((use) => (
                <li key={use} className="crimson" style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 300, display: 'flex', gap: 10, lineHeight: 1.5 }}>
                  <CheckIcon />
                  {use}
                </li>
              ))}
            </ul>
          </div>

          {/* Styled as a delivery manifest rather than a feature list — a
              packing slip reads as a count of things received, which is the
              whole argument of this section. */}
          <div className="card" style={{ padding: 0, background: 'var(--bg-base)', overflow: 'hidden' }}>
            <div style={{ padding: 'clamp(24px,3vw,30px) clamp(24px,3vw,30px) 18px', borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: 8 }}>
                Delivery Manifest
              </div>
              <div className="crimson" style={{ fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 300, lineHeight: 1.6 }}>
                Per sponsored episode. Every item handed over on completion.
              </div>
            </div>

            <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
              {MANIFEST.map((m) => (
                <li key={m.item} className="sp-manifest-row">
                  <span className="syne sp-manifest-qty">{m.qty}</span>
                  <span>
                    <span className="syne" style={{ fontSize: '14.5px', fontWeight: 700, color: 'var(--text-headline)', display: 'block', lineHeight: 1.35 }}>
                      {m.item}
                    </span>
                    <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginTop: 3, lineHeight: 1.5 }}>
                      {m.note}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div style={{ padding: 'clamp(20px,2.6vw,26px) clamp(24px,3vw,30px)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14, margin: 0 }}>
                {ALSO_INCLUDED.map((x) => (
                  <li key={x.t}>
                    <div className="syne" style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: 4, display: 'flex', gap: 10 }}>
                      <CheckIcon />
                      {x.t}
                    </div>
                    <p className="crimson" style={{ fontSize: '13.5px', lineHeight: 1.6, color: 'var(--text-secondary)', fontWeight: 300, margin: '0 0 0 25px' }}>
                      {x.d}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* PROOF                                                             */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Proof</Eyebrow>
        <SectionTitle>What it did for the last people who tried it.</SectionTitle>
        <div style={{ maxWidth: 780, marginTop: 40, marginBottom: 40, display: 'flex', flexDirection: 'column', gap: 24 }}>
          {bobart && bobartSponsorResult && (
            <Quote person={bobart} paragraphs={[bobartSponsorResult]} accent />
          )}
          {bobart && bobartGuestResult && (
            <div style={{ borderLeft: '2px solid var(--border-default)', paddingLeft: 24 }}>
              <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 10 }}>
                And from the guest chair
              </div>
              <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.7, color: 'var(--text-primary)', fontWeight: 400, fontStyle: 'italic', marginBottom: 10 }}>
                &ldquo;{bobartGuestResult}&rdquo;
              </p>
              <p className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
                Brandon Bobart, on his own guest appearance — not a paid placement.
                Same audience doing the responding.
              </p>
            </div>
          )}
        </div>
        <div>
          <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 14 }}>
            {/* "Recognizable", not "Recent" — the list is hand-maintained, so
                a recency claim rots the moment it is not updated. */}
            Recognizable Guests
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {RECOGNIZABLE_GUESTS.map((g) => (
              <span key={g} className="sp-chip">{g}</span>
            ))}
            {/* Deliberately not a computed count: libraryEpisodes counts
                episodes, not guests — some have no guest and several guests
                appear more than once. */}
            <span className="sp-chip" style={{ background: 'transparent' }}>+ hundreds more</span>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* AUDIENCE — disqualify early, it converts better than a number     */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        {/* Deliberately short. An earlier draft spent three paragraphs
            arguing about reach; arguing about a metric keeps the reader
            thinking about it. This page sells the asset package, so the
            audience section answers "who", not "how many", and moves on. */}
        <Eyebrow>Who Is Listening</Eyebrow>
        <SectionTitle>Forty-five minutes with the people who decide.</SectionTitle>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-primary)', fontWeight: 400, maxWidth: 700, marginBottom: 44 }}>
          Not a feed scroll. Not a banner. Forty-five uninterrupted minutes with a
          cannabis operator who chose to press play, on a show they have followed
          for six years. Current audience figures are available on request.
        </p>

        <div className="sp-audience-grid">
          {AUDIENCE_COMPOSITION.map((a) => (
            <div key={a.role} style={{ background: 'var(--bg-base)', padding: 'clamp(24px,3vw,30px)' }}>
              <div className="syne" style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: 8, letterSpacing: '.01em' }}>
                {a.role}
              </div>
              <p className="crimson" style={{ fontSize: '14.5px', lineHeight: 1.7, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
                {a.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CHANNEL MATH — the structural argument nobody else can make       */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <div style={{ maxWidth: 760 }}>
          <Eyebrow>The Channel Math</Eyebrow>
          {/* Headline scoped to match the paragraph under it. The stronger
              version ("you can't buy this audience") overreaches — LinkedIn
              ads exist, and ancillary vendors can run Google Search. */}
          <SectionTitle>Most of this industry can&apos;t buy Google or Meta ads.</SectionTitle>
          <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 20 }}>
            Paid search and paid social are closed to most of this industry. That
            leaves trade press, events, and podcasts — and that is the entire board.
            A booth at the big show runs five figures, ends on Sunday, and ships you
            nothing you can post on Monday.
          </p>
          <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-primary)', fontWeight: 400 }}>
            This is one of the few places a cannabis company can actually buy
            attention — and the only one that hands you {ASSETS_PER_EPISODE * CAMPAIGN_EPISODES} pieces
            of content on the way out.
          </p>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* PRICING                                                           */}
      {/* ---------------------------------------------------------------- */}
      <section id="pricing" className="sp-section" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Sponsorship Options</Eyebrow>
        <SectionTitle>One read gets noticed. Four get remembered.</SectionTitle>
        <div className="sp-tier-grid" style={{ marginTop: 44 }}>
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              className={`card${tier.featured ? ' sp-tier-featured' : ''}`}
              style={{
                position: 'relative',
                padding: 'clamp(28px,4vw,40px)',
                overflow: 'hidden',
                background: 'var(--bg-base)',
                borderColor: tier.featured ? 'var(--text-accent)' : 'var(--card-border)',
                boxShadow: tier.featured ? 'var(--shadow-card-hover)' : 'none',
              }}
            >
              <span className="syne" aria-hidden="true" style={{ position: 'absolute', top: -6, right: 12, fontSize: '96px', fontWeight: 800, color: 'transparent', WebkitTextStroke: '1px var(--border-default)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                0{i + 1}
              </span>
              {tier.featured && (
                <span className="tag" style={{ position: 'relative', zIndex: 1, marginBottom: 20, display: 'inline-block' }}>Built for Recall</span>
              )}
              <h3 className="syne" style={{ position: 'relative', fontSize: '26px', fontWeight: 800, color: 'var(--text-headline)', marginBottom: 12, marginTop: tier.featured ? 0 : 4 }}>
                {tier.name}
              </h3>
              <div style={{ position: 'relative', marginBottom: 22 }}>
                <span className="syne" style={{ fontSize: '38px', fontWeight: 800, color: 'var(--text-accent)', display: 'block', lineHeight: 1 }}>
                  {tier.price}
                </span>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '.06em', display: 'block', marginTop: 8 }}>
                  {tier.priceSub}
                </span>
              </div>
              <p className="crimson" style={{ position: 'relative', fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 24 }}>
                {tier.description}
              </p>
              <ul style={{ position: 'relative', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tier.inclusions.map((item) => (
                  <li key={item} className="crimson" style={{ fontSize: '14.5px', color: 'var(--text-primary)', fontWeight: 300, display: 'flex', gap: 10, lineHeight: 1.5 }}>
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Risk reversal. Scoped to exactly one promise — copy approval —
            because that is the only guarantee confirmed as honourable. Do not
            add revision or performance guarantees here without confirming
            them first; an unhonoured promise on this page is worse than no
            promise at all. */}
        <div style={{ marginTop: 40, maxWidth: 760, border: '1px solid var(--border-accent)', borderRadius: 4, padding: 'clamp(26px,4vw,36px)', background: 'var(--bg-base)' }}>
          <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: 14 }}>
            Our Side of the Deal
          </div>
          <h3 className="syne" style={{ fontSize: 'clamp(20px,2.6vw,26px)', fontWeight: 800, color: 'var(--text-headline)', marginBottom: 14, lineHeight: 1.2 }}>
            You approve the read before it airs.
          </h3>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 14 }}>
            Nothing goes out with your name on it that you haven&apos;t signed off on.
            You see the host-read copy before the episode publishes.
          </p>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-primary)', fontWeight: 400, margin: 0 }}>
            Start with one episode. If the assets aren&apos;t what we described here,
            don&apos;t book the next three.
          </p>
        </div>

        <CtaRow location="pricing" style={{ marginTop: 40 }} />
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* CAMPAIGN SUPPORT                                                  */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <div className="sp-split">
          <div>
            <Eyebrow>Campaign Support</Eyebrow>
            <SectionTitle maxWidth={620}>We build the campaign with you.</SectionTitle>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 20 }}>
              Multi-episode campaigns open with a strategy session to define the
              audience, offer, CTA, landing page, and tracking plan. You bring the
              expertise. The Dime shapes it into something this audience will
              actually respond to.
            </p>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300 }}>
              Original guides, checklists, landing-page copy, and other campaign
              assets are available for an additional production fee — quoted up
              front, never a surprise on the invoice.
            </p>
          </div>
          <div className="card" style={{ padding: 32, background: 'var(--bg-surface)' }}>
            <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 20 }}>
              Strategy Session Covers
            </div>
            <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {STRATEGY_INCLUDES.map((item) => (
                <li key={item} className="crimson" style={{ fontSize: '15px', color: 'var(--text-primary)', fontWeight: 300, display: 'flex', gap: 10 }}>
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* FAQ — also emitted as FAQPage schema above                        */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Before You Ask</Eyebrow>
        <SectionTitle>The questions everyone asks on the call.</SectionTitle>
        <div className="sp-faq-list" style={{ marginTop: 40 }}>
          {FAQ.map((item) => (
            <div key={item.question} className="sp-faq-item">
              <h3 className="syne" style={{ fontSize: '17px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: 10, lineHeight: 1.35 }}>
                {item.question}
              </h3>
              <p className="crimson" style={{ fontSize: '15.5px', lineHeight: 1.75, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
                {item.answer}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* QUALIFICATION — a trust play, not fine print                      */}
      {/* ---------------------------------------------------------------- */}
      <section className="sp-section" style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <div className="sp-split">
          <div>
            <Eyebrow>Qualification</Eyebrow>
            <SectionTitle maxWidth={620}>We turn down sponsors.</SectionTitle>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 20 }}>
              The Dime works with companies that serve the cannabis industry and give
              its audience useful, accurate information. Everyone else gets a no.
            </p>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-primary)', fontWeight: 400 }}>
              Sponsorship does not influence editorial questions or guest coverage —
              which is precisely why a read here carries weight. An audience that
              believes the show is for sale stops being worth selling to.
            </p>
          </div>
          {kuczeruk && <Quote person={kuczeruk} paragraphs={kuczeruk.quote.split('\n\n')} />}
        </div>
      </section>

      {/* ---------------------------------------------------------------- */}
      {/* INQUIRY FORM                                                      */}
      {/* ---------------------------------------------------------------- */}
      <section id="sponsor-inquiry" className="sp-section" style={{ background: 'var(--bg-surface)' }}>
        <Eyebrow>Inquiry Form</Eyebrow>
        <h2 className="syne" style={{ fontSize: 'clamp(30px,4.5vw,44px)', fontWeight: 800, color: 'var(--text-headline)', marginBottom: 16, maxWidth: 620, lineHeight: 1.06 }}>
          Let&apos;s find out if this fits.
        </h2>
        <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 580, marginBottom: 44 }}>
          Three fields — name, company, email. The rest is optional. If we&apos;re
          not right for you, we&apos;ll say so and point you somewhere better. If we
          are, you&apos;ll get the plan and the next open slot.
        </p>
        <div className="sp-form-layout">
          <form onSubmit={handleSubmit}>
            <div className="sp-form-grid" style={{ marginBottom: 28 }}>
              {FORM_FIELDS.map((field) => (
                <label
                  key={field.name}
                  className={field.span === 2 ? 'sp-field-span-2' : undefined}
                  style={{ fontFamily: "'Syne Mono', monospace", fontSize: '11px', color: 'var(--text-secondary)', letterSpacing: '.06em', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  <span>
                    {field.label}
                    {field.hint && (
                      <span style={{ color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}> — {field.hint}</span>
                    )}
                  </span>
                  {field.type === 'textarea' ? (
                    <textarea name={field.name} value={form[field.name]} onChange={handleChange} required={field.required} maxLength={field.maxLength} rows={3} />
                  ) : (
                    <input type={field.type} name={field.name} value={form[field.name]} onChange={handleChange} required={field.required} maxLength={field.maxLength} />
                  )}
                </label>
              ))}
            </div>

            {/* Honeypot: hidden from users, irresistible to bots. */}
            <div className="sp-honeypot" aria-hidden="true">
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={handleChange} />
              </label>
            </div>

            {/* Stays disabled after a successful send: the form is not cleared,
                so a second click would mail a duplicate. */}
            <button type="submit" className="btn-teal syne" style={{ width: '100%' }} disabled={status === 'sending' || status === 'sent'}>
              {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent ✓' : 'Request a Sponsorship →'}
            </button>

            <div aria-live="polite" style={{ minHeight: 24, marginTop: 14 }}>
              {status === 'sent' && (
                <p className="crimson" style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
                  Got it — this went straight to Bryan, and he&apos;ll come back to you.
                </p>
              )}
              {status === 'invalid' && (
                <p className="crimson" style={{ fontSize: '15px', color: 'var(--text-primary)', lineHeight: 1.7, margin: 0 }}>
                  That didn&apos;t go through — please check the email address and try again.
                </p>
              )}
              {status === 'fallback' && (
                <p className="crimson" style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.7, margin: 0 }}>
                  We couldn&apos;t submit that directly, so your email client should be
                  opening with the details filled in. If nothing happened, email{' '}
                  <a href={`mailto:${SPONSOR_EMAIL}`} style={{ color: 'var(--text-accent)' }}>{SPONSOR_EMAIL}</a>.
                </p>
              )}
            </div>
          </form>

          <div className="sp-sidebar">
            <div className="card" style={{ padding: 32, background: 'var(--bg-base)' }}>
              <div className="mono sp-label" style={{ fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: 20 }}>
                What Happens Next
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
                {NEXT_STEPS.map((step, i) => (
                  <li key={step} style={{ display: 'flex', gap: 12 }}>
                    <span className="syne" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-accent)', flexShrink: 0 }}>{i + 1}.</span>
                    <span className="crimson" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', fontWeight: 300 }}>{step}</span>
                  </li>
                ))}
              </ul>
              <div style={{ paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="mono sp-label" style={{ color: 'var(--text-secondary)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Prefer email?
                </div>
                <a
                  href={`mailto:${SPONSOR_EMAIL}`}
                  className="mono"
                  style={{ fontSize: '13px', color: 'var(--text-accent)' }}
                  onClick={() => track('sponsor_email_click')}
                >
                  {SPONSOR_EMAIL}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
