// lib/mailer.js
// Thin nodemailer wrapper shared by /api/contact and /api/guest-apply.
// Delivers via Gmail SMTP — see .env.local.example for how to generate the
// required GMAIL_APP_PASSWORD.

import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  const { GMAIL_USER, GMAIL_APP_PASSWORD } = process.env;
  if (!GMAIL_USER || !GMAIL_APP_PASSWORD) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }
  return transporter;
}

export async function sendMail({ subject, text, replyTo }) {
  const t = getTransporter();
  if (!t) {
    const err = new Error('Mailer not configured — set GMAIL_USER and GMAIL_APP_PASSWORD');
    err.code = 'MAILER_NOT_CONFIGURED';
    throw err;
  }

  const { GMAIL_USER, CONTACT_TO_EMAIL } = process.env;
  await t.sendMail({
    from: `"The Dime Podcast" <${GMAIL_USER}>`,
    to: CONTACT_TO_EMAIL || GMAIL_USER,
    replyTo,
    subject,
    text,
  });
}
