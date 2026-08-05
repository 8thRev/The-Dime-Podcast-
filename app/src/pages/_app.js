import '@/src/styles/globals.css';
import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { pageview, resetMilestones } from '@/lib/analytics';

const GA_ID = process.env.NEXT_PUBLIC_GA_ID;

// next/head applies the incoming page's title element as a DOM mutation
// *after* routeChangeComplete fires, so page_title has to wait for that
// mutation rather than for a tick of the event loop. Measured locally on a
// client-side nav: document.title still held the previous page's value
// synchronously, on the next microtask, and at setTimeout(0) (4ms), and was
// correct at the head mutation (10ms). Firing on the next tick tagged every
// client-side page_view with the previous page's title — the page_title version
// of the stale-page_path bug this whole change exists to fix.
// requestAnimationFrame is not usable as the trigger: it never fires while the
// tab is backgrounded.
//
// Returns a flush function so a navigation that lands while we are still
// waiting can settle the previous one instead of leaving it to the timeout.
function whenTitleSettled(fn) {
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    observer.disconnect();
    clearTimeout(fallback);
    window.removeEventListener('pagehide', finish);
    fn();
  };

  const startTitle = document.title;
  const observer = new MutationObserver(() => {
    if (document.title !== startTitle) finish();
  });
  observer.observe(document.head, { childList: true, subtree: true, characterData: true });

  // Two pages can carry the same title, and then there is no mutation to wait
  // for. Cap the wait so the page_view is still sent exactly once — 250ms is a
  // wide margin over the 10ms measured above, while staying short enough that
  // little is at risk if the visitor leaves mid-wait. pagehide covers the rest:
  // leaving the page flushes whatever is still pending.
  const fallback = setTimeout(finish, 250);
  window.addEventListener('pagehide', finish);

  return finish;
}

export default function App({ Component, pageProps }) {
  const router = useRouter();

  // Exactly one page_view per navigation, fired from here. The gtag bootstrap
  // in _document.js sets send_page_view: false, so this effect is the only
  // source of pageviews — hard loads included. See docs/analytics-spec.md 2.1.
  useEffect(() => {
    // A hard load needs no title wait: document.title is the server-rendered
    // one and is already correct.
    pageview(router.asPath);

    let flushPending = null;

    const onRouteChange = (url, { shallow } = {}) => {
      // Shallow route changes emit routeChangeComplete too, but the visitor has
      // not gone anywhere — only the URL was rewritten under the same page. The
      // archive search already rewrites ?q= this way on every keystroke
      // (episodes.js), so without this guard a 12-character query would book 12
      // page_views and clear milestones on a page still being read. A hard load
      // of /episodes?q=… is unaffected: that page_view comes from the mount
      // above, with the query string included.
      if (shallow) return;

      // Settle the previous navigation's page_view before starting this one, so
      // it cannot pick up the incoming page's title.
      if (flushPending) flushPending();
      // Reset immediately rather than inside the wait: milestones belong to the
      // page the visitor is already looking at.
      resetMilestones();
      flushPending = whenTitleSettled(() => {
        flushPending = null;
        pageview(url);
      });
    };

    router.events.on('routeChangeComplete', onRouteChange);
    return () => {
      router.events.off('routeChangeComplete', onRouteChange);
      if (flushPending) flushPending();
    };
    // Mount-only. router.events is stable, and re-running this would send a
    // duplicate page_view for the current route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Component {...pageProps} />
      <Analytics />
      <SpeedInsights />
      {GA_ID && (
        <Script strategy="afterInteractive" src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} />
      )}
    </>
  );
}
