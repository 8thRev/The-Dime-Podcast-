import { useState, useRef, useEffect } from 'react';
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
import { createBreadcrumbSchema } from '@/lib/schema';
import { PODCAST_RATING } from '@/lib/ratings';
import { HONEYPOT_FIELD, HONEYPOT_LABEL, FILL_TIME_FIELD } from '@/lib/formSpam';
import { SPONSOR_INQUIRY_FIELDS } from '@/lib/inquiryFields';
import Link from 'next/link';
import {
  NEWSLETTER_SUBSCRIBERS,
  NEWSLETTER_OPEN_RATE_PCT,
  EPISODE_DOWNLOADS_MIN,
  SPONSOR_OPTIONS,
  SPONSOR_OPTION_NAMES,
} from '@/lib/sponsorOffer';
import { getAllEditions } from '@/lib/newsletter';
import { getAllGuests, guestToSlug } from '@/lib/guests';
import testimonials from '@/content/testimonials.json';
import videos from '@/content/videos.json';

// Plain text, one column: who listens, three options with a price each, one
// form. Modelled on agentusecases.ai/sponsor. Resist adding sections back;
// the long version of this page had fourteen and asked the buyer to read all
// of them before seeing a price.
//
// Two rules carried over from the long version:
// - Audience numbers live in lib/sponsorOffer.js with their sources, and
//   each must be showable on request. Nothing estimated, nothing rounded up.
// - The options and prices come from lib/sponsorOffer.js, shared with the
//   "Sponsorship facts" section of /llms.txt so the two cannot disagree.

function durationSeconds(v) {
  const m = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(v.durationISO || '');
  if (!m) return 0;
  return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
}

// videos.json is 287 entries and must stay server-side: read it only here so
// Next strips it from the client bundle. Entries under four minutes are
// excerpts, not episodes.
// Hand-picked names a cannabis buyer will recognise. "Guests have included",
// never "recent": the list is hand-maintained and a recency claim would rot.
const NOTABLE_GUESTS = ['Hirsh Jain', 'Trent Woloveck', 'John Shute', 'Thomas Winstanley', 'Nadia Sabeh', 'George DeNardo'];

export async function getStaticProps() {
  const libraryEpisodes = videos.filter((v) => durationSeconds(v) >= 240).length;
  // The newest edition is the sample for both newsletter options.
  const latest = getAllEditions()[0] || null;
  const latestEdition = latest ? { slug: latest.slug, title: latest.title } : null;
  // Link a name only when its guest page exists, so no link 404s.
  const guestSlugs = new Set((await getAllGuests()).map((g) => g.slug));
  const notableGuests = NOTABLE_GUESTS.map((name) => {
    const slug = guestToSlug(name);
    return { name, slug: guestSlugs.has(slug) ? slug : null };
  });
  return { props: { libraryEpisodes, latestEdition, notableGuests }, revalidate: 3600 };
}

const SPONSOR_EMAIL = 'sponsorship@dimepodcast.com';

const FORM_FIELDS = [
// maxLength is SPONSOR_INQUIRY_FIELDS (lib/inquiryFields.js), the limits the
// route enforces with a 400 that names the field.
  { name: 'name', label: 'Name', type: 'text', required: true, maxLength: SPONSOR_INQUIRY_FIELDS.name.max },
  { name: 'company', label: 'Company', type: 'text', required: true, maxLength: SPONSOR_INQUIRY_FIELDS.company.max },
  { name: 'email', label: 'Email', type: 'email', required: true, maxLength: SPONSOR_INQUIRY_FIELDS.email.max },
  {
    name: 'option',
    label: 'Which option?',
    type: 'select',
    choices: [...SPONSOR_OPTION_NAMES, 'Not sure yet'],
    required: false,
  },
  {
    name: 'targetCustomer',
    maxLength: SPONSOR_INQUIRY_FIELDS.targetCustomer.max,
    label: 'Who are you trying to reach?',
    hint: 'Optional',
    type: 'textarea',
    required: false,
  },
];

// HONEYPOT_FIELD is the honeypot, not a field; it seeds here so the value
// stays controlled like every other input. See lib/formSpam.js.
const EMPTY_FORM = FORM_FIELDS.reduce((acc, f) => ({ ...acc, [f.name]: '' }), { [HONEYPOT_FIELD]: '' });

// One entry of the route's 400 `fields` array, in the form's own words.
function describeInvalidField({ field, problem, max }) {
  const label = FORM_FIELDS.find((f) => f.name === field)?.label || field;
  if (problem === 'missing') return `${label} (required)`;
  if (problem === 'too_long') return `${label} (at most ${max} characters)`;
  if (problem === 'invalid_email') return `${label} (not a valid email address)`;
  return label;
}

export default function Sponsorship({ libraryEpisodes, latestEdition, notableGuests }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [status, setStatus] = useState('idle'); // idle | sending | sent | invalid | fallback
  // Field names the route rejected, from its 400 `fields` array.
  const [invalidFields, setInvalidFields] = useState([]);
  const [formStarted, setFormStarted] = useState(false);
  // Set on mount so the fill-time check measures from when the form became
  // usable. See lib/formSpam.js.
  const mountedAt = useRef(null);
  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  // The one paragraph of Bobart's testimonial that is about a sponsorship.
  // The others are about his guest appearance and are not sponsorship proof.
  // Matched on content, not index, so an edit to testimonials.json cannot
  // relabel a guest outcome as a sponsor result.
  const bobart = testimonials.find((t) => t.name === 'Brandon Bobart');
  const sponsorProof = bobart?.quote?.split('\n\n').find((p) => /sponsorship/i.test(p));

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com/' },
    { name: 'Sponsorship', url: 'https://www.dimepodcast.com/sponsorship' },
  ]);

  function handleChange(e) {
    const { name, value } = e.target;
    if (!formStarted) {
      setFormStarted(true);
      trackSponsorFormStart();
    }
    setForm((f) => ({ ...f, [name]: value }));
    // An edited field is no longer the one the server rejected.
    setInvalidFields((list) => (list.some((f) => f.field === name) ? list.filter((f) => f.field !== name) : list));
  }

  // Opening the user's mail client is the fallback, not the happy path. See
  // the header comment in src/pages/api/sponsor-inquiry.js.
  function openMailFallback() {
    const subject = encodeURIComponent(`Sponsorship Inquiry: ${form.company || form.name}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Company: ${form.company}`,
        `Email: ${form.email}`,
        `Option: ${form.option}`,
        `Who they want to reach: ${form.targetCustomer}`,
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
        body: JSON.stringify({
          ...form,
          [FILL_TIME_FIELD]: mountedAt.current === null ? null : Date.now() - mountedAt.current,
        }),
      });
      // A 400 means the server rejected the input, not that transport failed.
      // Falling back to mailto here would hand the user a prefilled draft
      // containing the same bad address and tell them nothing.
      if (res.status === 400) {
        const data = await res.json().catch(() => ({}));
        setInvalidFields(Array.isArray(data.fields) ? data.fields : []);
        setStatus('invalid');
        track('sponsor_form_invalid');
        return;
      }
      setInvalidFields([]);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setStatus('sent');
      // The API answers honeypot hits with 200 so bots believe they got
      // through; `filtered` keeps the real submissions countable. No company
      // or email in the payload: lead detail belongs in the inbox, not GA.
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
        description={`Sponsor The Dime from $${Math.min(...SPONSOR_OPTIONS.map((o) => o.price))}: the First Principles newsletter (${NEWSLETTER_SUBSCRIBERS.toLocaleString('en-US')} subscribers), a sponsored write-up, or a read across every episode.`}
        path="/sponsorship"
      />
      <Schema schema={breadcrumbSchema} />
      <Header />

      <style>{`
        .sp-body {
          font-family: var(--font-body);
          font-size: 17px;
          line-height: 1.75;
          color: var(--text-secondary);
        }
        .sp-block {
          margin-top: clamp(40px, 6vw, 56px);
        }
        .sp-list {
          list-style: disc;
          padding-left: 22px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .sp-options {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .sp-option {
          border: 1px solid var(--border-default);
          border-radius: 8px;
          padding: clamp(20px, 3vw, 28px);
          background: var(--bg-surface);
        }
        .sp-option-head {
          display: flex;
          justify-content: space-between;
          align-items: baseline;
          gap: 8px 20px;
          flex-wrap: wrap;
        }
        .sp-option-name {
          font-family: var(--font-body);
          font-size: 21px;
          font-weight: 700;
          color: var(--text-headline);
        }
        .sp-option-price {
          font-family: var(--font-body);
          font-size: 21px;
          font-weight: 600;
          color: var(--text-accent);
          margin: 0;
        }
        .sp-option-actions {
          display: flex;
          align-items: baseline;
          flex-wrap: wrap;
          gap: 8px 24px;
          margin-top: 16px;
        }
        .sp-option-cta {
          display: inline-block;
          font-family: var(--font-body);
          font-size: 15px;
          font-weight: 600;
          color: var(--text-accent);
          text-decoration: none;
        }
        .sp-quote {
          margin-inline: 0;
          margin-bottom: 0;
          padding-left: 20px;
          border-left: 2px solid var(--text-accent);
        }
        .sp-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
        }
        .sp-form label {
          display: flex;
          flex-direction: column;
          gap: 8px;
          font-family: var(--font-mono);
          font-size: 12px;
          letter-spacing: 0.04em;
          color: var(--text-secondary);
        }
        .sp-form textarea {
          resize: vertical;
        }
        .sp-honeypot {
          position: absolute;
          left: -9999px;
          width: 1px;
          height: 1px;
          overflow: hidden;
        }
      `}</style>

      <section className="band">
        <div className="wrap wrap--prose page-head">
          <span className="eyebrow">Sponsorship</span>
          <h1 className="page-title">Reach the people who run cannabis.</h1>
          <p className="lede">
            Operators, founders and investors come to The Dime to learn. Most of
            this industry can&apos;t buy Google or Meta ads, so this is one of the
            few places you can reach them on purpose: in their inbox, or in
            their ears.
          </p>
        </div>
      </section>

      <div className="wrap wrap--prose page-body">
        <h2 className="section-label">Who listens and reads</h2>
        <p className="sp-body">
          Operators, founders, investors and the service providers who sell to
          them. Episodes average {EPISODE_DOWNLOADS_MIN}+ downloads each, and{' '}
          {NEWSLETTER_SUBSCRIBERS.toLocaleString('en-US')} subscribe to the
          First Principles newsletter, with a {NEWSLETTER_OPEN_RATE_PCT}% open
          rate. On air since 2020: {libraryEpisodes}+ episodes,{' '}
          {PODCAST_RATING.value}★ from {PODCAST_RATING.count} listener ratings.
        </p>
        <p className="sp-body" style={{ marginTop: 14 }}>
          Guests have included{' '}
          {notableGuests.map((g, i) => (
            <span key={g.name}>
              {g.slug ? (
                <Link href={`/guests/${g.slug}`} style={{ color: 'var(--text-accent)' }}>{g.name}</Link>
              ) : g.name}
              {i < notableGuests.length - 1 ? ', ' : ''}
            </span>
          ))}
          {' '}and hundreds more.
        </p>

        <div className="sp-block">
          <h2 className="section-label">Three ways to sponsor</h2>
          <div className="sp-options">
            {SPONSOR_OPTIONS.map((o) => (
              <section key={o.id} className="sp-option" aria-labelledby={`sp-${o.id}`}>
                <div className="sp-option-head">
                  <h3 id={`sp-${o.id}`} className="sp-option-name">{o.name}</h3>
                  <p className="sp-option-price">
                    ${o.price.toLocaleString('en-US')} <span className="meta">{o.unit}</span>
                  </p>
                </div>
                <p className="meta" style={{ color: 'var(--text-secondary)', margin: '4px 0 14px' }}>For: {o.forWhom}</p>
                <ul className="sp-list sp-body">
                  {o.includes.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
                <div className="sp-option-actions">
                  <a
                    href="#sponsor-inquiry"
                    className="sp-option-cta"
                    onClick={() => {
                      setForm((f) => ({ ...f, option: o.name }));
                      trackSponsorCtaClick('request_a_sponsorship', 'pricing');
                    }}
                  >
                    Choose {o.name} →
                  </a>
                  {o.example && latestEdition && (
                    <Link
                      href={`/newsletter/${latestEdition.slug}`}
                      className="meta"
                      onClick={() => track('sponsor_proof_click', { surface: 'First Principles' })}
                    >
                      See a recent edition
                    </Link>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>

        {sponsorProof && (
          <figure className="sp-quote sp-block">
            <blockquote className="sp-body" style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-primary)' }}>
              &ldquo;{sponsorProof}&rdquo;
            </blockquote>
            <figcaption className="meta" style={{ marginTop: 10 }}>
              {bobart.name}, {bobart.title}
            </figcaption>
          </figure>
        )}

        <div id="sponsor-inquiry" className="sp-block" style={{ scrollMarginTop: 24 }}>
          <h2 className="section-label">Request a slot</h2>
          <p className="sp-body" style={{ marginBottom: 24 }}>
            Bryan reads every one and comes back with the next open slot, or a
            straight answer if it is not a fit. Prefer email?{' '}
            <a
              href={`mailto:${SPONSOR_EMAIL}`}
              style={{ color: 'var(--text-accent)' }}
              onClick={() => track('sponsor_email_click')}
            >
              {SPONSOR_EMAIL}
            </a>
          </p>

          {/* method and action are for a submit before hydration or with JS
              failed: without them the browser sent a GET to this page with
              every field, email included, in the query string, which the
              page_view in _app.js then forwarded to GA. */}
          <form method="post" action="/api/sponsor-inquiry" onSubmit={handleSubmit} className="sp-form">
            {FORM_FIELDS.map((field) => (
              <label key={field.name}>
                <span>
                  {field.label}
                  {field.hint && <span style={{ color: 'var(--text-muted)' }}> ({field.hint})</span>}
                </span>
                {field.type === 'select' ? (
                  <select name={field.name} value={form[field.name]} onChange={handleChange}>
                    <option value="">Choose one</option>
                    {field.choices.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : field.type === 'textarea' ? (
                  <textarea name={field.name} value={form[field.name]} onChange={handleChange} required={field.required} maxLength={field.maxLength} rows={3} aria-invalid={invalidFields.some((f) => f.field === field.name) || undefined} />
                ) : (
                  <input type={field.type} name={field.name} value={form[field.name]} onChange={handleChange} required={field.required} maxLength={field.maxLength} aria-invalid={invalidFields.some((f) => f.field === field.name) || undefined} />
                )}
              </label>
            ))}

            {/* Honeypot: hidden from users, irresistible to bots. Named and
                labelled so autofill and agents leave it empty. See
                lib/formSpam.js. */}
            <div className="sp-honeypot" aria-hidden="true">
              <label>
                {HONEYPOT_LABEL}
                <input type="text" name={HONEYPOT_FIELD} tabIndex={-1} autoComplete="off" value={form[HONEYPOT_FIELD]} onChange={handleChange} />
              </label>
            </div>

            {/* Stays disabled after a successful send: the form is not cleared,
                so a second click would mail a duplicate. */}
            <button type="submit" className="btn-teal syne" style={{ width: '100%' }} disabled={status === 'sending' || status === 'sent'}>
              {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent ✓' : 'Request a Sponsorship'}
            </button>

            <div aria-live="polite" style={{ minHeight: 24 }}>
              {status === 'sent' && (
                <p className="sp-body" style={{ color: 'var(--text-primary)', margin: 0 }}>
                  Got it. This went straight to Bryan, and he will come back to you.
                </p>
              )}
              {status === 'invalid' && (
                <p role="alert" className="sp-body" style={{ color: 'var(--text-primary)', margin: 0 }}>
                  {invalidFields.length
                    ? `That didn't go through. Please check: ${invalidFields.map(describeInvalidField).join('; ')}.`
                    : <>That didn&apos;t go through. Please check the email address and try again.</>}
                </p>
              )}
              {status === 'fallback' && (
                <p className="sp-body" style={{ margin: 0 }}>
                  We couldn&apos;t submit that directly, so your email client should be
                  opening with the details filled in. If nothing happened, email{' '}
                  <a href={`mailto:${SPONSOR_EMAIL}`} style={{ color: 'var(--text-accent)' }}>{SPONSOR_EMAIL}</a>.
                </p>
              )}
            </div>
          </form>
        </div>
      </div>

      <Footer />
    </>
  );
}
