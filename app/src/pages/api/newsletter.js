// src/pages/api/newsletter.js
// Subscribes an email to the "First Principles" ConvertKit form server-side
// via ConvertKit's v3 API. This replaces relying solely on ConvertKit's
// client-side embed script, whose form previously had no fallback at all
// when NEXT_PUBLIC_CONVERTKIT_FORM_ID wasn't set — the button just did
// nothing. Requires CONVERTKIT_API_KEY + CONVERTKIT_FORM_ID.

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address.' });
  }

  const { CONVERTKIT_API_KEY, CONVERTKIT_FORM_ID } = process.env;
  if (!CONVERTKIT_API_KEY || !CONVERTKIT_FORM_ID) {
    console.error('Newsletter signup: CONVERTKIT_API_KEY / CONVERTKIT_FORM_ID not configured');
    return res.status(500).json({ error: 'Newsletter signup is not configured yet. Please try again later.' });
  }

  try {
    const ckRes = await fetch(`https://api.convertkit.com/v3/forms/${CONVERTKIT_FORM_ID}/subscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: CONVERTKIT_API_KEY, email }),
    });

    if (!ckRes.ok) {
      const body = await ckRes.text().catch(() => '');
      console.error(`ConvertKit subscribe error: ${ckRes.status} ${body}`);
      return res.status(500).json({ error: 'Something went wrong subscribing you. Please try again.' });
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Error subscribing to ConvertKit:', error);
    return res.status(500).json({ error: 'Something went wrong subscribing you. Please try again.' });
  }
}
