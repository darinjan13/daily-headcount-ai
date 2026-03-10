import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#046241", "#133020", "#2F6A4D", "#3C7A5A", "#548E71", "#6EA186", "#FFB347"];

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
          cy="50%"
          innerRadius={75}
          outerRadius={120}
          paddingAngle={3}
          dataKey="value"
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => [v.toLocaleString(), `${((v / total) * 100).toFixed(1)}%`]}
          contentStyle={{ borderRadius: 8, border: "1px solid var(--color-border)", fontSize: 13, backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text)" }}
          labelStyle={{ color: "var(--color-text)" }}
          itemStyle={{ color: "var(--color-text)" }}
        />
        <Legend
          formatter={(value) => <span style={{ fontSize: 12, color: "var(--color-text)" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
