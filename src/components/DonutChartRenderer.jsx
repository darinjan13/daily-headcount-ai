import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";

const COLORS = ["#FFB347", "#046241", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0", "#d1fae5"];

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
    return <p className="text-gray-400 text-sm">No data available.</p>;

  const total = chartData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {chartData.slice(0, 8).map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[rgba(4,98,65,0.06)] text-[var(--color-primary)] text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
            {item.name}
          </span>
        ))}
      </div>
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
            isAnimationActive
            animationDuration={260}
          >
            {chartData.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => [v.toLocaleString(), `${((v / total) * 100).toFixed(1)}%`]}
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)" }}
          />
          <Legend
            formatter={(value) => <span style={{ fontSize: 12, color: "#48665b" }}>{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}