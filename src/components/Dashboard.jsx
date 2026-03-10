import SummaryCards from "./SummaryCards";
import BarChartRenderer from "./BarChartRenderer";
import LineChartRenderer from "./LineChartRenderer";
import DonutChartRenderer from "./DonutChartRenderer";
import { useEffect, useMemo, useState, useCallback } from "react";
import ChartBuilder from "./ChartBuilder";
import PivotTableRenderer from "./PivotTableRenderer";
import DataTable from "./DataTable";
import DataChatbot from "./DataChatBot";
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
const CHART_COLORS = ["#046241","#059669","#10b981","#34d399","#6ee7b7","#a7f3d0","#FFB347","#f97316","#3b82f6","#8b5cf6"];
const CMP = { a:"#046241", b:"#FFB347" };

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDateValue(v) { if(!v)return null; const d=new Date(v); return isNaN(d.getTime())?null:d; }
function toDateKey(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function formatDateLabel(k) { const d=new Date(`${k}T00:00:00`); return isNaN(d.getTime())?k:d.toLocaleDateString("en-US",{year:"numeric",month:"short",day:"numeric"}); }

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
    const colRaw=columnField?row[columnField]:"Value";
    const colKey=columnField?(colRaw!=null?String(colRaw).trim().toLowerCase():null):"Value";
    const value=Number(row[metric])||0;
    if(!rowKey||!colKey)return;
    columnSet.add(colKey);
    if(!result[rowKey])result[rowKey]={};
    if(!result[rowKey][colKey])result[rowKey][colKey]=[];
    result[rowKey][colKey].push(value);
  });
  const columnKeys=Array.from(columnSet).sort();
  const columnLabels=columnField?columnKeys.map(k=>colLabelMap[k]||k):["Value"];
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

function groupForBar(data, xField, yField, topN=15) {
  const grouped={};
  data.forEach(row=>{
    const raw=row[xField]!=null?String(row[xField]).trim():null;
    if(!raw)return;
    const k=raw.toLowerCase();
    if(!grouped[k])grouped[k]={label:raw,value:0};
    grouped[k].value+=Number(row[yField])||0;
  });
  return Object.values(grouped).map(({label,value})=>({name:label,value})).sort((a,b)=>b.value-a.value).slice(0,topN);
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

// ── UI primitives ──────────────────────────────────────────────────────────────

function Section({ children, accent, pinned }) {
  return (
    <div style={{ background:UI.surfaceElevated, borderRadius:16, padding:24, marginBottom:20,
      boxShadow: pinned?"0 2px 16px rgba(4,98,65,0.18)":"var(--color-shadow-soft)",
      border: pinned?`1.5px solid ${LW.green}`:`1px solid ${UI.border}`,
      borderLeft: accent?`4px solid ${accent}`:pinned?`4px solid ${LW.green}`:`1px solid ${UI.border}`,
      fontFamily:"'Manrope',sans-serif" }}>
      {children}
    </div>
  );
}

function SectionHeader({ title, subtitle, badge, onPin, pinned, onRemove }) {
  const bs = { AI:{bg:LW.dark,color:LW.saffron}, AUTO:{bg:LW.green,color:"#fff"}, "RAW DATA":{bg:LW.paper,color:LW.dark}, CUSTOM:{bg:"#fff3dc",color:"#c17110"}, PINNED:{bg:LW.green,color:"#fff"}, "AI FILTER":{bg:LW.dark,color:LW.saffron} };
  const b = bs[badge]||{bg:LW.paper,color:LW.dark};
  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
      <div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:LW.dark, margin:0, letterSpacing:"-0.02em" }}>{title}</h3>
          {badge && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:100, fontWeight:700, letterSpacing:"0.08em", background:b.bg, color:b.color }}>{badge}</span>}
        </div>
        {subtitle && <p style={{ fontSize:12, color:"#9cafa4", margin:"4px 0 0", fontWeight:500 }}>{subtitle}</p>}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
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
      <span style={{ fontSize:20, flexShrink:0 }}>✨</span>
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

function DrilldownBanner({ filters, setFilters }) {
  const entries = Object.entries(filters.categories);
  const isDateFiltered = filters.dateFrom!=="all" || filters.dateTo!=="all";
  if (!entries.length && !isDateFiltered) return null;
  return (
    <div style={{ background:"#f0fdf4", border:"1px solid #bbf7d0", borderRadius:10, padding:"10px 16px", marginBottom:16, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap", fontFamily:"'Manrope',sans-serif" }}>
      <span style={{ fontSize:11, fontWeight:700, color:LW.green }}>⚡ Filtered view</span>
      {isDateFiltered && (
        <span style={{ fontSize:11, background:"#dcfce7", color:LW.green, borderRadius:100, padding:"2px 10px", fontWeight:700 }}>
          📅 {filters.dateFrom!=="all"?formatDateLabel(filters.dateFrom):"Start"} → {filters.dateTo!=="all"?formatDateLabel(filters.dateTo):"End"}
          <button onClick={()=>setFilters(f=>({...f,dateFrom:"all",dateTo:"all"}))} style={{ background:"none", border:"none", cursor:"pointer", padding:"0 0 0 4px", color:LW.green, fontSize:13 }}>×</button>
        </span>
      )}
      {entries.map(([col,val])=>(
        <span key={col} style={{ fontSize:11, background:"#dcfce7", color:LW.green, borderRadius:100, padding:"2px 10px", fontWeight:700, display:"inline-flex", alignItems:"center", gap:5 }}>
          {col}: {val}
          <button onClick={()=>setFilters(f=>{const c={...f.categories};delete c[col];return{...f,categories:c};})} style={{ background:"none", border:"none", cursor:"pointer", padding:0, color:LW.green, fontSize:13 }}>×</button>
        </span>
      ))}
      <button onClick={()=>setFilters({dateFrom:"all",dateTo:"all",categories:{}})} style={{ marginLeft:"auto", fontSize:11, fontWeight:700, color:"#9cafa4", background:"none", border:"none", cursor:"pointer" }}>Clear all</button>
    </div>
  );
}

// ── Comparison Mode ────────────────────────────────────────────────────────────

function CompareCards({ blueprint, objectData, dateCol, dateOptions, isWide }) {
  const [mode, setMode] = useState("day");
  const [dateA, setDateA] = useState(dateOptions[0]||"");
  const [dateB, setDateB] = useState(dateOptions[1]||"");

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
            {dateOptions.map(d=><option key={d} value={d}>{formatDateLabel(d)}</option>)}
          </select>
          <span style={{ fontSize:12, color:"#9cafa4", fontWeight:700 }}>vs</span>
          <span style={{ width:10,height:10,borderRadius:2,background:CMP.b,display:"inline-block" }}/>
          <select value={dateB} onChange={e=>setDateB(e.target.value)} style={{ padding:"5px 10px", borderRadius:8, border:`1.5px solid ${UI.border}`, fontSize:12, color:UI.text, background:UI.surface, outline:"none", cursor:"pointer" }}>
            {dateOptions.map(d=><option key={d} value={d}>{formatDateLabel(d)}</option>)}
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

function ClickableBarChart({ data, config, onDrilldown }) {
  const xKey=config?.x||"name", yKey=config?.y||"value";
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{top:5,right:20,left:10,bottom:60}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
        <XAxis dataKey={xKey} tick={{fontSize:11,fill:"#6b7280"}} angle={-35} textAnchor="end" interval={0}/>
        <YAxis tick={{fontSize:12,fill:"#6b7280"}} tickFormatter={v=>v.toLocaleString()}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:8,border:"1px solid #e5e7eb",fontSize:13}}/>
        <Bar dataKey={yKey} radius={[4,4,0,0]} cursor={onDrilldown?"pointer":"default"} onClick={d=>onDrilldown&&onDrilldown(d[xKey])}>
          {data.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ data, config, onDrilldown }) {
  const xKey=config?.x||"name", yKey=config?.y||"value";
  return (
    <ResponsiveContainer width="100%" height={Math.max(260,data.length*34)}>
      <BarChart data={data} layout="vertical" margin={{top:5,right:40,left:120,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false}/>
        <XAxis type="number" tick={{fontSize:11,fill:"#6b7280"}} tickFormatter={v=>v.toLocaleString()}/>
        <YAxis type="category" dataKey={xKey} tick={{fontSize:11,fill:"#6b7280"}} width={110}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:8,border:"1px solid #e5e7eb",fontSize:13}}/>
        <Bar dataKey={yKey} radius={[0,4,4,0]} cursor={onDrilldown?"pointer":"default"} onClick={d=>onDrilldown&&onDrilldown(d[xKey])}>
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false}/>
        <XAxis dataKey="name" tick={{fontSize:11,fill:"#6b7280"}} angle={-35} textAnchor="end" interval={0}/>
        <YAxis tick={{fontSize:12,fill:"#6b7280"}} tickFormatter={v=>v.toLocaleString()}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:8,border:"1px solid #e5e7eb",fontSize:13}}/>
        {stackKeys.map((k,i)=><Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i%CHART_COLORS.length]} radius={i===stackKeys.length-1?[4,4,0,0]:[0,0,0,0]}/>)}
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
        <CartesianGrid strokeDasharray="3 3" stroke="#f0ece4" vertical={false}/>
        <XAxis dataKey={xKey} tick={{fontSize:11,fill:"#9cafa4"}} angle={angle} textAnchor={angle!==0?"end":"middle"} interval={data.length>30?Math.floor(data.length/15):0} axisLine={false} tickLine={false}/>
        <YAxis tick={{fontSize:11,fill:"#9cafa4"}} tickFormatter={v=>v.toLocaleString()} axisLine={false} tickLine={false}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:10,border:"none",background:LW.dark,color:"#fff",fontSize:13}} labelStyle={{color:"#9cafa4",fontSize:11}}/>
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
      <div style={{background:"#fff",borderRadius:16,padding:"20px 22px",borderLeft:`4px solid ${accent}`,boxShadow:"0 1px 6px rgba(19,48,32,0.06)",fontFamily:"'Manrope',sans-serif"}}
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
          <div key={card.id||idx} style={{background:"#fff",borderRadius:14,padding:"20px 22px",borderLeft:`4px solid ${accent}`,boxShadow:"0 1px 6px rgba(19,48,32,0.06)",transition:"transform 0.2s,box-shadow 0.2s"}}
            onMouseEnter={e=>{e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow="0 6px 20px rgba(19,48,32,0.10)"}}
            onMouseLeave={e=>{e.currentTarget.style.transform="none";e.currentTarget.style.boxShadow="0 1px 6px rgba(19,48,32,0.06)"}}>
            <div style={{fontSize:10,fontWeight:700,color:"#9cafa4",letterSpacing:"0.1em",textTransform:"uppercase",marginBottom:8}}>{card.label}</div>
            <div style={{fontSize:30,fontWeight:800,color:accent,letterSpacing:"-0.03em",lineHeight:1}}>{formatNum(card.value,card.formatHint)}</div>
          </div>
        );
      })}
    </div>
  );
}

// ── Render a single chart/pivot by spec ───────────────────────────────────────

function RenderChart({ chart, filteredData, onDrilldown }) {
  if (chart.type==="pivot") return <PivotTableRenderer data={chart.pivotData}/>;
  if (chart.type==="bar") return <ClickableBarChart data={chart.chartData} config={{x:"name",y:"value"}} onDrilldown={v=>onDrilldown&&onDrilldown(chart.xCol,v)}/>;
  if (chart.type==="hbar") return <HorizontalBarChart data={chart.chartData} config={{x:"name",y:"value"}} onDrilldown={v=>onDrilldown&&onDrilldown(chart.xCol,v)}/>;
  if (chart.type==="stacked") return <StackedBarChart data={chart.chartData}/>;
  if (chart.type==="line") return <LineChartRenderer data={filteredData} config={chart.config}/>;
  if (chart.type==="donut") return <DonutChartRenderer data={filteredData} config={chart.config}/>;
  return null;
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard({ data, blueprint, fileId }) {
  const { headers, rows } = data;
  const [customCharts, setCustomCharts] = useState([]);
  const [filteredTables, setFilteredTables] = useState([]);
  const [activeView, setActiveView] = useState("home");
  const [showCompare, setShowCompare] = useState(false);
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
  const pinKey = `pinned_${fileId||"default"}`;
  const [pinnedIds, setPinnedIds] = useState(()=>{ try{return JSON.parse(localStorage.getItem(pinKey)||"[]");}catch{return[];} });
  const savePins = (ids) => { setPinnedIds(ids); try{localStorage.setItem(pinKey,JSON.stringify(ids));}catch{} };
  const togglePin = (id) => savePins(pinnedIds.includes(id)?pinnedIds.filter(p=>p!==id):[...pinnedIds,id]);
  const isPinned = (id) => pinnedIds.includes(id);

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

  // Click chart → drilldown
  const handleDrilldown = useCallback((col,val)=>{
    if(!col||!val)return;
    setFilters(f=>({...f,categories:{...f.categories,[col]:val}}));
  },[]);

  const removeCustom = (id) => setCustomCharts(prev=>prev.filter(c=>c.id!==id));
  const removeFilteredTable = (id) => setFilteredTables(prev=>prev.filter(t=>t.id!==id));

  const handleChatResult = ({ chartSpec, filterSpec }) => {
    if (filterSpec) {
      const id = Date.now();
      setFilteredTables(prev => [{ id, ...filterSpec }, ...prev]);
      setActiveView("home");
    } else if (chartSpec) {
      const spec = chartSpec;
      const id = Date.now();
      const title = spec.title || `${spec.measure||spec.y||""} by ${spec.rowDim||spec.x||""}`;
      let result;
      if(spec.type==="pivot") result={id,type:"pivot",title,xCol:spec.rowDim,pivotData:generatePivot(filteredData,spec.rowDim,spec.colDim||null,spec.measure,spec.aggregation||"sum")};
      else if(spec.type==="bar") result={id,type:"bar",title,xCol:spec.x,chartData:groupForBar(filteredData,spec.x,spec.y,20)};
      else if(spec.type==="line") result={id,type:"line",title,config:{x:spec.x,y:spec.y}};
      else if(spec.type==="donut") result={id,type:"donut",title,config:{x:spec.x,y:spec.y}};
      if(result) { setCustomCharts(prev=>[result,...prev]); setActiveView("charts"); }
    }
  };

  const periodData = analytics?analyticsToObjects(analytics.periodTotals):[];
  const primaryCol = analytics?.primaryCol||dataPrimaryCol||"Entity";
  const valueCol = analytics?.valueCol||"Total Production";
  const periodCol = analytics?.periodCol||"Period";
  const primaryPivot = analytics?.primaryTotals?analyticsToPrebuiltPivot(analytics.primaryTotals,primaryCol,valueCol):null;
  const sectionPivot = analytics?.sectionTotals?analyticsToPrebuiltPivot(analytics.sectionTotals,"Section",valueCol):null;

  // Date range helpers
  const { dateFrom, dateTo } = wideFilters;
  const isDateFiltered = dateFrom !== "all" || dateTo !== "all";
  const fromIdx = dateFrom !== "all" ? wideDateCols.indexOf(dateFrom) : 0;
  const toIdx   = dateTo   !== "all" ? wideDateCols.indexOf(dateTo)   : wideDateCols.length - 1;
  const activeDateRange = isDateFiltered ? wideDateCols.slice(fromIdx, toIdx + 1) : [];

  // For a single date, rank by that column directly.
  // For a range, sum across columns on the fly — effectiveValueCol stays as Total Production
  // but StaticSummaryCards will receive activeDateRange and sum live.
  const activeDateCol = activeDateRange.length === 1 ? activeDateRange[0] : null;
  const effectiveValueCol = activeDateCol || valueCol;

  function buildLongPivot(pivotDef) { return generatePivot(filteredData,pivotDef.rowDim,pivotDef.colDim||null,pivotDef.measure,pivotDef.aggregation||"sum"); }

  const autoIds = isWide
    ? ["wide_line",...(primaryPivot?["wide_primary"]:[]),...(sectionPivot?["wide_section"]:[])]
    : [...(blueprint.charts||[]).map(c=>c.id),...(blueprint.pivots||[]).map(p=>p.id)];

  const pinnedAutoIds = pinnedIds.filter(id=>autoIds.includes(id));
  const pinnedCustom = customCharts.filter(c=>pinnedIds.includes(String(c.id)));
  const pinnedCount = pinnedIds.length;

  const Divider = ({label}) => (
    <div style={{position:"relative",margin:"8px 0 24px",textAlign:"center"}}>
      <div style={{height:1,background:"#e8e3d9"}}/>
      <span style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:LW.salt,padding:"0 16px",fontSize:10,fontWeight:700,color:"#9cafa4",letterSpacing:"0.12em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
    </div>
  );

  return (
    <div style={{ padding: "48px 32px 80px", maxWidth: 1280, width: "100%", margin: "0 auto", fontFamily: "'Manrope',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');`}</style>

      {aiGenerated&&datasetSummary&&<AIBanner summary={datasetSummary}/>}
      <DashboardNav activeView={activeView} setActiveView={setActiveView} pinnedCount={pinnedCount} filteredTableCount={filteredTables.length}/>

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
          <DrilldownBanner filters={filters} setFilters={setFilters}/>

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

          <Section>
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
            const matchedRows = applyTableFilter();
            const displayRows = matchedRows.map(row => displayCols.map(col => row[col] === undefined ? null : row[col]));
            return (
              <Section key={table.id}>
                <SectionHeader
                  title={table.title}
                  subtitle={`${matchedRows.length} row${matchedRows.length !== 1 ? "s" : ""} · AI filtered`}
                  badge="AI FILTER"
                  onRemove={() => removeFilteredTable(table.id)}
                />
                <DataTable headers={displayCols} rows={displayRows}/>
              </Section>
            );
          })}
        </>
      )}

      {/* ── CHARTS TAB ───────────────────────────────────── */}
      {activeView==="charts" && (
        <>
          <DrilldownBanner filters={filters} setFilters={setFilters}/>

          {/* Pinned section */}
          {(pinnedAutoIds.length>0||pinnedCustom.length>0)&&(
            <>
              <div style={{fontSize:11,fontWeight:700,color:LW.green,textTransform:"uppercase",letterSpacing:"0.1em",marginBottom:12}}>📌 Pinned Charts</div>

              {pinnedCustom.map(chart=>(
                <div key={chart.id} style={{background:"#fff",borderRadius:16,padding:24,marginBottom:20,boxShadow:"0 2px 16px rgba(4,98,65,0.12)",border:`1.5px solid ${LW.green}`,borderLeft:`4px solid ${LW.green}`}}>
                  <SectionHeader title={chart.title} badge="PINNED" onPin={()=>togglePin(String(chart.id))} pinned={true} onRemove={()=>removeCustom(chart.id)}/>
                  <RenderChart chart={chart} filteredData={filteredData} onDrilldown={handleDrilldown}/>
                </div>
              ))}

              {isWide&&pinnedAutoIds.includes("wide_line")&&periodData.length>1&&(
                <Section pinned><SectionHeader title={`${valueCol} over Time`} badge="PINNED" onPin={()=>togglePin("wide_line")} pinned={true}/><SimpleAreaChart data={periodData} xKey={periodCol} yKey={valueCol}/></Section>
              )}
              {isWide&&pinnedAutoIds.includes("wide_primary")&&primaryPivot&&(
                <Section pinned><SectionHeader title={`${valueCol} by ${primaryCol}`} badge="PINNED" onPin={()=>togglePin("wide_primary")} pinned={true}/><PivotTableRenderer data={primaryPivot}/></Section>
              )}
              {isWide&&pinnedAutoIds.includes("wide_section")&&sectionPivot&&(
                <Section pinned><SectionHeader title={`${valueCol} by Section`} badge="PINNED" onPin={()=>togglePin("wide_section")} pinned={true}/><PivotTableRenderer data={sectionPivot}/></Section>
              )}
              {!isWide&&blueprint.charts?.filter(c=>pinnedAutoIds.includes(c.id)).map(chart=>(
                <Section key={chart.id} pinned>
                  <SectionHeader title={chart.title} badge="PINNED" onPin={()=>togglePin(chart.id)} pinned={true}/>
                  {chart.type==="line"&&<LineChartRenderer data={filteredData} config={chart}/>}
                  {chart.type==="bar"&&<ClickableBarChart data={groupForBar(filteredData,chart.x,chart.y,20)} config={{x:"name",y:"value"}} onDrilldown={v=>handleDrilldown(chart.x,v)}/>}
                  {chart.type==="donut"&&<DonutChartRenderer data={filteredData} config={chart}/>}
                </Section>
              ))}
              {!isWide&&blueprint.pivots?.filter(p=>pinnedAutoIds.includes(p.id)).map(pivot=>(
                <Section key={pivot.id} pinned>
                  <SectionHeader title={pivot.title} badge="PINNED" onPin={()=>togglePin(pivot.id)} pinned={true}/>
                  <PivotTableRenderer data={buildLongPivot(pivot)}/>
                </Section>
              ))}
              <Divider label="All Charts"/>
            </>
          )}

          {/* Custom builder */}
          <Section>
            <SectionHeader title="Custom Builder" subtitle="Build your own chart or pivot table"/>
            <ChartBuilder columns={headers} sampleData={objectData.slice(0,50)} onGenerate={(config)=>{
              const id=Date.now(); let result;
              if(config.outputType==="pivot")result={id,type:"pivot",title:config.title,xCol:config.rowGroup,pivotData:generatePivot(filteredData,config.rowGroup,config.columnGroup,config.metric,config.aggregation)};
              else if(config.outputType==="bar")result={id,type:"bar",title:config.title,xCol:config.rowGroup,chartData:groupForBar(filteredData,config.rowGroup,config.metric,config.topN)};
              else if(config.outputType==="hbar")result={id,type:"hbar",title:config.title,xCol:config.rowGroup,chartData:groupForBar(filteredData,config.rowGroup,config.metric,config.topN)};
              else if(config.outputType==="line")result={id,type:"line",title:config.title,config:{x:config.rowGroup,y:config.metric}};
              else if(config.outputType==="donut")result={id,type:"donut",title:config.title,config:{x:config.rowGroup,y:config.metric,topN:config.topN}};
              if(result)setCustomCharts(prev=>[result,...prev]);
            }}/>
          </Section>

          {/* Unpinned custom charts */}
          {customCharts.filter(c=>!pinnedIds.includes(String(c.id))).map(chart=>(
            <div key={chart.id} style={{background:"#fff",borderRadius:16,padding:24,marginBottom:20,boxShadow:"0 1px 8px rgba(19,48,32,0.06)",border:"1px solid #e8e3d9",borderLeft:`4px solid ${LW.saffron}`}}>
              <SectionHeader title={chart.title} badge="CUSTOM" onPin={()=>togglePin(String(chart.id))} pinned={isPinned(String(chart.id))} onRemove={()=>removeCustom(chart.id)}/>
              <RenderChart chart={chart} filteredData={filteredData} onDrilldown={handleDrilldown}/>
            </div>
          ))}

          <Divider label="Analytics"/>

          {/* Wide auto charts */}
          {isWide&&(
            <>
              {periodData.length>1&&<Section><SectionHeader title={`${valueCol} over Time`} badge="AUTO" onPin={()=>togglePin("wide_line")} pinned={isPinned("wide_line")}/><SimpleAreaChart data={periodData} xKey={periodCol} yKey={valueCol}/></Section>}
              <div style={{display:"grid",gap:20,gridTemplateColumns:sectionPivot?"1fr 1fr":"1fr"}}>
                {primaryPivot&&(
                  <Section>
                    <SectionHeader title={`${valueCol} by ${primaryCol}`} badge="AUTO" onPin={()=>togglePin("wide_primary")} pinned={isPinned("wide_primary")}/>
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
                    }/>
                  </Section>
                )}
                {sectionPivot&&(
                  <Section>
                    <SectionHeader title={`${valueCol} by Section`} badge="AUTO" onPin={()=>togglePin("wide_section")} pinned={isPinned("wide_section")}/>
                    <PivotTableRenderer data={
                      wideFilters.section!=="all"||wideFilters.name!=="all"
                        ? (()=>{
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
                            return{columns:["Section",effectiveValueCol],rows,totalRow:{Section:"Grand Total",[valueCol]:total},hasColDim:false};
                          })()
                        : sectionPivot
                    }/>
                  </Section>
                )}
              </div>
            </>
          )}

          {/* Long auto charts */}
          {!isWide&&(
            <>
              {blueprint.charts?.map(chart=>(
                <Section key={chart.id}>
                  <SectionHeader title={chart.title} badge={aiGenerated?"AI":"AUTO"} onPin={()=>togglePin(chart.id)} pinned={isPinned(chart.id)}/>
                  {chart.type==="line"&&<LineChartRenderer data={filteredData} config={chart}/>}
                  {chart.type==="bar"&&<ClickableBarChart data={groupForBar(filteredData,chart.x,chart.y,20)} config={{x:"name",y:"value"}} onDrilldown={v=>handleDrilldown(chart.x,v)}/>}
                  {chart.type==="donut"&&<DonutChartRenderer data={filteredData} config={chart}/>}
                </Section>
              ))}
              <div style={{display:"grid",gap:20,gridTemplateColumns:blueprint.pivots?.length>1?"1fr 1fr":"1fr"}}>
                {blueprint.pivots?.map(pivot=>(
                  <Section key={pivot.id}>
                    <SectionHeader title={pivot.title} badge={aiGenerated?"AI":"AUTO"} onPin={()=>togglePin(pivot.id)} pinned={isPinned(pivot.id)}/>
                    <PivotTableRenderer data={buildLongPivot(pivot)}/>
                  </Section>
                ))}
              </div>
            </>
          )}
        </>
      )}

      <DataChatbot headers={headers} rows={filteredRows} blueprint={blueprint} onResult={handleChatResult}/>
    </div>
  );
}

