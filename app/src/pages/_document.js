import { Html, Head, Main, NextScript } from 'next/document';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

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

        {/* Open Graph defaults. og:type is deliberately NOT here — it varies
            per page (SeoHead's `ogType` prop) and next/head isn't deduped
            against this Head, so a default here rendered a second, conflicting
            og:type on every page. Same trap as the description tag above. */}
        <meta property="og:site_name" content="The Dime Podcast" />
        <meta property="og:locale" content="en_US" />

        {/* Twitter / X Card defaults */}
        <meta name="twitter:card" content="summary_large_image" />
        {/* @thedime_cannabis was the YouTube handle pasted into an X field —
            16 characters, which X cannot issue (15 max), so it resolved to
            nothing on all 898 pages. The show's real handle appears 570 times
            in the Simplecast feed as "The Dime on Twitter". */}
        <meta name="twitter:site" content="@TheDime_8th" />
        <meta name="twitter:creator" content="@Bryanfields24" />

        {/* Podcast-specific */}
        <meta name="application-name" content="The Dime Podcast" />
        {/* Three feeds, listed most-specific-first. The Simplecast one is the
            podcast: it carries the audio enclosures and is what podcast apps
            should subscribe to, so it keeps the unqualified "RSS" title. The
            two site feeds link to pages on this domain and carry no audio —
            titled so a reader picking from this list can tell which is which
            (see lib/feed.js). */}
        <link rel="alternate" type="application/rss+xml" title="The Dime Podcast RSS" href="https://feeds.simplecast.com/Vnrz0StH" />
        <link rel="alternate" type="application/rss+xml" title="The Dime Podcast — new episodes on the site" href="https://www.dimepodcast.com/rss.xml" />
        <link rel="alternate" type="application/rss+xml" title="First Principles — written analysis" href="https://www.dimepodcast.com/newsletter/rss.xml" />

        {/* GA4 bootstrap: a raw inline script so window.gtag exists at
            HTML-parse time, independent of React. It only queues into
            dataLayer; gtag.js itself still loads lazily from _app, so this adds
            no request.

            Why not the next/script version this replaced (afterInteractive, in
            _app): that snippet only ran once React hydrated. Parse-time setup
            instead survives a hydration error anywhere in the tree — which
            blocks the effects of App and of a Script child alike — plus any
            delay in a renderer that is not compositing, and it does not depend
            on where the tag sits in the JSX. It does not by itself rescue the
            first page_view, which still comes from _app's mount effect; it
            guarantees window.gtag exists for anything that is not an effect.

            send_page_view is off; lib/analytics.ts fires every page_view
            explicitly with the current URL. GA4's "page changes based on
            browser history events" enhanced measurement must stay OFF to match
            (docs/analytics-spec.md Part 2.1, Change D) — with both on, every
            client-side route change counts twice.

            page_location/page_title are deliberately NOT set here, unlike the
            spec's Change A. Parameters in a config call become sticky defaults
            for every later event on that page load, so on a single-page-app
            they would pin every audio/read-depth event from Parts 2.2 onward to
            the URL the visitor landed on. Omitting them lets gtag read the
            current values per event, and pageview() passes both explicitly. */}
        {GA_ID && (
          <script
            id="ga4-init"
            dangerouslySetInnerHTML={{
              __html: `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(GA_ID)},{send_page_view:false});`,
            }}
          />
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
