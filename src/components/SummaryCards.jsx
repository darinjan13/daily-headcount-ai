export default function SummaryCards({ data, cards }) {
  if (!cards || cards.length === 0) return null;

  const calculate = (column, agg) => {
    const values = data.map((row) => Number(row[column])).filter((v) => !isNaN(v));
    if (agg === "sum") return values.reduce((a, b) => a + b, 0);
    if (agg === "avg") return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
    if (agg === "count") return values.length;
    return 0;
  };

  const format = (value, hint) => {
    if (hint === "currency")
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    if (hint === "percent") return `${value.toFixed(1)}%`;
    if (hint === "percent_decimal") return `${(value * 100).toFixed(1)}%`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
  };

  return (
    <div className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
      {cards.map((card) => {
        const raw = calculate(card.column, card.aggregation);
        const formatted = format(raw, card.formatHint || "number");
        return (
          <div
            key={card.id}
            className="bg-white rounded-xl shadow-sm border-l-4 border-emerald-700 px-6 py-5 hover:-translate-y-1 transition-transform cursor-default"
          >
            <div className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">{card.label}</div>
            <div className="text-3xl font-extrabold text-emerald-700 tracking-tight">{formatted}</div>
          </div>
        );
      })}
    </div>
  );
}