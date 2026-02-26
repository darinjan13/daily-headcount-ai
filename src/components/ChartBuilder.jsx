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

function inferColumnType(col, sampleData) {
  if (!sampleData || sampleData.length === 0) return "unknown";
  const values = sampleData.map((r) => r[col]).filter((v) => v != null && String(v).trim() !== "");
  if (values.length === 0) return "unknown";

  const numCount = values.filter((v) => !isNaN(Number(v))).length;
  const dateCount = values.filter((v) => {
    const d = new Date(v);
    return !isNaN(d.getTime()) && String(v).length >= 6;
  }).length;

  const ratio = values.length;
  if (dateCount / ratio >= 0.7) return "date";
  if (numCount / ratio >= 0.7) return "numeric";
  return "category";
}

export default function ChartBuilder({ columns, onGenerate, sampleData = [] }) {
  const [groupBy, setGroupBy] = useState("");
  const [metric, setMetric] = useState("");
  const [aggregation, setAggregation] = useState("sum");
  const [columnGroup, setColumnGroup] = useState("");
  const [outputType, setOutputType] = useState("pivot");
  const [topN, setTopN] = useState(15);
  const [chartTitle, setChartTitle] = useState("");

  // Infer column types from sample data
  const colTypes = {};
  columns.forEach((col) => {
    colTypes[col] = inferColumnType(col, sampleData);
  });

  const numericCols = columns.filter((c) => colTypes[c] === "numeric");
  const categoryCols = columns.filter((c) => colTypes[c] === "category");
  const dateCols = columns.filter((c) => colTypes[c] === "date");

  // What columns make sense as "Group By" depends on output type
  const groupByCols = outputType === "line"
    ? [...dateCols, ...categoryCols]   // line: prefer date cols first
    : [...categoryCols, ...dateCols];  // others: categories first

  // Metric cols: numeric always; for count aggregation allow any column
  const metricCols = aggregation === "count" ? columns : numericCols.length > 0 ? numericCols : columns;

  // Reset dependent fields when output type changes
  const handleOutputTypeChange = (val) => {
    setOutputType(val);
    setColumnGroup("");  // reset cross-tab
    setGroupBy("");
    setMetric("");
    setChartTitle("");
  };

  // Reset metric when aggregation changes to/from count
  const handleAggregationChange = (val) => {
    setAggregation(val);
    setMetric("");
  };

  const showTopN = outputType === "bar" || outputType === "donut";
  const showColumnGroup = outputType === "pivot";
  const showAggregation = true;

  const canGenerate = groupBy && metric;

  // Validation hints
  const lineNeedsDate = outputType === "line" && groupBy && colTypes[groupBy] !== "date";

  return (
    <div className="flex flex-wrap gap-3 items-end">

      {/* Output Type first — drives everything else */}
      <Select label="Output Type" value={outputType} onChange={handleOutputTypeChange}>
        <option value="pivot">Pivot Table</option>
        <option value="bar">Bar Chart</option>
        <option value="line">Line Chart</option>
        <option value="donut">Donut Chart</option>
      </Select>

      {/* Group By */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          {outputType === "line" ? "Date / X Axis" : "Row / Group By"}
        </label>
        <select
          value={groupBy}
          onChange={(e) => setGroupBy(e.target.value)}
          className={`px-3 py-2 rounded-lg border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-36 ${
            lineNeedsDate ? "border-orange-300 text-orange-600" : "border-gray-200 text-gray-700"
          }`}
        >
          <option value="">Select column</option>
          {outputType === "line" && dateCols.length > 0 && (
            <optgroup label="📅 Date columns">
              {dateCols.map((col) => <option key={col} value={col}>{col}</option>)}
            </optgroup>
          )}
          {outputType === "line" && categoryCols.length > 0 && (
            <optgroup label="🏷 Category columns">
              {categoryCols.map((col) => <option key={col} value={col}>{col}</option>)}
            </optgroup>
          )}
          {outputType !== "line" && categoryCols.length > 0 && (
            <optgroup label="🏷 Category columns">
              {categoryCols.map((col) => <option key={col} value={col}>{col}</option>)}
            </optgroup>
          )}
          {outputType !== "line" && dateCols.length > 0 && (
            <optgroup label="📅 Date columns">
              {dateCols.map((col) => <option key={col} value={col}>{col}</option>)}
            </optgroup>
          )}
          {groupByCols.length === 0 && columns.map((col) => <option key={col} value={col}>{col}</option>)}
        </select>
        {lineNeedsDate && (
          <p className="text-orange-500 text-xs mt-1">⚠ Line chart works best with a date column</p>
        )}
      </div>

      {/* Metric */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          {outputType === "line" ? "Y Axis / Metric" : "Metric"}
        </label>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400 min-w-36"
        >
          <option value="">Select column</option>
          {aggregation === "count" ? (
            columns.map((col) => <option key={col} value={col}>{col}</option>)
          ) : (
            <>
              {numericCols.length > 0 && (
                <optgroup label="🔢 Numeric columns">
                  {numericCols.map((col) => <option key={col} value={col}>{col}</option>)}
                </optgroup>
              )}
              {numericCols.length === 0 && columns.map((col) => <option key={col} value={col}>{col}</option>)}
            </>
          )}
        </select>
      </div>

      {/* Aggregation */}
      <Select label="Aggregation" value={aggregation} onChange={handleAggregationChange}>
        <option value="sum">Sum</option>
        <option value="avg">Average</option>
        <option value="count">Count</option>
      </Select>

      {/* Column Group — pivot only */}
      {showColumnGroup && (
        <Select label="Column Group" value={columnGroup} onChange={setColumnGroup} optional>
          <option value="">None</option>
          {categoryCols.map((col) => <option key={col} value={col}>{col}</option>)}
        </Select>
      )}

      {/* Top N — bar and donut */}
      {showTopN && (
        <Select label="Top N" value={topN} onChange={(v) => setTopN(Number(v))}>
          {[5, 10, 15, 20, 30, 50].map((n) => <option key={n} value={n}>Top {n}</option>)}
        </Select>
      )}

      {/* Chart Title */}
      <div>
        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">
          Title <span className="text-gray-300 font-normal normal-case tracking-normal ml-1">(optional)</span>
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
            rowGroup: groupBy,
            columnGroup,
            metric,
            aggregation,
            outputType,
            topN,
            title: chartTitle.trim() || `${metric} by ${groupBy}`,
          });
        }}
        className={`px-5 py-2 rounded-lg text-white text-sm font-bold tracking-wide transition-colors h-9 ${
          canGenerate ? "bg-emerald-700 hover:bg-emerald-800 cursor-pointer" : "bg-gray-300 cursor-not-allowed"
        }`}
      >
        Generate
      </button>
    </div>
  );
}