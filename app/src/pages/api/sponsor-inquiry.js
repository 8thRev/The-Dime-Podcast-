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
// the form is never *worse* than it was: an unconfigured transport degrades to
// exactly the old behaviour rather than swallowing the lead.
//
// Transport moved to lib/sendMail.js, shared with api/guest-inquiry.js. This
// route shipped Resend-only and RESEND_API_KEY was never set in production, so
// every sponsorship inquiry since it deployed has been going out as a mailto
// draft — working, but dependent on the prospect having a mail client. SMTP
// through Google Workspace is now tried first because dimepodcast.com's MX
// already points there, so it needs no new vendor and no new DNS.

import { sendMail } from '@/lib/sendMail';

// Set these in the deployment environment. FROM_ADDRESS must be an address the
// configured transport is allowed to send as.
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

  const result = await sendMail(
    {
      from: FROM_ADDRESS,
      to: TO_ADDRESS,
      // So hitting Reply in the inbox answers the prospect directly.
      replyTo: email,
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
    },
    'sponsor-inquiry'
  );

  // No transport configured — tell the client to fall back to mailto rather
  // than reporting a success we can't back up. sendMail logs the reason on a
  // real failure; the client only needs to know it should fall back.
  if (!result.configured) {
    return res.status(503).json({ error: 'Mail transport not configured' });
  }
  if (!result.ok) {
    return res.status(502).json({ error: 'Send failed' });
  }

  return res.status(200).json({ ok: true });
}
