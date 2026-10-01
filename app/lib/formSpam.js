// lib/formSpam.js
// Spam signals shared by the /guests and /sponsorship forms and their API
// routes (api/guest-inquiry.js, api/sponsor-inquiry.js).
//
// The honeypot used to be named `website` and labelled "Website". Guests and
// sponsors have websites, so browser autofill and AI agents submitting on a
// PR person's or sponsor's behalf (they read the DOM, not the rendered page)
// filled it in — and the route then answered 200 and dropped a real lead while
// the sender saw success. The name and label below are chosen so that nothing
// legitimate fills them: no autofill heuristic maps "hp_leave_blank", and an
// agent reading the label is told outright to leave it alone. A filled
// honeypot is still discarded.
//
// The fill-time check is the second signal, and it no longer discards
// anything. It used to: a submission under MIN_FILL_MS after page load was
// dropped with a 200 and the page showed "sent". People are slower than that,
// but a browser agent filling the form programmatically is not, so an agent
// pitching a guest on someone's behalf could be thrown away while it and the
// person it acts for were told it went through. A fast submission is now
// delivered with a flag in the subject line for the reader to weigh, which
// costs a glance at the occasional scripted spam instead of a lost lead.
//
// The client sends elapsed milliseconds, not a timestamp, so client/server
// clock skew can't matter. A missing or non-numeric value is not fast: a
// direct POST never sends one.

export const HONEYPOT_FIELD = 'hp_leave_blank';
export const HONEYPOT_LABEL = 'Leave this field empty';
export const FILL_TIME_FIELD = 'fillMs';
export const MIN_FILL_MS = 2000;

/** True when the honeypot was filled: discard the submission. */
export function isHoneypotFilled(body) {
  const honeypot = body[HONEYPOT_FIELD];
  return typeof honeypot === 'string' && !!honeypot.trim();
}

/**
 * A subject line prefix for a submission sent faster than a person types,
 * or '' when there is nothing to flag. Deliver it either way.
 */
export function fastFillFlag(body) {
  const fillMs = body[FILL_TIME_FIELD];
  const fast = typeof fillMs === 'number' && Number.isFinite(fillMs) && fillMs >= 0 && fillMs < MIN_FILL_MS;
  return fast ? `[Check: sent ${(Math.floor(fillMs / 100) / 10).toFixed(1)}s after page load] ` : '';
}
