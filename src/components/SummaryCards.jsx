import { useMemo } from "react";

const LW = { dark: "var(--color-text)", green: "var(--color-castleton-green)", saffron: "var(--color-saffron)", salt: "var(--color-surface-soft)" };
const UI = {
  surface: "var(--color-surface)",
  elevated: "var(--color-surface-elevated)",
  border: "var(--color-border)",
  borderStrong: "var(--color-border-strong)",
  text: "var(--color-text)",
  textLight: "var(--color-text-light)",
};
const ACCENTS = [LW.green, LW.dark, LW.saffron, "#417256", "#034E34"];

const fmt = (value, hint) => {
  if (value === null || value === undefined || isNaN(value)) return "—";
  // guard: if value is a large number, percent hints are clearly wrong
  if ((hint === "percent" || hint === "percent_decimal") && Math.abs(value) >= 2) hint = "number";
  if (hint === "currency") return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
  if (hint === "percent") return `${Number(value).toFixed(1)}%`;
  if (hint === "percent_decimal") return `${(Number(value) * 100).toFixed(1)}%`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value % 1 === 0 ? value.toLocaleString() : value.toFixed(2);
};

const MEDALS = ["🥇", "🥈", "🥉"];

function RankBar({ pct, accent }) {
  return (
    <div style={{ height: 3, borderRadius: 999, background: UI.border, overflow: "hidden", marginTop: 3 }}>
      <div style={{ height: "100%", width: `${Math.min(100, Math.max(2, pct))}%`, background: accent, borderRadius: 999 }} />
    </div>
  );
}

function SummaryCard({ card, data, accent }) {
  const hint = card.formatHint || "number";

  const { rankings, topValue } = useMemo(() => {
    const rawValues = data
      .map(r => r[card.column])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== "");

    if (card.aggregation === "count") {
      // rank by frequency, case-insensitive grouping, preserve original casing
      const freq = {};
      const canonical = {}; // lowercase key → original display label (first seen)
      rawValues.forEach(v => {
        const k = String(v).trim();
        const lower = k.toLowerCase();
        freq[lower] = (freq[lower] || 0) + 1;
        if (!canonical[lower]) canonical[lower] = k;
      });
      const sorted = Object.entries(freq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([lower, count]) => ({ label: canonical[lower], value: count, display: count.toLocaleString() }));
      return { rankings: sorted, topValue: sorted[0]?.value || 0 };
    }

    // numeric — find the best category column to group by
    const allCols = Object.keys(data[0] || {});
    const categoryCol = allCols.find(col => {
      if (col === card.column) return false;
      const vals = data.map(r => r[col]).filter(v => v !== null && v !== undefined && String(v).trim() !== "");
      if (!vals.length) return false;
      const unique = new Set(vals.map(v => String(v).trim().toLowerCase()));
      const uniqueRatio = unique.size / vals.length;
      // good label column: not all unique (not an ID), not all same, mostly text
      const numericCount = vals.filter(v => !isNaN(parseFloat(String(v).replace(/,/g, "")))).length;
      const isTextCol = numericCount / vals.length < 0.5;
      return isTextCol && uniqueRatio > 0.005 && uniqueRatio < 0.95 && unique.size >= 2;
    });

    if (categoryCol) {
      // group by category column, case-insensitive, preserve original casing
      const groups = {};
      const canonical = {};
      data.forEach(row => {
        const raw = String(row[categoryCol] ?? "—").trim();
        const lower = raw.toLowerCase();
        const num = parseFloat(String(row[card.column] ?? "").replace(/,/g, ""));
        if (!isNaN(num)) {
          groups[lower] = (groups[lower] || 0) + num;
          if (!canonical[lower]) canonical[lower] = raw;
        }
      });
      const sorted = Object.entries(groups)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([lower, value]) => ({ label: canonical[lower], value, display: fmt(value, hint) }));
      return { rankings: sorted, topValue: sorted[0]?.value || 0 };
    }

    // fallback — rank individual rows by value
    const entries = data
      .map(r => ({ label: String(r[card.column] ?? "—").trim(), raw: parseFloat(String(r[card.column] ?? "").replace(/,/g, "")) }))
      .filter(e => !isNaN(e.raw))
      .sort((a, b) => b.raw - a.raw)
      .slice(0, 8)
      .map(e => ({ label: e.label, value: e.raw, display: fmt(e.raw, hint) }));
    return { rankings: entries, topValue: entries[0]?.value || 0 };
  }, [data, card]);

  return (
    <div
      style={{
        background: UI.elevated,
        borderRadius: 16,
        padding: "20px 22px",
        borderLeft: `4px solid ${accent}`,
        boxShadow: "var(--color-shadow-soft)",
        display: "flex",
        flexDirection: "column",
        gap: 0,
        transition: "transform 0.18s, box-shadow 0.18s",
        cursor: "default",
        fontFamily: "'Manrope', sans-serif",
        border: `1px solid ${UI.border}`,
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: UI.textLight, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>
            {card.label}
          </div>
          <div style={{ fontSize: 11, color: UI.textLight, fontWeight: 500 }}>
            Top {rankings.length} ranking
          </div>
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: accent, letterSpacing: "-0.03em" }}>
          {fmt(rankings[0]?.value, hint)}
        </div>
      </div>

      <div style={{ height: 1, background: UI.borderStrong, marginBottom: 12 }} />

      {/* Rankings list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {rankings.map((item, i) => {
          const pct = topValue > 0 ? (item.value / topValue) * 100 : 0;
          const isMedal = i < 3;
          return (
            <div key={i}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Rank indicator */}
                <div style={{
                  width: 22, height: 22, borderRadius: 6,
                  background: isMedal ? accent : UI.border,
                  border: isMedal ? "none" : `1px solid ${UI.borderStrong}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: isMedal ? 11 : 10,
                  fontWeight: 800,
                  color: isMedal ? "#fff" : UI.textLight,
                  flexShrink: 0,
                }}>
                  {isMedal ? MEDALS[i] : i + 1}
                </div>

                {/* Label */}
                <div style={{
                  flex: 1,
                  fontSize: 12,
                  fontWeight: i === 0 ? 700 : 500,
                  color: i === 0 ? UI.text : UI.textLight,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {item.label}
                </div>

                {/* Value */}
                <div style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: i === 0 ? accent : UI.text,
                  flexShrink: 0,
                }}>
                  {item.display}
                </div>
              </div>
              <div style={{ paddingLeft: 30 }}>
                <RankBar pct={pct} accent={i === 0 ? accent : UI.borderStrong} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SummaryCards({ data, cards }) {
  if (!cards || cards.length === 0) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginBottom: 24 }}>
      {cards.map((card, idx) => (
        <SummaryCard key={card.id} card={card} data={data} accent={ACCENTS[idx % ACCENTS.length]} />
      ))}
    </div>
  );
}
