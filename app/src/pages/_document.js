import { Html, Head, Main, NextScript } from 'next/document';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />

        {/* viewport lives in SeoHead (next/head, per-page) rather than here —
            Next.js only recognizes/dedupes a page-declared viewport tag
            against its own auto-injected default when it's declared via
            next/head, not next/document's Head. */}

        {/* Global, page-independent defaults only — title/description/
            twitter:title/twitter:description live in SeoHead per-page
            (next/head is not deduped against this Head, so anything
            page-specific declared here would render twice). */}
        <meta name="robots" content="index, follow" />

        {/* Open Graph defaults */}
        <meta property="og:site_name" content="The Dime Podcast" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter / X Card defaults */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@thedime_cannabis" />
        <meta name="twitter:creator" content="@Bryanfields24" />

        {/* Podcast-specific */}
        <meta name="application-name" content="The Dime Podcast" />
        <link rel="alternate" type="application/rss+xml" title="The Dime Podcast RSS" href="https://feeds.simplecast.com/Vnrz0StH" />
      </Head>
      <body>
        <div className="grain" />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
