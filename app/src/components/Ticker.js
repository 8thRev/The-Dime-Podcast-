export default function Ticker({ items }) {
  const tickerItems = [...items, ...items];

  return (
    <div className="guest-ticker-wrap">
        <div className="guest-ticker">
          {tickerItems.map((item, i) => (
            <div key={i} className="ticker-item">
              <span className={`ticker-name ${i % 6 === 0 ? "highlight" : ""}`}>
                {item}
              </span>
              <span className="ticker-separator">·</span>
            </div>
          ))}
        </div>
    </div>
  );
}
