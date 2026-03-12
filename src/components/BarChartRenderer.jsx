import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const COLORS = [
  "var(--color-chart-1, #0f9d71)",
  "var(--color-chart-2, #1c4732)",
  "var(--color-chart-3, #2f6a4d)",
  "var(--color-chart-4, #3c7a5a)",
  "var(--color-chart-5, #6ea186)",
  "var(--color-chart-6, #ffb347)",
];

export default function BarChartRenderer({ data, config }) {
  if (!data || data.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No data available.</p>;

  const xKey = config?.x || "name";
  const yKey = config?.y || "value";

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--color-chart-axis)" }}
          tickFormatter={(v) => v.toLocaleString()}
        />
        <Tooltip
          formatter={(v) => v.toLocaleString()}
          contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text)" }}
          labelStyle={{ color: "var(--color-text)" }}
          itemStyle={{ color: "var(--color-text)" }}
        />
        <Bar dataKey={yKey} radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
