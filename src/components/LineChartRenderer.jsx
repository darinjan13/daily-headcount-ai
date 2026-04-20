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

export default function LineChartRenderer({ data, config }) {
  if (!config) return null;

  const dates = data.map((r) => parseDate(r[config.x])).filter(Boolean);

  if (dates.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No date data available.</p>;

  const period = detectPeriod(dates);
  const chartData = groupByPeriod(data, config.x, config.y, period);

  if (chartData.length === 0)
    return <p className="text-sm" style={{ color: "var(--color-text-light)" }}>No data to display.</p>;

  const angle = chartData.length > 12 ? -24 : 0;
  const marginBottom = angle !== 0 ? 42 : 16;

  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={chartData} margin={{ top: 14, right: 20, left: 4, bottom: marginBottom }}>
        <defs>
          <linearGradient id="premiumLineStroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#ffca6e" />
            <stop offset="55%" stopColor="#ffb347" />
            <stop offset="100%" stopColor="#f97316" />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="4 8" stroke="var(--color-grid)" vertical={false} opacity={0.55} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10, fill: "var(--color-chart-axis)" }}
          angle={angle}
          textAnchor={angle !== 0 ? "end" : "middle"}
          interval={getAxisInterval(chartData.length, 8)}
          minTickGap={18}
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
          contentStyle={{
            borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.18)",
            fontSize: 12,
            backgroundColor: "var(--color-surface-elevated)",
            color: "var(--color-text)",
            boxShadow: "0 18px 44px rgba(0,0,0,0.22)",
            backdropFilter: "blur(14px)",
          }}
          labelStyle={{ color: "var(--color-text)" }}
          itemStyle={{ color: "var(--color-text)" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke="url(#premiumLineStroke)"
          strokeWidth={3}
          dot={{ fill: "var(--color-chart-accent, #ffb347)", r: chartData.length > 24 ? 0 : 3, strokeWidth: 0 }}
          activeDot={{ r: 6, fill: "var(--color-chart-accent, #ffb347)", stroke: "var(--color-chart-line-primary, #0f9d71)", strokeWidth: 2 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
