import { useState } from 'react';
import Link from 'next/link';
import Header from '@/src/components/Header';
import Footer from '@/src/components/Footer';
import SeoHead from '@/src/components/SeoHead';
import { PODCAST_RATING } from '@/lib/ratings';
import { getAllGuests, guestToSlug } from '@/lib/guests';
import { getAllEpisodes } from '@/lib/rss';
import { trackGuestFormStart, trackGuestInquirySubmit } from '@/lib/guestFunnel';

const GUESTS_TICKER = [
  'Aubrey Amatelli', 'Gretchen Gailey', 'Dan McDermitt', 'Margaret Brodie',
  'Micah Anderson', 'Kristin & Eric Rogers', 'Trent Woloveck', 'John Shute',
  'Brian Adams', 'Nicolas Guarino', 'Bill Morachnick', 'Ryan Crandall',
  'Tyler Robson', 'Adam Stettner', 'Chris Emerson', 'Nick Kenny',
  'Thomas Winstanley', 'Alex Kwon', 'Jared Maloof', 'Chris Ball',
  'Jim Higdon', 'Ryan Castle', 'Mitchell Osak', 'Zach Edge',
  'Dan Cook', 'Nadia Sabeh', 'David Fettner', 'Shahar Yamay',
  'Hirsh Jain', 'Socrates Rosenfeld', 'Jesse Redmond', 'Brett Puffenbarger',
  'Tyler Nielsen', 'Ilya Shmidt', 'Brett Gelfand', 'George DeNardo',
  'AnnaRae Grabstein', 'Emily Fisher & Dr June Chin', 'Christina Betancourt Johnson', 'Ron Gershoni',
  'Luna Stower', 'Nick Kovacevich', 'Jeff Guillot', 'Jamie Pearson',
  'Dan Shapiro', 'Trip McDermott', 'Chloe Kaleiokalani', 'Ben Burstein',
  'Ralph Risch', 'Colin Keeler', 'Wendy Bronfein', 'Jack Grover',
  'Kristian Andreassen', 'Yoko Miyashita', 'Cameron Clarke', 'Erik Knutson',
  'Sundie Seefried', 'Travis Higginbotham', 'Zach Marburger', 'Emily Sisneros',
  'Brandon Bobart', 'Mike Siebold', 'Rama Mayo', 'Alleh Lindquist',
  'Jordan Isenstadt', 'Neil Kaufman', 'Mario Naric', 'Krista Raymer',
  'Shane Johnson', 'Dr. Tassa Saldi', 'Chris Fontes', 'Anthony Coniglio',
  'Seth Yakatan', 'Todd Harrison', 'Rick Bashkoff', 'Gabe Mendoza',
  'Crystal Millican', 'Markel Bababekov', 'Bradley Nattrass', 'Charlie Bachtell',
  'Kate Miller', 'Dr. Matthew Moore', 'Warren Bobrow', 'Lulu Tsui',
  'Jon Levine', 'Jon Purow', 'Rob Sechrist', 'Harrison Bard',
  'Anne Forkutza', 'Jeremy Johnson', 'Dr. Amanda Reiman', 'Bob Hoban',
  'Matt Zorn', 'Kristi Palmer', 'Emma Beckerle', 'David Goubert',
  'Christine Smith', 'Ted Lidie', 'Christina Wong', 'Brandon Barksdale',
  'Lisa Buffo', 'Scott Grossman', 'Raj Grover', 'Rob Sims',
  'Ian Rumpp', 'Michael Johnson', 'Luke Anderson', 'Aaron Miles',
  'Alvaro Torres', 'John Yang', 'Jesse Campoamor', 'Elliot Lane',
  'Chad Bronstein', 'Kim Rivers', 'Jason Spatafora', 'Coleman Beale',
  'Olivia Alexander', 'Kristina Adduci', 'Max Simon', 'Adam Terry',
  'Jane West', 'Graham Farrar', 'Brady Cobb', 'Damian Fagon',
  'Kieve Huffman', 'Shaleen Title', 'Karson Humiston', 'Daniel Muller',
  'Chris Chiari', 'Chris Becker', 'Matt Hawkins', 'Nate Lipton',
  'Leslie Bocskor', 'Chris Piazza', 'Adam Young', 'Vince Ning',
  'Kim Stuck', 'Ashley Reynolds', 'Jason Wild', 'Emily Paxhia',
  'Josh Smith', 'Troy Datcher', 'Oren Schauble', 'Otha Smith',
  'Nathan Mison', 'Franny Tacy', 'Lisa Weser', 'Lauren Wilson',
  'Kaelan Castetter', 'Wes Campbell', 'Eric Levitt', 'Dede Perkins',
  'Dr. Tim Shu', 'Gary Santo', 'Nicolas Schlienz', 'Jeff Ragovin',
  'Robert Beasley', 'Rob Wirtz', 'Ben Larson', 'Tahir Johnson',
  'Ashley Grimes', 'Ben Euhus', 'Sam Richard', 'Rosie Mattio',
  'Jason Malcolm', 'Jordan Highley', 'Colin Landforce', 'Mona Zhang',
  'Dr. John Abrams', 'Dr. Jason Lupoi', 'Johanna Nuding', 'Fabian Monaco',
  'Josh Crossney', 'Neil Juneja', 'Jon Rubin', 'Jordan Zager',
  'Kevin Carrillo', 'Malcolm Boyce', 'Rena Sherbill', 'Bruce Eckfeldt',
];

// The application form. Same shape as the sponsorship form's FORM_FIELDS
// (src/pages/sponsorship.js) so the two stay recognisably one pattern.
//
// maxLength is set here rather than copied from that form, which carries none:
// these are the first limits on the site.
//
// The normal path POSTs to /api/guest-inquiry, where length is bounded again
// server-side, so these are a courtesy to the person typing rather than a
// security control.
//
// They matter on the fallback path. When the route cannot send, the page hands
// the application to a mailto: draft, and Windows shell handlers cap the URL
// around 2,048 characters. Measured against the body built below:
//
//   1,000-char pitch, ordinary name/company/email/links   1,618  ok
//   1,000-char pitch + 500-char links                     2,196  over
//   every field at its maximum                            2,753  over
//   1,000 accented or CJK characters in the pitch alone    6,258  well over
//
// So a maxed-out application that falls back can open a draft truncated
// mid-sentence. Shrinking the pitch box to fit would trade a rare truncation on
// a rare path for permanently refusing the considered answer this field asks
// for; keeping the server route healthy is the actual fix.
//
// The attribute is not a guard on its own: a password manager, autofill or a
// mobile IME can set a value past it programmatically. validate() re-checks
// every length below, which is what actually enforces these client-side.
const FORM_FIELDS = [
  { name: 'name', label: 'Full Name', type: 'text', required: true, maxLength: 100 },
  { name: 'companyTitle', label: 'Company and Title', type: 'text', required: true, maxLength: 120 },
  { name: 'email', label: 'Email Address', type: 'email', required: true, maxLength: 254 },
  {
    name: 'pitch',
    label: 'What would you say to a room of cannabis operators and executives? 2-3 sentences.',
    type: 'textarea',
    required: true,
    maxLength: 1000,
    rows: 4,
  },
  {
    name: 'links',
    label: 'Links: LinkedIn, recent press, company website',
    type: 'textarea',
    required: false,
    maxLength: 500,
    rows: 2,
  },
];

const GUEST_EMAIL = 'guests@dimepodcast.com';

// `website` is the honeypot, not a field. It seeds here so the value stays
// controlled like every other input.
const EMPTY_FORM = FORM_FIELDS.reduce((acc, f) => ({ ...acc, [f.name]: '' }), { website: '' });

const FIELD_STYLE = {
  background: 'var(--navy2)',
  border: '1px solid var(--border)',
  color: 'var(--white)',
  fontFamily: "'Syne', sans-serif",
  fontSize: '13px',
  padding: '14px 16px',
  width: '100%',
  outline: 'none',
};

// Deliberately not the browser's own required/type validation. Native
// validation blocks submit and shows a transient bubble, which leaves nothing
// on the page for a returning visitor to read and nothing for the acceptance
// check to assert against. The form carries noValidate and this runs instead.
function validate(values) {
  const errors = {};
  for (const field of FORM_FIELDS) {
    const raw = values[field.name];
    const value = raw.trim();
    if (field.required && !value) {
      errors[field.name] = 'This field is required.';
      // Length is checked against the raw value, not the trimmed one. It is the
      // raw value that goes into the mailto: body, so 1,000 characters padded
      // with 500 spaces is 1,500 characters of URL however it trims.
    } else if (raw.length > field.maxLength) {
      errors[field.name] = `Please keep this under ${field.maxLength} characters.`;
    } else if (field.name === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.name] = 'Enter a valid email address.';
    }
  }
  return errors;
}

export async function getStaticProps() {
  const guests = await getAllGuests();
  const episodes = await getAllEpisodes();
  const guestSlugs = guests.reduce((acc, g) => {
    acc[g.slug] = true;
    return acc;
  }, {});

  return {
    // Was hardcoded to 299 in the credibility line below, which had drifted
    // five episodes behind the feed on the one page whose job is to look
    // credible to a prospective guest.
    props: { guestSlugs, episodeCount: episodes.length },
    revalidate: 3600,
  };
}

export default function ForGuests({ guestSlugs, episodeCount }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  // idle | sending | sent | invalid | fallback. Same machine as the sponsorship
  // form (src/pages/sponsorship.js), because this posts to the same kind of
  // route and has to fail the same way.
  const [status, setStatus] = useState('idle');

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
    // Clear a field's error as soon as it is being corrected, rather than
    // leaving stale red text under a field the visitor has already fixed.
    setErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
    // Editing after a send means a different application is being written; the
    // previous outcome no longer describes what is on screen. Exception: once
    // it is genuinely sent, the message stays and the button stays disabled, so
    // a second click cannot mail a duplicate.
    setStatus((s) => (s === 'sent' ? s : 'idle'));
  }

  // The mailto: draft the page fell back to before this had a server route, and
  // still falls back to when the route cannot send. It is a worse mechanism —
  // it cannot confirm delivery, and a visitor with no mail client configured
  // still loses the application — but it is strictly better than a button that
  // does nothing, which is what this page had.
  function openMailFallback() {
    const v = Object.fromEntries(FORM_FIELDS.map((f) => [f.name, form[f.name].trim()]));
    const subject = encodeURIComponent(`Guest Application: ${v.name}`);
    const body = encodeURIComponent(
      [
        `Name: ${v.name}`,
        `Company and Title: ${v.companyTitle}`,
        `Email: ${v.email}`,
        '',
        'What they would say to the room:',
        v.pitch,
        '',
        `Links: ${v.links || 'None provided'}`,
      ].join('\n')
    );
    window.location.href = `mailto:${GUEST_EMAIL}?subject=${subject}&body=${body}`;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending' || status === 'sent') return;

    const found = validate(form);
    if (Object.keys(found).length > 0) {
      // Nothing is tracked on a failed submit. A validation failure that books
      // the key event corrupts the only measure of inbound guest interest.
      setErrors(found);
      setStatus('idle');
      // Send the caret to the first thing that needs fixing. Without this a
      // screen-reader user who submits from the button hears the alert but is
      // left at the bottom of a form with no indication of where to go.
      const firstInvalid = FORM_FIELDS.find((f) => found[f.name]);
      document.getElementById(`guest-${firstInvalid.name}`)?.focus();
      return;
    }
    setErrors({});
    setStatus('sending');

    try {
      const res = await fetch('/api/guest-inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      // A 400 means the server rejected the input, not that transport failed.
      // Falling back to mailto here would hand the applicant a prefilled draft
      // carrying the same bad address and tell them nothing.
      if (res.status === 400) {
        setStatus('invalid');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json().catch(() => ({}));
      setStatus('sent');
      // Fires on a confirmed send only, never on click and never on a
      // validation failure. The route answers honeypot hits with 200 so bots
      // believe they got through; `filtered` keeps them out of the count.
      // Only booleans go out, never the typed strings — see lib/guestFunnel.ts.
      if (!data.filtered) {
        trackGuestInquirySubmit(Boolean(form.companyTitle.trim()), Boolean(form.links.trim()));
      }
    } catch {
      // Never strand the applicant.
      setStatus('fallback');
      openMailFallback();
    }
  }

  return (
    <>
      <SeoHead
        title="Apply to Guest"
        description="Apply to be a guest on The Dime Podcast — a strategy room for cannabis operators, executives, and investors making real decisions in the industry."
        path="/guests"
      />
      <Header />

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
          Guest Application
        </div>
        <h1 className="syne" style={{ fontSize: 'clamp(44px,7vw,92px)', fontWeight: 800, color: '#E8E4DC', letterSpacing: '.02em', lineHeight: 0.88, maxWidth: 760, marginBottom: 36 }}>
          This is the room<br />
          serious operators<br />
          <span style={{ color: '#00C9A7' }}>want to be in.</span>
        </h1>
        <p className="crimson" style={{ fontSize: '17px', lineHeight: 1.85, color: '#7A8FA8', maxWidth: 600, fontWeight: 300 }}>
          The Dime listener is an operator, executive, or investor making real decisions in cannabis. They are not looking for inspiration. They are looking for intelligence. If you have something real to say to that room, this is where you say it.
        </p>
      </section>

      <section style={{ padding: '80px 48px', borderBottom: '1px solid var(--faint)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80 }}>
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 20 }}>
            Who&apos;s Listening
          </div>
          {[
            ['Primary Audience', 'Cannabis operators, CEOs, founders, VPs, and strategic advisors across the full supply chain.'],
            ['Investors', 'Family offices, cannabis-focused funds, and institutional capital allocators.'],
            ['Credibility', `${PODCAST_RATING.value} stars, ${PODCAST_RATING.count} ratings, top 5% most shared globally. ${episodeCount} episodes.`],
            ['Geography', 'NY, FL, MI, CA, CO, IL, MA and every emerging state market with capital at stake.'],
            ['Mindset', 'Survival-focused. Risk-aware. Skeptical of hype. Benchmarking against peers.'],
          ].map(([label, value]) => (
            <div key={label} style={{ padding: '22px 0', borderTop: '1px solid var(--faint)' }}>
              <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 8 }}>
                {label}
              </div>
              <div className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.8, fontWeight: 300 }}>
                {value}
              </div>
            </div>
          ))}
        </div>
        <div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 20 }}>
            What Works Here
          </div>
          <div style={{ borderLeft: '2px solid #00C9A7', paddingLeft: 28, marginBottom: 48 }}>
            <p className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.9, fontWeight: 300, marginBottom: 18 }}>
              This is not a brand awareness play. The guests who land well on The Dime bring something real: a hard decision they made, a structural insight, a contrarian view on where the market is going.
            </p>
            <p className="crimson" style={{ fontSize: '15px', color: '#7A8FA8', lineHeight: 1.9, fontWeight: 300 }}>
              We do not do puff pieces. We do not do product launches dressed as conversations. The room will notice, and it will cost you credibility, not build it.
            </p>
          </div>
          <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 16 }}>
            Past Guests Include
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
            {GUESTS_TICKER.slice(0, 32).map((g) => {
              const slug = guestToSlug(g);
              const hasProfile = !!guestSlugs[slug];
              return (
                <div key={g} style={{ fontSize: '12px', fontWeight: 500, padding: '12px 0', borderBottom: '1px solid var(--faint)', letterSpacing: '.02em' }}>
                  {hasProfile ? (
                    <Link href={`/guests/${slug}`} style={{ color: '#3A4F66', textDecoration: 'none' }}>
                      {g}
                    </Link>
                  ) : (
                    <span style={{ color: '#3A4F66' }}>{g}</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section style={{ padding: '80px 48px' }}>
        <div className="mono" style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', color: '#3A4F66', marginBottom: 32 }}>
          Submit Your Application
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 60 }}>
          <form
            onSubmit={handleSubmit}
            onFocus={trackGuestFormStart}
            noValidate
            style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          >
            {FORM_FIELDS.map((field) => {
              const error = errors[field.name];
              const shared = {
                id: `guest-${field.name}`,
                name: field.name,
                value: form[field.name],
                onChange: handleChange,
                placeholder: field.label,
                maxLength: field.maxLength,
                'aria-label': field.label,
                // The form is noValidate, so `required` is carried as ARIA
                // only: it tells assistive tech which fields are mandatory
                // before submitting, without handing validation back to the
                // browser's transient bubble.
                'aria-required': field.required ? 'true' : undefined,
                'aria-invalid': error ? 'true' : undefined,
                'aria-describedby': error ? `guest-${field.name}-error` : undefined,
              };
              const style = {
                ...FIELD_STYLE,
                borderColor: error ? '#E06C6C' : 'var(--border)',
              };
              return (
                <div key={field.name}>
                  {field.type === 'textarea' ? (
                    <textarea
                      {...shared}
                      rows={field.rows}
                      style={{ ...style, resize: field.rows > 2 ? 'vertical' : 'none' }}
                    />
                  ) : (
                    <input {...shared} type={field.type} style={style} />
                  )}
                  {error && (
                    <div
                      id={`guest-${field.name}-error`}
                      role="alert"
                      className="mono"
                      style={{ fontSize: '10px', color: '#E06C6C', marginTop: 6, letterSpacing: '.06em' }}
                    >
                      {error}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Honeypot: hidden from users, irresistible to bots. Positioned
                off-screen rather than display:none, which some bots skip. */}
            <div aria-hidden="true" style={{ position: 'absolute', left: -9999, width: 1, height: 1, overflow: 'hidden' }}>
              <label>
                Website
                <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={handleChange} />
              </label>
            </div>

            {/* Stays disabled after a successful send: the form is not cleared,
                so a second click would file a duplicate application. */}
            <button
              type="submit"
              className="btn-teal"
              style={{ alignSelf: 'flex-start' }}
              disabled={status === 'sending' || status === 'sent'}
            >
              {status === 'sending' ? 'Sending…' : status === 'sent' ? 'Sent ✓' : 'Submit Application'}
            </button>

            {/* Each state says what actually happened, and no more. "Sent" is a
                confirmed server response, so it can promise a reply. "Fallback"
                cannot: the draft was handed to a mail client that may not
                exist, so it gives the address instead of a promise. */}
            <div aria-live="polite" style={{ minHeight: 24 }}>
              {status === 'sent' && (
                <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.7, fontWeight: 300 }}>
                  Got it. Your application is with us, and we review every one personally.
                </div>
              )}
              {status === 'invalid' && (
                <div className="crimson" style={{ fontSize: '14px', color: '#E06C6C', lineHeight: 1.7, fontWeight: 300 }}>
                  That did not go through. Please check the email address and try again.
                </div>
              )}
              {status === 'fallback' && (
                <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.7, fontWeight: 300 }}>
                  We could not submit that directly, so your email client should be opening with
                  the details filled in. If nothing happened, email them to{' '}
                  <a href={`mailto:${GUEST_EMAIL}`} style={{ color: '#00C9A7' }}>
                    {GUEST_EMAIL}
                  </a>
                  .
                </div>
              )}
            </div>
          </form>
          <div>
            <div className="mono" style={{ fontSize: '9px', color: '#009E85', fontWeight: 700, letterSpacing: '.25em', textTransform: 'uppercase', marginBottom: 20 }}>
              What Happens Next
            </div>
            {[
              ['Review', 'We review every application personally. If it\'s a fit, we\'ll reach out within 5 business days.'],
              ['Pre-Call', 'A short alignment call to agree on angle, framing, and what the room needs to hear from you.'],
              ['Recording', 'Remote or in-person. We handle all production. You show up with something real to say.'],
              ['Distribution', 'Apple Podcasts, Spotify, YouTube, LinkedIn, and the First Principles newsletter.'],
            ].map(([step, detail]) => (
              <div key={step} style={{ marginBottom: 28 }}>
                <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 6 }}>
                  {step}
                </div>
                <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.82, fontWeight: 300 }}>
                  {detail}
                </div>
              </div>
            ))}

            {/* The address lives here permanently, not only inside the success
                box. Submitting hands the application to the visitor's mail
                client, and if that client never opens, the confirmation is the
                only place that says where to send it instead — a confirmation
                that clears the moment they touch a field again. Someone whose
                mailto: does nothing needs this in front of them regardless. */}
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
              <div className="mono" style={{ fontSize: '9px', letterSpacing: '.2em', textTransform: 'uppercase', color: '#00C9A7', marginBottom: 6 }}>
                Prefer Email?
              </div>
              <div className="crimson" style={{ fontSize: '14px', color: '#7A8FA8', lineHeight: 1.82, fontWeight: 300 }}>
                Send the same details to{' '}
                <a href="mailto:guests@dimepodcast.com" style={{ color: '#00C9A7' }}>
                  guests@dimepodcast.com
                </a>
                .
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </>
  );
}
