import { useState } from 'react';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import Schema from '@/src/components/Schema';
import SeoHead from '@/src/components/SeoHead';
import { createBreadcrumbSchema } from '@/lib/schema';
import { trackSponsorCtaClick, trackSponsorFormStart, trackSponsorInquirySubmit } from '@/lib/sponsorFunnel';
import testimonials from '@/content/testimonials.json';

const STATS = [
  { value: '500-1,000', label: 'Downloads / New Episode' },
  { value: '1,500', label: 'Email Subscribers' },
  { value: '1,600', label: 'LinkedIn Followers' },
  { value: '300', label: 'Nearly This Many Episodes' },
  { value: '6 Yrs', label: 'Covering Cannabis' },
];

const BENEFITS = [
  { title: 'Host-Read Placement', desc: 'Integrated into the podcast and YouTube episode, read by Bryan and Kellan, not a pre-roll drop-in.' },
  { title: 'Newsletter Placement', desc: 'Featured in First Principles, the weekly newsletter operators actually read.' },
  { title: 'Show Notes & YouTube Links', desc: 'Persistent links wherever the episode lives, indefinitely.' },
  { title: 'Social Distribution', desc: 'LinkedIn and selected social posts carrying the campaign message.' },
  { title: 'One Consistent Message', desc: 'A single CTA, repeated cleanly across every touchpoint — no diluted messaging.' },
];

const TIERS = [
  {
    name: 'Episode Partner',
    price: '$1,000',
    priceNote: 'Starting at',
    description: 'One integrated episode sponsorship across The Dime’s primary channels.',
    inclusions: ['Host-read integration in one episode', 'Podcast and YouTube placement', 'Newsletter and show-notes links'],
    featured: false,
  },
  {
    name: 'Four-Episode Campaign',
    price: '$3,000',
    priceNote: 'Starting at',
    description: 'Four integrated sponsorships with repeated messaging, campaign strategy, category exclusivity, and reporting.',
    inclusions: ['Four host-read integrations', 'Repeated messaging across episodes', 'Category exclusivity', 'Campaign strategy and reporting'],
    featured: true,
  },
];

const STRATEGY_INCLUDES = ['Audience definition', 'Offer & CTA', 'Landing page plan', 'Tracking plan'];

const RECOGNIZABLE_GUESTS = [
  'Hirsh Jain', 'Trent Woloveck', 'John Shute', 'Thomas Winstanley', 'Nadia Sabeh', 'George DeNardo',
];

const FORM_FIELDS = [
  { name: 'name', label: 'Name', type: 'text', span: 1 },
  { name: 'company', label: 'Company', type: 'text', span: 1 },
  { name: 'email', label: 'Email', type: 'email', span: 2 },
  { name: 'targetCustomer', label: 'Target Customer', type: 'textarea', span: 2 },
  { name: 'campaignGoal', label: 'Campaign Goal', type: 'textarea', span: 2 },
];

const EMPTY_FORM = FORM_FIELDS.reduce((acc, f) => ({ ...acc, [f.name]: '' }), {});

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
      <span className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.28em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
        {children}
      </span>
    </div>
  );
}

export default function Sponsorship() {
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitted, setSubmitted] = useState(false);
  const bobart = testimonials.find((t) => t.name === 'Brandon Bobart');
  const sponsorParagraph = bobart?.quote?.split('\n\n')[2];

  const breadcrumbSchema = createBreadcrumbSchema([
    { name: 'Home', url: 'https://www.dimepodcast.com/' },
    { name: 'Sponsorship', url: 'https://www.dimepodcast.com/sponsorship' },
  ]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    // Every field carries `required`, so the browser has already validated by the
    // time this runs — this is the submit-success moment, not a click. Fired
    // before the mailto handoff, which can take the page's attention away.
    // Only whether a company was named goes out, never the string, and neither
    // free-text field: see lib/sponsorFunnel.ts.
    trackSponsorInquirySubmit(Boolean(form.company));
    const subject = encodeURIComponent(`Sponsorship Inquiry: ${form.company || form.name}`);
    const body = encodeURIComponent(
      [
        `Name: ${form.name}`,
        `Company: ${form.company}`,
        `Email: ${form.email}`,
        `Target Customer: ${form.targetCustomer}`,
        `Campaign Goal: ${form.campaignGoal}`,
      ].join('\n')
    );
    setSubmitted(true);
    window.location.href = `mailto:sponsorship@thedime.com?subject=${subject}&body=${body}`;
  }

  return (
    <>
      <SeoHead
        title="Sponsorship"
        description="Reach cannabis operators, founders, and executives through The Dime — podcast, newsletter, and social placements starting at $1,000."
        path="/sponsorship"
      />
      <Schema schema={breadcrumbSchema} />
      <Header />

      <style>{`
        .sponsor-benefit-grid {
          display: grid;
          gap: 1px;
          background: var(--border-subtle);
          grid-template-columns: repeat(2, 1fr);
          border: 1px solid var(--border-subtle);
        }
        .sponsor-tier-grid {
          display: grid;
          gap: 28px;
          grid-template-columns: 1fr 1fr;
        }
        .sponsor-support-grid {
          display: grid;
          grid-template-columns: 1.3fr 1fr;
          gap: 64px;
          align-items: start;
        }
        .sponsor-hero-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 32px;
        }
        .sponsor-form-layout {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 56px;
          align-items: start;
        }
        .sponsor-form-grid {
          display: grid;
          gap: 20px;
          grid-template-columns: 1fr 1fr;
        }
        .sponsor-form-grid textarea {
          resize: vertical;
        }
        .sponsor-field-span-2 {
          grid-column: span 2;
        }
        .sponsor-chip {
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
        .sponsor-sidebar {
          position: sticky;
          top: 24px;
        }
        @media (max-width: 900px) {
          .sponsor-support-grid,
          .sponsor-form-layout {
            grid-template-columns: 1fr;
            gap: 40px;
          }
          .sponsor-sidebar {
            position: static;
          }
        }
        @media (max-width: 767px) {
          .sponsor-benefit-grid {
            grid-template-columns: 1fr;
          }
          .sponsor-tier-grid,
          .sponsor-form-grid {
            grid-template-columns: 1fr;
          }
          .sponsor-field-span-2 {
            grid-column: span 1;
          }
          .sponsor-hero-stats {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
        }
      `}</style>

      {/* HERO */}
      <section style={{ position: 'relative', overflow: 'hidden', background: 'var(--bg-base)', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'linear-gradient(to bottom,transparent,var(--text-accent) 20%,var(--text-accent) 80%,transparent)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(var(--border-subtle) 1px,transparent 1px),linear-gradient(90deg,var(--border-subtle) 1px,transparent 1px)', backgroundSize: '80px 80px', opacity: 0.3, pointerEvents: 'none' }} />
        <div className="syne" style={{ position: 'absolute', bottom: -40, right: -20, fontSize: 'clamp(110px,16vw,240px)', fontWeight: 800, color: 'transparent', WebkitTextStroke: '1px #1A2A3A', lineHeight: 1, userSelect: 'none', pointerEvents: 'none', letterSpacing: '.04em', zIndex: 0 }}>
          SPONSOR
        </div>

        <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(64px,10vw,120px) clamp(24px,5vw,48px) 0' }}>
          <div className="fade-in" style={{ marginBottom: 32 }}>
            <Eyebrow>Sponsorship</Eyebrow>
          </div>
          <h1 className="syne fade-in" style={{ fontSize: 'clamp(44px,7vw,92px)', fontWeight: 800, color: 'var(--text-headline)', letterSpacing: '.01em', lineHeight: 0.94, maxWidth: 880, marginBottom: 28 }}>
            Reach cannabis<br />decision-makers through <span style={{ color: 'var(--text-accent)' }}>The Dime</span>.
          </h1>
          <p className="crimson fade-in" style={{ fontSize: 'clamp(16px,2vw,19px)', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 620, marginBottom: 44 }}>
            Connect with cannabis operators, founders, executives, investors, and service providers through podcast, email, YouTube, and social distribution.
          </p>
          <div className="fade-in" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 56 }}>
            <a href="#sponsor-inquiry" onClick={() => trackSponsorCtaClick('request_a_sponsorship', 'hero')} className="btn-teal syne" style={{ textDecoration: 'none', display: 'inline-block' }}>Request a Sponsorship</a>
            <a href="#pricing" onClick={() => trackSponsorCtaClick('view_pricing', 'hero')} className="btn-outline syne" style={{ textDecoration: 'none', display: 'inline-block', background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>View Pricing ↓</a>
          </div>

          <div className="sponsor-hero-stats fade-in" style={{ paddingTop: 32, paddingBottom: 40, borderTop: '1px solid var(--border-subtle)' }}>
            {STATS.map((s) => (
              <div key={s.label}>
                <div className="syne" style={{ fontSize: 'clamp(22px,2.6vw,30px)', fontWeight: 800, color: 'var(--text-accent)', marginBottom: 8 }}>
                  {s.value}
                </div>
                <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WHY THE DIME */}
      <section style={{ padding: 'clamp(64px,9vw,112px) clamp(24px,5vw,48px)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Why The Dime</Eyebrow>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, maxWidth: 640, marginBottom: 44 }}>
          The Dime reaches a concentrated cannabis business audience through trusted, long-form conversations. Sponsors receive:
        </p>
        <div className="sponsor-benefit-grid">
          {BENEFITS.map((b) => (
            <div key={b.title} className="card" style={{ background: 'var(--bg-base)', padding: 28, display: 'flex', gap: 16 }}>
              <CheckIcon />
              <div>
                <div className="syne" style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-headline)', marginBottom: 6, letterSpacing: '.01em' }}>
                  {b.title}
                </div>
                <p className="crimson" style={{ fontSize: '14px', lineHeight: 1.65, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
                  {b.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SPONSORSHIP OPTIONS */}
      <section id="pricing" style={{ padding: 'clamp(64px,9vw,112px) clamp(24px,5vw,48px)', background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Sponsorship Options</Eyebrow>
        <div className="sponsor-tier-grid">
          {TIERS.map((tier, i) => (
            <div
              key={tier.name}
              className="card"
              style={{
                position: 'relative',
                padding: 40,
                overflow: 'hidden',
                background: 'var(--bg-surface)',
                borderColor: tier.featured ? 'var(--text-accent)' : 'var(--card-border)',
                boxShadow: tier.featured ? 'var(--shadow-card-hover)' : 'none',
              }}
            >
              <span className="syne" style={{ position: 'absolute', top: -6, right: 12, fontSize: '96px', fontWeight: 800, color: 'transparent', WebkitTextStroke: '1px var(--border-default)', lineHeight: 1, userSelect: 'none', pointerEvents: 'none' }}>
                0{i + 1}
              </span>
              {tier.featured && (
                <span className="tag" style={{ position: 'relative', zIndex: 1, marginBottom: 20, display: 'inline-block' }}>Best Value</span>
              )}
              <h2 className="syne" style={{ position: 'relative', fontSize: '26px', fontWeight: 800, color: 'var(--text-headline)', marginBottom: 10, marginTop: tier.featured ? 0 : 4 }}>
                {tier.name}
              </h2>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 22 }}>
                <span className="mono" style={{ fontSize: '11px', color: 'var(--text-muted)', letterSpacing: '.08em' }}>{tier.priceNote}</span>
                <span className="syne" style={{ fontSize: '34px', fontWeight: 800, color: 'var(--text-accent)' }}>{tier.price}</span>
              </div>
              <p className="crimson" style={{ position: 'relative', fontSize: '15px', lineHeight: 1.7, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 24 }}>
                {tier.description}
              </p>
              <ul style={{ position: 'relative', listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {tier.inclusions.map((item) => (
                  <li key={item} className="crimson" style={{ fontSize: '14px', color: 'var(--text-primary)', fontWeight: 300, display: 'flex', gap: 10 }}>
                    <CheckIcon />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* CAMPAIGN SUPPORT */}
      <section style={{ padding: 'clamp(64px,9vw,112px) clamp(24px,5vw,48px)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <div className="sponsor-support-grid">
          <div>
            <Eyebrow>Campaign Support</Eyebrow>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300, marginBottom: 20 }}>
              Multi-episode campaigns include a strategy session to define the audience, offer, CTA, landing page, and tracking plan. The sponsor provides the expertise. The Dime shapes it into a campaign that fits the audience.
            </p>
            <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: 'var(--text-secondary)', fontWeight: 300 }}>
              Original guides, checklists, landing-page copy, and other campaign assets are available for an additional production fee.
            </p>
          </div>
          <div className="card" style={{ padding: 32, background: 'var(--bg-base)' }}>
            <div className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 20 }}>
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

      {/* PREVIOUS PARTNERS */}
      <section style={{ padding: 'clamp(64px,9vw,112px) clamp(24px,5vw,48px)', background: 'var(--bg-base)', borderBottom: '1px solid var(--faint)' }}>
        <Eyebrow>Previous Partners</Eyebrow>
        {bobart && sponsorParagraph && (
          <div style={{ display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 720, marginBottom: 40, padding: 36, border: '1px solid var(--border-subtle)', borderRadius: 4, background: 'var(--bg-surface)', boxShadow: 'var(--shadow-card)' }}>
            <div style={{ position: 'relative', width: 60, height: 60, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--border-subtle)', flexShrink: 0, background: 'var(--bg-elevated)' }}>
              <img src={bobart.photo} alt={bobart.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            </div>
            <div>
              <span className="mono" style={{ fontSize: '28px', color: 'var(--text-accent)', display: 'block', marginBottom: 4, lineHeight: 1 }}>&ldquo;</span>
              <blockquote className="crimson" style={{ fontSize: '17px', color: 'var(--text-headline)', lineHeight: 1.7, fontWeight: 400, fontStyle: 'italic', margin: '0 0 18px' }}>
                {sponsorParagraph}
              </blockquote>
              <div className="mono" style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-headline)' }}>
                {bobart.linkedinUrl ? (
                  <a href={bobart.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{bobart.name}</a>
                ) : bobart.name}
              </div>
              <div className="mono" style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: 2 }}>
                {bobart.title}
              </div>
            </div>
          </div>
        )}
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 14 }}>
            Recognizable Guests
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {RECOGNIZABLE_GUESTS.map((g) => (
              <span key={g} className="sponsor-chip">{g}</span>
            ))}
            <span className="sponsor-chip" style={{ background: 'transparent' }}>+ hundreds more</span>
          </div>
        </div>
      </section>

      {/* QUALIFICATION */}
      <section style={{ padding: 'clamp(48px,7vw,80px) clamp(24px,5vw,48px)', background: 'var(--bg-surface)', borderBottom: '1px solid var(--faint)' }}>
        <div style={{ maxWidth: 720, borderLeft: '2px solid var(--text-accent)', paddingLeft: 28 }}>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-accent)', marginBottom: 12 }}>
            Qualification
          </div>
          <p className="crimson" style={{ fontSize: '16px', lineHeight: 1.8, color: 'var(--text-secondary)', fontWeight: 300, margin: 0 }}>
            The Dime works with companies that serve the cannabis industry and provide useful, accurate information to its audience. Sponsorship does not influence editorial questions or guest coverage.
          </p>
        </div>
      </section>

      {/* INQUIRY FORM */}
      <section id="sponsor-inquiry" style={{ padding: 'clamp(64px,9vw,112px) clamp(24px,5vw,48px)', background: 'var(--bg-base)' }}>
        <Eyebrow>Inquiry Form</Eyebrow>
        <h2 className="syne" style={{ fontSize: 'clamp(30px,4.5vw,44px)', fontWeight: 800, color: 'var(--text-headline)', marginBottom: 40, maxWidth: 620 }}>
          Request a Sponsorship
        </h2>
        <div className="sponsor-form-layout">
          <form onSubmit={handleSubmit} onFocus={trackSponsorFormStart}>
            <div className="sponsor-form-grid" style={{ marginBottom: 28 }}>
              {FORM_FIELDS.map((field) => (
                <label
                  key={field.name}
                  className={field.span === 2 ? 'sponsor-field-span-2' : undefined}
                  style={{ fontFamily: "'Syne Mono', monospace", fontSize: '10px', color: 'var(--text-muted)', letterSpacing: '.06em', textTransform: 'uppercase', display: 'flex', flexDirection: 'column', gap: 8 }}
                >
                  {field.label}
                  {field.type === 'textarea' ? (
                    <textarea name={field.name} value={form[field.name]} onChange={handleChange} required rows={3} />
                  ) : (
                    <input type={field.type} name={field.name} value={form[field.name]} onChange={handleChange} required />
                  )}
                </label>
              ))}
            </div>
            <button type="submit" className="btn-teal syne" style={{ width: '100%' }}>
              {submitted ? 'Opening your email client…' : 'Request a Sponsorship →'}
            </button>
          </form>

          <div className="sponsor-sidebar">
            <div className="card" style={{ padding: 32, background: 'var(--bg-surface)' }}>
              <div className="mono" style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 20 }}>
                What Happens Next
              </div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 28 }}>
                {[
                  'Submitting opens a prefilled email to our sponsorship inbox',
                  'We reply with fit, availability, and next steps',
                  'Multi-episode campaigns start with a strategy session',
                ].map((step, i) => (
                  <li key={step} style={{ display: 'flex', gap: 12 }}>
                    <span className="syne" style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-accent)', flexShrink: 0 }}>{i + 1}.</span>
                    <span className="crimson" style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)', fontWeight: 300 }}>{step}</span>
                  </li>
                ))}
              </ul>
              <div style={{ paddingTop: 20, borderTop: '1px solid var(--border-subtle)' }}>
                <div className="mono" style={{ fontSize: '9px', color: 'var(--text-muted)', letterSpacing: '.1em', textTransform: 'uppercase', marginBottom: 6 }}>
                  Prefer email?
                </div>
                <a href="mailto:sponsorship@thedime.com" className="mono" style={{ fontSize: '13px', color: 'var(--text-accent)' }}>
                  sponsorship@thedime.com
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
