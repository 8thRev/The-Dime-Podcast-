// lib/sendMail.js
// One outbound mail path for both inquiry routes (api/guest-inquiry.js,
// api/sponsor-inquiry.js), so they cannot drift in transport, error handling,
// or what "configured" means.
//
// Two transports, tried in that order:
//
//   1. SMTP, when EMAIL_USERNAME and EMAIL_PASSWORD are set. The variable names
//      are deliberately the same ones bot/config.py already uses for the guest
//      research mailer, so the repo has one email convention rather than two
//      and the same Google Workspace App Password serves both.
//   2. Resend, when RESEND_API_KEY is set. This is what api/sponsor-inquiry.js
//      shipped with. Kept rather than removed so a deployment already
//      configured that way keeps working untouched.
//
// With neither configured, send() reports `configured: false` and the callers
// return 503, which makes their clients fall back to a mailto: draft. That is
// the whole point of the ordering: an unconfigured deployment degrades to the
// old behaviour instead of silently swallowing a lead.
//
// Why SMTP is the preferred path here despite being slower: dimepodcast.com's
// MX records point at Google Workspace, so mail sent through Google as an
// address on that domain is SPF and DKIM aligned by construction. Sending the
// same From: through a third party requires verifying the domain there first,
// and until that DNS lands every send is rejected.

import nodemailer from 'nodemailer';

const RESEND_ENDPOINT = 'https://api.resend.com/emails';

// Matches bot/config.py's defaults so a value set for the bot means the same
// thing here.
const SMTP_HOST = process.env.EMAIL_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.EMAIL_PORT || 587);

// Reused across invocations that land on a warm lambda. A cold start still pays
// the TCP + TLS + AUTH handshake, which is the main cost of SMTP over an HTTP
// API and the reason the callers must treat a send as slow.
let cachedTransport = null;

function smtpTransport() {
  if (!process.env.EMAIL_USERNAME || !process.env.EMAIL_PASSWORD) return null;
  if (!cachedTransport) {
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      // 587 is STARTTLS, 465 is implicit TLS. Getting this backwards hangs
      // until the function times out rather than erroring, so it is derived
      // from the port instead of being a third setting to get wrong.
      secure: SMTP_PORT === 465,
      auth: { user: process.env.EMAIL_USERNAME, pass: process.env.EMAIL_PASSWORD },
    });
  }
  return cachedTransport;
}

/**
 * @param {object} message
 * @param {string} message.from     RFC 5322 From. On Workspace this must be the
 *                                  authenticated user or an alias it may send as.
 * @param {string} message.to
 * @param {string} message.replyTo  So replying in the inbox answers the person.
 * @param {string} message.subject
 * @param {string} message.text
 * @param {string} label            Prefix for server logs.
 * @returns {Promise<{ok: boolean, configured: boolean, via?: string}>}
 */
export async function sendMail({ from, to, replyTo, subject, text }, label = 'sendMail') {
  const transport = smtpTransport();

  if (transport) {
    try {
      await transport.sendMail({ from, to, replyTo, subject, text });
      return { ok: true, configured: true, via: 'smtp' };
    } catch (err) {
      // A stale cached transport (Google rotated the App Password, socket died
      // between invocations) fails every subsequent send until the lambda is
      // recycled. Drop it so the next attempt reconnects.
      cachedTransport = null;
      console.error(`[${label}] SMTP send failed:`, err);
      return { ok: false, configured: true, via: 'smtp' };
    }
  }

  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: [to], reply_to: replyTo, subject, text }),
      });
      if (!response.ok) {
        console.error(`[${label}] Resend rejected the send:`, response.status, await response.text());
        return { ok: false, configured: true, via: 'resend' };
      }
      return { ok: true, configured: true, via: 'resend' };
    } catch (err) {
      console.error(`[${label}] Resend send threw:`, err);
      return { ok: false, configured: true, via: 'resend' };
    }
  }

  return { ok: false, configured: false };
}
