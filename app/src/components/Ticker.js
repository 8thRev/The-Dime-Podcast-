import Link from 'next/link';

// The scroll used to be a hardcoded 120s for a hardcoded 32 names. Since the
// keyframe always travels exactly one copy of the list, a fixed duration means
// speed changes whenever the list length does — 120s over 222 names would be a
// blur. Pinning seconds-per-name instead keeps the pace identical no matter how
// many guests there are; 3.75s is the original 120s / 32 names.
const SECONDS_PER_NAME = 3.75;

// `items` is [{ name, slug }] — every entry links to that guest's page.
// The list is duplicated to make the marquee loop seamlessly; the second
// copy is hidden from assistive tech and taken out of the tab order so the
// same names aren't announced or tabbed through twice.
export default function Ticker({ items }) {
  const tickerItems = [...items, ...items];

  return (
    <div className="guest-ticker-wrap">
        <div
          className="guest-ticker"
          style={{ '--ticker-duration': `${(items.length * SECONDS_PER_NAME).toFixed(1)}s` }}
        >
          {tickerItems.map((item, i) => {
            const isDuplicate = i >= items.length;
            return (
              <div key={i} className="ticker-item" aria-hidden={isDuplicate || undefined}>
                <Link
                  href={`/guests/${item.slug}`}
                  className={`ticker-name ${i % 6 === 0 ? 'highlight' : ''}`}
                  tabIndex={isDuplicate ? -1 : undefined}
                >
                  {item.name}
                </Link>
                <span className="ticker-separator">·</span>
              </div>
            );
          })}
        </div>
    </div>
  );
}
