// lib/rss.ts
// Fetches and parses The Dime RSS feed from Simplecast at build time.

import Parser from "rss-parser";
import { UTM, tagHtmlLinks, withUtm } from "./utm";

const FEED_URL = "https://feeds.simplecast.com/Vnrz0StH";

type CustomItem = {
  title: string;
  pubDate: string;
  "content:encoded": string;
  enclosure: { url: string; length: string; type: string };
  guid: string;
  link: string;
  itunes: {
    duration: string;
    summary: string;
    image?: string;
    episode?: string;
    keywords?: string;
  };
  "simplecast:episode_id"?: string;
};

export type Episode = {
  id: string;
  slug: string;
  legacySlug: string;
  num: string;
  title: string;
  guest: string;
  company: string;
  companyUrl: string;
  date: string;
  dateISO: string;
  duration: string;
  durationISO: string;
  description: string;
  showNotes: string;
  audioUrl: string;
  tags: string[];
  playerUrl: string;
};

const parser = new Parser<Record<string, unknown>, CustomItem>({
  customFields: {
    item: [
      ["content:encoded", "content:encoded"],
      ["itunes:duration", "itunes.duration"],
      ["itunes:summary", "itunes.summary"],
      ["itunes:image", "itunes.image"],
      ["itunes:episode", "itunes.episode"],
      ["itunes:keywords", "itunes.keywords"],
    ],
  },
});

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/-+$/, "");
}

// Episode-title-slug -> the guest's real name. Takes precedence over the
// regex parsing below, which cannot recover a name the title never contained
// ("Emergency Update: Shane Pennington…" parses as no-guest under any rule
// that doesn't know Shane is the guest) and shouldn't be contorted trying.
//
// An empty string means the episode genuinely has no guest — hosts only — so
// it must produce no entity page at all. That is distinct from a missing key,
// which means "fall through to the regexes".
//
// Keyed by title slug rather than by the parser's own output, so fixing the
// parser can't silently orphan an entry. Names sourced from GUESTS_TICKER in
// src/pages/guests.js and the `guest:` frontmatter in content/newsletter/*.md,
// both of which are hand-maintained and correct.
const GUEST_NAME_OVERRIDES: Record<string, string> = {
  "an-inside-look-into-a-hemp-processing-facility-ft-malcolm-boyce-of-axtell-labs": "Malcolm Boyce",
  "arizona-cannabis-legalization-ft-sam-richard-of-ada": "Sam Richard",
  "behind-the-scenes-of-cannabis-lobbying-how-it-really-works-ft-the-liaison-group": "Erin Moffet & David Mangone",
  "boosting-revenue-with-crop-cycle-monitoring-how-sensors-increase-your-yield-and-bottom-line": "Scott Campbell",
  "budding-cannabis-news-who-are-the-next-major-companies-in-the-cannabis-market-with-matt-obrien-of-four-pm": "Matt O'Brien",
  "cannabinoid-research-education-and-advocacy-ft-clinical-psychologist-nicolas-schlienz": "Nicolas Schlienz",
  "cannabinoids-for-cancer-ft-msc-biochemist-ben-euhus": "Ben Euhus",
  "cannabinoids-the-nfl-ft-delvin-breaux-sr": "Delvin Breaux Sr.",
  "cannabis-compliance-a-moving-target-ft-dede-perkins-ceo-of-procanna": "Dede Perkins",
  "cannabis-controversy-duis": "",
  "cannabis-for-pets-ft-dr-tim-shu-of-vetcbd": "Dr. Tim Shu",
  "cannabis-industry-secrets-ft-bruce-eckfeldt-host-of-the-thinking-outside-the-bud-podcast": "Bruce Eckfeldt",
  "cannabis-potency-technology-purpl-pro-featuring-chad-lieber": "Chad Lieber",
  "connecting-professional-cannabis-leaders-featuring-mike-mejer-of-greenlane-communications": "Mike Mejer",
  "diversification-of-a-cannabis-mso-ft-gary-santo-ceo-of-tilt-holding": "Gary Santo",
  "east-coast-infused-cannabis-beverage-leader-from-origin-to-exit-ft-matt-melander-levia": "Matt Melander",
  // "Nate D" is the guest's actual public credit — it is how the episode title
  // and the show notes name him, and he is co-founder of Turn/Made/Project
  // Packs. Do NOT "complete" this to Nate Lipton: that is a different person
  // (Growers House, ep. 109). Merging them publishes a false worksFor claim.
  "ecosystem-secrets-how-premier-cannabis-brands-scale-ft-nate-d": "Nate D",
  "emergency-update-shane-pennington-breaks-down-cannabis-rescheduling": "Shane Pennington",
  "helping-cannabis-start-ups-light-up-how-leafwire-is-connecting-investors-start-ups-and-everyone-in-between-together": "Peter Vogel",
  "high-tech-cannabis-extraction-ft-rob-wirtz-of-mach-technologies": "Rob Wirtz",
  "how-grown-rogues-craft-cannabis-model-is-disrupting-the-industry-ft-obie-strickler": "Obie Strickler",
  "how-trulieve-became-the-most-dominant-cannabis-company-in-the-world-ft-kim-rivers-part-1": "Kim Rivers",
  "how-trulieve-became-the-most-dominant-cannabis-company-in-the-world-ft-kim-rivers-part-2": "Kim Rivers",
  // Not host-only: the notes name both founders, "we sit down with the Carl
  // Giannone & Jesse Pitts". Only the title is vague.
  "if-you-like-flavors-come-to-traders-ft-founders-of-trade-roots": "Carl Giannone & Jesse Pitts",
  "industrial-scale-cbd-hemp-operations-ft-pure-valley-solutions": "Austin Fricker & Nick Layton",
  "las-vegas-newest-attraction-a-cannabis-consumption-lounge-a-stones-throw-away-from-the-strip": "Chris LaPorte",
  "leading-the-way-into-cannabis-ft-the-cannabis-pr-queen-rosie-mattio": "Rosie Mattio",
  "legally-protecting-yourself-cannabis-edition-ft-neil-juneja-of-gleam-law": "Neil Juneja",
  "mainstream-medias-disconnect-with-the-cannabis-industry-ft-rena-sherbill-senior-editor-at-seeking-alpha-and-host-of-the-cannabis-investing-podcast": "Rena Sherbill",
  "meet-the-queens-of-cannabis-ft-her-highness": "Laura Eisman & Allison Krongard",
  "optimizing-cannabis-for-the-consumer-experience-ft-colin-landforce-cto-of-unrivaled-brands": "Colin Landforce",
  "passing-the-smell-test-terpenes-edition-ft-dr-jason-lupoi-of-thar-process": "Dr. Jason Lupoi",
  "peter-barsoom-how-1906s-has-crafted-microdosing-cannabinoids-with-targeted-effects": "Peter Barsoom",
  "recent-news-georgias-senate-election": "",
  "simplifying-cannabis-genetics-ft-jordan-zager-ceo-of-dewey-scientific": "Jordan Zager",
  "texas-cannabis-shayda-torabi-ceo-of-restart-cbd": "Shayda Torabi",
  "the-cannabis-titanic-the-reset-ahead-matt-karnes-on-what-the-numbers-say": "Matt Karnes",
  "the-last-cannabis-mile-ft-cory-azzalino-of-eaze": "Cory Azzalino",
  "the-leader-of-cannabis-intelligence-ft-arcview-consulting": "Jake Kuczeruk",
  "the-leading-non-profit-of-cannabis-science-research-ft-dr-john-abrams-chairman-of-the-cesc": "Dr. John Abrams",
  "the-lyft-playbook-for-cannabis-building-trust-through-tech-ft-ashwin-raj": "Ashwin Raj",
  "the-mso-gang-how-an-internet-army-is-policing-the-cannabis-industry-ft-kevin-carrillo-host-of-the-cannabinoid-connect-podcast": "Kevin Carrillo",
  "the-next-cannabis-unicorn-ft-jeff-ragovin-of-fyllo": "Jeff Ragovin",
  "the-og-cannabis-edible-ft-eric-leslie-of-cheeba-chews": "Eric Leslie",
  "the-secrets-of-global-cannabis-smuggling-with-kingpin-barry-foy": "Barry Foy",
  "tony-verzura-innovating-with-authentic-cannabis-derived-terpenes-deconstructing-extracts": "Tony Verzura",
  "viral-cannabis-brownie-ft-howard-schacter-of-marimed": "Howard Schacter",
  "world-renowned-harvard-doctor-untangles-myths-misconceptions-and-medical-uses-of-cannabis-ft-dr-grinspoon": "Dr. Peter Grinspoon",

  // Guest is named plainly in the title, but in a shape no safe regex
  // generalises — "<Name> on <Topic>", "<Name> Reveals…", "<Topic>: <Name>
  // on …". A rule loose enough to catch these also matches ordinary prose,
  // so they are enumerated instead. Every name here appears verbatim in its
  // own episode title.
  "aaron-nosbisch-reveals-brz-marketing-secrets-a-beverage-exploding-toward-20-million": "Aaron Nosbisch",
  "big-tobacco-is-moving-on-cannabis-the-global-strategy-is-unfolding-and-deepak-anand-reveals-wheres-next": "Deepak Anand",
  "boris-jordan-on-curaleafs-european-strategy-building-coca-cola-of-cannabis": "Boris Jordan",
  "caleb-counts-details-connecteds-35-million-rd-breeding-program-and-best-in-class-genetics-that-continues-to-deliver-hitters": "Caleb Counts",
  "chris-violas-breaks-down-blazes-software-infrastructure": "Chris Violas",
  "curaleafs-european-breakout-boris-jordan-strategy-for-the-hemp-company": "Boris Jordan",
  "deciding-on-a-dose-medical-cannabis-research-with-dr-jean-talleryand-of-medicann": "Dr. Jean Talleryand",
  "disrupting-cannabis-for-social-equity-martine-pierre-of-cannalution-leads-the-way-to-revolution": "Martine Pierre",
  "dr-matthew-johnson-the-worlds-most-published-scientist-on-the-human-effects-of-psychedelics": "Dr. Matthew Johnson",
  "ed-rosenthal-and-greg-baughman-youre-still-growing-cannabis-wrong": "Ed Rosenthal & Greg Baughman",
  "fix-the-process-real-cannabis-manufacturing-tools-optimization-techniques-ft-murphy-murri": "Murphy Murri",
  "from-one-of-the-nations-first-licensed-medical-operators-to-kingpin-statute-for-a-nonviolent-offense-luke-scarmazzos-shocking-story-vs-the-federal-government": "Luke Scarmazzo",
  "hard-questions-for-cannabis-founders-tony-schor-on-creative-capital-and-ma-strategies": "Tony Schor",
  "inside-the-lab-synthetic-cannabinoids-and-the-genomic-landscape-of-cannabis-with-dr-daniela-vergara": "Dr. Daniela Vergara",
  "kim-rivers-discusses-trulieve-preparing-for-floridas-6-billion-opportunity": "Kim Rivers",
  "no-exits-no-capital-no-bullsht-seth-yakatan-on-cannabis-reality": "Seth Yakatan",
  "organigrams-competitive-edge-paolo-de-luca-on-bat-ma-strategy-and-the-cannabis-long-game": "Paolo De Luca",
  "pablo-zuanic-on-cannabis-stocks-institutional-strategies-for-retail-investors": "Pablo Zuanic",
  "paul-f-austin-on-exploring-psychedelics-creativity-hidden-benefits-microdosing-and-retreats": "Paul F. Austin",
  "paul-weaver-of-boston-beer-company-on-big-alcohols-cannabis-strategy": "Paul Weaver",
  "richie-proud-on-the-ianthus-turnaround-why-selling-arizona-fueled-core-market-growth": "Richie Proud",
  "surprising-medical-uses-of-cannabis-first-hand-insights-from-dr-benjamin-caplan-on-cancer-dementia-and-skincare": "Dr. Benjamin Caplan",
  "the-etiquette-of-high-society-sitting-down-with-author-and-journalist-andrew-ward-thecannawriter": "Andrew Ward",
  "the-michelin-star-experience-gibran-washington-on-what-customers-actually-want": "Gibran Washington",
  "trump-texas-sb3-the-rescheduling-timeline-jim-higdon-on-what-comes-next": "Jim Higdon",
  // Both spellings are the same person — ep. 179's notes say "We invited Dr.
  // Matt Moore back for a third time". Normalised to the "Matthew" form so all
  // three appearances land on /guests/dr-matthew-moore, which already exists
  // and is indexed, rather than minting a competing /guests/dr-matt-moore.
  // GUESTS_TICKER also carries the "Matthew" form.
  "what-is-delta-10-thc-with-dr-matt-moore": "Dr. Matthew Moore",
  "delta-8-thc-deep-dive-featuring-dr-matt-moore": "Dr. Matthew Moore",
  "willie-mckenzie-from-legacy-california-to-profitable-8-figure-cannabis-operation-building-the-elite-cannabis-operators-mastermind": "Willie McKenzie",
};

// Trailing affiliation the title tacks onto a name — "Cory Azzalino of Eaze",
// "Gary Santo CEO of TILT Holding". Everything from the role/preposition on is
// company, not person, and must not end up in Person.name or the slug.
const NAME_TAIL_RE =
  /\s+(?:of|at|from|with|host of|co-host of|founder of|ceo of|cto of|cfo of|coo of|president of|chairman of|senior editor at)\b.*$/i;

// Leading epithet or credential — "MSc Biochemist Ben Euhus", "Clinical
// Psychologist Nicolas Schlienz", "The Cannabis PR Queen Rosie Mattio".
// Deliberately does NOT strip "Dr."/"Mr."/"Ms.", which are part of how these
// guests are credited everywhere else on the site.
const NAME_LEAD_RE =
  /^(?:the\s+)?(?:msc\s+)?(?:biochemist|clinical\s+psychologist|kingpin|cannabis\s+pr\s+queen|pr\s+queen)\s+/i;

function cleanGuestName(raw: string): string {
  return raw
    .replace(/\s*\((?:part|pt\.?)\s*\d+\)\s*$/i, "") // "(Part 1)" — same person, two episodes
    .replace(/[)\]]+\s*$/, "") // stray unmatched close-paren, e.g. "Delvin Breaux Sr)"
    .replace(NAME_TAIL_RE, "")
    .replace(NAME_LEAD_RE, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractGuest(title: string): { guest: string; company: string } {
  const override = GUEST_NAME_OVERRIDES[slugify(title)];
  if (override !== undefined) return { guest: override || "Guest", company: "" };

  // Patterns: "Title ft. Guest", "Title featuring Guest", "Title with Guest",
  // "Guest Name: Title".
  //
  // \b on `ft` is load-bearing: without it the pattern fires inside ordinary
  // words — "The Ly[ft] Playbook…", "Grown Rogue's Cra[ft] Cannabis Model…" —
  // and captures the rest of the title as if it were a person's name.
  const ftMatch = title.match(/\bft\.?\s+([^,\n]+?)(?:\s*,|\s*$)/i);
  const featuringMatch = title.match(/\bfeaturing\s+([^,\n)]+?)(?:\s*[,)]|\s*$)/i);
  const withMatch = title.match(/\bwith\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/);
  const colonMatch = title.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+):\s/);

  const raw = ftMatch?.[1] || featuringMatch?.[1] || withMatch?.[1] || colonMatch?.[1] || "";
  const guest = cleanGuestName(raw);
  return { guest: guest || "Guest", company: "" };
}

function formatDuration(raw: string): string {
  if (!raw) return "";
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  }
  if (parts.length === 2) {
    const [m] = parts;
    return `${m} min`;
  }
  const mins = Math.floor(Number(raw) / 60);
  return `${mins} min`;
}

// schema.org/Google structured data requires ISO 8601 duration (PT1H23M45S),
// not the "1h 23m" display string from formatDuration().
function formatDurationISO(raw: string): string {
  if (!raw) return "";
  let totalSeconds: number;
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) {
    const [h, m, s] = parts;
    totalSeconds = h * 3600 + m * 60 + s;
  } else if (parts.length === 2) {
    const [m, s] = parts;
    totalSeconds = m * 60 + s;
  } else {
    totalSeconds = Number(raw) || 0;
  }
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = Math.floor(totalSeconds % 60);
  return `PT${h > 0 ? `${h}H` : ""}${m > 0 ? `${m}M` : ""}${s > 0 || (h === 0 && m === 0) ? `${s}S` : ""}`;
}

function extractSimplecastId(guid: string, link: string): string {
  // Extract UUID from guid (Simplecast uses UUID format)
  const guidMatch = guid?.match(/([a-f0-9-]{36})/);
  if (guidMatch) return guidMatch[1];
  // Fallback to short code from link
  const linkMatch = link?.match(/-([a-zA-Z0-9]{8})(?:\?|$)/);
  if (linkMatch) return linkMatch[1];
  return guid || "";
}

// Domains to skip when auto-detecting company links from show notes
const SKIP_DOMAINS = [
  "linkedin.com", "twitter.com", "x.com", "instagram.com", "youtube.com",
  "facebook.com", "tiktok.com", "spotify.com", "podcasts.apple.com",
  "dimepodcast.com", "thedimepodcast.com", "8threv.com", "eighthrev.com",
  "simplecast.com", "anchor.fm", "buzzsprout.com",
];

// Hosts where the subdomain is the guest's actual identity and the base
// domain is just the platform ("mitchellosak.substack.com" -> "Mitchellosak").
// Everything else drops any subdomain and uses the label before the TLD
// ("en.wikipedia.org" -> "Wikipedia", "scale.williemckenzie.com" -> "Williemckenzie").
const SUBDOMAIN_IS_BRAND_HOSTS = ["substack.com", "myshopify.com", "wordpress.com", "blogspot.com", "wixsite.com"];

// "organigram.ca" -> "Organigram", "cryocure.com" -> "Cryocure". Multi-word
// domains with no separator (e.g. "ajnabiosciences.com") stay mashed
// together — imperfect, but still a correct link with a readable-enough
// label, which is what matters for an auto-detected fallback.
function hostnameToCompanyName(hostname: string): string {
  const labels = hostname.split(".");
  const platformSuffix = SUBDOMAIN_IS_BRAND_HOSTS.find(
    (h) => hostname === h || hostname.endsWith("." + h)
  );
  const isSubdomainOfPlatform = platformSuffix && labels.length > platformSuffix.split(".").length;
  const base = isSubdomainOfPlatform
    ? labels[0]
    : labels.length >= 2
      ? labels[labels.length - 2]
      : labels[0];
  return base
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(" ");
}

// Show notes sometimes wrap guest links in an email-tracking redirect
// (e.g. Streak: "streaklinks.com/<id>/https%3A%2F%2Fayrwellness.com%2F").
// The redirect host isn't the guest's company, so unwrap to the
// percent-encoded destination URL when one is embedded in the path.
function unwrapTrackingRedirect(raw: string): string {
  let current = raw;
  for (let i = 0; i < 3; i++) {
    const embedded = current.match(/https?%3A%2F%2F.+/i);
    if (!embedded) break;
    let decoded: string;
    try {
      decoded = decodeURIComponent(embedded[0]);
    } catch {
      break;
    }
    if (decoded === current) break;
    current = decoded;
  }
  return current;
}

// Company links are only auto-detected from the show notes' "Guest Links"
// section (heading text varies a little: "Guest Links:", "Guest Links",
// "Follow Guest Links"). About half of episodes don't have one — those get
// no auto-detected company rather than a guessed one. Scanning the *whole*
// show notes (the old approach) reliably picked up the "Newton Insights"
// sponsor read or the "Eighth Revolution" footer link instead, since both
// appear in every episode's boilerplate and neither is on SKIP_DOMAINS.
function extractCompanyFromShowNotes(html: string): { company: string; companyUrl: string } {
  const headingMatch = html.match(/guest\s*links?\s*:?\s*<\/(?:strong|b)>\s*<\/p>/i);
  if (!headingMatch || headingMatch.index === undefined) return { company: "", companyUrl: "" };

  const afterHeading = html.slice(headingMatch.index + headingMatch[0].length);
  // The "Our Links" heading text varies ("Our Links:", "Follow us: Our
  // Links.") and a few episodes skip it entirely, going straight into the
  // boilerplate — but every episode's boilerplate links Bryan's Twitter/X
  // and the "Eighth Revolution" sponsor site, so those are more reliable
  // end-of-guest-links boundaries than the heading itself.
  const headingEndMatch = afterHeading.match(/our\s*links?/i);
  const boilerplateMatch = afterHeading.match(
    /href=["']https?:\/\/(?:www\.)?(?:(?:x|twitter)\.com\/BryanFields24|eighthrevolution\.com)/i
  );
  const endIndex = [headingEndMatch?.index, boilerplateMatch?.index]
    .filter((i): i is number => i !== undefined)
    .sort((a, b) => a - b)[0];
  const section = endIndex !== undefined ? afterHeading.slice(0, endIndex) : afterHeading;

  // Guest links show up both as <a href> tags and as bare text URLs (some
  // episodes never wrap them in an anchor at all). A few episodes' show
  // notes have two different links pasted back-to-back with no separator
  // (e.g. "linkedin.com/in/xhttps://realcompany.com/") — the lookahead stops
  // each match before a second embedded scheme so the two are split into
  // separate candidates instead of one match swallowing both.
  const urlRe = /(https?:\/\/(?:(?!https?:\/\/)[^\s"'<>)])+)|(\bwww\.(?:(?!https?:\/\/)[^\s"'<>)])+)/gi;
  let match: RegExpExecArray | null;
  while ((match = urlRe.exec(section)) !== null) {
    const raw = unwrapTrackingRedirect(
      (match[1] || `https://${match[2]}`).replace(/[.,;)]+$/, "")
    );
    try {
      const url = new URL(raw);
      const hostname = url.hostname.replace(/^www\./, "");
      if (SKIP_DOMAINS.some((d) => hostname === d || hostname.endsWith("." + d))) continue;
      return { company: hostnameToCompanyName(hostname), companyUrl: raw };
    } catch {
      continue;
    }
  }
  return { company: "", companyUrl: "" };
}

// Manual overrides — takes precedence over auto-detection.
// Use when the show notes don't link the company or the wrong link is detected.
const GUEST_COMPANY_MAP: Record<string, { company: string; companyUrl: string }> = {
  "Aubrey Amatelli": { company: "PayRio", companyUrl: "https://www.payrio.co" },
};

// Simplecast's editor markdown-escapes underscores, and the escape survives
// into the published <content:encoded> HTML — so a handle like @todd_harrison
// ships as a link to `todd\_harrison`, which is nobody. Every social link with
// an underscore in the handle is broken this way.
//
// The feed carries the escape in two different encodings and both have to be
// handled: the href is already percent-encoded (`twitter.com/todd%5C_harrison`,
// 34 in the feed) while the anchor text keeps the literal backslash
// (`twitter.com/todd\_harrison`, 68). Fixing only one leaves either a dead link
// or a visibly mangled URL on the page.
//
// Scoped deliberately to the underscore case: an audit of the full feed found
// `\_` to be the only backslash sequence present, so a general markdown
// unescape would be strictly more risk for no additional fix.
function unescapeMarkdownUnderscores(html: string): string {
  return html.replace(/(?:\\|%5C)_/gi, "_");
}

// The Simplecast show notes misspell the co-host's surname in a minority of
// episodes — "Kellen" appears 30 times against 2,146 correct "Kellan", so this
// is a typo in the source copy, not an alternate spelling. It renders in the
// visible "Full Show Notes" block, so without this the site publishes a named
// person's name wrong on ~30 episode pages.
//
// Canonical spelling is "Kellan Finney" (src/pages/about.js). Fixing the bare
// first name covers "Kellen Finney" and standalone "Kellen" in the timestamped
// chapter lists both; the follow-up passes then repair the surname where the
// notes also garble it.
function normalizeCohostName(html: string): string {
  return html
    .replace(/\bKellen\b/g, "Kellan")
    .replace(/\bKellan Finny\b/g, "Kellan Finney")
    .replace(/\bKellan Finn\b(?![ey])/g, "Kellan Finney");
}

// Paths on the Eighth Revolution domains that 404 at the origin. Verified
// 2026-08-06: eighthrevolution.com and 8threv.com resolve to an AWS load
// balancer (`Server: awselb/2.0`), not this deployment. That origin 301s its
// own root to dimepodcast.com but 404s every deeper path, so the host rules in
// next.config.js never fire and cannot repair these — see the note there.
//
// The damage was sitewide: /the-dime/ is in the show-notes boilerplate of all
// 304 episodes, and the two /monthly-report/ links are on ~216 each. Every
// episode page was rendering at least one dead outbound link, most three.
//
// The two cases are handled differently, because the copy around them differs.
//
// UNLINK — "At Eighth Revolution (8th Rev), we provide services from capital to
// cannabinoid…" is descriptive credit copy. It reads perfectly as prose with no
// link, so the anchor is stripped and the sentence kept. The bare domain root is
// deliberately absent from this list — it still resolves (301 → dimepodcast.com).
const DEAD_UNLINK_PATTERNS = [/(?:www\.)?eighthrevolution\.com\/the-dime(?:-podcast)?\b/i];

// RETARGET — "Sign up for our playbook here:" is a call to action. Unlinking it
// leaves a sentence promising a link that isn't there, on ~216 pages. The 8th Rev
// monthly report was superseded by the First Principles newsletter, so these point
// at its signup instead: the CTA works again and lands somewhere that actually
// captures the email.
//
// Deliberately a site-relative path, not an absolute dimepodcast.com URL. It
// makes this a true internal link — no cross-origin hop, no redirect — and it
// keeps working on preview deployments. It also means withUtm leaves it alone
// (unparseable as an absolute URL, and dimepodcast.com is a never-tag host
// anyway): tagging an internal link would start a fresh GA4 session and
// overwrite the visitor's real acquisition source.
const DEAD_RETARGET = [
  { pattern: /(?:www\.)?(?:eighthrevolution|8threv)\.com\/monthly-report\b/i, destination: "/newsletter" },
];

// Rewrites or strips the anchor, keeping its contents either way, so inline
// markup inside the link text (the boilerplate wraps it in <strong>) survives.
//
// Ordering: this must run *after* extractCompanyFromShowNotes, which uses the
// eighthrevolution.com href as the end-boundary of the "Guest Links" section
// (see the comment there). Removing these anchors first would strip that
// boundary and break guest-company detection across a large share of episodes.
function repairDeadLinks(html: string): string {
  return html.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (match, attrs: string, inner: string) => {
    const href = attrs.match(/href\s*=\s*["']([^"']*)["']/i)?.[1];
    if (!href) return match;

    const retarget = DEAD_RETARGET.find((r) => r.pattern.test(href));
    if (retarget) {
      // Function replacement: a destination containing "$&" would otherwise be
      // read as a replacement pattern.
      const rewritten = attrs.replace(
        /href\s*=\s*["'][^"']*["']/i,
        () => `href="${retarget.destination}"`
      );
      return `<a${rewritten}>${inner}</a>`;
    }

    return DEAD_UNLINK_PATTERNS.some((re) => re.test(href)) ? inner : match;
  });
}

let cachedEpisodes: Episode[] | null = null;

export async function getAllEpisodes(): Promise<Episode[]> {
  if (cachedEpisodes) return cachedEpisodes;

  try {
    const feed = await parser.parseURL(FEED_URL);

    cachedEpisodes = feed.items.map((item, index) => {
      const { guest, company: extractedCompany } = extractGuest(item.title || "");
      const showNotesRaw = normalizeCohostName(
        unescapeMarkdownUnderscores(item["content:encoded"] || item.itunes?.summary || "")
      );
      const companyOverride = GUEST_COMPANY_MAP[guest];
      const autoDetected = companyOverride ? { company: "", companyUrl: "" } : extractCompanyFromShowNotes(showNotesRaw);
      const company = companyOverride?.company || autoDetected.company || extractedCompany;
      const id = extractSimplecastId(item.guid || "", item.link || "");
      const epNum = item.itunes?.episode || String(feed.items.length - index);
      const tags = item.itunes?.keywords?.split(",").map((k) => k.trim()).filter(Boolean) || [];

      const fullSlug = slugify(item.title || "");
      const truncatedSlug = fullSlug.slice(0, 80).replace(/-+$/, "");

      // Attribution for the links inside the show notes, applied at build time.
      // The episode page renders this HTML verbatim, so tagging here covers
      // every hand-written sponsor read and guest link on the website without
      // editing every back-catalog episode in Simplecast. Links that already carry utm_
      // params are left alone by withUtm, so tagging an episode in Simplecast
      // later takes precedence instead of being double-tagged.
      //
      // Ordering matters twice over. extractCompanyFromShowNotes must see the
      // untagged HTML (it matches boundary hrefs and returns a URL that would
      // otherwise arrive pre-tagged with the wrong medium), and `description`
      // is derived from the untagged copy so it is structurally impossible for
      // a param to reach a meta description — tagHtmlLinks only touches
      // attribute values, but deriving from showNotesRaw makes that a
      // guarantee rather than a coincidence.
      const showNotes = tagHtmlLinks(
        repairDeadLinks(showNotesRaw),
        { ...UTM.showNotes, content: fullSlug }
      );
      const description = showNotesRaw.replace(/<[^>]+>/g, "").slice(0, 220) + "...";

      // The company link is rendered by the episode and guest pages as their
      // own element rather than as part of the notes, so it gets the guest_link
      // campaign to keep it separable from the in-notes links above.
      const companyUrl = withUtm(
        companyOverride?.companyUrl || autoDetected.companyUrl || "",
        { ...UTM.guestLink, content: fullSlug }
      );

      return {
        id,
        slug: fullSlug,
        legacySlug: truncatedSlug !== fullSlug ? truncatedSlug : "",
        num: epNum,
        title: item.title || "",
        guest,
        company,
        companyUrl,
        date: new Date(item.pubDate || "").toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
        dateISO: new Date(item.pubDate || "").toISOString(),
        duration: formatDuration(item.itunes?.duration || ""),
        durationISO: formatDurationISO(item.itunes?.duration || ""),
        description,
        showNotes,
        audioUrl: item.enclosure?.url || "",
        tags: tags.slice(0, 5),
        playerUrl: `https://player.simplecast.com/${id}?dark=true&color=00C9A7`,
      };
    });

    return cachedEpisodes;
  } catch (error) {
    console.error("Error fetching RSS feed:", error);
    return [];
  }
}

// Simplecast's itunes:episode numbering has a few duplicate/skipped
// numbers, so it doesn't equal episodes.length. Use the highest episode
// number so displayed counts match the "Ep. N" badges shown elsewhere.
export function getLatestEpisodeNumber(episodes: Episode[]): number {
  return episodes.reduce((max, ep) => {
    const n = parseInt(ep.num, 10);
    return Number.isFinite(n) && n > max ? n : max;
  }, episodes.length);
}

export async function getEpisodeBySlug(slug: string): Promise<Episode | null> {
  const episodes = await getAllEpisodes();
  return episodes.find((ep) => ep.slug === slug || ep.legacySlug === slug) || null;
}
