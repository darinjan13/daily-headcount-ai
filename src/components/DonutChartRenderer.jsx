import { useState } from "react";

const Select = ({ label, value, onChange, children, optional }) => (
  <div>
    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
      {label}{optional && <span className="text-gray-300 font-normal normal-case tracking-normal ml-1">(optional)</span>}
    </label>
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-36"
    >
      {children}
    </select>
  </div>
);

export default function ChartBuilder({ columns, onGenerate }) {
  const [groupBy, setGroupBy] = useState("");
  const [metric, setMetric] = useState("");
  const [aggregation, setAggregation] = useState("sum");
  const [columnGroup, setColumnGroup] = useState("");
  const [outputType, setOutputType] = useState("pivot");
  const [topN, setTopN] = useState(15);
  const [chartTitle, setChartTitle] = useState("");

  const canGenerate = groupBy && metric;
  const showTopN = outputType === "bar" || outputType === "line";
  const showColumnGroup = outputType === "pivot";

  return (
    <div className="flex flex-wrap gap-3 items-end">
      <Select label="Row / Group By" value={groupBy} onChange={setGroupBy}>
        <option value="">Select column</option>
        {columns.map((col) => <option key={col}>{col}</option>)}
      </Select>

      <Select label="Metric" value={metric} onChange={setMetric}>
        <option value="">Select column</option>
        {columns.map((col) => <option key={col}>{col}</option>)}
      </Select>

      <Select label="Aggregation" value={aggregation} onChange={setAggregation}>
        <option value="sum">Sum</option>
        <option value="avg">Average</option>
        <option value="count">Count</option>
      </Select>

      {showColumnGroup && (
        <Select label="Column Group" value={columnGroup} onChange={setColumnGroup} optional>
          <option value="">None</option>
          {columns.map((col) => <option key={col}>{col}</option>)}
        </Select>
      )}

      <Select label="Output Type" value={outputType} onChange={setOutputType}>
        <option value="pivot">Pivot Table</option>
        <option value="bar">Bar Chart</option>
        <option value="line">Line Chart</option>
        <option value="donut">Donut Chart</option>
      </Select>

      {showTopN && (
        <Select label="Top N" value={topN} onChange={(v) => setTopN(Number(v))}>
          {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </Select>
      )}

      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          Chart Title <span className="text-gray-300 font-normal normal-case tracking-normal ml-1">(optional)</span>
        </label>
        <input
          value={chartTitle}
          onChange={(e) => setChartTitle(e.target.value)}
          placeholder={groupBy && metric ? `${metric} by ${groupBy}` : "Auto"}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-44"
        />
      </div>

      <button
        onClick={() => {
          if (!canGenerate) return;
          onGenerate({
            rowGroup: groupBy, columnGroup, metric, aggregation,
            outputType, topN,
            title: chartTitle.trim() || `${metric} by ${groupBy}`,
          });
        }}
        className={`px-5 py-2 rounded-lg text-white text-sm font-bold tracking-wide transition-colors h-9 ${canGenerate ? "bg-emerald-700 hover:bg-emerald-800 cursor-pointer" : "bg-gray-300 cursor-not-allowed"}`}
      >
        Generate
      </button>
    </div>
  );
}