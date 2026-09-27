// lib/sponsorOffer.js
// The numbers the sponsorship offer is quoted with, in one place, so the
// /sponsorship page and the "Sponsorship facts" section of /llms.txt cannot
// disagree. The facts section is written to be ingested verbatim by AI
// agents researching sponsorships on a brand's behalf, so a price that drifts
// from the page is not cosmetic: it is a wrong figure quoted to a buyer.
//
// Assets produced per sponsored episode: 1 video + 1 audio + 3-5 social cuts
// + newsletter + article + episode page. That is 8 at the floor and 10 at the
// ceiling, so 8 is what gets quoted and what drives the per-asset math on the
// page. Quote the floor, not the ceiling: the page argues that it does not
// publish numbers it cannot show you, and the first sum a buyer can check by
// hand is this one. "3-5 clips plus five other things" does not reach 10 at
// the low end. A smaller honest number is worth more than a bigger padded one.
export const ASSETS_PER_EPISODE = 8;
export const ASSETS_PER_EPISODE_MAX = 10;
export const SOCIAL_CUTS_MIN = 3;
export const SOCIAL_CUTS_MAX = 5;
export const EPISODE_PRICE = 1000;
export const CAMPAIGN_PRICE = 3000;
export const CAMPAIGN_EPISODES = 4;
export const PER_EPISODE_IN_CAMPAIGN = CAMPAIGN_PRICE / CAMPAIGN_EPISODES;
export const CAMPAIGN_DISCOUNT_PCT = Math.round((1 - PER_EPISODE_IN_CAMPAIGN / EPISODE_PRICE) * 100);
