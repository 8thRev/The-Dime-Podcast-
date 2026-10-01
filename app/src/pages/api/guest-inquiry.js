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
// The client falls back to mailto on non-2xx, so an unconfigured mail transport
// degrades to a prefilled draft rather than swallowing the applicant.

import { sendMail } from '@/lib/sendMail';
import { isHoneypotFilled, fastFillFlag } from '@/lib/formSpam';
import { GUEST_INQUIRY_FIELDS, validateInquiry, invalidFieldsBody } from '@/lib/inquiryFields';

// FROM_ADDRESS must be an address the configured transport is allowed to send
// as: on Google Workspace SMTP that means the authenticated user or one of its
// aliases, and on Resend an address on a verified domain. Google rejects
// anything else outright, so the default falls back to EMAIL_FROM — the same
// variable bot/config.py uses, already proven to work with the same account —
// before the hardcoded address.
//
// The domain runs three mailboxes: info@, guests@ and sponsorship@. info@ is
// the generic site sender, so it is what these notifications come from, while
// the queue-specific addresses stay recipients. Sending from the same address
// a message is delivered to also makes Gmail thread it as self-sent, which is
// worth avoiding on the one inbox that has to stay scannable.
//
// GUEST_TO_ADDRESS is separate from the sponsorship inbox on purpose: these are
// two different queues answered on two different timescales, and the page
// promises a reply within 5 business days.
const FROM_ADDRESS =
  process.env.GUEST_FROM_ADDRESS || process.env.EMAIL_FROM || 'The Dime <info@dimepodcast.com>';
const TO_ADDRESS = process.env.GUEST_TO_ADDRESS || 'guests@dimepodcast.com';

// Field rules, limits included, live in lib/inquiryFields.js, shared with the
// form page and with the limits llms.txt documents for agents.

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot check. See lib/formSpam.js for why the field is
  // not called `website` any more. 200 so a naive bot believes it succeeded
  // and doesn't retry; `filtered` lets the client skip its analytics event
  // rather than counting bots as applications. Same accepted trade as the
  // sponsorship route: this is a cheap filter for unsophisticated spam, not a
  // defence against a targeted attacker, and rate limiting is still the
  // missing control.
  if (isHoneypotFilled(body)) return res.status(200).json({ ok: true, filtered: true });

  // Over-length is a 400 naming the field, not a silent cut: the sender has
  // to learn what did not arrive.
  const { values, errors } = validateInquiry(body, GUEST_INQUIRY_FIELDS);
  if (errors.length) return res.status(400).json(invalidFieldsBody(errors));
  const { name, companyTitle, email, pitch, links } = values;
  // Too fast for a person is not discarded any more, only flagged for the
  // reader; see lib/formSpam.js.
  const flag = fastFillFlag(body);

  const result = await sendMail(
    {
      from: FROM_ADDRESS,
      to: TO_ADDRESS,
      // So hitting Reply in the inbox answers the applicant directly.
      replyTo: email,
      subject: `${flag}Guest application: ${name}`,
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
    },
    'guest-inquiry'
  );

  // No transport configured — tell the client to fall back to mailto rather
  // than reporting a success we can't back up. Distinct from a configured
  // transport that failed, which is a 502: one is a deployment that was never
  // finished, the other is an outage worth alerting on.
  if (!result.configured) {
    return res.status(503).json({ error: 'Mail transport not configured' });
  }
  if (!result.ok) {
    return res.status(502).json({ error: 'Send failed' });
  }

  return res.status(200).json({ ok: true });
}
