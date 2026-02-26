import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

function parseDate(val) {
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function groupByPeriod(data, xField, yField, period = "month") {
  const grouped = {};
  data.forEach((row) => {
    const d = parseDate(row[xField]);
    if (!d) return;
    const value = Number(row[yField]) || 0;
    let key;
    if (period === "month") key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    else if (period === "quarter") key = `${d.getFullYear()} Q${Math.floor(d.getMonth() / 3) + 1}`;
    else key = String(d.getFullYear());
    grouped[key] = (grouped[key] || 0) + value;
  });
  return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => ({ name, value }));
}

export default function LineChartRenderer({ data, config }) {
  if (!config) return null;

  const dates = data.map((r) => parseDate(r[config.x])).filter(Boolean);
  let period = "month";
  if (dates.length > 0) {
    const min = new Date(Math.min(...dates));
    const max = new Date(Math.max(...dates));
    const months = (max.getFullYear() - min.getFullYear()) * 12 + (max.getMonth() - min.getMonth());
    if (months > 36) period = "quarter";
    if (months > 72) period = "year";
  }

  const chartData = groupByPeriod(data, config.x, config.y, period);

  if (chartData.length === 0)
    return <p className="text-gray-400 text-sm">No date data available.</p>;

  return (
    <ResponsiveContainer width="100%" height={320}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#6b7280" }} />
        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v) => v.toLocaleString()} />
        <Tooltip
          formatter={(v) => v.toLocaleString()}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
        />
        <Line type="monotone" dataKey="value" stroke="#046241" strokeWidth={2.5} dot={{ fill: "#046241", r: 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}