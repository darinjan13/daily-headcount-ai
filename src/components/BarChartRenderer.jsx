import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const COLORS = [
  ["#0f9d71", "#06452f"],
  ["#12c48b", "#046241"],
  ["#7be3b3", "#0f9d71"],
  ["#ffca6e", "#f59e0b"],
  ["#fb923c", "#c2410c"],
  ["#60a5fa", "#2563eb"],
];

function getAxisInterval(length, maxTicks = 8) {
  if (!length || length <= maxTicks) return 0;
  return Math.max(0, Math.ceil(length / maxTicks) - 1);
}

function formatCompactNumber(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return value;
  if (Math.abs(number) >= 10000) {
    return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(number);
  }
  return number.toLocaleString();
}

function formatAxisLabel(value, maxLength = 14) {
  const raw = value == null ? "" : String(value);
  const parsed = new Date(raw);
  const label = !Number.isNaN(parsed.getTime()) && /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(raw)
    ? parsed.toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : raw;
  return label.length > maxLength ? `${label.slice(0, maxLength - 1)}…` : label;
}

export default function BarChartRenderer({ data, config }) {
  if (!data || data.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No data available.</p>;

  const xKey = config?.x || "name";
  const yKey = config?.y || "value";
  const angled = data.length > 8;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 12, right: 18, left: 4, bottom: angled ? 44 : 20 }}>
        <defs>
          {COLORS.map(([start, end], index) => (
            <linearGradient key={index} id={`rendererPremiumBar${index}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={start} stopOpacity={0.98} />
              <stop offset="100%" stopColor={end} stopOpacity={0.88} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="4 8" stroke="var(--color-grid)" vertical={false} opacity={0.55} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 10, fill: "var(--color-chart-axis)" }}
          angle={angled ? -28 : 0}
          textAnchor={angled ? "end" : "middle"}
          interval={getAxisInterval(data.length, 8)}
          minTickGap={18}
          tickFormatter={formatAxisLabel}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
          tickFormatter={formatCompactNumber}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={formatCompactNumber}
          contentStyle={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", fontSize: 12, backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text)", boxShadow: "0 18px 44px rgba(0,0,0,0.22)", backdropFilter: "blur(14px)" }}
          labelStyle={{ color: "var(--color-text)" }}
          itemStyle={{ color: "var(--color-text)" }}
        />
        <Bar dataKey={yKey} radius={[8, 8, 0, 0]} maxBarSize={38} isAnimationActive={false} activeBar={false}>
          {data.map((_, i) => (
            <Cell key={i} fill={`url(#rendererPremiumBar${i % COLORS.length})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
