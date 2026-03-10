import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function detectPeriod(dates) {
  if (dates.length < 2) return "day";
  const min = new Date(Math.min(...dates));
  const max = new Date(Math.max(...dates));
  const days = (max - min) / (1000 * 60 * 60 * 24);
  if (days <= 60) return "day";
  if (days <= 365 * 3) return "month";
  if (days <= 365 * 6) return "quarter";
  return "year";
}

function formatKey(d, period) {
  const pad = (n) => String(n).padStart(2, "0");
  if (period === "day")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (period === "month")
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  if (period === "quarter")
    return `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
  return String(d.getFullYear());
}

function formatLabel(key, period) {
  if (period === "day") {
    const [y, m, dd] = key.split("-");
    const d = new Date(Number(y), Number(m) - 1, Number(dd));
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return key;
}

function groupByPeriod(data, xField, yField, period) {
  const grouped = {};
  data.forEach((row) => {
    const d = parseDate(row[xField]);
    if (!d) return;
    const value = Number(row[yField]) || 0;
    const key = formatKey(d, period);
    grouped[key] = (grouped[key] || 0) + value;
  });
  return Object.entries(grouped)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => ({ name: formatLabel(key, period), value }));
}

export default function LineChartRenderer({ data, config }) {
  if (!config) return null;

  const dates = data.map((r) => parseDate(r[config.x])).filter(Boolean);

  if (dates.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No date data available.</p>;

  const period = detectPeriod(dates);
  const chartData = groupByPeriod(data, config.x, config.y, period);

  if (chartData.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No data to display.</p>;

  const angle = chartData.length > 14 ? -45 : 0;
  const marginBottom = angle !== 0 ? 60 : 10;

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: marginBottom }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grid)" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: "var(--color-chart-axis)" }}
          angle={angle}
          textAnchor={angle !== 0 ? "end" : "middle"}
          interval={chartData.length > 30 ? Math.floor(chartData.length / 15) : 0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "var(--color-chart-axis)" }}
          tickFormatter={(v) => v.toLocaleString()}
        />
        <Tooltip
          formatter={(v) => v.toLocaleString()}
          contentStyle={{
            borderRadius: 8,
            border: "1px solid var(--color-border)",
            fontSize: 13,
            backgroundColor: "var(--color-surface-elevated)",
            color: "var(--color-text)",
          }}
          labelStyle={{ color: "var(--color-text)" }}
          itemStyle={{ color: "var(--color-text)" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="var(--color-chart-line-primary)"
          strokeWidth={2.5}
          dot={{ fill: "var(--color-chart-line-primary)", r: chartData.length > 30 ? 2 : 4 }}
          activeDot={{ r: 6, fill: "#FFB347", stroke: "var(--color-chart-line-primary)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
