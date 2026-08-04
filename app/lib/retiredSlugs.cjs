// Retired URL slugs that 301 to their corrected destination.
//
// Lives in its own module — rather than inline in next.config.js — so that
// `scripts/verify-site.mjs` can assert every row actually redirects where it
// claims to. Before this file existed the verification script regex-scraped
// the table out of next.config.js as text, which silently stopped matching
// the moment the formatting changed. CommonJS because next.config.js is CJS;
// Node lets the ESM verify script import it all the same.

// Guest slugs retired by the extractGuest() fix in lib/rss.ts. Each of these
// was a live, indexed URL that named a non-person ("Emergency Update") or a
// mangled name ("cory-azzalino-of-eaze"), so they 301 to the corrected entity
// rather than 404. The two that map to /episodes/... are episodes that turned
// out to have no guest at all, so there is no entity page to point at.
//
// These keys are outputs of the OLD parser, so they are not derivable from
// GUEST_NAME_OVERRIDES alone — regenerating this table means replaying the
// pre-fix extractGuest() against the feed and diffing its guest slugs against
// the current ones. Adding an override does not automatically belong here:
// only add a row when the old parser actually produced that slug and the new
// one no longer does.
const RETIRED_GUEST_SLUGS = {
    'arcview-consulting': '/guests/jake-kuczeruk',
    'authentic-cannabis': '/guests/tony-verzura',
    'bruce-eckfeldt-host-of-the-thinking-outside-the-bud-podcast': '/guests/bruce-eckfeldt',
    'budding-cannabis-news': '/guests/matt-obrien',
    'cannabis-controversy': '/episodes/cannabis-controversy-duis',
    'cannabis-model-is-disrupting-the-industry-ft-obie-strickler': '/guests/obie-strickler',
    'cannabis-potency-technology': '/guests/chad-lieber',
    'clinical-psychologist-nicolas-schlienz': '/guests/nicolas-schlienz',
    'colin-landforce-cto-of-unrivaled-brands': '/guests/colin-landforce',
    'connecting-professional-cannabis-leaders': '/guests/mike-mejer',
    'cory-azzalino-of-eaze': '/guests/cory-azzalino',
    'crop-cycle-monitoring': '/guests/scott-campbell',
    'dede-perkins-ceo-of-procanna': '/guests/dede-perkins',
    'dr-grinspoon': '/guests/dr-peter-grinspoon',
    'dr-jason-lupoi-of-thar-process': '/guests/dr-jason-lupoi',
    'dr-john-abrams-chairman-of-the-cesc': '/guests/dr-john-abrams',
    'dr-tim-shu-of-vetcbd': '/guests/dr-tim-shu',
    'emergency-update': '/guests/shane-pennington',
    'eric-leslie-of-cheeba-chews': '/guests/eric-leslie',
    'founders-of-trade-roots': '/guests/carl-giannone-jesse-pitts',
    'gary-santo-ceo-of-tilt-holding': '/guests/gary-santo',
    'helping-cannabis-start-ups-light-up': '/guests/peter-vogel',
    'her-highness': '/guests/laura-eisman-allison-krongard',
    'howard-schacter-of-marimed': '/guests/howard-schacter',
    'jeff-ragovin-of-fyllo': '/guests/jeff-ragovin',
    'jordan-zager-ceo-of-dewey-scientific': '/guests/jordan-zager',
    'kevin-carrillo-host-of-the-cannabinoid-connect-podcast': '/guests/kevin-carrillo',
    'kim-rivers-part-1': '/guests/kim-rivers',
    'kim-rivers-part-2': '/guests/kim-rivers',
    'kingpin-barry-foy': '/guests/barry-foy',
    'las-vegas-newest-attraction': '/guests/chris-laporte',
    'malcolm-boyce-of-axtell-labs': '/guests/malcolm-boyce',
    'matt-melander-levia': '/guests/matt-melander',
    'msc-biochemist-ben-euhus': '/guests/ben-euhus',
    'neil-juneja-of-gleam-law': '/guests/neil-juneja',
    'playbook-for-cannabis-building-trust-through-tech-ft-ashwin-raj': '/guests/ashwin-raj',
    'pure-valley-solutions': '/guests/austin-fricker-nick-layton',
    'recent-news': '/episodes/recent-news-georgias-senate-election',
    'rena-sherbill-senior-editor-at-seeking-alpha-and-host-of-the-cannabis-investing-podcast': '/guests/rena-sherbill',
    'rob-wirtz-of-mach-technologies': '/guests/rob-wirtz',
    'sam-richard-of-ada': '/guests/sam-richard',
    'targeted-effects': '/guests/peter-barsoom',
    'texas-cannabis': '/guests/shayda-torabi',
    'the-cannabis-pr-queen-rosie-mattio': '/guests/rosie-mattio',
    'the-cannabis-titanic': '/guests/matt-karnes',
    'the-liaison-group': '/guests/erin-moffet-david-mangone',
};

// Pre-truncation short slugs for the "Dime Hosts" video series. Confirmed
// still taking inbound traffic in GA (Jul 2026) and not covered by the
// legacySlug mechanism in lib/videoCatalog.mjs, which only maps the 80-char
// truncations. Note the third: the live slug is `delta8-thc`, no hyphen.
const RETIRED_VIDEO_SLUGS = {
  'nomenclature': '/videos/nomenclature-dime-hosts-episode-11',
  'cannabis-industry-milestones': '/videos/cannabis-industry-milestones-dime-hosts-episode-5',
  'delta-8-thc': '/videos/delta8-thc-dime-hosts-episode-10',
};

module.exports = { RETIRED_GUEST_SLUGS, RETIRED_VIDEO_SLUGS };
