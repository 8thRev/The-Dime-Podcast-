import { Html, Head, Main, NextScript } from 'next/document';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;
const SITE_URL = 'https://thedime.com';
const DEFAULT_TITLE = 'The Dime Podcast — Cannabis Business Intelligence';
const DEFAULT_DESCRIPTION = 'Strategy conversations for cannabis operators, not observers. 295+ episodes with founders, executives, and investors shaping the industry.';

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <meta charSet="UTF-8" />

        {/* Global SEO defaults — pages override these via next/head */}
        <meta name="description" content={DEFAULT_DESCRIPTION} />
        <meta name="robots" content="index, follow" />

        {/* Open Graph defaults */}
        <meta property="og:site_name" content="The Dime Podcast" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter / X Card defaults */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:site" content="@thedime_cannabis" />
        <meta name="twitter:creator" content="@Bryanfields24" />
        <meta name="twitter:title" content={DEFAULT_TITLE} />
        <meta name="twitter:description" content={DEFAULT_DESCRIPTION} />

        {/* Podcast-specific */}
        <meta name="application-name" content="The Dime Podcast" />
        <link rel="alternate" type="application/rss+xml" title="The Dime Podcast RSS" href="https://feeds.simplecast.com/Vnrz0StH" />

        {/* Google Analytics 4 — set NEXT_PUBLIC_GA_ID in .env.local */}
        {GA_ID && (
          <>
            <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
            <script
              dangerouslySetInnerHTML={{
                __html: `
                  window.dataLayer = window.dataLayer || [];
                  function gtag(){dataLayer.push(arguments);}
                  gtag('js', new Date());
                  gtag('config', '${GA_ID}', { page_path: window.location.pathname });
                `,
              }}
            />
          </>
        )}
      </Head>
      <body>
        <div className="grain" />
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
