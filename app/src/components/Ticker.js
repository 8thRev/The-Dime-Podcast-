import Link from 'next/link';

// `items` is [{ name, slug }] — every entry links to that guest's page.
// The list is duplicated to make the marquee loop seamlessly; the second
// copy is hidden from assistive tech and taken out of the tab order so the
// same names aren't announced or tabbed through twice.
export default function Ticker({ items }) {
  const tickerItems = [...items, ...items];

  return (
    <div className="guest-ticker-wrap">
        <div className="guest-ticker">
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
