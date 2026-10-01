// lib/inquiryReply.js
// How the two inquiry routes answer. A fetch from the form page or an agent
// sends JSON and gets JSON. A native form post (the forms carry method="post"
// so a submit before hydration, or with JavaScript failing, never becomes a
// GET with the email in the query string) gets a small readable page instead
// of a raw JSON body, with the same status code.

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function isNativeFormPost(req) {
  return /application\/x-www-form-urlencoded|multipart\/form-data/i.test(String(req.headers['content-type'] || ''));
}

/**
 * `context` is { page: '/guests', email: 'guests@dimepodcast.com' }, used
 * only for the HTML page's links.
 */
export function reply(req, res, status, body, context) {
  if (!isNativeFormPost(req)) return res.status(status).json(body);

  let message;
  if (status === 200) {
    message = 'Thanks, it reached our inbox. A person reads every one.';
  } else if (status === 400) {
    message = `Some fields need fixing. ${body.error || ''} Go back, correct them and send again.`;
  } else {
    message = `We could not send it just now. Please email ${context.email} instead.`;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).send(
    '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<meta name="robots" content="noindex">' +
      '<title>The Dime Podcast</title></head>' +
      '<body style="font-family:system-ui,sans-serif;max-width:560px;margin:64px auto;padding:0 16px;line-height:1.6">' +
      `<p>${escapeHtml(message)}</p>` +
      `<p><a href="${escapeHtml(context.page)}">Back to the form</a> · <a href="mailto:${escapeHtml(context.email)}">${escapeHtml(context.email)}</a></p>` +
      '</body></html>'
  );
}
