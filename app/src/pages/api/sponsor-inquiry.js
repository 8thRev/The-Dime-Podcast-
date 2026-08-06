// src/pages/api/sponsor-inquiry.js
// Server-side receiver for the /sponsorship inquiry form.
//
// Why this exists: the form previously did nothing but set
// `window.location.href = 'mailto:…'`. That left no record of a submission
// anywhere. If a prospect's browser had no OS mail handler registered — the
// default state for Chrome-on-Windows webmail users — they filled out five
// fields, pressed the button, and nothing happened, and we never learned they
// existed. Every failed submission was an invisible lost sale.
//
// The client still falls back to mailto when this route returns non-2xx, so
// the form is never *worse* than it was: a missing RESEND_API_KEY degrades to
// exactly the old behaviour rather than swallowing the lead.
//
// Deliberately dependency-free — Resend's REST API over fetch, no SDK.

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Set these in the deployment environment. FROM_ADDRESS must be on a domain
// verified in Resend or the send is rejected.
const FROM_ADDRESS = process.env.SPONSOR_FROM_ADDRESS || 'The Dime Site <inquiries@dimepodcast.com>';
const TO_ADDRESS = process.env.SPONSOR_TO_ADDRESS || 'sponsorship@dimepodcast.com';

// Keep in sync with FORM_FIELDS in src/pages/sponsorship.js.
const MAX_LEN = { name: 200, company: 200, email: 320, targetCustomer: 4000, campaignGoal: 4000 };

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
  // Return 200 so the bot believes it succeeded and doesn't retry.
  // 200 so a naive bot believes it succeeded. `filtered` is there so the
  // client can skip its analytics event and not count bots as leads.
  //
  // This is not covert: a bot that parses the JSON can see the flag. That is
  // an accepted trade — the honeypot is a cheap filter for unsophisticated
  // spam, not a defence against a targeted attacker. Rate limiting is the
  // control that matters here and is not yet in place.
  if (clean(body.website, 200)) return res.status(200).json({ ok: true, filtered: true });

  const name = clean(body.name, MAX_LEN.name);
  const company = clean(body.company, MAX_LEN.company);
  const email = clean(body.email, MAX_LEN.email);
  const targetCustomer = clean(body.targetCustomer, MAX_LEN.targetCustomer);
  const campaignGoal = clean(body.campaignGoal, MAX_LEN.campaignGoal);

  if (!name || !company || !email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
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
        // So hitting Reply in the inbox answers the prospect directly.
        reply_to: email,
        subject: `Sponsorship inquiry: ${company}`,
        text: [
          `Name:    ${name}`,
          `Company: ${company}`,
          `Email:   ${email}`,
          '',
          'Who are they trying to reach?',
          targetCustomer || '(not provided)',
          '',
          'What should listeners do?',
          campaignGoal || '(not provided)',
        ].join('\n'),
      }),
    });

    if (!response.ok) {
      // Surface the reason in the server log; the client only needs to know
      // it should fall back.
      console.error('[sponsor-inquiry] Resend rejected the send:', response.status, await response.text());
      return res.status(502).json({ error: 'Send failed' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[sponsor-inquiry] Send threw:', err);
    return res.status(502).json({ error: 'Send failed' });
  }
}
