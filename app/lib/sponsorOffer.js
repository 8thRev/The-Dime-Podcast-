// lib/sponsorOffer.js
// The sponsorship offer in one place, so the /sponsorship page and the
// "Sponsorship facts" section of /llms.txt cannot disagree. The facts section
// is written to be ingested verbatim by AI agents researching sponsorships on
// a brand's behalf, so a price that drifts from the page is not cosmetic: it
// is a wrong figure quoted to a buyer.
//
// Three options, split by what the sponsor is trying to get done rather than
// by format. Each one is priced on the work it takes, not on reach: a catalog
// read is one recording however long it runs, so it is priced per month.

// Audience figures, as of October 2026. These are material representations
// in a paid sale: each one must be showable from its source on request (the
// email platform for the first two, the podcast host for the third). Update
// them from there; never round up.
export const NEWSLETTER_SUBSCRIBERS = 1675;
export const NEWSLETTER_OPEN_RATE_PCT = 63;
export const EPISODE_DOWNLOADS_MIN = 500;

const SUBS = NEWSLETTER_SUBSCRIBERS.toLocaleString('en-US');

export const SPONSOR_OPTIONS = [
  {
    id: 'newsletter',
    name: 'Newsletter Sponsor',
    price: 250,
    unit: 'per edition',
    // Links the newest edition on the page: the newsletter is the sample.
    example: true,
    forWhom: 'A short message in front of the readers.',
    includes: [
      `Your name, link and a two-sentence message in one First Principles edition, sent to ${SUBS} subscribers (${NEWSLETTER_OPEN_RATE_PCT}% open rate).`,
      "The same block stays on that edition's page on dimepodcast.com for good.",
      'Labelled "Sponsored by", so it reads as an ad, not as the essay.',
    ],
  },
  {
    id: 'writeup',
    name: 'The Write-Up',
    price: 500,
    unit: 'per feature',
    example: true,
    forWhom: 'A launch, a release or an announcement.',
    includes: [
      'Bryan writes a full First Principles edition about it: what it is, and why an operator should care.',
      `Sent to ${SUBS} subscribers, and published as a permanent article on dimepodcast.com.`,
      'Marked as a sponsored feature. You check it for accuracy before it goes out; the words stay Bryan’s.',
    ],
  },
  {
    id: 'catalog',
    name: 'The Catalog Read',
    price: 750,
    unit: 'per month',
    forWhom: 'Being known by the people who buy.',
    includes: [
      `A 60-second read in Bryan’s voice, inserted into every episode in the catalog for the month. Episodes average ${EPISODE_DOWNLOADS_MIN}+ downloads each.`,
      'Anyone who plays any episode that month hears it, on Apple, Spotify and every other audio platform.',
      'You approve the script before it is recorded.',
    ],
  },
];

export const SPONSOR_OPTION_NAMES = SPONSOR_OPTIONS.map((o) => o.name);
