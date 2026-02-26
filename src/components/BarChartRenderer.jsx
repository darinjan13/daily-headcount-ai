import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#046241", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

export default function BarChartRenderer({ data, config }) {
  if (!data || data.length === 0)
    return <p className="text-gray-400 text-sm">No data available.</p>;

  const xKey = config?.x || "name";
  const yKey = config?.y || "value";

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          angle={-35}
          textAnchor="end"
          interval={0}
        />
        <YAxis
          tick={{ fontSize: 12, fill: "#6b7280" }}
          tickFormatter={(v) => v.toLocaleString()}
        />
        <Tooltip
          formatter={(v) => v.toLocaleString()}
          contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }}
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