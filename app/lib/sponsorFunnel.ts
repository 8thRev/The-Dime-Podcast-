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
// 2. There IS a server submit now, and this event only fires when it succeeds.
//    The form POSTs to /api/sponsor-inquiry and trackSponsorInquirySubmit is
//    called on a 2xx, so the count is inquiries actually delivered rather than
//    mail drafts handed off. It no longer needs reconciling against the inbox.
//
//    Two cases deliberately do NOT fire it: a honeypot hit (the API answers
//    200 with `filtered: true` so bots are not counted as leads), and the
//    mailto fallback taken when the transport fails — that path fires
//    sponsor_form_fallback instead, because whether the visitor then presses
//    send is unobservable. If fallback volume is material, RESEND_API_KEY is
//    probably unset in the deployment environment.
//
// Firing still happens after validation, not on click — the fields carry
// `required`, so the browser blocks submit and the handler never runs until the
// form is valid, which is the guarantee the spec was reaching for.

import { track, once } from './analytics';

// Part 1 enumerates these four.
export type CtaLocation = 'hero' | 'pricing' | 'inline' | 'footer';

// Typed like the locations rather than left as a free string, so labels cannot
// drift into three spellings of the same button across call sites.
export type CtaLabel = 'request_a_sponsorship' | 'view_pricing';

export function trackSponsorCtaClick(ctaLabel: CtaLabel, location: CtaLocation): void {
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
