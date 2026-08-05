// lib/sponsorFunnel.ts
// The sponsorship funnel: CTA click, form start, inquiry submit.
// See docs/analytics-spec.md Part 2.7. sponsor_inquiry_submit is the primary
// key event on the site, so what it counts matters more than anywhere else.
//
// Two things about this form differ from the spec's description of it, and both
// change the implementation:
//
// 1. campaign_goal and target_customer are NOT sent. The spec allows them only
//    if the fields are enumerated selects; on this page both are <textarea>
//    (sponsorship.js FORM_FIELDS), so they are free prose a sponsor typed about
//    their business. Part 1 forbids sending free text, and converting the fields
//    to selects is a product decision, not an analytics one. Only
//    company_provided goes out — a boolean, never the company string.
//
// 2. There is no server submit to succeed or fail. The spec expects a same-origin
//    POST to /sponsorship; the page actually builds a mailto: URL and hands off
//    to the visitor's mail client. So "submit success" can only mean "the form
//    validated and the mail client was handed the draft". Whether the visitor
//    then presses send is unobservable from here, so this event necessarily
//    overcounts against inquiries actually received. Worth knowing before it is
//    quoted as a conversion rate: reconcile it against the inbox.
//
// Firing still happens after validation, not on click — the fields carry
// `required`, so the browser blocks submit and the handler never runs until the
// form is valid, which is the guarantee the spec was reaching for.

import { track, once } from './analytics';

// Part 1 enumerates these four.
export type CtaLocation = 'hero' | 'pricing' | 'inline' | 'footer';

export function trackSponsorCtaClick(ctaLabel: string, location: CtaLocation): void {
  track('sponsor_cta_click', { cta_label: ctaLabel, cta_location: location });
}

/** First interaction with any field, once per page view. */
export function trackSponsorFormStart(): void {
  once('sponsor_form_start', () =>
    track('sponsor_form_start', { form_location: 'sponsorship_page' })
  );
}

/** Called once the browser has validated the form and the draft is handed off. */
export function trackSponsorInquirySubmit(companyProvided: boolean): void {
  track('sponsor_inquiry_submit', {
    company_provided: companyProvided,
    form_location: 'sponsorship_page',
  });
}
