// src/pages/api/contact.js
// Delivers the /contact form via Gmail SMTP. See lib/spamGuard.js for the
// honeypot/math/timing anti-spam checks and lib/mailer.js for the send.

import { runAntiSpamChecks } from '@/lib/spamGuard';
import { sendMail } from '@/lib/mailer';

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, email, message, company, a, b, answer, loadedAt } = req.body || {};

  const spamCheck = runAntiSpamChecks({ company, a, b, answer, loadedAt });
  if (spamCheck.blocked) {
    if (spamCheck.silent) return res.status(200).json({ ok: true });
    return res.status(400).json({ error: spamCheck.error });
  }

  if (!name || !email || !message || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please fill in your name, a valid email, and a message.' });
  }

  if (String(message).length > 5000) {
    return res.status(400).json({ error: 'Message is too long.' });
  }

  try {
    await sendMail({
      subject: `New contact form message from ${name}`,
      text: `From: ${name} <${email}>\n\n${message}`,
      replyTo: email,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'MAILER_NOT_CONFIGURED') {
      console.error('Contact form:', error.message);
      return res.status(500).json({ error: 'Contact form is not configured yet. Please email us directly.' });
    }
    console.error('Error sending contact form email:', error);
    return res.status(500).json({ error: 'Something went wrong sending your message. Please try again.' });
  }
}
