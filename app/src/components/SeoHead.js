// src/components/SeoHead.js
// Single source of truth for per-page <head> tags. Every page renders this
// instead of hand-rolling next/head — it's what guarantees exactly one
// title/description/canonical tag (no duplicate with a global default) and
// that neither one can silently exceed a safe length, no matter how long
// the underlying RSS/YouTube/AI-generated source string is.

import Head from 'next/head';
import { buildPageTitle, truncateDescription, truncateTitle } from '@/lib/schema';

const SITE_URL = 'https://www.dimepodcast.com';
// STOPGAP: `${SITE_URL}/og-default.jpg` has never existed in app/public, so
// every share of an episode, guest, topic or newsletter URL — 586 pages —
// rendered a blank card against `twitter:card=summary_large_image`. Pointing at
// the real Simplecast cover art makes those cards show actual artwork today.
//
// It is not the right long-term answer: the art is square (2047x2047 as
// delivered, despite the 3000x3000 path segment) so large-image cards crop
// it, and the URL is Simplecast's, so re-uploading the
// cover there breaks this again. Replace with a purpose-made 1200x630
// app/public/og-default.jpg and revert this constant.
const DEFAULT_OG_IMAGE =
  'https://image.simplecastcdn.com/images/1a0a47e2-85d2-449a-9d9b-559883abfdcb/9dcf3518-cd67-4e0f-9f5c-c21c9ce295e3/3000x3000/dime-cover-art-new-v2.jpg';

export default function SeoHead({
  title,
  description,
  path,
  ogType = 'website',
  ogImage = DEFAULT_OG_IMAGE,
  noindex = false,
  // Set true when `title` already IS the full page title (e.g. the
  // homepage's "The Dime Podcast — Cannabis Business Intelligence"), so
  // the " — The Dime Podcast" suffix isn't appended a second time.
  fullTitleProvided = false,
}) {
  const fullTitle = fullTitleProvided ? truncateTitle(title, 60) : buildPageTitle(title);
  const desc = truncateDescription(description);
  const canonical = `${SITE_URL}${path}`;

  return (
    <Head>
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={canonical} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:type" content={ogType} />
      <meta property="og:url" content={canonical} />
      <meta property="og:image" content={ogImage} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:image" content={ogImage} />
      {noindex && <meta name="robots" content="noindex, follow" />}
    </Head>
  );
}
