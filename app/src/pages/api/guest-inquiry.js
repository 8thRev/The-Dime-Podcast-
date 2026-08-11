// src/pages/api/guest-inquiry.js
// Server-side receiver for the /guests application form.
//
// Deliberately the same shape as api/sponsor-inquiry.js — same transport, same
// honeypot, same fallback contract — because it exists for the same reason and
// should fail the same way. Read that file first; only the differences are
// noted here.
//
// Why this exists: /guests had five inputs, a Submit Application button, and no
// `<form>` element. The inputs carried no name, value or onChange and the
// button no onClick, so its implicit type="submit" was inert with a null
// button.form. Clicking produced no navigation, no request, no event and no
// error. Every application typed into that page since it shipped was discarded
// silently, and there is no record anywhere of how many there were.
//
// The client falls back to mailto on non-2xx, so a missing RESEND_API_KEY
// degrades to a prefilled draft rather than swallowing the applicant.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Set these in the deployment environment. FROM_ADDRESS must be on a domain
// verified in Resend or the send is rejected. GUEST_TO_ADDRESS is separate from
// the sponsorship inbox on purpose: these are two different queues answered on
// two different timescales, and the page promises a reply within 5 business
// days.
const FROM_ADDRESS = process.env.GUEST_FROM_ADDRESS || 'The Dime Site <inquiries@dimepodcast.com>';
const TO_ADDRESS = process.env.GUEST_TO_ADDRESS || 'guests@dimepodcast.com';

// Keep in sync with FORM_FIELDS in src/pages/guests.js. Larger than the
// client's maxLength on purpose: the client caps what a person can type, this
// caps what an attacker can post, and a mismatch that truncates a legitimate
// application is worse than storing a few hundred extra characters.
const MAX_LEN = { name: 200, companyTitle: 300, email: 320, pitch: 4000, links: 2000 };

function clean(value, max) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot. Real users never see this field, so anything in it is a bot.
  // 200 so a naive bot believes it succeeded and doesn't retry; `filtered`
  // lets the client skip its analytics event rather than counting bots as
  // applications. Same accepted trade as the sponsorship route: this is a
  // cheap filter for unsophisticated spam, not a defence against a targeted
  // attacker, and rate limiting is still the missing control.
  if (clean(body.website, 200)) return res.status(200).json({ ok: true, filtered: true });

  const name = clean(body.name, MAX_LEN.name);
  const companyTitle = clean(body.companyTitle, MAX_LEN.companyTitle);
  const email = clean(body.email, MAX_LEN.email);
  const pitch = clean(body.pitch, MAX_LEN.pitch);
  const links = clean(body.links, MAX_LEN.links);

  // `links` is the one optional field, matching the form.
  if (!name || !companyTitle || !email || !pitch || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return res.status(400).json({ error: 'Missing or invalid required fields' });
  }

  // No key configured — tell the client to fall back to mailto rather than
  // reporting a success we can't back up.
  if (!process.env.RESEND_API_KEY) {
    return res.status(503).json({ error: 'Mail transport not configured' });
  }

  try {
    const response = await fetch(RESEND_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [TO_ADDRESS],
        // So hitting Reply in the inbox answers the applicant directly.
        reply_to: email,
        subject: `Guest application: ${name}`,
        text: [
          `Name:              ${name}`,
          `Company and title: ${companyTitle}`,
          `Email:             ${email}`,
          '',
          'What would they say to a room of cannabis operators and executives?',
          pitch,
          '',
          'Links:',
          links || '(not provided)',
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      console.error('[guest-inquiry] Resend rejected the send:', response.status, await response.text());
      return res.status(502).json({ error: 'Send failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[guest-inquiry] Send threw:', err);
    return res.status(502).json({ error: 'Send failed' });
  }
}
