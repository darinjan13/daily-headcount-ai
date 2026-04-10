import SummaryCards from "./SummaryCards";
import BarChartRenderer from "./BarChartRenderer";
import LineChartRenderer from "./LineChartRenderer";
import DonutChartRenderer from "./DonutChartRenderer";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import ChartBuilder from "./ChartBuilder";
import PivotTableRenderer from "./PivotTableRenderer";
import DataTable from "./DataTable";
import DataChatbot from "./DataChatBot";
import { useAuth } from "../context/AuthContext";
import { usePins } from "../hooks/usePins";
import { Grip, PencilLine, Sparkles } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  ResponsiveContainer, Cell, AreaChart, Area,
} from "recharts";

const LW = { dark:"var(--color-text)", green:"#046241", saffron:"#FFB347", yellow:"#FFC370", paper:"var(--color-surface)", salt:"var(--color-surface-soft)" };
const UI = {
  surface: "var(--color-surface)",
  surfaceElevated: "var(--color-surface-elevated)",
  surfaceSoft: "var(--color-surface-soft)",
  border: "var(--color-border)",
  text: "var(--color-text)",
  textLight: "var(--color-text-light)",
};
const CHART_THEME = {
  grid: "var(--color-grid)",
  axis: "var(--color-chart-axis)",
  tooltipBorder: "var(--color-border)",
  tooltipBg: "var(--color-surface-elevated)",
  tooltipText: "var(--color-text)",
};
const CHART_COLORS = ["#046241","#059669","#10b981","#34d399","#6ee7b7","#a7f3d0","#FFB347","#f97316","#3b82f6","#8b5cf6"];
const CMP = { a:"#046241", b:"#FFB347" };

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDateValue(v) { if(!v)return null; const d=new Date(v); return isNaN(d.getTime())?null:d; }
function toDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function formatDateLabel(k) { const d=new Date(`${k}T00:00:00`); return isNaN(d.getTime())?k:d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}); }
function formatMonthLabel(k) { const d=new Date(`${k}T00:00:00`); return isNaN(d.getTime())?k:d.toLocaleDateString("en-US",{year:"numeric",month:"long"}); }

function detectDateColumn(headers, rows, isWide, dateCols) {
  // Wide format files use dates as column headers — no row-level date filter applies
  if (isWide) return null;
  const dateColSet = new Set(dateCols || []);
  const priority = headers.filter(h => /date|day|time|period/i.test(String(h)) && !dateColSet.has(h));
  const rest = headers.filter(h => !priority.includes(h) && !dateColSet.has(h));
  const ordered = [...priority, ...rest];
  for (const col of ordered) {
    const vals = rows.slice(0,80).map(r=>r[col]).filter(Boolean);
    if (vals.length < 3) continue;
    if (vals.filter(v=>!!parseDateValue(v)).length/vals.length >= 0.7) return col;
  }
  return null;
}

function detectCategoryColumns(headers, rows, dateCol) {
  return headers.filter(col => {
    if (col === dateCol) return false;
    const vals = rows.slice(0,50).map(r=>r[col]).filter(v=>v!=null&&String(v).trim()!=="");
    if (!vals.length) return false;
    if (vals.filter(v=>!isNaN(Number(v))).length/vals.length > 0.7) return false;
    const unique = new Set(vals.map(v=>String(v).trim().toLowerCase()));
    return unique.size >= 2 && unique.size <= 30;
  });
}

function formatNum(v, hint) {
  if (hint==="currency") return new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
  if (hint==="percent") return `${Number(v).toFixed(1)}%`;
  if (hint==="percent_decimal") return `${(Number(v)*100).toFixed(1)}%`;
  const n=Number(v);
  if (n>=1_000_000) return `${(n/1_000_000).toFixed(2)}M`;
  if (n>=1_000) return `${(n/1_000).toFixed(1)}K`;
  return n%1===0?n.toLocaleString():n.toFixed(2);
}

function buildLabelMap(data, field) {
  const map={};
  data.forEach(row=>{ const raw=row[field]; if(raw==null)return; const k=String(raw).trim().toLowerCase(); if(k&&!map[k])map[k]=String(raw).trim(); });
  return map;
}

function generatePivot(data, rowField, columnField, metric, aggregation) {
  const result={}, columnSet=new Set();
  const rowLabelMap=buildLabelMap(data,rowField);
  const colLabelMap=columnField?buildLabelMap(data,columnField):{};
  data.forEach(row=>{
    const rowKey=row[rowField]!=null?String(row[rowField]).trim().toLowerCase():null;
    const colRaw=columnField?row[columnField]:(metric||"Value");
    const colKey=columnField?(colRaw!=null?String(colRaw).trim().toLowerCase():null):(metric||"Value");
    const value=Number(row[metric])||0;
    if(!rowKey||!colKey)return;
    columnSet.add(colKey);
    if(!result[rowKey])result[rowKey]={};
    if(!result[rowKey][colKey])result[rowKey][colKey]=[];
    result[rowKey][colKey].push(value);
  });
  const columnKeys=Array.from(columnSet).sort();
  const columnLabels=columnField?columnKeys.map(k=>colLabelMap[k]||k):[metric||"Value"];
  const pivotRows=Object.entries(result).map(([rowKey,colValues])=>{
    const label=rowLabelMap[rowKey]||rowKey;
    const rowObj={[rowField]:label};
    let rowTotal=0;
    columnKeys.forEach((colKey,idx)=>{
      const colLabel=columnLabels[idx];
      const values=colValues[colKey]||[];
      let agg=0;
      if(aggregation==="sum")agg=values.reduce((a,b)=>a+b,0);
      if(aggregation==="avg")agg=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
      if(aggregation==="count")agg=values.length;
      rowObj[colLabel]=agg; rowTotal+=agg;
    });
    rowObj.__rowTotal=rowTotal; return rowObj;
  });
  pivotRows.sort((a,b)=>b.__rowTotal-a.__rowTotal);
  pivotRows.forEach(r=>delete r.__rowTotal);
  const totalRow={[rowField]:"Grand Total"};
  columnLabels.forEach(col=>{
    const vals=pivotRows.map(r=>r[col]||0);
    totalRow[col]=aggregation==="avg"?vals.reduce((a,b)=>a+b,0)/(vals.length||1):vals.reduce((a,b)=>a+b,0);
  });
  return{columns:[rowField,...columnLabels],rows:pivotRows,totalRow,hasColDim:!!columnField};
}

function groupForBar(data, xField, yField, topN=15, aggregation="sum") {
  const grouped={};
  data.forEach(row=>{
    const raw=row[xField]!=null?String(row[xField]).trim():null;
    if(!raw)return;
    const k=raw.toLowerCase();
    if(!grouped[k])grouped[k]={label:raw,values:[]};
    const n=Number(row[yField]);
    if(!isNaN(n))grouped[k].values.push(n);
  });
  return Object.values(grouped).map(({label,values})=>{
    let value=0;
    if(aggregation==="count")value=values.length;
    else if(aggregation==="avg")value=values.length?values.reduce((a,b)=>a+b,0)/values.length:0;
    else value=values.reduce((a,b)=>a+b,0);
    return{name:label,value:Math.round(value*100)/100};
  }).sort((a,b)=>b.value-a.value).slice(0,topN);
}

function analyticsToObjects(payload) {
  if(!payload)return[];
  return payload.rows.map(row=>Object.fromEntries(payload.headers.map((h,i)=>[h,row[i]])));
}
function analyticsToPrebuiltPivot(payload, rowField, valueField) {
  if(!payload)return null;
  const rows=analyticsToObjects(payload);
  const pivotRows=rows.map(r=>({[rowField]:r[rowField],[valueField]:r[valueField]}));
  const totalRow={[rowField]:"Grand Total",[valueField]:pivotRows.reduce((s,r)=>s+(Number(r[valueField])||0),0)};
  return{columns:[rowField,valueField],rows:pivotRows,totalRow,hasColDim:false};
}

function getWeekRange(dateKey) {
  const d=new Date(`${dateKey}T00:00:00`); const day=d.getDay();
  const start=new Date(d); start.setDate(d.getDate()-day);
  const end=new Date(d); end.setDate(d.getDate()+(6-day));
  return{start:toDateKey(start),end:toDateKey(end)};
}
function getMonthRange(dateKey) {
  const [y,m]=dateKey.split("-").map(Number);
  const start=`${y}-${String(m).padStart(2,"0")}-01`;
  const lastDay=new Date(y,m,0).getDate();
  return{start,end:`${y}-${String(m).padStart(2,"0")}-${lastDay}`};
}
function getMonthStart(dateKey) {
  const [y,m]=dateKey.split("-").map(Number);
  return `${y}-${String(m).padStart(2,"0")}-01`;
}
function formatWeekLabel(dateKey) {
  const { start, end } = getWeekRange(dateKey);
  return `${formatDateLabel(start)} - ${formatDateLabel(end)}`;
}
function getComparePeriodOptions(dateOptions, mode) {
  const seen = new Set();
  return dateOptions.reduce((acc, dateKey) => {
    const value = mode === "week" ? getWeekRange(dateKey).start : mode === "month" ? getMonthStart(dateKey) : dateKey;
    if (seen.has(value)) return acc;
    seen.add(value);
    acc.push({
      value,
      label: mode === "week" ? formatWeekLabel(value) : mode === "month" ? formatMonthLabel(value) : formatDateLabel(value),
    });
    return acc;
  }, []);
}

// ── UI primitives ──────────────────────────────────────────────────────────────

function Section({ children, accent, pinned, style }) {
  return (
    <div style={{ background:UI.surfaceElevated, borderRadius:16, padding:24, marginBottom:20,
      boxShadow: pinned?"0 2px 16px rgba(4,98,65,0.18)":"var(--color-shadow-soft)",
      border: pinned?`1.5px solid ${LW.green}`:`1px solid ${UI.border}`,
      borderLeft: accent?`4px solid ${accent}`:pinned?`4px solid ${LW.green}`:`1px solid ${UI.border}`,
      fontFamily:"'Manrope',sans-serif",
      ...style }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, badge, onPin, pinned, onRemove, onRename, onHide, onToggleMinimize, minimized = false, marginBottom = 20 }) {
  const bs = { AI:{bg:LW.dark,color:LW.saffron}, AUTO:{bg:LW.green,color:"#fff"}, "RAW DATA":{bg:LW.paper,color:LW.dark}, CUSTOM:{bg:"#fff3dc",color:"#c17110"}, PINNED:{bg:LW.green,color:"#fff"}, "AI FILTER":{bg:LW.dark,color:LW.saffron} };
  const b = bs[badge]||{bg:LW.paper,color:LW.dark};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef(null);

  const startEdit = () => { if (!onRename) return; setDraft(title); setEditing(true); setTimeout(()=>inputRef.current?.select(), 30); };
  const commit = () => { const t = draft.trim(); if (t && t !== title) onRename(t); setEditing(false); };
  const cancel = () => setEditing(false);

  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom }}>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();commit();} if(e.key==="Escape")cancel(); }}
              style={{ fontSize:15, fontWeight:800, color:LW.dark, margin:0, letterSpacing:"-0.02em", border:"none", borderBottom:`2px solid ${LW.green}`, outline:"none", background:"transparent", width:"100%", maxWidth:340, fontFamily:"inherit" }}
            />
          ) : (
            <h3
              onClick={startEdit}
              title={onRename ? "Click to rename" : undefined}
              style={{ fontSize:15, fontWeight:800, color:LW.dark, margin:0, letterSpacing:"-0.02em", cursor:"default", borderBottom:"none" }}
              onMouseEnter={e=>{ if(onRename) e.currentTarget.style.borderBottomColor="#9cafa4"; }}
              onMouseLeave={e=>{ if(onRename) e.currentTarget.style.borderBottomColor="transparent"; }}
            >{title}</h3>
          )}
          {badge && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:100, fontWeight:700, letterSpacing:"0.08em", background:b.bg, color:b.color, flexShrink:0 }}>{badge}</span>}
        </div>
        {subtitle && <p style={{ fontSize:12, color:"#9cafa4", margin:"4px 0 0", fontWeight:500 }}>{subtitle}</p>}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {onToggleMinimize && (
          <button
            onClick={onToggleMinimize}
            title={minimized ? "Restore section" : "Minimize section"}
            style={{
              width: 24,
              height: 24,
              borderRadius: 999,
              border: "1px solid rgba(0,0,0,0.14)",
              background: "#febc2e",
              color: "rgba(0,0,0,0.62)",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              padding: 0,
            }}
          >
            {minimized ? "+" : "-"}
          </button>
        )}
        {onHide && (
          <button
            onClick={onHide}
            style={{ background:"none", border:`1px solid ${UI.border}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color:"#9cafa4" }}
          >
            Hide
          </button>
        )}
        {onPin && (
          <button onClick={onPin} style={{ background:"none", border:`1px solid ${pinned?LW.green:"#e8e3d9"}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", fontSize:12, fontWeight:700, color:pinned?LW.green:"#9cafa4" }}>
            {pinned?"📌 Pinned":"📌 Pin"}
          </button>
        )}
        {onRemove && (
          <button onClick={onRemove} style={{ background:"none", border:"none", color:"#d1d5db", cursor:"pointer", fontSize:18, padding:"0 4px" }}
            onMouseEnter={e=>e.currentTarget.style.color="#9cafa4"}
            onMouseLeave={e=>e.currentTarget.style.color="#d1d5db"}>×</button>
        )}
      </div>
    </div>
  );
}

function DashboardNav({ activeView, setActiveView, pinnedCount, filteredTableCount = 0 }) {
  return (
    <div style={{ display:"flex", gap:8, marginBottom:18 }}>
      {[{id:"home",label:`Home${filteredTableCount>0?` · ${filteredTableCount} filtered`:""}`},{id:"charts",label:`Charts${pinnedCount>0?` · ${pinnedCount} pinned`:""}`}].map(tab=>{
        const active=activeView===tab.id;
        return <button key={tab.id} onClick={()=>setActiveView(tab.id)} style={{ padding:"8px 14px", borderRadius:10, border:`1px solid ${active?LW.green:UI.border}`, background:active?LW.green:UI.surface, color:active?"#fff":UI.text, fontSize:12, fontWeight:700, cursor:"pointer", boxShadow:"var(--color-shadow-soft)" }}>{tab.label}</button>;
      })}
    </div>
  );
}

function AIBanner({ summary }) {
  if(!summary)return null;
  return (
    <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"16px 20px", marginBottom:20, background:LW.dark, borderRadius:14, fontFamily:"'Manrope',sans-serif" }}>
      <Sparkles style={{ width: 20, height: 20, flexShrink: 0, color: LW.saffron }} aria-hidden="true" />
      <div style={{ flex:1 }}>
        <div style={{ fontSize:10, fontWeight:700, color:LW.saffron, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:5 }}>AI Analysis</div>
        <p style={{ fontSize:13, color:"rgba(255,255,255,0.85)", margin:0, lineHeight:1.6 }}>{summary}</p>
      </div>
      <span style={{ fontSize:10, fontWeight:700, background:LW.green, color:"#fff", padding:"3px 10px", borderRadius:100 }}>AI GENERATED</span>
    </div>
  );
}

// ── Wide Format Filter Bar ─────────────────────────────────────────────────────
// For payroll-style files where dates are column headers, not row values.
// primaryCol and sectionCol now come directly from data (set by backend extractor).
// Falls back to auto-detection from objectData if backend didn't send them.

function WideFilterBar({ wideDateCols, objectData, wideFilters, setWideFilters, primaryCol, sectionCol }) {
  // Auto-detect sectionCol if backend didn't send one
  const effectiveSectionCol = sectionCol || (
    objectData.length > 0
      ? Object.keys(objectData[0]).find(k => /^section|^dept|^department/i.test(k)) || null
      : null
  );

  // Auto-detect primaryCol if backend didn't send one —
  // first non-numeric, non-section column
  const effectivePrimaryCol = primaryCol || (
    objectData.length > 0
      ? Object.keys(objectData[0]).find(k => {
          if (k === effectiveSectionCol) return false;
          const vals = objectData.slice(0, 20).map(r => r[k]).filter(Boolean);
          const numRatio = vals.filter(v => !isNaN(Number(v))).length / (vals.length || 1);
          return numRatio < 0.5 && vals.length > 0;
        }) || null
      : null
  );

  const sections = useMemo(() => {
    if (!effectiveSectionCol) return [];
    return Array.from(new Set(
      objectData.map(r => String(r[effectiveSectionCol] || "").trim()).filter(Boolean)
    )).sort();
  }, [objectData, effectiveSectionCol]);

  const names = useMemo(() => {
    if (!effectivePrimaryCol) return [];
    let rows = objectData;
    if (wideFilters.section !== "all" && effectiveSectionCol) {
      rows = rows.filter(r => String(r[effectiveSectionCol] || "").trim() === wideFilters.section);
    }
    return Array.from(new Set(rows.map(r => String(r[effectivePrimaryCol] || "").trim()).filter(Boolean))).sort();
  }, [objectData, effectivePrimaryCol, effectiveSectionCol, wideFilters.section]);

  const activeCount = (wideFilters.section !== "all" ? 1 : 0) + (wideFilters.name !== "all" ? 1 : 0) + (wideFilters.dateFrom !== "all" || wideFilters.dateTo !== "all" ? 1 : 0);

  return (
    <div style={{ background:UI.surfaceElevated, borderRadius:14, border:`1px solid ${UI.border}`, marginBottom:20, overflow:"hidden", fontFamily:"'Manrope',sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", flexWrap:"wrap", color:UI.text }}>
        <span style={{ fontSize:11, fontWeight:700, color:UI.textLight, textTransform:"uppercase", letterSpacing:"0.08em", flexShrink:0 }}>🔍 Filters</span>

        {effectiveSectionCol && sections.length > 0 && (
          <select value={wideFilters.section} onChange={e => setWideFilters(f => ({ ...f, section: e.target.value, name: "all" }))}
            style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:600 }}>
            <option value="all">All Sections</option>
            {sections.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        )}

        {effectivePrimaryCol && names.length > 0 && (
          <select value={wideFilters.name} onChange={e => setWideFilters(f => ({ ...f, name: e.target.value }))}
            style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:600 }}>
            <option value="all">All {effectivePrimaryCol}s</option>
            {names.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        )}

        {wideDateCols.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#9cafa4" }}>📅</span>
            <select
              value={wideFilters.dateFrom}
              onChange={e => {
                const val = e.target.value;
                setWideFilters(f => {
                  if(val === "all") return { ...f, dateFrom: "all", dateTo: "all" };
                  const toIdx = wideDateCols.indexOf(f.dateTo);
                  const fromIdx = wideDateCols.indexOf(val);
                  // No "To" yet → default to same day; "From" jumped past "To" → snap To forward
                  const newTo = f.dateTo === "all" ? val : (fromIdx > toIdx ? val : f.dateTo);
                  return { ...f, dateFrom: val, dateTo: newTo };
                });
              }}
              style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:600 }}>
              <option value="all">From</option>
              {wideDateCols.map(dc => <option key={dc} value={dc}>{dc}</option>)}
            </select>
            <span style={{ fontSize:11, color:"#9cafa4", fontWeight:700 }}>→</span>
            <select
              value={wideFilters.dateTo}
              onChange={e => {
                const val = e.target.value;
                setWideFilters(f => {
                  // If new "to" is before current "from", reset "from"
                  const fromIdx = wideFilters.dateFrom === "all" ? 0 : wideDateCols.indexOf(wideFilters.dateFrom);
                  const toIdx = wideDateCols.indexOf(val);
                  const newFrom = (f.dateFrom !== "all" && toIdx < fromIdx) ? val : f.dateFrom;
                  return { ...f, dateTo: val, dateFrom: newFrom };
                });
              }}
              style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:600 }}>
              <option value="all">To</option>
              {wideDateCols.map(dc => {
                const fromIdx = wideFilters.dateFrom === "all" ? 0 : wideDateCols.indexOf(wideFilters.dateFrom);
                const dcIdx = wideDateCols.indexOf(dc);
                return <option key={dc} value={dc} disabled={dcIdx < fromIdx}>{dc}</option>;
              })}
            </select>
          </div>
        )}

        {activeCount > 0 && (
          <button onClick={() => setWideFilters({ section:"all", name:"all", dateFrom:"all", dateTo:"all" })}
            style={{ marginLeft:"auto", padding:"5px 12px", borderRadius:8, border:`1px solid ${UI.border}`, background:UI.surface, fontSize:11, fontWeight:700, color:UI.textLight, cursor:"pointer" }}>
             Clear all
           </button>
         )}
       </div>

       {/* Active filter pills */}
       {(wideFilters.section !== "all" || wideFilters.name !== "all") && (
         <div style={{ borderTop:`1px solid ${UI.border}`, padding:"8px 16px", display:"flex", gap:8, flexWrap:"wrap" }}>
           {wideFilters.section !== "all" && (
             <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:100, background:LW.green, color:"#fff", fontSize:11, fontWeight:700 }}>
              Section: {wideFilters.section}
              <button onClick={() => setWideFilters(f => ({ ...f, section:"all", name:"all" }))} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", cursor:"pointer", padding:0, fontSize:13 }}>×</button>
            </span>
           )}
           {wideFilters.name !== "all" && (
             <span style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"3px 10px", borderRadius:100, background:LW.green, color:"#fff", fontSize:11, fontWeight:700 }}>
              {wideFilters.name}
              <button onClick={() => setWideFilters(f => ({ ...f, name:"all" }))} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", cursor:"pointer", padding:0, fontSize:13 }}>×</button>
            </span>
           )}
         </div>
       )}
    </div>
  );
}

// ── Global Filter Bar ──────────────────────────────────────────────────────────

function GlobalFilterBar({ dateCol, dateOptions, filters, setFilters, categoryColumns, objectData }) {
  const [expanded, setExpanded] = useState(false);

  const getCategoryValues = useCallback((col) => {
    return Array.from(new Set(objectData.map(r=>r[col]).filter(v=>v!=null&&String(v).trim()!=="").map(v=>String(v).trim()))).sort();
  }, [objectData]);

  const isDateFiltered = filters.dateFrom!=="all" || filters.dateTo!=="all";
  const activeCount = (isDateFiltered?1:0)+Object.keys(filters.categories).length;

  // dateOptions are already sorted desc (newest first) — for From/To we want asc
  const dateOptionsAsc = [...dateOptions].reverse();

  return (
    <div style={{ background:UI.surfaceElevated, borderRadius:14, border:`1px solid ${UI.border}`, marginBottom:20, overflow:"hidden", fontFamily:"'Manrope',sans-serif" }}>
      <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", flexWrap:"wrap" }}>
        <span style={{ fontSize:11, fontWeight:700, color:UI.textLight, textTransform:"uppercase", letterSpacing:"0.08em", flexShrink:0 }}>🔍 Filters</span>

        {dateCol && dateOptionsAsc.length > 0 && (
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ fontSize:11, fontWeight:700, color:"#9cafa4" }}>📅</span>
            <select value={filters.dateFrom} onChange={e=>{
              const val=e.target.value;
              setFilters(f=>{
                if(val==="all") return{...f,dateFrom:"all",dateTo:"all"};
                const toIdx=dateOptionsAsc.indexOf(f.dateTo);
                const fromIdx=dateOptionsAsc.indexOf(val);
                // No "To" yet → default to same day; "From" jumped past "To" → snap To forward
                const newTo=f.dateTo==="all"?val:(fromIdx>toIdx?val:f.dateTo);
                return{...f,dateFrom:val,dateTo:newTo};
              });
            }} style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:600 }}>
              <option value="all">From</option>
              {dateOptionsAsc.map(d=><option key={d} value={d}>{formatDateLabel(d)}</option>)}
            </select>
            <span style={{ fontSize:11, color:"#9cafa4", fontWeight:700 }}>→</span>
            <select value={filters.dateTo} onChange={e=>{
              const val=e.target.value;
              setFilters(f=>{
                const fromIdx=dateOptionsAsc.indexOf(f.dateFrom);
                const toIdx=dateOptionsAsc.indexOf(val);
                const newFrom=(f.dateFrom!=="all"&&toIdx<fromIdx)?val:f.dateFrom;
                return{...f,dateTo:val,dateFrom:newFrom};
              });
            }} style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:600 }}>
              <option value="all">To</option>
              {dateOptionsAsc.map(d=>{
                const fromIdx=filters.dateFrom==="all"?0:dateOptionsAsc.indexOf(filters.dateFrom);
                const dIdx=dateOptionsAsc.indexOf(d);
                return <option key={d} value={d} disabled={dIdx<fromIdx}>{formatDateLabel(d)}</option>;
              })}
            </select>
          </div>
        )}

        {Object.entries(filters.categories).map(([col,val])=>(
          <span key={col} style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:100, background:LW.green, color:"#fff", fontSize:11, fontWeight:700 }}>
            {col}: {val}
            <button onClick={()=>setFilters(f=>{const c={...f.categories};delete c[col];return{...f,categories:c};})} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.7)", cursor:"pointer", padding:0, fontSize:13 }}>×</button>
          </span>
        ))}

        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          {activeCount>0 && <button onClick={()=>setFilters({dateFrom:"all",dateTo:"all",categories:{}})} style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${UI.border}`, background:UI.surface, fontSize:11, fontWeight:700, color:UI.textLight, cursor:"pointer" }}>Clear all</button>}
          {categoryColumns.length>0 && <button onClick={()=>setExpanded(v=>!v)} style={{ padding:"5px 12px", borderRadius:8, border:`1px solid ${expanded?LW.green:UI.border}`, background:expanded?LW.green:UI.surface, fontSize:11, fontWeight:700, color:expanded?"#fff":UI.textLight, cursor:"pointer" }}>{expanded?"▲ Less":"▼ More filters"}</button>}
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop:`1px solid ${UI.border}`, padding:"14px 16px", display:"flex", flexWrap:"wrap", gap:16 }}>
          {categoryColumns.slice(0,6).map(col=>(
            <div key={col}>
              <div style={{ fontSize:10, fontWeight:700, color:UI.textLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:6 }}>{col}</div>
              <select value={filters.categories[col]||""} onChange={e=>{
                const val=e.target.value;
                setFilters(f=>({...f,categories:val?{...f.categories,[col]:val}:(()=>{const c={...f.categories};delete c[col];return c;})()}));
              }} style={{ padding:"6px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer", fontWeight:500 }}>
                <option value="">All</option>
                {getCategoryValues(col).map(v=><option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Drilldown Banner ───────────────────────────────────────────────────────────


// ── Comparison Mode ────────────────────────────────────────────────────────────

function CompareCards({ blueprint, objectData, dateCol, dateOptions, isWide }) {
  const [mode, setMode] = useState("day");
  const [dateA, setDateA] = useState(dateOptions[0]||"");
  const [dateB, setDateB] = useState(dateOptions[1]||"");
  const periodOptions = useMemo(() => getComparePeriodOptions(dateOptions, mode), [dateOptions, mode]);

  useEffect(() => {
    if (!periodOptions.length) {
      setDateA("");
      setDateB("");
      return;
    }
    setDateA((current) => periodOptions.some((option) => option.value === current) ? current : periodOptions[0].value);
    setDateB((current) => {
      if (periodOptions.some((option) => option.value === current)) return current;
      return (periodOptions[1] || periodOptions[0]).value;
    });
  }, [periodOptions]);

  const filterByRange = (range) => {
    if (!dateCol) return objectData;
    return objectData.filter(row=>{ const d=parseDateValue(row[dateCol]); if(!d)return false; const k=toDateKey(d); return k>=range.start&&k<=range.end; });
  };
  const getRange = (dk,m) => {
    if(m==="day")return{start:dk,end:dk};
    if(m==="week")return getWeekRange(dk);
    if(m==="month")return getMonthRange(dk);
    return{start:dk,end:dk};
  };

  const dataA = filterByRange(getRange(dateA,mode));
  const dataB = filterByRange(getRange(dateB,mode));

  const calcCard = (d, card) => {
    const vals=d.map(r=>r[card.column]).filter(v=>v!=null&&String(v).trim()!=="");
    if(card.aggregation==="count")return new Set(vals.map(v=>String(v).trim().toLowerCase())).size;
    const nums=vals.map(v=>Number(v)).filter(v=>!isNaN(v));
    if(card.aggregation==="sum")return nums.reduce((a,b)=>a+b,0);
    if(card.aggregation==="avg")return nums.length?nums.reduce((a,b)=>a+b,0)/nums.length:0;
    return 0;
  };

  const displayCards = blueprint.cards||[];

  return (
    <Section>
      <SectionHeader title="Compare Periods" subtitle="Select two periods to compare KPIs side by side" badge="AUTO" />
      <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", marginBottom:20 }}>
        {["day","week","month"].map(m=>(
          <button key={m} onClick={()=>setMode(m)} style={{ padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:700, cursor:"pointer", border:`1px solid ${mode===m?LW.green:UI.border}`, background:mode===m?LW.green:UI.surface, color:mode===m?"#fff":UI.text }}>{m.charAt(0).toUpperCase()+m.slice(1)}</button>
        ))}
        <div style={{ display:"flex", gap:8, alignItems:"center", marginLeft:8 }}>
          <span style={{ width:10,height:10,borderRadius:2,background:CMP.a,display:"inline-block" }}/>
          <select value={dateA} onChange={e=>setDateA(e.target.value)} style={{ padding:"5px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer" }}>
            {periodOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <span style={{ fontSize:12, color:"#9cafa4", fontWeight:700 }}>vs</span>
          <span style={{ width:10,height:10,borderRadius:2,background:CMP.b,display:"inline-block" }}/>
          <select value={dateB} onChange={e=>setDateB(e.target.value)} style={{ padding:"5px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer" }}>
            {periodOptions.map(option=><option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <span style={{ fontSize:11, color:UI.textLight }}>{dataA.length} vs {dataB.length} rows</span>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:14 }}>
        {displayCards.map((card,idx)=>{
          const vA = isWide?(card.value||0):calcCard(dataA,card);
          const vB = isWide?(card.value||0):calcCard(dataB,card);
          const pct = vB?((vA-vB)/Math.abs(vB)*100).toFixed(1):null;
          const positive = vA >= vB;
          const hint = card.formatHint||"number";
          return (
            <div key={card.id||idx} style={{ background:UI.surfaceElevated, borderRadius:14, padding:"18px 20px", border:`1px solid ${UI.border}` }}>
              <div style={{ fontSize:10, fontWeight:700, color:UI.textLight, textTransform:"uppercase", letterSpacing:"0.08em", marginBottom:10 }}>{card.label}</div>
              <div style={{ display:"flex", gap:12, alignItems:"flex-end", marginBottom:8, flexWrap:"wrap" }}>
                <div>
                  <div style={{ fontSize:9, color:CMP.a, fontWeight:700, marginBottom:2 }}>Period A</div>
                  <div style={{ fontSize:20, fontWeight:800, color:CMP.a }}>{formatNum(vA,hint)}</div>
                </div>
                <div>
                  <div style={{ fontSize:9, color:CMP.b, fontWeight:700, marginBottom:2 }}>Period B</div>
                  <div style={{ fontSize:20, fontWeight:800, color:CMP.b }}>{formatNum(vB,hint)}</div>
                </div>
              </div>
              {pct!==null && <div style={{ fontSize:11, fontWeight:700, color:positive?"#059669":"#ef4444" }}>{positive?"▲":"▼"} {Math.abs(pct)}% vs period B</div>}
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── Clickable charts ───────────────────────────────────────────────────────────

function ClickableBarChart({ data, config, labels, height = 320 }) {
  const xKey=config?.x||"name", yKey=config?.y||"value";
  const xLabel = labels?.x || xKey;
  const yLabel = labels?.y || yKey;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{top:5,right:20,left:10,bottom:60}} style={{cursor:"default"}}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false}/>
        <XAxis dataKey={xKey} tick={{fontSize:11,fill:CHART_THEME.axis}} angle={-35} textAnchor="end" interval={0} label={undefined}/>
        <YAxis tick={{fontSize:12,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()}/>
        <Tooltip formatter={(v,_)=>[v.toLocaleString(), yLabel]} labelFormatter={l=>`${xLabel}: ${l}`} contentStyle={{borderRadius:8,border:`1px solid ${CHART_THEME.tooltipBorder}`,fontSize:13,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText}} labelStyle={{color:CHART_THEME.tooltipText}} itemStyle={{color:CHART_THEME.tooltipText}}/>
        <Bar dataKey={yKey} radius={[4,4,0,0]} cursor="default" isAnimationActive={false} activeBar={false}>
          {data.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ data, config, labels, height }) {
  const xKey=config?.x||"name", yKey=config?.y||"value";
  const xLabel = labels?.x || xKey;
  const yLabel = labels?.y || yKey;
  const autoHeight = height || Math.max(260, data.length * 34);
  return (
    <ResponsiveContainer width="100%" height={autoHeight}>
      <BarChart data={data} layout="vertical" margin={{top:5,right:40,left:120,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false}/>
        <XAxis type="number" tick={{fontSize:11,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()}/>
        <YAxis type="category" dataKey={xKey} tick={{fontSize:11,fill:CHART_THEME.axis}} width={110}/>
        <Tooltip formatter={(v,_)=>[v.toLocaleString(), yLabel]} labelFormatter={l=>`${xLabel}: ${l}`} contentStyle={{borderRadius:8,border:`1px solid ${CHART_THEME.tooltipBorder}`,fontSize:13,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText}} labelStyle={{color:CHART_THEME.tooltipText}} itemStyle={{color:CHART_THEME.tooltipText}}/>
        <Bar dataKey={yKey} radius={[0,4,4,0]} cursor="default" isAnimationActive={false} activeBar={false}>
          {data.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function StackedBarChart({ data }) {
  if (!data||!data.length) return <p style={{color:"#9cafa4",fontSize:13}}>No data.</p>;
  const stackKeys=Object.keys(data[0]).filter(k=>k!=="name");
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{top:5,right:20,left:10,bottom:60}}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false}/>
        <XAxis dataKey="name" tick={{fontSize:11,fill:CHART_THEME.axis}} angle={-35} textAnchor="end" interval={0}/>
        <YAxis tick={{fontSize:12,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:8,border:`1px solid ${CHART_THEME.tooltipBorder}`,fontSize:13,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText}} labelStyle={{color:CHART_THEME.tooltipText}} itemStyle={{color:CHART_THEME.tooltipText}}/>
        {stackKeys.map((k,i)=><Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i%CHART_COLORS.length]} radius={i===stackKeys.length-1?[4,4,0,0]:[0,0,0,0]} activeBar={false} isAnimationActive={false}/>)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimpleAreaChart({ data, xKey, yKey }) {
  const angle=data.length>14?-45:0, mb=angle!==0?60:10;
  return (
    <ResponsiveContainer width="100%" height={340}>
      <AreaChart data={data} margin={{top:8,right:20,left:10,bottom:mb}}>
        <defs><linearGradient id="lwGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={LW.green} stopOpacity={0.15}/><stop offset="95%" stopColor={LW.green} stopOpacity={0}/></linearGradient></defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false}/>
        <XAxis dataKey={xKey} tick={{fontSize:11,fill:CHART_THEME.axis}} angle={angle} textAnchor={angle!==0?"end":"middle"} interval={data.length>30?Math.floor(data.length/15):0} axisLine={false} tickLine={false}/>
        <YAxis tick={{fontSize:11,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()} axisLine={false} tickLine={false}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:10,border:`1px solid ${CHART_THEME.tooltipBorder}`,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText,fontSize:13}} labelStyle={{color:CHART_THEME.tooltipText,fontSize:11}}/>
        <Area type="monotone" dataKey={yKey} stroke={LW.green} strokeWidth={2.5} fill="url(#lwGrad)" dot={{fill:LW.green,r:data.length>30?0:4,strokeWidth:0}} activeDot={{r:6,fill:LW.saffron,stroke:LW.dark,strokeWidth:2}}/>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function StaticSummaryCards({ cards, analytics, filteredData, primaryCol: pCol, sectionCol: sCol, valueCol: vCol, activeDateRange, isFiltered }) {
  if(!cards||!cards.length)return null;
  const accents=[LW.green,LW.dark,LW.saffron,"#417256","#034E34"];
  const MEDALS=["🥇","🥈","🥉"];

  const toRanked = (payload, labelCol, valueCol) => {
    if(!payload) return null;
    const li = payload.headers.indexOf(labelCol);
    const vi = payload.headers.indexOf(valueCol);
    if(li===-1||vi===-1) return null;
    return payload.rows
      .map(r=>({ label: String(r[li]||"—").trim(), value: r[vi] }))
      .filter(r=>r.value!=null&&!isNaN(r.value))
      .sort((a,b)=>b.value-a.value)
      .slice(0,8);
  };

  // When a filter is active, recompute rankings live from filteredData
  // instead of using the pre-computed analytics payload (which is always unfiltered)
  const buildLiveRanked = (data, groupCol, metricCol, dateRange) => {
    if (!data || !groupCol) return null;
    const grouped = {};
    data.forEach(row => {
      const key = String(row[groupCol] || "—").trim();
      if (!key || key === "nan") return;
      // If a date range is active, sum across all columns in that range
      const value = dateRange && dateRange.length > 1
        ? dateRange.reduce((sum, dc) => sum + (Number(row[dc]) || 0), 0)
        : (Number(row[metricCol]) || 0);
      grouped[key] = (grouped[key] || 0) + value;
    });
    return Object.entries(grouped)
      .map(([label, value]) => ({ label, value }))
      .filter(r => r.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  };

  const effectiveValueCol = vCol || analytics?.valueCol;
  const effectivePrimaryCol = pCol || analytics?.primaryCol;
  const effectiveSectionCol = sCol || "Section";

  const primaryRanked = isFiltered && filteredData
    ? buildLiveRanked(filteredData, effectivePrimaryCol, effectiveValueCol, activeDateRange)
    : analytics ? toRanked(analytics.primaryTotals, analytics.primaryCol, analytics.valueCol) : null;

  const sectionRanked = isFiltered && filteredData
    ? buildLiveRanked(filteredData, effectiveSectionCol, effectiveValueCol, activeDateRange)
    : analytics ? toRanked(analytics.sectionTotals, "Section", analytics.valueCol) : null;

  const RankCard = ({ title, ranked, accent }) => {
    if(!ranked||!ranked.length) return null;
    const top = ranked[0].value;
    return (
      <div style={{background:UI.surfaceElevated,borderRadius:16,padding:"20px 22px",borderLeft:`4px solid ${accent}`,boxShadow:"var(--color-shadow-soft)",border:`1px solid ${UI.border}`,fontFamily:"'Manrope',sans-serif"}}
        onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 8px 24px rgba(19,48,32,0.11)"}}
        onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 6px rgba(19,48,32,0.06)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
          <div>
            <div style={{fontSize:10,fontWeight:700,color:"#9cafa4",letterSpacing:"0.12em",textTransform:"uppercase",marginBottom:3}}>{title}</div>
            <div style={{fontSize:11,color:"#b8c8c0",fontWeight:500}}>Top {ranked.length} ranking</div>
          </div>
          <div style={{fontSize:20,fontWeight:800,color:accent,letterSpacing:"-0.03em"}}>{formatNum(ranked[0].value,"number")}</div>
        </div>
        <div style={{height:1,background:"rgba(19,48,32,0.07)",marginBottom:12}}/>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {ranked.map((item,i)=>{
            const pct = top>0?(item.value/top)*100:0;
            const isMedal=i<3;
            return (
              <div key={i}>
                <div style={{display:"flex",alignItems:"center",gap:8}}>
                  <div style={{width:22,height:22,borderRadius:6,background:isMedal?accent:"rgba(19,48,32,0.06)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:isMedal?11:10,fontWeight:800,color:isMedal?"#fff":"#9cafa4",flexShrink:0}}>
                    {isMedal?MEDALS[i]:i+1}
                  </div>
                  <div style={{flex:1,fontSize:12,fontWeight:i===0?700:500,color:i===0?LW.dark:"#4a6358",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{item.label}</div>
                  <div style={{fontSize:12,fontWeight:700,color:i===0?accent:LW.dark,flexShrink:0}}>{formatNum(item.value,"number")}</div>
                </div>
                <div style={{paddingLeft:30}}>
                  <div style={{height:3,borderRadius:999,background:"rgba(19,48,32,0.07)",overflow:"hidden",marginTop:3}}>
                    <div style={{height:"100%",width:`${Math.min(100,Math.max(2,pct))}%`,background:i===0?accent:"rgba(19,48,32,0.15)",borderRadius:999}}/>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if(analytics && (primaryRanked||sectionRanked)) {
    return (
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:16,marginBottom:24}}>
        {primaryRanked && <RankCard title={`Top ${effectivePrimaryCol} by ${effectiveValueCol}`} ranked={primaryRanked} accent={accents[0]} />}
        {sectionRanked && <RankCard title={`${effectiveValueCol} by Section`} ranked={sectionRanked} accent={accents[1]} />}
      </div>
    );
  }

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(200px,1fr))",gap:14,marginBottom:20}}>
      {cards.map((card,idx)=>{
        const accent=accents[idx%accents.length];
        return (
          <div key={card.id||idx} style={{background:UI.surfaceElevated,borderRadius:14,padding:"20px 22px",borderLeft:`4px solid ${accent}`,boxShadow:"var(--color-shadow-soft)",border:`1px solid ${UI.border}`,transition:"transform 0.2s,box-shadow 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(0,0,0,0.24)"}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="var(--color-shadow-soft)"}}>
             <div style={{fontSize:10,fontWeight:700,color:"#9cafa4",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{card.label}</div>
             <div style={{fontSize:30,fontWeight:800,color:accent,letterSpacing:"-0.03em",lineHeight:1}}>{formatNum(card.value,card.formatHint)}</div>
           </div>
        );
      })}
    </div>
  );
}

// ── Render a single chart/pivot by spec ───────────────────────────────────────

function RenderChart({ chart, filteredData }) {
  if (chart.type==="pivot") return <PivotTableRenderer data={chart.pivotData}/>;
  if (chart.type==="bar") return <ClickableBarChart data={chart.chartData} config={{x:"name",y:"value"}} labels={{x:chart.xCol,y:chart.config?.y||"Value"}}/>;
  if (chart.type==="hbar") return <HorizontalBarChart data={chart.chartData} config={{x:"name",y:"value"}} labels={{x:chart.xCol,y:chart.config?.y||"Value"}}/>;
  if (chart.type==="stacked") return <StackedBarChart data={chart.chartData}/>;
  if (chart.type==="line") return <LineChartRenderer data={filteredData} config={chart.config}/>;
  if (chart.type==="donut") return <DonutChartRenderer data={filteredData} config={chart.config}/>;
  return null;
}

// Fullscreen variant — measures container height and passes to chart components
function FullscreenChartWrapper({ card }) {
  const containerRef = useRef(null);
  const [containerHeight, setContainerHeight] = useState(500);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(Math.floor(entry.contentRect.height));
      }
    });
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  if (!card) return null;

  const renderWithHeight = (h) => {
    if (!card.chart) return card.render;
    const chart = card.chart;
    if (chart.type === "bar") return <ClickableBarChart data={chart.chartData} config={{x:"name",y:"value"}} labels={{x:chart.xCol,y:chart.config?.y||"Value"}} height={h}/>;
    if (chart.type === "hbar") return <HorizontalBarChart data={chart.chartData} config={{x:"name",y:"value"}} labels={{x:chart.xCol,y:chart.config?.y||"Value"}} height={h}/>;
    return card.render;
  };

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%", overflow: card.kind === "pivot" ? "auto" : "hidden" }}>
      {renderWithHeight(containerHeight)}
    </div>
  );
}

function getChartWorkspaceDefault(card) {
  if (card.kind === "pivot") return { span: 6, height: 460 };
  if (card.kind === "wide_line") return { span: 12, height: 460 };
  if (card.kind === "line") return { span: 12, height: 440 };
  return { span: 6, height: 430 };
}

function getWorkspaceMetrics(width) {
  const gap = 20;
  const safeWidth = Math.max(width || 0, 360);
  const colWidth = Math.max((safeWidth - gap * 11) / 12, 20);
  return { gap, colWidth };
}

function getCardPixelWidth(span, workspaceWidth) {
  const { gap, colWidth } = getWorkspaceMetrics(workspaceWidth);
  return colWidth * span + gap * Math.max(span - 1, 0);
}

function buildChartLayouts(cards, previousLayouts, workspaceWidth) {
  const gap = 20;
  const existingBottom = cards.reduce((maxBottom, card) => {
    const prev = previousLayouts?.[card.id];
    if (typeof prev?.x !== "number" || typeof prev?.y !== "number") return maxBottom;
    return Math.max(maxBottom, prev.y + (prev.height ?? getChartWorkspaceDefault(card).height));
  }, 0);
  let nextStackY = existingBottom > 0 ? existingBottom + gap : 0;

  return cards.reduce((acc, card) => {
    const defaults = getChartWorkspaceDefault(card);
    const prev = previousLayouts?.[card.id] || {};
    const span = prev.span ?? defaults.span;
    const height = prev.height ?? defaults.height;
    const hasStoredPosition = typeof prev.x === "number" && typeof prev.y === "number";

    acc[card.id] = {
      span,
      height,
      hidden: prev.hidden ?? false,
      x: hasStoredPosition ? prev.x : 0,
      y: hasStoredPosition ? prev.y : nextStackY,
    };

    if (!hasStoredPosition) {
      nextStackY += height + gap;
    }

    return acc;
  }, {});
}

function WindowActionButton({ label, title, active = false, tone = "neutral", compact = false, onClick }) {
  const tones = {
    neutral: {
      border: UI.border,
      color: "#7c8f85",
      glow: "rgba(19, 48, 32, 0.12)",
      activeBg: UI.surface,
      activeColor: UI.text,
    },
    green: {
      border: "rgba(4, 98, 65, 0.26)",
      color: LW.green,
      glow: "rgba(4, 98, 65, 0.18)",
      activeBg: "rgba(4, 98, 65, 0.10)",
      activeColor: LW.green,
    },
    saffron: {
      border: "rgba(255, 179, 71, 0.34)",
      color: "#c17110",
      glow: "rgba(255, 179, 71, 0.24)",
      activeBg: "rgba(255, 179, 71, 0.14)",
      activeColor: "#9a5e08",
    },
  };

  const theme = tones[tone] || tones.neutral;
  const basePadding = compact ? "0" : "0 12px";

  return (
    <button
      type="button"
      title={title || label}
      onClick={onClick}
      style={{
        minWidth: compact ? 34 : "auto",
        height: 30,
        padding: basePadding,
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        background: active ? theme.activeBg : "rgba(255,255,255,0.7)",
        color: active ? theme.activeColor : theme.color,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        boxShadow: active ? `0 8px 16px ${theme.glow}` : "0 1px 2px rgba(19, 48, 32, 0.06)",
        transition: "transform 0.16s ease, box-shadow 0.16s ease, border-color 0.16s ease, background 0.16s ease, color 0.16s ease",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 10px 18px ${theme.glow}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = active ? `0 8px 16px ${theme.glow}` : "0 1px 2px rgba(19, 48, 32, 0.06)";
      }}
      onMouseDown={e => {
        e.stopPropagation();
        e.currentTarget.style.transform = "translateY(1px) scale(0.98)";
      }}
      onPointerDown={e => {
        e.stopPropagation();
      }}
      onMouseUp={e => {
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
    >
      {label}
    </button>
  );
}

function MacWindowControls({
  canHide,
  isMinimized,
  isFullscreen,
  onHide,
  onToggleMinimize,
  onToggleFullscreen,
}) {
  const [hovered, setHovered] = useState(false);

  const controls = [
    {
      key: "hide",
      bg: "#ff5f57",
      symbol: "x",
      action: onHide,
      enabled: canHide,
      title: "Hide chart",
    },
    {
      key: "minimize",
      bg: "#febc2e",
      symbol: isMinimized ? "+" : "-",
      action: onToggleMinimize,
      enabled: true,
      title: isMinimized ? "Restore chart" : "Minimize chart",
    },
    {
      key: "fullscreen",
      bg: "#28c840",
      symbol: isFullscreen ? "−" : "+",
      action: onToggleFullscreen,
      enabled: true,
      title: isFullscreen ? "Exit fullscreen" : "Open fullscreen",
    },
  ];

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}
    >
      {controls.map(control => (
        <button
          key={control.key}
          type="button"
          title={control.title}
          disabled={!control.enabled}
          onClick={control.action}
          onMouseDown={e=>e.stopPropagation()}
          onPointerDown={e=>e.stopPropagation()}
          style={{
            width: 12,
            height: 12,
            borderRadius: 999,
            border: "1px solid rgba(0,0,0,0.14)",
            background: control.enabled ? control.bg : "rgba(156, 175, 164, 0.45)",
            color: "rgba(0,0,0,0.62)",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 0,
            cursor: control.enabled ? "pointer" : "not-allowed",
            boxShadow: hovered && control.enabled ? "0 4px 10px rgba(0,0,0,0.14)" : "none",
            transform: hovered && control.enabled ? "translateY(-1px)" : "translateY(0)",
            transition: "transform 0.16s ease, box-shadow 0.16s ease, filter 0.16s ease",
            filter: control.enabled ? "saturate(1)" : "saturate(0.6)",
            fontSize: 8,
            fontWeight: 800,
            lineHeight: 1,
          }}
        >
          <span style={{ opacity: hovered && control.enabled ? 1 : 0, transition: "opacity 0.14s ease" }}>
            {control.symbol}
          </span>
        </button>
      ))}
    </div>
  );
}

function ChartWorkspaceCard({
  card,
  layout,
  workspaceWidth,
  locked,
  minimized,
  visibilityState,
  isDragging,
  onDragStart,
  onResizeStart,
  onToggleDrag,
  onResetLayout,
  onToggleMinimize,
  onToggleFullscreen,
  children,
}) {
  const borderColor = card.badge === "PINNED" ? LW.green : UI.border;
  const cardHeight = minimized ? 58 : layout.height;
  const cardWidth = getCardPixelWidth(layout.span, workspaceWidth);
  const [renamingCard, setRenamingCard] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const renameInputRef = useRef(null);
  const startRename = (e) => { e.stopPropagation(); if (!card.onRename) return; setRenameDraft(card.title); setRenamingCard(true); setTimeout(() => renameInputRef.current?.select(), 30); };
  const commitRename = () => { const t = renameDraft.trim(); if (t && t !== card.title) card.onRename(t); setRenamingCard(false); };

  return (
    <div
      style={{
        position: "absolute",
        left: layout.x || 0,
        top: layout.y || 0,
        width: cardWidth,
        opacity: visibilityState === "closing" ? 0 : isDragging ? 0.42 : 1,
        transform: visibilityState === "closing"
          ? "scale(0.96) translateY(-6px)"
          : visibilityState === "opening"
            ? "scale(0.985) translateY(4px)"
            : "none",
        transition: "transform 0.22s ease, opacity 0.22s ease, box-shadow 0.18s ease",
        zIndex: isDragging ? 25 : 1,
      }}
    >
      <div
        style={{
          height: cardHeight,
          minHeight: minimized ? 58 : 320,
          background: UI.surfaceElevated,
          borderRadius: 16,
          display: "flex",
          flexDirection: "column",
          boxShadow: isDragging ? "0 18px 32px rgba(4, 98, 65, 0.16)" : "var(--color-shadow-soft)",
          border: `1.5px solid ${borderColor}`,
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          onPointerDown={(event) => onDragStart(event, card.id)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 14,
            padding: "12px 16px",
            background: "linear-gradient(180deg, rgba(19,48,32,0.04), rgba(19,48,32,0))",
            borderBottom: `1px solid ${UI.border}`,
            cursor: locked ? "default" : isDragging ? "grabbing" : "grab",
            userSelect: "none",
            touchAction: "none",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <MacWindowControls
              canHide={Boolean(card.onHide)}
              isMinimized={minimized}
              isFullscreen={Boolean(card.isFullscreen)}
              onHide={card.onHide}
              onToggleMinimize={onToggleMinimize}
              onToggleFullscreen={onToggleFullscreen}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                {renamingCard ? (
                  <input
                    ref={renameInputRef}
                    value={renameDraft}
                    onChange={e => setRenameDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => { if (e.key === "Enter") commitRename(); if (e.key === "Escape") setRenamingCard(false); }}
                    onPointerDown={e => e.stopPropagation()}
                    style={{ fontSize: 13, fontWeight: 800, color: UI.text, background: "transparent", border: "none", borderBottom: `2px solid ${LW.green}`, outline: "none", padding: "0 2px", width: 200, fontFamily: "inherit" }}
                  />
                ) : (
                  <div style={{ fontSize: 14, fontWeight: 800, color: UI.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {card.title}
                  </div>
                )}
                {card.badge && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 100, fontWeight: 700, letterSpacing: "0.08em", background: card.badge === "PINNED" ? LW.green : card.badge === "CUSTOM" ? "#fff3dc" : LW.green, color: card.badge === "CUSTOM" ? "#c17110" : "#fff", flexShrink: 0 }}>{card.badge}</span>}
                {card.onRename && !renamingCard && (
                  <button
                    onPointerDown={startRename}
                    title="Rename chart"
                    style={{ background: "none", border: "none", cursor: "pointer", padding: "2px 3px", borderRadius: 5, color: "#9cafa4", fontSize: 13, lineHeight: 1, display: "flex", alignItems: "center", opacity: 0.7, flexShrink: 0 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = 1}
                    onMouseLeave={e => e.currentTarget.style.opacity = 0.7}
                  >
                    <PencilLine className="h-[13px] w-[13px]" aria-hidden="true" />
                  </button>
                )}
              </div>
              {card.subtitle && <div style={{ fontSize: 11, color: "#9cafa4", marginTop: 2 }}>{card.subtitle}</div>}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <WindowActionButton
              label={locked ? "Enable Drag" : "Lock Drag"}
              title={locked ? "Enable dragging for this chart" : "Lock this chart position"}
              active={!locked}
              tone="green"
              onClick={onToggleDrag}
            />
            <WindowActionButton
              label="Reset"
              title="Reset this chart layout"
              tone="neutral"
              onClick={onResetLayout}
            />
            {card.onPin && (
              <WindowActionButton
                label={card.pinned ? "Unpin" : "Pin"}
                title={card.pinned ? "Remove from pinned charts" : "Pin chart"}
                active={card.pinned}
                tone={card.pinned ? "green" : "saffron"}
                onClick={card.onPin}
              />
            )}
            {card.onRemove && (
              <WindowActionButton
                label="x"
                title="Remove chart"
                compact
                tone="saffron"
                onClick={card.onRemove}
              />
            )}
          </div>
        </div>

        <div
          style={{
            flex: minimized ? "0 0 auto" : 1,
            minHeight: 0,
            overflow: "hidden",
            maxHeight: minimized ? 0 : Math.max(180, layout.height - 70),
            opacity: minimized ? 0 : 1,
            transition: "max-height 0.24s ease, opacity 0.2s ease",
          }}
        >
          <div style={{ height: "100%", overflow: "auto", padding: 16 }}>
            {children}
          </div>
        </div>

        {!locked && !minimized && (
          <button
            type="button"
            aria-label={`Resize ${card.title}`}
            onPointerDown={(event) => onResizeStart(event, card.id)}
            style={{
              position: "absolute",
              right: 10,
              bottom: 10,
              width: 18,
              height: 18,
              border: "none",
              background: "transparent",
              cursor: "nwse-resize",
              padding: 0,
            }}
          >
            <Grip className="h-[18px] w-[18px]" style={{ color: "#9cafa4" }} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard({ data, blueprint, fileId }) {
  const { headers, rows } = data;

  // filteredTables now persisted via usePins
  const [activeView, setActiveView] = useState("home");
  const [showCompare, setShowCompare] = useState(false);
  const [customBuilderMinimized, setCustomBuilderMinimized] = useState(false);
  const [filters, setFilters] = useState({ dateFrom:"all", dateTo:"all", categories:{} });
  // Wide-format filter state — section, name (primary entity), and active date columns
  const [wideFilters, setWideFilters] = useState({ section:"all", name:"all", dateFrom:"all", dateTo:"all" });

  const isWide = blueprint.tableFormat==="wide";
  const analytics = blueprint.analytics||data.analytics||null;
  const aiGenerated = blueprint.aiGenerated||false;
  const datasetSummary = blueprint.datasetSummary||null;

  // Date columns for wide format (e.g. ["Sep 16", "Sep 17", ...]) — now sent by backend
  const wideDateCols = useMemo(() => data.dateCols || [], [data]);

  // primaryCol / sectionCol — backend sends these; fall back to analytics if older backend
  const dataPrimaryCol = data.primaryCol || analytics?.primaryCol || null;
  const dataSectionCol = data.sectionCol || (analytics?.sectionTotals ? "Section" : null);

  // Pin storage per file
  const { user } = useAuth();
  const { pinnedIds, customCharts: savedCustomCharts, filteredTables, loading: pinsLoading,
          togglePin, isPinned, addCustomChart, addAndPinChart, removeCustomChart, clearAllCustomCharts, renameCustomChart,
          addFilteredTable, removeFilteredTable, updateFilteredTable, renameFilteredTable, addAndPinTable, clearAllFilteredTables } = usePins(user?.uid, fileId||"default");

  // customCharts from usePins is already seeded from localStorage on first render
  // and synced from Firestore in background — use directly
  const [sessionCharts, setCustomCharts] = useState([]);


  // Object data
  const objectData = useMemo(()=>
    rows.map(row=>Object.fromEntries(headers.map((h,i)=>[h,row[i]]))).filter(row=>
      !Object.values(row).some(v=>{ if(!v)return false; const s=String(v).toLowerCase().trim(); return s==="total"||s==="grand total"||s==="sub total"||s==="overall"||s.startsWith("total ")||s.endsWith(" total"); })
    ), [headers,rows]);

  const dateCol = useMemo(()=>detectDateColumn(headers,objectData,isWide,data.dateCols),[headers,objectData,isWide,data.dateCols]);
  const categoryColumns = useMemo(()=>detectCategoryColumns(headers,objectData,dateCol),[headers,objectData,dateCol]);
  const dateOptions = useMemo(()=>{
    if(!dateCol)return[];
    const keys=new Set();
    objectData.forEach(row=>{ const d=parseDateValue(row[dateCol]); if(d)keys.add(toDateKey(d)); });
    return Array.from(keys).sort((a,b)=>b.localeCompare(a));
  },[objectData,dateCol]);

  // Filtered data (long-format) — date + category filters
  const filteredData = useMemo(()=>{
    let result=objectData;
    if((filters.dateFrom!=="all"||filters.dateTo!=="all")&&dateCol) result=result.filter(row=>{ const d=parseDateValue(row[dateCol]); if(!d)return false; const k=toDateKey(d); const from=filters.dateFrom!=="all"?filters.dateFrom:null; const to=filters.dateTo!=="all"?filters.dateTo:null; return (!from||k>=from)&&(!to||k<=to); });
    Object.entries(filters.categories).forEach(([col,val])=>{ result=result.filter(row=>row[col]!=null&&String(row[col]).trim()===val); });
    return result;
  },[objectData,filters,dateCol]);

  const filteredRows = useMemo(()=>filteredData.map(row=>headers.map(h=>row[h]===undefined?null:row[h])),[filteredData,headers]);
  // Rebuild saved charts from Firestore — recompute chartData/pivotData from their spec
  // Must be after filteredData is defined
  const rebuiltSavedCharts = useMemo(() => {
    return savedCustomCharts.map(c => {
      if (c.type === "pivot" && c.xCol && !c.pivotData) {
        return { ...c, pivotData: generatePivot(filteredData, c.xCol, null, null, "sum") };
      }
      if ((c.type === "bar" || c.type === "donut") && c.config?.x && !c.chartData) {
        return { ...c, chartData: groupForBar(filteredData, c.config.x, c.config.y, 20) };
      }
      return c;
    });
  }, [savedCustomCharts, filteredData]);

  // Merge session charts with rebuilt Firestore charts
  const allCustomCharts = [
    ...sessionCharts,
    ...rebuiltSavedCharts.filter(s => !sessionCharts.find(c => String(c.id) === String(s.id)))
  ];

  const autoIds = isWide
    ? ["wide_line", "wide_primary", "wide_section"]
    : [...(blueprint.charts||[]).map(c=>c.id), ...(blueprint.pivots||[]).map(p=>p.id)];

  const validPinnedIds = pinnedIds.filter(id =>
    autoIds.includes(id) ||
    allCustomCharts.some(c => String(c.id) === id) ||
    id === "raw_data_table" ||
    filteredTables.some(t => String(t.id) === id)
  );

  const chartWorkspaceStorageKey = `chart_workspace_${fileId||"default"}`;
  const workspaceRef = useRef(null);
  const resizeRef = useRef(null);
  const dragRef = useRef(null);
  const [chartOrder, setChartOrder] = useState([]);
  const [chartLayouts, setChartLayouts] = useState({});
  const [draggedChartId, setDraggedChartId] = useState(null);
  const [lockedCharts, setLockedCharts] = useState({});
  const [minimizedCharts, setMinimizedCharts] = useState({});
  const [fullscreenChartId, setFullscreenChartId] = useState(null);
  const [chartVisibilityState, setChartVisibilityState] = useState({});
  const [workspaceWidth, setWorkspaceWidth] = useState(1120);

  // Wide-format: filter by section/name
  const wideFilteredData = useMemo(()=>{
    if(!isWide) return objectData;
    let result = objectData;
    if(wideFilters.section !== "all" && dataSectionCol) {
      result = result.filter(r => String(r[dataSectionCol] || "").trim() === wideFilters.section);
    }
    if(wideFilters.name !== "all" && dataPrimaryCol) {
      result = result.filter(r => String(r[dataPrimaryCol] || "").trim() === wideFilters.name);
    }
    return result;
  }, [isWide, objectData, wideFilters, dataPrimaryCol, dataSectionCol]);

  // Wide-format: hide date columns outside selected range
  const wideVisibleHeaders = useMemo(()=>{
    if(!isWide) return headers;
    const { dateFrom, dateTo } = wideFilters;
    if(dateFrom === "all" && dateTo === "all") return headers;
    const fromIdx = dateFrom !== "all" ? wideDateCols.indexOf(dateFrom) : 0;
    const toIdx   = dateTo   !== "all" ? wideDateCols.indexOf(dateTo)   : wideDateCols.length - 1;
    const inRange = new Set(wideDateCols.slice(fromIdx, toIdx + 1));
    return headers.filter(h => !wideDateCols.includes(h) || inRange.has(h));
  }, [isWide, headers, wideDateCols, wideFilters.dateFrom, wideFilters.dateTo]);

  // Analytics-derived variables
  const periodData = analytics ? analyticsToObjects(analytics.periodTotals) : [];
  const primaryCol = analytics?.primaryCol || dataPrimaryCol || "Entity";
  const valueCol   = analytics?.valueCol || "Total Production";
  const periodCol  = analytics?.periodCol || "Period";
  const primaryPivot = analytics?.primaryTotals
    ? analyticsToPrebuiltPivot(analytics.primaryTotals, primaryCol, valueCol) : null;
  const sectionPivot = analytics?.sectionTotals
    ? analyticsToPrebuiltPivot(analytics.sectionTotals, "Section", valueCol) : null;

  const { dateFrom, dateTo } = wideFilters;
  const isDateFiltered = dateFrom !== "all" || dateTo !== "all";
  const fromIdx = dateFrom !== "all" ? wideDateCols.indexOf(dateFrom) : 0;
  const toIdx   = dateTo   !== "all" ? wideDateCols.indexOf(dateTo)   : wideDateCols.length - 1;
  const activeDateRange = isDateFiltered ? wideDateCols.slice(fromIdx, toIdx + 1) : [];
  const activeDateCol = activeDateRange.length === 1 ? activeDateRange[0] : null;
  const effectiveValueCol = activeDateCol || valueCol;

  function buildLongPivot(pivotDef) {
    return generatePivot(filteredData, pivotDef.rowDim, pivotDef.colDim||null, pivotDef.measure, pivotDef.aggregation||"sum");
  }

  const pinCustomChart = (id, chartObj = null) => {
    const chart = chartObj || allCustomCharts.find(c => String(c.id) === String(id));
    if (!chart) return;
    if (!isPinned(String(id))) {
      addAndPinChart(chart); // single atomic save — chart + pinId together
    }
  };

  const removeCustom = (id) => {
    setCustomCharts(prev => prev.filter(c => String(c.id) !== String(id)));
    removeCustomChart(id);
  };

  const renameChart = (id, newTitle) => {
    setCustomCharts(prev => prev.map(c =>
      c.id !== id ? c : { ...c, title: newTitle, spec: c.spec ? { ...c.spec, title: newTitle } : c.spec }
    ));
    renameCustomChart(id, newTitle);
  };

  // Build a chart result from a spec, applying limit/sort/row-filters
  const buildChartResult = (spec, id) => {
    if (!spec) return null;
    let data = filteredData;
    if (spec.filters?.length) {
      data = data.filter(row => spec.filters.every(({ column, operator, value }) => {
        const cell = String(row[column] ?? "").trim().toLowerCase();
        const val = String(value ?? "").toLowerCase();
        if (operator === "eq") return cell === val;
        if (operator === "neq") return cell !== val;
        if (operator === "contains") return cell.includes(val);
        const cn = parseFloat(cell), vn = parseFloat(val);
        if (operator === "gt") return cn > vn;
        if (operator === "gte") return cn >= vn;
        if (operator === "lt") return cn < vn;
        if (operator === "lte") return cn <= vn;
        return true;
      }));
    }
    const limit = spec.limit || null;
    const xCol = spec.x || spec.xCol || null;
    const yCol = spec.y || null;
    if (spec.type === "pivot") {
      return { id, type: "pivot", title: spec.title || "Pivot", xCol: spec.rowDim, spec,
        pivotData: generatePivot(data, spec.rowDim, spec.colDim || null, spec.measure, spec.aggregation || "sum") };
    }
    if (spec.type === "bar" || spec.type === "hbar") {
      return { id, type: spec.type, title: spec.title || "Chart", xCol, spec,
        config: { x: xCol, y: yCol },
        chartData: groupForBar(data, xCol, yCol, limit || 20, spec?.aggregation || "sum") };
    }
    if (spec.type === "donut") {
      return { id, type: "donut", title: spec.title || "Chart", xCol, spec,
        config: { x: xCol, y: yCol, topN: limit || 10 },
        chartData: groupForBar(data, xCol, yCol, limit || 10, spec?.aggregation || "sum") };
    }
    if (spec.type === "line") {
      return { id, type: "line", title: spec.title || "Chart", spec, config: { x: xCol, y: yCol } };
    }
    return null;
  };

  const handleChatResult = ({ chartSpec, filterSpec, action, targetId, updateChartId, deleteSpec, pinSpec, newChartSpecs, renameSpec, tab, modifyChartSpec, tableActionSpec }) => {
    if (action === "rename" && renameSpec) {
      const match = allCustomCharts.find(c =>
        c.title?.toLowerCase() === renameSpec.targetTitle?.toLowerCase()
      );
      if (match) renameChart(match.id, renameSpec.newTitle);
      return;
    }

    if (action === "navigate" && tab) {
      setActiveView(tab);
      return;
    }

    if (action === "modify_chart" && modifyChartSpec) {
      const match = allCustomCharts.find(c =>
        c.title?.toLowerCase() === modifyChartSpec.targetTitle?.toLowerCase()
      );
      if (match) {
        const updated = {
          ...match,
          spec: match.spec ? { ...match.spec, limit: modifyChartSpec.limit, sort: modifyChartSpec.sort } : match.spec,
        };
        setCustomCharts(prev => prev.map(c => String(c.id) === String(match.id) ? updated : c));
        if (isPinned(String(match.id))) addCustomChart(updated);
      }
      return;
    }

    if (action === "table_action" && tableActionSpec) {
      const { action: act, targetTitle, newTitle, sort_col, sort_dir, limit, filter: addFilter, filter_column } = tableActionSpec;
      const findTable = (title) => filteredTables.find(t => t.title?.toLowerCase() === title?.toLowerCase());

      if (act === "deleteAll") {
        clearAllFilteredTables();
      } else if (act === "delete") {
        const match = findTable(targetTitle);
        if (match) removeFilteredTable(match.id);
      } else if (act === "pinAll") {
        filteredTables.forEach(t => { if (!isPinned(String(t.id))) addAndPinTable(t); });
      } else if (act === "unpinAll") {
        filteredTables.forEach(t => { if (isPinned(String(t.id))) togglePin(String(t.id)); });
      } else if (act === "pin") {
        const match = findTable(targetTitle);
        if (match && !isPinned(String(match.id))) addAndPinTable(match);
      } else if (act === "rename") {
        const match = findTable(targetTitle);
        if (match) renameFilteredTable(match.id, newTitle);
      } else if (act === "sort") {
        // Update table's sort_col + sort_dir in filteredTables state
        const match = findTable(targetTitle);
        if (match) {
          const updated = { ...match, sort_col, sort_dir: sort_dir || "asc" };
          updateFilteredTable(updated);
        }
      } else if (act === "limit") {
        const match = findTable(targetTitle);
        if (match) {
          const updated = { ...match, limit };
          updateFilteredTable(updated);
        }
      } else if (act === "add_filter") {
        const match = findTable(targetTitle);
        if (match && addFilter?.column) {
          const existingFilters = match.filters || [];
          // Replace filter for same column, or append
          const newFilters = [...existingFilters.filter(f => f.column !== addFilter.column), addFilter];
          const updated = { ...match, filters: newFilters };
          updateFilteredTable(updated);
        }
      } else if (act === "remove_filter") {
        const match = findTable(targetTitle);
        if (match && filter_column) {
          const updated = { ...match, filters: (match.filters || []).filter(f => f.column !== filter_column) };
          updateFilteredTable(updated);
        }
      }
      return;
    }

    if (action === "pin" && pinSpec) {
      if (pinSpec.pinAll) {
        // Pin existing charts
        allCustomCharts.forEach(c => pinCustomChart(String(c.id)));
        // Pin charts created in this same batch via __pendingCharts registry
        const pending = window.__pendingCharts || {};
        Object.entries(pending).forEach(([id, chart]) => {
          pinCustomChart(String(id), chart);
        });
        window.__pendingCharts = {};
      } else if (pinSpec.unpinAll) {
        allCustomCharts.forEach(c => {
          if (isPinned(String(c.id))) togglePin(String(c.id));
        });
      } else if (pinSpec.targetTitle) {
        const match = allCustomCharts.find(c =>
          c.title?.toLowerCase() === pinSpec.targetTitle?.toLowerCase()
        );
        if (match) {
          if (pinSpec.pinned && !isPinned(String(match.id))) pinCustomChart(String(match.id));
          else if (!pinSpec.pinned && isPinned(String(match.id))) togglePin(String(match.id));
        }
      }
      return;
    }

    if (action === "delete" && deleteSpec) {
      if (deleteSpec.deleteAll) {
        clearAllCustomCharts();
        setCustomCharts([]); // clear sessionCharts (custom builder charts)
      } else {
        const match = allCustomCharts.find(c =>
          (deleteSpec.targetId && String(c.id) === String(deleteSpec.targetId)) ||
          (deleteSpec.targetTitle && c.title?.toLowerCase() === deleteSpec.targetTitle?.toLowerCase())
        );
        if (match) {
          setCustomCharts(prev => prev.filter(c => c.id !== match.id));
          removeCustomChart(match.id);
        }
      }
      return;
    }

    if (action === "filter" && filterSpec) {
      const id = filterSpec.id || Date.now();
      addFilteredTable({ ...filterSpec, id });
      setActiveView("home");
      return;
    }
    if (filterSpec) {
      const id = Date.now();
      addFilteredTable({ id, ...filterSpec });
      setActiveView("home");
    } else if (chartSpec) {
      const modifyId = targetId || updateChartId || (action === "modify" ? chartSpec.targetId : null);
      if (modifyId) {
        setCustomCharts(prev => prev.map(c => {
          if (String(c.id) !== String(modifyId)) return c;
          return buildChartResult(chartSpec, c.id) || c;
        }));
        const updated = buildChartResult(chartSpec, modifyId);
        if (updated) addCustomChart(updated);
        setActiveView("charts");
      } else {
        const id = chartSpec._chatId || Date.now();
        const result = buildChartResult(chartSpec, id);
        if (result) {
          setCustomCharts(prev => [result, ...prev]); // session only — persists to Firestore on pin
          // If a pinAll is coming in same batch, pre-register so pin can find it
          if (chartSpec._chatId) {
            window.__pendingCharts = window.__pendingCharts || {};
            window.__pendingCharts[String(id)] = result;
          }
          setActiveView("charts");
        }
      }
    }
  };

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(chartWorkspaceStorageKey) || "{}");
      setChartOrder(Array.isArray(saved.order) ? saved.order : []);
      setChartLayouts(saved.layouts && typeof saved.layouts === "object" ? saved.layouts : {});
      setLockedCharts(saved.lockedCharts && typeof saved.lockedCharts === "object" ? saved.lockedCharts : {});
      setMinimizedCharts(saved.minimized && typeof saved.minimized === "object" ? saved.minimized : {});
    } catch {
      setChartOrder([]);
      setChartLayouts({});
      setLockedCharts({});
      setMinimizedCharts({});
    }
  }, [chartWorkspaceStorageKey]);

  const setChartHidden = (cardId, hidden) => {
    if (hidden) {
      setChartVisibilityState(prev => ({ ...prev, [cardId]: "closing" }));
      window.setTimeout(() => {
        setChartLayouts(prev => ({
          ...prev,
          [cardId]: {
            ...(prev[cardId] || {}),
            hidden: true,
          },
        }));
        setChartVisibilityState(prev => {
          const next = { ...prev };
          delete next[cardId];
          return next;
        });
      }, 180);
      return;
    }

    setChartLayouts(prev => ({
      ...prev,
      [cardId]: {
        ...(prev[cardId] || {}),
        hidden: false,
      },
    }));
    setChartVisibilityState(prev => ({ ...prev, [cardId]: "opening" }));
    window.setTimeout(() => {
      setChartVisibilityState(prev => {
        const next = { ...prev };
        delete next[cardId];
        return next;
      });
    }, 220);
  };

  const chartCards = [
    ...allCustomCharts.map(chart => ({
      id: `custom-${chart.id}`,
      kind: chart.type === "pivot" ? "pivot" : chart.type,
      title: chart.title,
      badge: isPinned(String(chart.id)) ? "PINNED" : null,
      pinned: isPinned(String(chart.id)),
      onPin: () => {
        if (isPinned(String(chart.id))) togglePin(String(chart.id));
        else pinCustomChart(String(chart.id));
      },
      onRemove: () => removeCustom(chart.id),
      onRename: t => renameChart(chart.id, t),
      onHide: () => setChartHidden(`custom-${chart.id}`, true),
      isFullscreen: fullscreenChartId === `custom-${chart.id}`,
      render: <RenderChart chart={chart} filteredData={filteredData} />,
      chart: chart,
    })),
    ...(isWide && isPinned("wide_line") && periodData.length > 1 ? [{
      id: "auto-wide-line",
      sourceId: "wide_line",
      kind: "wide_line",
      title: `${valueCol} over Time`,
      badge: isPinned("wide_line") ? "PINNED" : "AUTO",
      pinned: isPinned("wide_line"),
      onPin: () => togglePin("wide_line"),
      onHide: () => setChartHidden("auto-wide-line", true),
      isFullscreen: fullscreenChartId === "auto-wide-line",
      render: <SimpleAreaChart data={periodData} xKey={periodCol} yKey={valueCol} />,
    }] : []),
    ...(isWide && isPinned("wide_primary") && primaryPivot ? [{
      id: "auto-wide-primary",
      sourceId: "wide_primary",
      kind: "pivot",
      title: `${valueCol} by ${primaryCol}`,
      badge: isPinned("wide_primary") ? "PINNED" : "AUTO",
      pinned: isPinned("wide_primary"),
      onPin: () => togglePin("wide_primary"),
      onHide: () => setChartHidden("auto-wide-primary", true),
      isFullscreen: fullscreenChartId === "auto-wide-primary",
      render: (
        <PivotTableRenderer data={
          wideFilters.section!=="all"||wideFilters.name!=="all"
            ? analyticsToPrebuiltPivot({
                headers:[primaryCol,"Production"],
                rows:wideFilteredData.map(r=>[
                  r[primaryCol],
                  activeDateRange.length > 1
                    ? activeDateRange.reduce((s,dc)=>s+(Number(r[dc])||0),0)
                    : (Number(r[effectiveValueCol])||0)
                ])
              }, primaryCol, "Production")
            : primaryPivot
        } />
      ),
    }] : []),
    ...(isWide && isPinned("wide_section") && sectionPivot ? [{
      id: "auto-wide-section",
      sourceId: "wide_section",
      kind: "pivot",
      title: `${valueCol} by Section`,
      badge: isPinned("wide_section") ? "PINNED" : "AUTO",
      pinned: isPinned("wide_section"),
      onPin: () => togglePin("wide_section"),
      onHide: () => setChartHidden("auto-wide-section", true),
      isFullscreen: fullscreenChartId === "auto-wide-section",
      render: (
        <PivotTableRenderer data={
          wideFilters.section!=="all"||wideFilters.name!=="all"
            ? (()=> {
                const grouped={};
                wideFilteredData.forEach(r=>{
                  const s=r[dataSectionCol||"Section"]||"Unknown";
                  const v = activeDateRange.length > 1
                    ? activeDateRange.reduce((sum,dc)=>sum+(Number(r[dc])||0),0)
                    : (Number(r[effectiveValueCol])||0);
                  grouped[s]=(grouped[s]||0)+v;
                });
                const rows=Object.entries(grouped).sort((a,b)=>b[1]-a[1]).map(([s,v])=>({Section:s,[effectiveValueCol]:v}));
                const total=rows.reduce((s,r)=>s+(Number(r[effectiveValueCol])||0),0);
                return { columns:["Section",effectiveValueCol], rows, totalRow:{Section:"Grand Total",[valueCol]:total}, hasColDim:false };
              })()
            : sectionPivot
        } />
      ),
    }] : []),
    ...(!isWide ? (blueprint.charts || []).filter(chart => isPinned(chart.id)).map(chart => ({
      id: `auto-chart-${chart.id}`,
      sourceId: chart.id,
      kind: chart.type,
      title: chart.title,
      badge: isPinned(chart.id) ? "PINNED" : (aiGenerated ? "AI" : "AUTO"),
      pinned: isPinned(chart.id),
      onPin: () => togglePin(chart.id),
      onHide: () => setChartHidden(`auto-chart-${chart.id}`, true),
      isFullscreen: fullscreenChartId === `auto-chart-${chart.id}`,
      render: (
        <>
          {chart.type==="line"&&<LineChartRenderer data={filteredData} config={chart}/>}
          {chart.type==="bar"&&<ClickableBarChart data={groupForBar(filteredData,chart.x,chart.y,20)} config={{x:"name",y:"value"}} labels={{x:chart.x,y:chart.y}}/>}
          {chart.type==="donut"&&<DonutChartRenderer data={filteredData} config={chart}/>}
        </>
      ),
    })) : []),
    ...(!isWide ? (blueprint.pivots || []).filter(pivot => isPinned(pivot.id)).map(pivot => ({
      id: `auto-pivot-${pivot.id}`,
      sourceId: pivot.id,
      kind: "pivot",
      title: pivot.title,
      badge: isPinned(pivot.id) ? "PINNED" : (aiGenerated ? "AI" : "AUTO"),
      pinned: isPinned(pivot.id),
      onPin: () => togglePin(pivot.id),
      onHide: () => setChartHidden(`auto-pivot-${pivot.id}`, true),
      isFullscreen: fullscreenChartId === `auto-pivot-${pivot.id}`,
      render: <PivotTableRenderer data={buildLongPivot(pivot)} />,
    })) : []),
  ];

  const chartCardIds = chartCards.map(card => card.id);
  const orderedChartCards = chartOrder
    .map(id => chartCards.find(card => card.id === id))
    .filter(Boolean);

  const visibleChartCards = orderedChartCards.filter(card => !chartLayouts[card.id]?.hidden);
  const hiddenChartCards = orderedChartCards.filter(card => chartLayouts[card.id]?.hidden);
  const workspaceHeight = visibleChartCards.length
    ? Math.max(
        ...visibleChartCards.map(card => {
          const layout = chartLayouts[card.id] || getChartWorkspaceDefault(card);
          const cardHeight = minimizedCharts[card.id] ? 58 : layout.height;
          return (layout.y || 0) + cardHeight;
        }),
      ) + 24
    : 360;

  const resetSingleChartLayout = (cardId) => {
    const card = chartCards.find(item => item.id === cardId);
    if (!card) return;
    const defaults = getChartWorkspaceDefault(card);
    const nextY = chartCards.reduce((maxBottom, item) => {
      if (item.id === cardId) return maxBottom;
      const layout = chartLayouts[item.id];
      if (!layout || typeof layout.y !== "number") return maxBottom;
      return Math.max(maxBottom, layout.y + (layout.height ?? getChartWorkspaceDefault(item).height));
    }, 0);

    setChartLayouts(prev => ({
      ...prev,
      [cardId]: {
        ...defaults,
        hidden: false,
        x: 0,
        y: nextY > 0 ? nextY + 20 : 0,
      },
    }));
    setMinimizedCharts(prev => ({ ...prev, [cardId]: false }));
    setFullscreenChartId(prev => prev === cardId ? null : prev);
  };

  useEffect(() => {
    if (activeView !== "charts") return;
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const syncWidth = () => {
      const nextWidth = workspace.getBoundingClientRect().width;
      if (nextWidth > 0) setWorkspaceWidth(nextWidth);
    };

    syncWidth();

    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(syncWidth);
    observer.observe(workspace);
    return () => observer.disconnect();
  }, [activeView, chartCardIds.length]);

  useEffect(() => {
    setChartOrder(prev => {
      const kept = prev.filter(id => chartCardIds.includes(id));
      const missing = chartCardIds.filter(id => !kept.includes(id));
      return [...kept, ...missing];
    });

    setChartLayouts(prev => buildChartLayouts(chartCards, prev, workspaceWidth));
  }, [chartCardIds.join("|"), workspaceWidth]);

  useEffect(() => {
    try {
      localStorage.setItem(chartWorkspaceStorageKey, JSON.stringify({
        order: chartOrder,
        layouts: chartLayouts,
        lockedCharts,
        minimized: minimizedCharts,
      }));
    } catch {}
  }, [chartWorkspaceStorageKey, chartOrder, chartLayouts, lockedCharts, minimizedCharts]);

  const handleChartDragStart = (event, cardId) => {
    if (lockedCharts[cardId]) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (event.button !== 0) return;

    const workspace = workspaceRef.current;
    const layout = chartLayouts[cardId];
    if (!workspace || !layout) return;

    const workspaceRect = workspace.getBoundingClientRect();
    const cardWidth = getCardPixelWidth(layout.span, workspaceRect.width);
    dragRef.current = {
      cardId,
      workspaceRect,
      cardWidth,
      offsetX: event.clientX - workspaceRect.left - (layout.x || 0),
      offsetY: event.clientY - workspaceRect.top - (layout.y || 0),
    };
    setDraggedChartId(cardId);

    const onPointerMove = moveEvent => {
      const state = dragRef.current;
      if (!state) return;

      const nextX = Math.max(
        0,
        Math.min(
          state.workspaceRect.width - state.cardWidth,
          moveEvent.clientX - state.workspaceRect.left - state.offsetX,
        ),
      );
      const nextY = Math.max(0, moveEvent.clientY - state.workspaceRect.top - state.offsetY);

      setChartLayouts(prev => ({
        ...prev,
        [cardId]: {
          ...(prev[cardId] || {}),
          x: nextX,
          y: nextY,
        },
      }));
    };

    const onPointerUp = () => {
      dragRef.current = null;
      setDraggedChartId(null);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  const handleChartResizeStart = (event, cardId) => {
    if (lockedCharts[cardId]) return;
    event.preventDefault();
    event.stopPropagation();
    const workspace = workspaceRef.current;
    if (!workspace) return;

    const current = chartLayouts[cardId] || { span: 6, height: 430 };
    resizeRef.current = {
      cardId,
      startX: event.clientX,
      startY: event.clientY,
      startSpan: current.span,
      startHeight: current.height,
      workspaceWidth: workspace.getBoundingClientRect().width,
    };

    const onPointerMove = moveEvent => {
      const state = resizeRef.current;
      if (!state) return;
      const dx = moveEvent.clientX - state.startX;
      const dy = moveEvent.clientY - state.startY;
      const colWidth = Math.max(state.workspaceWidth / 12, 1);
      const span = Math.max(4, Math.min(12, Math.round((state.startSpan * colWidth + dx) / colWidth)));
      const height = Math.max(320, Math.min(760, state.startHeight + dy));
      setChartLayouts(prev => ({
        ...prev,
        [cardId]: {
          ...(prev[cardId] || {}),
          span,
          height,
          x: Math.max(0, Math.min(prev[cardId]?.x ?? 0, state.workspaceWidth - getCardPixelWidth(span, state.workspaceWidth))),
        },
      }));
    };

    const onPointerUp = () => {
      resizeRef.current = null;
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  };

  return (
    <div style={{ padding: "48px 40px 80px", width: "100%", fontFamily: "'Manrope',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>

      {aiGenerated&&datasetSummary&&<AIBanner summary={datasetSummary}/>}
      <DashboardNav activeView={activeView} setActiveView={setActiveView} pinnedCount={validPinnedIds.length} filteredTableCount={filteredTables.length}/>

      {/* ── HOME TAB ─────────────────────────────────────── */}
      {activeView==="home" && (
        <>
          {/* Wide format: WideFilterBar with section/name/date dropdowns
              Long format: GlobalFilterBar with date + category dropdowns */}
          {isWide
            ? <WideFilterBar
                wideDateCols={wideDateCols}
                objectData={objectData}
                wideFilters={wideFilters}
                setWideFilters={setWideFilters}
                primaryCol={dataPrimaryCol}
                sectionCol={dataSectionCol}
              />
            : <GlobalFilterBar
                dateCol={dateCol}
                dateOptions={dateOptions}
                filters={filters}
                setFilters={setFilters}
                categoryColumns={categoryColumns}
                objectData={objectData}
              />
          }

          {isWide&&blueprint.cards?.length>0&&<StaticSummaryCards
            cards={blueprint.cards}
            analytics={analytics}
            filteredData={wideFilteredData}
            primaryCol={dataPrimaryCol}
            sectionCol={dataSectionCol}
            valueCol={effectiveValueCol}
            activeDateRange={activeDateRange}
            isFiltered={wideFilters.section!=="all"||wideFilters.name!=="all"||isDateFiltered}
          />}
          {!isWide&&<SummaryCards data={filteredData} cards={blueprint.cards}/>}

          {!isWide&&dateCol&&dateOptions.length>=2&&(
            <div style={{marginBottom:20}}>
              <button onClick={()=>setShowCompare(v=>!v)} style={{padding:"8px 16px",borderRadius:10,fontSize:12,fontWeight:700,cursor:"pointer",border:`1px solid ${showCompare?LW.green:UI.border}`,background:showCompare?LW.green:UI.surface,color:showCompare?"#fff":UI.text,boxShadow:"var(--color-shadow-soft)"}}>
                {showCompare?"▲ Hide Comparison":"⚖️ Compare Periods"}
              </button>
            </div>
          )}

          {showCompare&&dateCol&&dateOptions.length>=2&&(
            <CompareCards blueprint={blueprint} objectData={objectData} dateCol={dateCol} dateOptions={dateOptions} isWide={isWide}/>
          )}

          {/* AI filtered tables from chatbot — bottom of summary */}
          {filteredTables.map(table => {
            const applyTableFilter = () => {
              return objectData.filter(row =>
                (table.filters||[]).every(({ column, operator, value }) => {
                  const cell = row[column];
                  const cellStr = cell === null || cell === undefined ? "" : String(cell).trim();
                  const cellNum = parseFloat(cellStr.replace(/,/g, ""));
                  const valNum = parseFloat(String(value).replace(/,/g, ""));
                  switch (operator) {
                    case "eq":       return cellStr.toLowerCase() === String(value).toLowerCase();
                    case "neq":      return cellStr.toLowerCase() !== String(value).toLowerCase();
                    case "contains": return cellStr.toLowerCase().includes(String(value).toLowerCase());
                    case "gt":       return !isNaN(cellNum) && cellNum > valNum;
                    case "gte":      return !isNaN(cellNum) && cellNum >= valNum;
                    case "lt":       return !isNaN(cellNum) && cellNum < valNum;
                    case "lte":      return !isNaN(cellNum) && cellNum <= valNum;
                    default: return true;
                  }
                })
              );
            };
            const displayCols = (table.columns||[]).filter(c => headers.includes(c));
            let matchedRows = applyTableFilter();
            // Sort if table has sort config
            if (table.sort_col && displayCols.includes(table.sort_col)) {
              const col = table.sort_col;
              const dir = table.sort_dir === "asc" ? 1 : -1;
              matchedRows = [...matchedRows].sort((a, b) => {
                const av = a[col], bv = b[col];
                const an = parseFloat(String(av).replace(/,/g, "")), bn = parseFloat(String(bv).replace(/,/g, ""));
                if (!isNaN(an) && !isNaN(bn)) return (an - bn) * dir;
                return String(av||"").localeCompare(String(bv||"")) * dir;
              });
            }
            // Limit rows if set
            const limitedRows = table.limit ? matchedRows.slice(0, table.limit) : matchedRows;
            const displayRows = limitedRows.map(row => displayCols.map(col => row[col] === undefined ? null : row[col]));
            return (
              <Section key={table.id}>
                <SectionHeader
                  title={table.title}
                  subtitle={`${limitedRows.length}${table.limit && matchedRows.length > table.limit ? ` of ${matchedRows.length}` : ""} row${limitedRows.length !== 1 ? "s" : ""}${table.sort_col ? ` · sorted by ${table.sort_col} ${table.sort_dir||"desc"}` : ""} · AI filtered`}
                  badge="AI FILTER"
                  onPin={() => togglePin(String(table.id))}
                  pinned={isPinned(String(table.id))}
                  onRename={newTitle => renameFilteredTable(table.id, newTitle)}
                  onRemove={() => removeFilteredTable(table.id)}
                />
                <DataTable headers={displayCols} rows={displayRows}/>
              </Section>
            );
          })}

          <Section style={{
            padding: customBuilderMinimized ? "16px 20px" : 24,
            minHeight: customBuilderMinimized ? 70 : "auto",
            transition: "padding 0.28s ease, min-height 0.28s ease, box-shadow 0.24s ease"
          }}>
            <SectionHeader
              title="Data Table"
              subtitle={`${(isWide ? wideFilteredData : filteredData).length.toLocaleString()} of ${objectData.length.toLocaleString()} rows · ${(isWide ? wideVisibleHeaders : headers).length} columns${isWide&&isDateFiltered?(activeDateRange.length===1?` · ${activeDateRange[0]}`:(dateFrom!=="all"&&dateTo!=="all"?` · ${dateFrom} → ${dateTo}`:dateFrom!=="all"?` · From ${dateFrom}`:` · To ${dateTo}`)):""}${!isWide&&(Object.keys(filters.categories).length>0||filters.date!=="all")?" · filtered":""}`}
              badge="RAW DATA"
            />
            <DataTable
              headers={isWide ? wideVisibleHeaders : headers}
              rows={isWide
                ? wideFilteredData.map(row => wideVisibleHeaders.map(h => row[h] === undefined ? null : row[h]))
                : filteredRows
              }
            />
          </Section>

        </>
      )}

      {/* ── CHARTS TAB ───────────────────────────────────── */}
      {activeView==="charts" && (
        <>
          {/* Custom builder */}
          <Section style={{ paddingBottom: customBuilderMinimized ? 18 : 24, transition: "padding 0.28s ease, box-shadow 0.24s ease" }}>
            <SectionHeader
              title="Custom Builder"
              subtitle="Build your own chart or pivot table"
              onToggleMinimize={() => setCustomBuilderMinimized(prev => !prev)}
              minimized={customBuilderMinimized}
              marginBottom={customBuilderMinimized ? 0 : 20}
            />
            <div
              style={{
                maxHeight: customBuilderMinimized ? 0 : 420,
                opacity: customBuilderMinimized ? 0 : 1,
                overflow: "hidden",
                transform: customBuilderMinimized ? "translateY(-6px)" : "translateY(0)",
                transition: "max-height 0.34s ease, opacity 0.22s ease, transform 0.22s ease",
                pointerEvents: customBuilderMinimized ? "none" : "auto",
                marginTop: customBuilderMinimized ? 0 : 2,
              }}
            >
              <ChartBuilder columns={headers} sampleData={objectData.slice(0,50)} onGenerate={(config)=>{
              const id=Date.now(); let result;
              const spec=config; // save full config as spec for Firestore rebuild
              if(config.outputType==="pivot")result={id,type:"pivot",title:config.title,xCol:config.rowGroup,spec,pivotData:generatePivot(filteredData,config.rowGroup,config.columnGroup,config.metric,config.aggregation)};
              else if(config.outputType==="bar")result={id,type:"bar",title:config.title,xCol:config.rowGroup,spec,config:{x:config.rowGroup,y:config.metric},chartData:groupForBar(filteredData,config.rowGroup,config.metric,config.topN,config.aggregation)};
              else if(config.outputType==="hbar")result={id,type:"hbar",title:config.title,xCol:config.rowGroup,spec,config:{x:config.rowGroup,y:config.metric},chartData:groupForBar(filteredData,config.rowGroup,config.metric,config.topN,config.aggregation)};
              else if(config.outputType==="line")result={id,type:"line",title:config.title,spec,config:{x:config.rowGroup,y:config.metric}};
              else if(config.outputType==="donut")result={id,type:"donut",title:config.title,spec,config:{x:config.rowGroup,y:config.metric,topN:config.topN}};
              if(result) {
                setCustomCharts(prev=>[result,...prev]); // session only — persists on pin
              }
            }}/>
            </div>
          </Section>

          {hiddenChartCards.length > 0 && (
            <div style={{ marginBottom: 20, padding: "14px 16px", borderRadius: 14, background: UI.surfaceElevated, border: `1px solid ${UI.border}`, boxShadow: "var(--color-shadow-soft)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9cafa4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
                Hidden Charts
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                {hiddenChartCards.map(card => {
                  const pinned = card.pinned;
                  return (
                    <div key={card.id} style={{ display: "flex", alignItems: "center", borderRadius: 999, border: `1px solid ${UI.border}`, background: UI.surface, overflow: "hidden" }}>
                      <button
                        onClick={() => setChartHidden(card.id, false)}
                        style={{ padding: "8px 12px", background: "none", border: "none", color: UI.text, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                      >
                        Show {card.title}
                      </button>
                      {card.onPin && (
                        <>
                          <div style={{ width: 1, height: 20, background: UI.border }} />
                          <button
                            onClick={card.onPin}
                            title={pinned ? "Unpin" : "Pin chart"}
                            style={{ padding: "8px 10px", background: "none", border: "none", cursor: "pointer", fontSize: 13, color: pinned ? LW.green : "#9cafa4", display: "flex", alignItems: "center" }}
                          >
                            {pinned ? "📌" : "📍"}
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 18, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9cafa4", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>
                Chart Workspace
              </div>
              <p style={{ fontSize: 13, color: UI.textLight, margin: 0 }}>
                Created charts and pinned charts live here. Each chart has its own drag and reset controls in the window header.
              </p>
            </div>
          </div>

          {chartCards.length === 0 ? (
            <div style={{ background: UI.surfaceElevated, border: `1px solid ${UI.border}`, borderRadius: 18, padding: "48px 32px", textAlign: "center", boxShadow: "var(--color-shadow-soft)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9cafa4", textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 10 }}>
                Charts Dashboard
              </div>
              <h2 style={{ fontSize: 26, fontWeight: 800, color: UI.text, margin: 0 }}>No charts added yet.</h2>
              <p style={{ fontSize: 14, color: UI.textLight, marginTop: 10 }}>
                Create charts using the chatbot or pin them here from the generated results.
              </p>
            </div>
          ) : (
            <div
              ref={workspaceRef}
              style={{ position: "relative", minHeight: workspaceHeight }}
            >
              {visibleChartCards.filter(card => card.id !== fullscreenChartId).map(card => (
              <ChartWorkspaceCard
                key={card.id}
                card={card}
                layout={chartLayouts[card.id] || getChartWorkspaceDefault(card)}
                workspaceWidth={workspaceWidth}
                locked={Boolean(lockedCharts[card.id])}
                minimized={Boolean(minimizedCharts[card.id])}
                visibilityState={chartVisibilityState[card.id]}
                isDragging={draggedChartId === card.id}
                onDragStart={handleChartDragStart}
                onResizeStart={handleChartResizeStart}
                onToggleDrag={() => setLockedCharts(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                onResetLayout={() => resetSingleChartLayout(card.id)}
                onToggleMinimize={() => setMinimizedCharts(prev => ({ ...prev, [card.id]: !prev[card.id] }))}
                onToggleFullscreen={() => setFullscreenChartId(prev => prev === card.id ? null : card.id)}
                >
                  {card.render}
                </ChartWorkspaceCard>
              ))}
            </div>
          )}

          {fullscreenChartId && (() => {
            const fullscreenCard = chartCards.find(card => card.id === fullscreenChartId);
            if (!fullscreenCard) return null;
            return (
              <div style={{ position: "fixed", inset: 0, zIndex: 160, background: "rgba(6, 16, 12, 0.72)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
                <div style={{ width: "min(1800px, 96%)", height: "calc(100vh - 48px)", background: UI.surfaceElevated, borderRadius: 20, border: `1px solid ${UI.border}`, boxShadow: "0 24px 60px rgba(0,0,0,0.32)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "14px 20px", borderBottom: `1px solid ${UI.border}`, flexShrink: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: "#ef4444" }} />
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: "#f59e0b" }} />
                        <span style={{ width: 10, height: 10, borderRadius: 999, background: "#10b981" }} />
                      </div>
                      <div style={{ fontSize: 16, fontWeight: 800, color: UI.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {fullscreenCard.title}
                      </div>
                    </div>
                    <button onClick={() => setFullscreenChartId(null)} style={{ background: "none", border: `1px solid ${UI.border}`, borderRadius: 10, padding: "6px 14px", cursor: "pointer", fontSize: 12, fontWeight: 700, color: UI.text }}>
                      Close fullscreen
                    </button>
                  </div>
                  {/* Chart — fills remaining height */}
                  <div style={{ flex: 1, minHeight: 0, padding: "24px 32px", display: "flex", flexDirection: "column" }}>
                    <div style={{ flex: 1, minHeight: 0 }}>
                      <FullscreenChartWrapper card={fullscreenCard} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </>
      )}

      <DataChatbot headers={headers} rows={filteredRows} blueprint={blueprint} onResult={handleChatResult} customCharts={allCustomCharts.map(c=>({...c, pinned: isPinned(String(c.id))}))} filteredTables={filteredTables.map(t=>({...t, pinned: isPinned(String(t.id))}))}/>
    </div>
  );
}
