// src/pages/api/guest-apply.js
// Delivers the /guests application form via Gmail SMTP. Mirrors
// /api/contact — see lib/spamGuard.js and lib/mailer.js.

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

  const { fullName, companyTitle, email, pitch, links, company, a, b, answer, loadedAt } = req.body || {};

  const spamCheck = runAntiSpamChecks({ company, a, b, answer, loadedAt });
  if (spamCheck.blocked) {
    if (spamCheck.silent) return res.status(200).json({ ok: true });
    return res.status(400).json({ error: spamCheck.error });
  }

  if (!fullName || !email || !pitch || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please fill in your name, a valid email, and what you\'d say to the room.' });
  }

  if (String(pitch).length > 3000 || String(links || '').length > 1000 || String(companyTitle || '').length > 300) {
    return res.status(400).json({ error: 'One of those fields is too long.' });
  }

  try {
    await sendMail({
      subject: `New guest application from ${fullName}`,
      text: [
        `Name: ${fullName}`,
        `Company / Title: ${companyTitle || '(not provided)'}`,
        `Email: ${email}`,
        '',
        'Pitch:',
        pitch,
        '',
        'Links:',
        links || '(not provided)',
      ].join('\n'),
      replyTo: email,
    });
    return res.status(200).json({ ok: true });
  } catch (error) {
    if (error.code === 'MAILER_NOT_CONFIGURED') {
      console.error('Guest apply form:', error.message);
      return res.status(500).json({ error: 'Applications aren\'t configured yet. Please email us directly.' });
    }
    console.error('Error sending guest application email:', error);
    return res.status(500).json({ error: 'Something went wrong submitting your application. Please try again.' });
  }
}
