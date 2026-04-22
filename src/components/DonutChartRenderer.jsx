import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = [
  "#0f9d71",
  "#12c48b",
  "#7be3b3",
  "#ffca6e",
  "#fb923c",
  "#60a5fa",
  "#a78bfa",
  "#0b6b4a",
];

function groupData(data, xField, yField, topN = 10) {
  const grouped = {};   // key → { label, value }
  data.forEach((row) => {
    const raw = row[xField] != null ? String(row[xField]).trim() : null;
    if (!raw) return;
    const key = raw.toLowerCase();
    if (!grouped[key]) grouped[key] = { label: raw, value: 0 };
    grouped[key].value += Number(row[yField]) || 0;
  });
  return Object.values(grouped)
    .map(({ label, value }) => ({ name: label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, topN);
}

export default function DonutChartRenderer({ data, config }) {
  if (!config) return null;

  const chartData = groupData(data, config.x, config.y, config.topN || 10);

  if (chartData.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No data available.</p>;

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <ResponsiveContainer width="100%" height={320}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="48%"
          innerRadius={72}
          outerRadius={112}
          paddingAngle={4}
          cornerRadius={9}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [v.toLocaleString(), `${((v / total) * 100).toFixed(1)}%`]}
          contentStyle={{ borderRadius: 14, border: "1px solid rgba(255,255,255,0.18)", fontSize: 12, backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text)", boxShadow: "0 18px 44px rgba(0,0,0,0.22)", backdropFilter: "blur(14px)" }}
          labelStyle={{ color: "var(--color-text)" }}
          itemStyle={{ color: "var(--color-text)" }}
        />
        <Legend
          iconType="circle"
          formatter={(value) => <span style={{ fontSize: 12, color: "var(--color-text)" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
