export default function SummaryCards({ data, cards }) {
  if (!cards || cards.length === 0) return null;

  const calculate = (column, agg) => {
    const rawValues = data
      .map((row) => row[column])
      .filter((v) => v !== null && v !== undefined && String(v).trim() !== "");

    // count = distinct non-null values, case-insensitive + trimmed
    if (agg === "count")
      return new Set(rawValues.map((v) => String(v).trim().toLowerCase())).size;

    const numValues = rawValues.map((v) => Number(v)).filter((v) => !isNaN(v));
    if (agg === "sum") return numValues.reduce((a, b) => a + b, 0);
    if (agg === "avg") return numValues.length ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0;
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