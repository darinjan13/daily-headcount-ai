import SummaryCards from "./SummaryCards";
import BarChartRenderer from "./BarChartRenderer";
import LineChartRenderer from "./LineChartRenderer";
import DonutChartRenderer from "./DonutChartRenderer";
import { useState } from "react";
import ChartBuilder from "./ChartBuilder";
import PivotTableRenderer from "./PivotTableRenderer";
import DataTable from "./DataTable";
import DataChatbot from "./DataChatBot";
import { LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";

function SectionHeader({ title, subtitle, badge }) {
  return (
    <div className="flex items-start justify-between mb-5">
      <div>
        <div className="flex items-center gap-2.5">
          <h3 className="text-base font-bold text-[var(--color-primary)] m-0">{title}</h3>
          {badge && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-bold tracking-wide ${
              badge === "AI"
                ? "bg-[rgba(4,98,65,0.08)] text-[var(--color-primary)]"
                : "bg-[rgba(255,179,71,0.16)] text-[#b56800]"
            }`}>
              {badge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-xs text-slate-500 mt-1 mb-0">{subtitle}</p>}
      </div>
    </div>
  );
}

const Section = ({ children, className = "", id }) => (
  <section id={id} className={`card-elevated p-6 mb-8 rounded-2xl ${className}`}>
    {children}
  </section>
);

// ── AI Dataset Summary Banner ──
function AIBanner({ summary }) {
  if (!summary) return null;
  return (
    <div id="summary" className="glass-panel border border-[rgba(4,98,65,0.15)] rounded-2xl px-5 py-4 mb-6 flex items-start gap-3">
      <span className="text-xl mt-0.5">🤖</span>
      <div>
        <div className="pill-badge mb-1">AI Analysis</div>
        <p className="text-sm text-[var(--color-ink)] m-0">{summary}</p>
      </div>
      <span className="ml-auto text-xs bg-[rgba(255,179,71,0.18)] text-[#b56800] px-2 py-0.5 rounded-full font-bold whitespace-nowrap self-start">
        AI Generated
      </span>
    </div>
  );
}

// ── Helpers ──────────────────────────────

function buildLabelMap(data, field) {
  const map = {};
  data.forEach((row) => {
    const raw = row[field];
    if (raw == null) return;
    const key = String(raw).trim().toLowerCase();  // case-insensitive key
    if (key && !map[key]) map[key] = String(raw).trim();  // keep first-seen casing as label
  });
  return map;
}

function normalizeKey(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === "" || s.toLowerCase() === "null") return null;
  return s.toLowerCase();  // always lowercase for grouping
}

function generatePivot(data, rowField, columnField, metric, aggregation) {
  const result = {};
  const columnSet = new Set();
  const rowLabelMap = buildLabelMap(data, rowField);
  const colLabelMap = columnField ? buildLabelMap(data, columnField) : {};

  data.forEach((row) => {
    const rowKey = normalizeKey(row[rowField]);
    const colRaw = columnField ? row[columnField] : "Value";
    const colKey = columnField ? normalizeKey(colRaw) : "Value";
    const value = Number(row[metric]) || 0;
    if (!rowKey || !colKey) return;
    columnSet.add(colKey);
    if (!result[rowKey]) result[rowKey] = {};
    if (!result[rowKey][colKey]) result[rowKey][colKey] = [];
    result[rowKey][colKey].push(value);
  });

  const columnKeys = Array.from(columnSet).sort();
  const columnLabels = columnField ? columnKeys.map((k) => colLabelMap[k] || k) : ["Value"];

  const pivotRows = Object.entries(result).map(([rowKey, colValues]) => {
    const label = rowLabelMap[rowKey] || rowKey;
    const rowObj = { [rowField]: label };
    let rowTotal = 0;
    columnKeys.forEach((colKey, idx) => {
      const colLabel = columnLabels[idx];
      const values = colValues[colKey] || [];
      let agg = 0;
      if (aggregation === "sum") agg = values.reduce((a, b) => a + b, 0);
      if (aggregation === "avg") agg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
      if (aggregation === "count") agg = values.length;
      rowObj[colLabel] = agg;
      rowTotal += agg;
    });
    rowObj["__rowTotal"] = rowTotal;
    return rowObj;
  });

  pivotRows.sort((a, b) => b["__rowTotal"] - a["__rowTotal"]);
  pivotRows.forEach((r) => delete r["__rowTotal"]);

  const totalRow = { [rowField]: "Grand Total" };
  columnLabels.forEach((col) => {
    const vals = pivotRows.map((r) => r[col] || 0);
    totalRow[col] = aggregation === "avg"
      ? vals.reduce((a, b) => a + b, 0) / (vals.length || 1)
      : vals.reduce((a, b) => a + b, 0);
  });

  return {
    columns: [rowField, ...columnLabels],
    rows: pivotRows,
    totalRow,
    hasColDim: !!columnField,  // tells renderer whether to show column totals
  };
}

function groupForBar(data, xField, yField, topN = 15) {
  const grouped = {};  // key → { label, value }
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

function analyticsToObjects(payload) {
  if (!payload) return [];
  return payload.rows.map((row) =>
    Object.fromEntries(payload.headers.map((h, i) => [h, row[i]]))
  );
}

function analyticsToPrebuiltPivot(payload, rowField, valueField) {
  if (!payload) return null;
  const rows = analyticsToObjects(payload);
  const pivotRows = rows.map((r) => ({ [rowField]: r[rowField], [valueField]: r[valueField] }));
  const totalRow = { [rowField]: "Grand Total", [valueField]: pivotRows.reduce((s, r) => s + (Number(r[valueField]) || 0), 0) };
  return { columns: [rowField, valueField], rows: pivotRows, totalRow, hasColDim: false };
}

function StaticSummaryCards({ cards }) {
  if (!cards || cards.length === 0) return null;

  const format = (value, hint) => {
    if (hint === "currency")
      return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
    if (hint === "percent") return `${Number(value).toFixed(1)}%`;
    const v = Number(value);
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(2)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v % 1 === 0 ? v.toLocaleString() : v.toFixed(2);
  };

  return (
    <div id="kpis" className="grid gap-4 mb-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
      {cards.map((card) => (
        <div
          key={card.id}
          className="card-elevated px-6 py-5 border-l-4 border-[var(--color-primary)] rounded-2xl hover:-translate-y-1 transition-transform cursor-default"
        >
          <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">{card.label}</div>
          <div className="text-3xl font-extrabold text-[var(--color-primary)] tracking-tight">{format(card.value, card.formatHint)}</div>
        </div>
      ))}
    </div>
  );
}

function SimpleLineChart({ data, xKey, yKey }) {
  const angle = data.length > 14 ? -45 : 0;
  const marginBottom = angle !== 0 ? 60 : 10;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: marginBottom }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey={xKey}
          tick={{ fontSize: 11, fill: "#6b7280" }}
          angle={angle}
          textAnchor={angle !== 0 ? "end" : "middle"}
          interval={data.length > 30 ? Math.floor(data.length / 15) : 0}
        />
        <YAxis tick={{ fontSize: 12, fill: "#6b7280" }} tickFormatter={(v) => v.toLocaleString()} />
        <Tooltip formatter={(v) => v.toLocaleString()} contentStyle={{ borderRadius: 8, border: "1px solid #e5e7eb", fontSize: 13 }} />
        <Line type="monotone" dataKey={yKey} stroke="#046241" strokeWidth={2.5} dot={{ fill: "#046241", r: data.length > 30 ? 2 : 4 }} activeDot={{ r: 6 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ── Main Dashboard ────────────────────────

export default function Dashboard({ data, blueprint }) {
  const { headers, rows } = data;
  const [customCharts, setCustomCharts] = useState([]);

  const isWide = blueprint.tableFormat === "wide";
  const analytics = blueprint.analytics || data.analytics || null;
  const aiGenerated = blueprint.aiGenerated || false;
  const datasetSummary = blueprint.datasetSummary || null;

  const objectData = rows
    .map((row) => Object.fromEntries(headers.map((h, i) => [h, row[i]])))
    .filter((row) =>
      !Object.values(row).some((value) => {
        if (!value) return false;
        const str = String(value).toLowerCase().trim();
        return str === "total" || str === "grand total" || str === "sub total" ||
          str === "overall" || str.startsWith("total ") || str.endsWith(" total");
      })
    );

  const removeCustom = (id) => setCustomCharts((prev) => prev.filter((c) => c.id !== id));

  const periodData = analytics ? analyticsToObjects(analytics.periodTotals) : [];
  const primaryCol = analytics?.primaryCol || "Entity";
  const valueCol = analytics?.valueCol || "Value";
  const periodCol = analytics?.periodCol || "Period";

  const primaryPivot = analytics?.primaryTotals
    ? analyticsToPrebuiltPivot(analytics.primaryTotals, primaryCol, valueCol)
    : null;
  const sectionPivot = analytics?.sectionTotals
    ? analyticsToPrebuiltPivot(analytics.sectionTotals, "Section", valueCol)
    : null;

  function buildLongPivot(pivotDef) {
    return generatePivot(objectData, pivotDef.rowDim, pivotDef.colDim || null, pivotDef.measure, pivotDef.aggregation || "sum");
  }

  return (
    <div className="px-1 sm:px-2 md:px-0 py-2 max-w-screen-2xl mx-auto" id="summary">

      {/* AI Dataset Summary Banner */}
      {aiGenerated && datasetSummary && <AIBanner summary={datasetSummary} />}

      {/* KPI Cards */}
      {isWide && blueprint.cards?.length > 0 && <StaticSummaryCards cards={blueprint.cards} />}
      {!isWide && <SummaryCards data={objectData} cards={blueprint.cards} />}

      {/* Custom Builder */}
      <Section id="builder">
        <SectionHeader title="Custom Builder" subtitle="Build your own chart or pivot table" />
        <ChartBuilder
          columns={headers}
          sampleData={objectData.slice(0, 50)}
          onGenerate={(config) => {
            let result;
            if (config.outputType === "pivot") {
              result = { id: Date.now(), type: "pivot", title: config.title, pivotData: generatePivot(objectData, config.rowGroup, config.columnGroup, config.metric, config.aggregation) };
            } else if (config.outputType === "bar") {
              result = { id: Date.now(), type: "bar", title: config.title, chartData: groupForBar(objectData, config.rowGroup, config.metric, config.topN) };
            } else if (config.outputType === "line") {
              result = { id: Date.now(), type: "line", title: config.title, config: { x: config.rowGroup, y: config.metric, aggregation: config.aggregation } };
            } else if (config.outputType === "donut") {
              result = { id: Date.now(), type: "donut", title: config.title, config: { x: config.rowGroup, y: config.metric, topN: config.topN } };
            }
            if (result) setCustomCharts((prev) => [result, ...prev]);
          }}
        />
      </Section>

      {/* Custom Chart Results */}
      {customCharts.length > 0 ? (
        <div id="custom">
          {customCharts.map((chart) => (
            <Section key={chart.id} className="border-l-4 border-[var(--color-primary)]">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-2.5">
                  <h3 className="text-base font-bold text-[var(--color-primary)] m-0">{chart.title}</h3>
                  <span className="text-xs bg-[rgba(255,179,71,0.18)] text-[#b56800] px-2 py-0.5 rounded-full font-bold">CUSTOM</span>
                </div>
                <button onClick={() => removeCustom(chart.id)} className="text-slate-300 hover:text-slate-500 text-lg bg-transparent border-none cursor-pointer px-1">✕</button>
              </div>
              {chart.type === "pivot" && <PivotTableRenderer data={chart.pivotData} />}
              {chart.type === "bar" && <BarChartRenderer data={chart.chartData} config={{ x: "name", y: "value" }} />}
              {chart.type === "line" && <LineChartRenderer data={objectData} config={chart.config} />}
              {chart.type === "donut" && <DonutChartRenderer data={objectData} config={chart.config} />}
            </Section>
          ))}
        </div>
      ) : (
        <div id="custom" className="mb-2" />
      )}

      {/* Raw Data Table */}
      <Section id="data-table">
        <SectionHeader
          title="Data Table"
          subtitle={`${rows.length.toLocaleString()} rows · ${headers.length} columns`}
          badge="RAW DATA"
        />
        <DataTable headers={headers} rows={rows} />
      </Section>

      {/* Divider */}
      <div className="relative my-2 mb-8" id="analytics">
        <div className="border-t-2 border-dashed border-[rgba(4,98,65,0.18)]" />
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 text-xs font-bold text-slate-400 uppercase tracking-widest whitespace-nowrap">
          Analytics
        </span>
      </div>

      {/* ── WIDE FORMAT: pre-computed analytics ── */}
      {isWide && (
        <>
          {periodData.length > 1 && (
            <Section>
              <SectionHeader title={`${valueCol} over Time`} subtitle="Totals per period across all records" badge="AUTO" />
              <SimpleLineChart data={periodData} xKey={periodCol} yKey={valueCol} />
            </Section>
          )}

          <div className={`grid gap-6 ${sectionPivot ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
            {primaryPivot && (
              <Section>
                <SectionHeader title={`${valueCol} by ${primaryCol}`} badge="AUTO" />
                <PivotTableRenderer data={primaryPivot} />
              </Section>
            )}
            {sectionPivot && (
              <Section>
                <SectionHeader title={`${valueCol} by Section`} badge="AUTO" />
                <PivotTableRenderer data={sectionPivot} />
              </Section>
            )}
          </div>
        </>
      )}

      {/* ── LONG FORMAT: AI-generated charts ── */}
      {!isWide && (
        <>
          {/* Charts — line, bar, donut all supported */}
          {blueprint.charts?.map((chart, idx) => (
            <Section key={chart.id} id={idx === 0 ? "kpis" : undefined}>
              <SectionHeader title={chart.title} badge={aiGenerated ? "AI" : "AUTO"} />
              {chart.type === "line" && <LineChartRenderer data={objectData} config={chart} />}
              {chart.type === "bar" && <BarChartRenderer data={groupForBar(objectData, chart.x, chart.y, 20)} config={{ x: "name", y: "value" }} />}
              {chart.type === "donut" && <DonutChartRenderer data={objectData} config={chart} />}
            </Section>
          ))}

          <div className={`grid gap-6 ${blueprint.pivots?.length > 1 ? "grid-cols-1 xl:grid-cols-2" : "grid-cols-1"}`}>
            {blueprint.pivots?.map((pivot, idx) => (
              <Section key={pivot.id} id={idx === 0 ? "builder" : undefined}>
                <SectionHeader title={pivot.title} badge={aiGenerated ? "AI" : "AUTO"} />
                <PivotTableRenderer data={buildLongPivot(pivot)} />
              </Section>
            ))}
          </div>
        </>
      )}

      {/* Floating Data Chatbot */}
      <div id="chatbot" />
      <DataChatbot headers={headers} rows={rows} blueprint={blueprint} />

    </div>
  );
}