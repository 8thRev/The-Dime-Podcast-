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
// agent reading the label is told outright to leave it alone.
//
// The fill-time check is the second signal. Scripted bots post within
// milliseconds of load; people and agents are far slower than MIN_FILL_MS.
// The client sends elapsed milliseconds, not a timestamp, so client/server
// clock skew can't matter. A missing or non-numeric value passes: a page
// cached from before this shipped, or a direct POST, must not lose a lead to
// a signal it never sent.

export const HONEYPOT_FIELD = 'hp_leave_blank';
export const HONEYPOT_LABEL = 'Leave this field empty';
export const FILL_TIME_FIELD = 'fillMs';
export const MIN_FILL_MS = 2000;

export function isFilteredSubmission(body) {
  const honeypot = body[HONEYPOT_FIELD];
  if (typeof honeypot === 'string' && honeypot.trim()) return true;

  const fillMs = body[FILL_TIME_FIELD];
  return typeof fillMs === 'number' && Number.isFinite(fillMs) && fillMs >= 0 && fillMs < MIN_FILL_MS;
}
