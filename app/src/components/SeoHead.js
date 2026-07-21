// src/components/SeoHead.js
// Single source of truth for per-page <head> tags. Every page renders this
// instead of hand-rolling next/head — it's what guarantees exactly one
// title/description/canonical tag (no duplicate with a global default) and
// that neither one can silently exceed a safe length, no matter how long
// the underlying RSS/YouTube/AI-generated source string is.

import Head from 'next/head';
import { buildPageTitle, truncateDescription, truncateTitle } from '@/lib/schema';

const SITE_URL = 'https://www.dimepodcast.com';
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.jpg`;

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
