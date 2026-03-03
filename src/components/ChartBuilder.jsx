import { useState } from "react";

const LW = { dark: "#133020", green: "#046241", saffron: "#FFB347", paper: "#f5eedb", salt: "#F9F7F7" };

function LWSelect({ label, value, onChange, children, optional }) {
  const [focused, setFocused] = useState(false);
  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9cafa4", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
        {label}{optional && <span style={{ color: "#d1d5db", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>(optional)</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} style={{
        padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${focused ? LW.green : "#e8e3d9"}`,
        fontSize: 13, color: LW.dark, background: "#ffffff", outline: "none", cursor: "pointer",
        fontFamily: "'Manrope', sans-serif", fontWeight: 500, minWidth: 140, transition: "border-color 0.2s",
      }}>
        {children}
      </select>
    </div>
  );
}

function inferColumnType(col, sampleData) {
  if (!sampleData || sampleData.length === 0) return "unknown";
  const values = sampleData.map(r => r[col]).filter(v => v != null && String(v).trim() !== "");
  if (values.length === 0) return "unknown";
  const numCount = values.filter(v => !isNaN(Number(v))).length;
  const dateCount = values.filter(v => { const d = new Date(v); return !isNaN(d.getTime()) && String(v).length >= 6; }).length;
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
  const [titleFocused, setTitleFocused] = useState(false);

  const colTypes = {};
  columns.forEach(col => { colTypes[col] = inferColumnType(col, sampleData); });
  const numericCols = columns.filter(c => colTypes[c] === "numeric");
  const categoryCols = columns.filter(c => colTypes[c] === "category");
  const dateCols = columns.filter(c => colTypes[c] === "date");
  const metricCols = aggregation === "count" ? columns : numericCols.length > 0 ? numericCols : columns;

  const handleOutputTypeChange = val => { setOutputType(val); setColumnGroup(""); setGroupBy(""); setMetric(""); setChartTitle(""); };
  const handleAggregationChange = val => { setAggregation(val); setMetric(""); };
  const lineNeedsDate = outputType === "line" && groupBy && colTypes[groupBy] !== "date";
  const canGenerate = groupBy && metric;

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end", fontFamily: "'Manrope', sans-serif" }}>
      <LWSelect label="Output type" value={outputType} onChange={handleOutputTypeChange}>
        <option value="pivot">Pivot Table</option>
        <option value="bar">Bar Chart</option>
        <option value="hbar">Horizontal Bar</option>
        <option value="line">Line Chart</option>
        <option value="donut">Donut Chart</option>
      </LWSelect>

      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9cafa4", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          {outputType === "line" ? "Date / X axis" : "Row / Group by"}
        </label>
        <select value={groupBy} onChange={e => setGroupBy(e.target.value)} style={{
          padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${lineNeedsDate ? "#fbbf24" : "#e8e3d9"}`,
          fontSize: 13, color: lineNeedsDate ? "#d97706" : LW.dark, background: "#ffffff",
          outline: "none", cursor: "pointer", fontFamily: "'Manrope', sans-serif", fontWeight: 500, minWidth: 140,
        }}>
          <option value="">Select column</option>
          {outputType === "line" && dateCols.length > 0 && <optgroup label="📅 Date columns">{dateCols.map(col => <option key={col} value={col}>{col}</option>)}</optgroup>}
          {outputType === "line" && categoryCols.length > 0 && <optgroup label="🏷 Category columns">{categoryCols.map(col => <option key={col} value={col}>{col}</option>)}</optgroup>}
          {outputType !== "line" && categoryCols.length > 0 && <optgroup label="🏷 Category columns">{categoryCols.map(col => <option key={col} value={col}>{col}</option>)}</optgroup>}
          {outputType !== "line" && dateCols.length > 0 && <optgroup label="📅 Date columns">{dateCols.map(col => <option key={col} value={col}>{col}</option>)}</optgroup>}
          {(categoryCols.length === 0 && dateCols.length === 0) && columns.map(col => <option key={col} value={col}>{col}</option>)}
        </select>
        {lineNeedsDate && <p style={{ color: "#d97706", fontSize: 11, marginTop: 4 }}>⚠ Line chart works best with a date column</p>}
      </div>

      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9cafa4", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          {outputType === "line" ? "Y axis / Metric" : "Metric"}
        </label>
        <select value={metric} onChange={e => setMetric(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid #e8e3d9", fontSize: 13, color: LW.dark, background: "#ffffff", outline: "none", cursor: "pointer", fontFamily: "'Manrope', sans-serif", fontWeight: 500, minWidth: 140 }}>
          <option value="">Select column</option>
          {aggregation === "count" ? columns.map(col => <option key={col} value={col}>{col}</option>) : (
            <>
              {numericCols.length > 0 && <optgroup label="🔢 Numeric columns">{numericCols.map(col => <option key={col} value={col}>{col}</option>)}</optgroup>}
              {numericCols.length === 0 && columns.map(col => <option key={col} value={col}>{col}</option>)}
            </>
          )}
        </select>
      </div>

      <LWSelect label="Aggregation" value={aggregation} onChange={handleAggregationChange}>
        <option value="sum">Sum</option>
        <option value="avg">Average</option>
        <option value="count">Count</option>
      </LWSelect>

      {outputType === "pivot" && (
        <LWSelect label="Column group" value={columnGroup} onChange={setColumnGroup} optional>
          <option value="">None</option>
          {categoryCols.map(col => <option key={col} value={col}>{col}</option>)}
        </LWSelect>
      )}

      {(outputType === "bar" || outputType === "hbar" || outputType === "donut") && (
        <LWSelect label="Top N" value={topN} onChange={v => setTopN(Number(v))}>
          {[5, 10, 15, 20, 30, 50].map(n => <option key={n} value={n}>Top {n}</option>)}
        </LWSelect>
      )}

      <div>
        <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "#9cafa4", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
          Title <span style={{ color: "#d1d5db", fontWeight: 400, textTransform: "none", letterSpacing: 0, marginLeft: 4 }}>(optional)</span>
        </label>
        <input value={chartTitle} onChange={e => setChartTitle(e.target.value)}
          onFocus={() => setTitleFocused(true)} onBlur={() => setTitleFocused(false)}
          placeholder={groupBy && metric ? `${metric} by ${groupBy}` : "Auto"}
          style={{
            padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${titleFocused ? LW.green : "#e8e3d9"}`,
            fontSize: 13, color: LW.dark, background: "#ffffff", outline: "none",
            fontFamily: "'Manrope', sans-serif", minWidth: 176, transition: "border-color 0.2s",
          }} />
      </div>

      <button onClick={() => {
        if (!canGenerate) return;
        onGenerate({ rowGroup: groupBy, columnGroup, metric, aggregation, outputType, topN, title: chartTitle.trim() || `${metric} by ${groupBy}` });
      }} style={{
        padding: "9px 20px", borderRadius: 8, border: "none",
        background: canGenerate ? LW.dark : "#e8e3d9",
        color: canGenerate ? "#ffffff" : "#9cafa4",
        fontSize: 13, fontWeight: 700, cursor: canGenerate ? "pointer" : "not-allowed",
        fontFamily: "'Manrope', sans-serif", transition: "background 0.2s",
        letterSpacing: "0.02em",
      }}
        onMouseEnter={e => { if (canGenerate) e.currentTarget.style.background = LW.green; }}
        onMouseLeave={e => { if (canGenerate) e.currentTarget.style.background = LW.dark; }}
      >
        Generate →
      </button>
    </div>
  );
}