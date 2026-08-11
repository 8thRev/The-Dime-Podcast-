// lib/guestFunnel.ts
// The guest-application funnel on /guests: form start, inquiry submit.
// Mirrors lib/sponsorFunnel.ts, which is the pattern this page copies.
//
// guest_inquiry_submit is a primary key event (docs/analytics-spec.md Part 3),
// so what it counts matters. Two notes on that:
//
// 1. Part 3's parameter list for this event reads `company` `role`
//    `referral_source`. Those are the raw strings a person typed, which Part 1's
//    PII prohibition forbids outright, and `role` and `referral_source` are not
//    fields this form has. Booleans are sent instead — whether a company/title
//    was given and whether links were given — which is the same treatment
//    sponsor_inquiry_submit gives its company field.
//
// 2. It fires on a confirmed 2xx from /api/guest-inquiry, so unlike the older
//    mailto-only version of this form it means "the application was sent", not
//    "a draft was handed to a mail client". Two exceptions keep it honest:
//    honeypot hits answer 200 with `filtered: true` and are not counted, and a
//    submission that falls back to mailto because the route could not send
//    books nothing at all. The event therefore *under*counts by exactly the
//    fallback volume, which is the right direction for a key event to err.
//
// The parameter strings below are registered GA4 custom dimensions and are a
// fixed contract; renaming one empties the dimension silently (Part 1).

import { track, once } from './analytics';

const FORM_LOCATION = 'guests_page';

/** First interaction with any field, once per page view. */
export function trackGuestFormStart(): void {
  once('guest_form_start', () => track('guest_form_start', { form_location: FORM_LOCATION }));
}

/**
 * Called once the form has validated and the draft is handed off — never on
 * click, and never on a validation failure. Wrapped in once() so a double
 * submit within one page view books a single application, which is what the
 * key event is supposed to mean.
 */
export function trackGuestInquirySubmit(companyProvided: boolean, linksProvided: boolean): void {
  once('guest_inquiry_submit', () =>
    track('guest_inquiry_submit', {
      company_provided: companyProvided,
      links_provided: linksProvided,
      form_location: FORM_LOCATION,
    })
  );
}
