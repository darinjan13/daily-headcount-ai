import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";

const COLORS = ["#FFB347", "#046241", "#059669", "#10b981", "#34d399", "#6ee7b7", "#a7f3d0"];

export default function BarChartRenderer({ data, config }) {
  if (!data || data.length === 0)
    return <p className="text-gray-400 text-sm">No data available.</p>;

  const xKey = config?.x || "name";
  const yKey = config?.y || "value";

  const legendItems = data.slice(0, Math.min(6, data.length));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {legendItems.map((item, idx) => (
          <span key={idx} className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-[rgba(4,98,65,0.06)] text-[var(--color-primary)] text-xs font-semibold">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS[idx % COLORS.length] }} />
            {item[xKey]}
          </span>
        ))}
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fontSize: 11, fill: "#48665b" }}
            angle={-35}
            textAnchor="end"
            interval={0}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "#48665b" }}
            tickFormatter={(v) => v.toLocaleString()}
          />
          <Tooltip
            formatter={(v) => v.toLocaleString()}
            contentStyle={{ borderRadius: 12, border: "1px solid #e5e7eb", fontSize: 13, background: "rgba(255,255,255,0.94)", backdropFilter: "blur(8px)" }}
          />
          <Bar dataKey={yKey} radius={[6, 6, 0, 0]} isAnimationActive animationDuration={260}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}