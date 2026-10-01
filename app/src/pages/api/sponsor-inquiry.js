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
import { reply } from '@/lib/inquiryReply';
import { isHoneypotFilled, fastFillFlag } from '@/lib/formSpam';
import { SPONSOR_INQUIRY_FIELDS, validateInquiry, invalidFieldsBody } from '@/lib/inquiryFields';

// FROM_ADDRESS must be an address the configured transport is allowed to send
// as. Falls back to EMAIL_FROM, the variable bot/config.py already uses with
// this same account, before info@ — the domain's generic sender. See
// api/guest-inquiry.js for why that ordering matters.
const FROM_ADDRESS =
  process.env.SPONSOR_FROM_ADDRESS || process.env.EMAIL_FROM || 'The Dime <info@dimepodcast.com>';
const TO_ADDRESS = process.env.SPONSOR_TO_ADDRESS || 'sponsorship@dimepodcast.com';

// Field rules, limits included, live in lib/inquiryFields.js, shared with the
// form page and with the limits llms.txt documents for agents.

const REPLY_CONTEXT = { page: '/sponsorship', email: 'sponsorship@dimepodcast.com' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};

  // Honeypot check. See lib/formSpam.js for why the field is not called
  // `website` any more, and why it must not catch a person or an agent
  // submitting on someone's behalf.
  // 200 so a naive bot believes it succeeded. `filtered` is there so the
  // client can skip its analytics event and not count bots as leads.
  //
  // This is not covert: a bot that parses the JSON can see the flag. That is
  // an accepted trade — the honeypot is a cheap filter for unsophisticated
  // spam, not a defence against a targeted attacker. Rate limiting is the
  // control that matters here and is not yet in place.
  if (isHoneypotFilled(body)) return reply(req, res, 200, { ok: true, filtered: true }, REPLY_CONTEXT);

  // Over-length is a 400 naming the field, not a silent cut: the sender has
  // to learn what did not arrive.
  const { values, errors } = validateInquiry(body, SPONSOR_INQUIRY_FIELDS);
  if (errors.length) return reply(req, res, 400, invalidFieldsBody(errors), REPLY_CONTEXT);
  const { name, company, email, targetCustomer, campaignGoal } = values;
  // Too fast for a person is not discarded any more, only flagged for the
  // reader; see lib/formSpam.js.
  const flag = fastFillFlag(body);

  const result = await sendMail(
    {
      from: FROM_ADDRESS,
      to: TO_ADDRESS,
      // So hitting Reply in the inbox answers the prospect directly.
      replyTo: email,
      subject: `${flag}Sponsorship inquiry: ${company}`,
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
    return reply(req, res, 503, { error: 'Mail transport not configured' }, REPLY_CONTEXT);
  }
  if (!result.ok) {
    return reply(req, res, 502, { error: 'Send failed' }, REPLY_CONTEXT);
  }

  return reply(req, res, 200, { ok: true }, REPLY_CONTEXT);
}
