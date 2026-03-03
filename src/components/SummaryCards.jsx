const LW = { dark: "#133020", green: "#046241", saffron: "#FFB347", yellow: "#FFC370", paper: "#f5eedb", salt: "#F9F7F7" };

export default function SummaryCards({ data, cards }) {
  if (!cards || cards.length === 0) return null;

  const calculate = (column, agg) => {
    const rawValues = data.map(r => r[column]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
    if (agg === "count") return new Set(rawValues.map(v => String(v).trim().toLowerCase())).size;
    const numValues = rawValues.map(v => Number(v)).filter(v => !isNaN(v));
    if (agg === "sum") return numValues.reduce((a, b) => a + b, 0);
    if (agg === "avg") return numValues.length ? numValues.reduce((a, b) => a + b, 0) / numValues.length : 0;
    return 0;
  };

  const format = (value, hint) => {
    if (hint === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    if (hint === "percent") return `${value.toFixed(1)}%`;
    if (hint === "percent_decimal") return `${(value * 100).toFixed(1)}%`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
  };

  const accents = [LW.green, LW.dark, LW.saffron, "#417256", "#034E34"];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 24, fontFamily: "'Manrope', sans-serif" }}>
      {cards.map((card, idx) => {
        const raw = calculate(card.column, card.aggregation);
        const formatted = format(raw, card.formatHint || "number");
        const accent = accents[idx % accents.length];
        return (
          <div key={card.id} style={{
            background: LW.white, borderRadius: 14, padding: "20px 22px",
            borderLeft: `4px solid ${accent}`,
            boxShadow: "0 1px 6px rgba(19,48,32,0.06)",
            cursor: "default", transition: "transform 0.2s, box-shadow 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(19,48,32,0.10)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = "none"; e.currentTarget.style.boxShadow = "0 1px 6px rgba(19,48,32,0.06)"; }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: "#9cafa4", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 30, fontWeight: 800, color: accent, letterSpacing: "-0.03em", lineHeight: 1 }}>{formatted}</div>
          </div>
        );
      })}
    </div>
  );
}