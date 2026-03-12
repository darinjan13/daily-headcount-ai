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
import GridLayout, { WidthProvider } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";
import minimizeIcon from "../../images/window-minimize.png";
import maximizeIcon from "../../images/maximize.png";
import closeIcon from "../../images/close.png";
import pinIcon from "../../images/thumbtacks.png";
import padlockIcon from "../../images/padlock.png";
import upArrowIcon from "../../images/upload.png";
import downArrowIcon from "../../images/down-arrow.png";
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
const MINIMIZED_ROWS = 2;
const ReactGridLayout = WidthProvider(GridLayout);

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

const BADGE_STYLES = {
  AI:{bg:LW.dark,color:LW.saffron},
  AUTO:{bg:LW.green,color:"#fff"},
  "RAW DATA":{bg:LW.paper,color:LW.dark},
  CUSTOM:{bg:"#fff3dc",color:"#c17110"},
  PINNED:{bg:LW.green,color:"#fff"},
  "AI FILTER":{bg:LW.dark,color:LW.saffron},
};

function SectionHeader({ title, subtitle, badge, onPin, pinned, onRemove, onRename, actionSlot }) {
  const b = BADGE_STYLES[badge]||{bg:LW.paper,color:LW.dark};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef(null);

  const startEdit = () => { if (!onRename) return; setDraft(title); setEditing(true); setTimeout(()=>inputRef.current?.select(), 30); };
  const commit = () => { const t = draft.trim(); if (onRename && t && t !== title) onRename(t); setEditing(false); };
  const cancel = () => setEditing(false);

  return (
    <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:20 }}>
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
              style={{ fontSize:15, fontWeight:800, color:LW.dark, margin:0, letterSpacing:"-0.02em", cursor:onRename?"text":"default", borderBottom:onRename?"1px dashed transparent":"none" }}
              onMouseEnter={e=>{ if(onRename) e.currentTarget.style.borderBottomColor="#9cafa4"; }}
              onMouseLeave={e=>{ if(onRename) e.currentTarget.style.borderBottomColor="transparent"; }}
            >{title}</h3>
          )}
          {badge && <span style={{ fontSize:10, padding:"2px 8px", borderRadius:100, fontWeight:700, letterSpacing:"0.08em", background:b.bg, color:b.color, flexShrink:0 }}>{badge}</span>}
        </div>
        {subtitle && <p style={{ fontSize:12, color:"#9cafa4", margin:"4px 0 0", fontWeight:500 }}>{subtitle}</p>}
      </div>
      <div style={{ display:"flex", gap:8, alignItems:"center" }}>
        {actionSlot}
        {onPin && (
          <button
            onClick={onPin}
            aria-label={pinned ? "Pinned" : "Pin"}
            title={pinned ? "Pinned" : "Pin"}
            style={{ background:"none", border:`1px solid ${pinned?LW.green:"#e8e3d9"}`, borderRadius:8, padding:"4px 10px", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}
          >
            <img src={pinIcon} alt="" style={{ width:14, height:14, opacity:pinned?1:0.7 }} />
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

function ChartWidget({ item, locked, minimized, onToggleMinimize, onMaximize, onClose, onToggleLock }) {
  const { title, badge, onPin, pinned, onRename, render } = item;
  const b = BADGE_STYLES[badge]||{bg:LW.paper,color:LW.dark};
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!editing) setDraft(title);
  }, [title, editing]);

  const startEdit = () => { if (!onRename) return; setDraft(title); setEditing(true); setTimeout(()=>inputRef.current?.select(), 30); };
  const commit = () => { const t = draft.trim(); if (t && t !== title) onRename(t); setEditing(false); };
  const cancel = () => setEditing(false);

  const handleHeaderClick = () => {};

  return (
    <div className={`chart-widget ${minimized ? "is-minimized" : ""}`}>
      <div className={`chart-widget__header ${locked ? "is-locked" : ""}`} onClick={handleHeaderClick}>
        <div className="chart-widget__title">
          {onPin && (
            <button className="chart-widget__pin" onClick={onPin} aria-label={pinned ? "Pinned" : "Pin"} title={pinned ? "Pinned" : "Pin"}>
              <img src={pinIcon} alt="" />
            </button>
          )}
          {editing ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={e=>setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={e=>{ if(e.key==="Enter"){e.preventDefault();commit();} if(e.key==="Escape")cancel(); }}
              onClick={e=>e.stopPropagation()}
              style={{ fontSize:14, fontWeight:800, color:LW.dark, margin:0, letterSpacing:"-0.02em", border:"none", borderBottom:`2px solid ${LW.green}`, outline:"none", background:"transparent", width:"100%", maxWidth:320, fontFamily:"inherit" }}
            />
          ) : (
            <h3
              onClick={e=>{ e.stopPropagation(); startEdit(); }}
              title={onRename ? "Click to rename" : undefined}
              style={{ fontSize:14, fontWeight:800, color:LW.dark, margin:0, letterSpacing:"-0.02em", cursor:onRename?"text":"default", borderBottom:onRename?"1px dashed transparent":"none" }}
              onMouseEnter={e=>{ if(onRename) e.currentTarget.style.borderBottomColor="#9cafa4"; }}
              onMouseLeave={e=>{ if(onRename) e.currentTarget.style.borderBottomColor="transparent"; }}
            >{title}</h3>
          )}
          {!minimized && badge && <span className="chart-widget__badge" style={{ background:b.bg, color:b.color }}>{badge}</span>}
        </div>
        <div className="chart-widget__actions" onClick={e=>e.stopPropagation()}>
          {!minimized && (
            <button
              className={`chart-widget__icon chart-widget__lock ${locked ? "is-locked" : "is-unlocked"}`}
              title={locked ? "Enable Drag Mode" : "Lock Layout"}
              aria-label={locked ? "Enable Drag Mode" : "Lock Layout"}
              onClick={onToggleLock}
              style={{ backgroundImage: `url(${padlockIcon})` }}
            />
          )}
          <button
            className="chart-widget__icon"
            title={minimized ? "Restore chart" : "Minimize chart"}
            aria-label={minimized ? "Restore chart" : "Minimize chart"}
            onClick={onToggleMinimize}
            style={{ backgroundImage: `url(${minimizeIcon})` }}
          />
          {!minimized && (
            <button
              className="chart-widget__icon"
              title="Maximize chart"
              aria-label="Maximize chart"
              onClick={onMaximize}
              style={{ backgroundImage: `url(${maximizeIcon})` }}
            />
          )}
          {!minimized && onClose && (
            <button
              className="chart-widget__icon chart-widget__icon--danger"
              title="Close chart"
              aria-label="Close chart"
              onClick={onClose}
              style={{ backgroundImage: `url(${closeIcon})` }}
            />
          )}
        </div>
      </div>
      <div className={`chart-widget__body ${minimized ? "is-collapsed" : ""}`}>
        <div className="chart-widget__content">
          {render()}
        </div>
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

function ClickableBarChart({ data, config, onDrilldown, labels }) {
  const xKey=config?.x||"name", yKey=config?.y||"value";
  const xLabel = labels?.x || xKey;
  const yLabel = labels?.y || yKey;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{top:5,right:20,left:10,bottom:60}}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false}/>
        <XAxis dataKey={xKey} tick={{fontSize:11,fill:CHART_THEME.axis}} angle={-35} textAnchor="end" interval={0} label={undefined}/>
        <YAxis tick={{fontSize:12,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()}/>
        <Tooltip formatter={(v,_)=>[v.toLocaleString(), yLabel]} labelFormatter={l=>`${xLabel}: ${l}`} contentStyle={{borderRadius:8,border:`1px solid ${CHART_THEME.tooltipBorder}`,fontSize:13,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText}} labelStyle={{color:CHART_THEME.tooltipText}} itemStyle={{color:CHART_THEME.tooltipText}}/>
        <Bar dataKey={yKey} radius={[4,4,0,0]} cursor={onDrilldown?"pointer":"default"} onClick={d=>onDrilldown&&onDrilldown(d[xKey])}>
          {data.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]}/>)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarChart({ data, config, onDrilldown, labels }) {
  const xKey=config?.x||"name", yKey=config?.y||"value";
  const xLabel = labels?.x || xKey;
  const yLabel = labels?.y || yKey;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{top:5,right:40,left:120,bottom:5}}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} horizontal={false}/>
        <XAxis type="number" tick={{fontSize:11,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()}/>
        <YAxis type="category" dataKey={xKey} tick={{fontSize:11,fill:CHART_THEME.axis}} width={110}/>
        <Tooltip formatter={(v,_)=>[v.toLocaleString(), yLabel]} labelFormatter={l=>`${xLabel}: ${l}`} contentStyle={{borderRadius:8,border:`1px solid ${CHART_THEME.tooltipBorder}`,fontSize:13,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText}} labelStyle={{color:CHART_THEME.tooltipText}} itemStyle={{color:CHART_THEME.tooltipText}}/>
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
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{top:5,right:20,left:10,bottom:60}}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false}/>
        <XAxis dataKey="name" tick={{fontSize:11,fill:CHART_THEME.axis}} angle={-35} textAnchor="end" interval={0}/>
        <YAxis tick={{fontSize:12,fill:CHART_THEME.axis}} tickFormatter={v=>v.toLocaleString()}/>
        <Tooltip formatter={v=>v.toLocaleString()} contentStyle={{borderRadius:8,border:`1px solid ${CHART_THEME.tooltipBorder}`,fontSize:13,background:CHART_THEME.tooltipBg,color:CHART_THEME.tooltipText}} labelStyle={{color:CHART_THEME.tooltipText}} itemStyle={{color:CHART_THEME.tooltipText}}/>
        {stackKeys.map((k,i)=><Bar key={k} dataKey={k} stackId="a" fill={CHART_COLORS[i%CHART_COLORS.length]} radius={i===stackKeys.length-1?[4,4,0,0]:[0,0,0,0]}/>)}
      </BarChart>
    </ResponsiveContainer>
  );
}

function SimpleAreaChart({ data, xKey, yKey }) {
  const angle=data.length>14?-45:0, mb=angle!==0?60:10;
  return (
    <ResponsiveContainer width="100%" height="100%">
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

function RenderChart({ chart, filteredData, onDrilldown }) {
  if (chart.type==="pivot") return <PivotTableRenderer data={chart.pivotData}/>;
  if (chart.type==="bar") return <ClickableBarChart data={chart.chartData} config={{x:"name",y:"value"}} labels={{x:chart.xCol,y:chart.config?.y||"Value"}} onDrilldown={v=>onDrilldown&&onDrilldown(chart.xCol,v)}/>;
  if (chart.type==="hbar") return <HorizontalBarChart data={chart.chartData} config={{x:"name",y:"value"}} labels={{x:chart.xCol,y:chart.config?.y||"Value"}} onDrilldown={v=>onDrilldown&&onDrilldown(chart.xCol,v)}/>;
  if (chart.type==="stacked") return <StackedBarChart data={chart.chartData}/>;
  if (chart.type==="line") return <LineChartRenderer data={filteredData} config={chart.config}/>;
  if (chart.type==="donut") return <DonutChartRenderer data={filteredData} config={chart.config}/>;
  return null;
}

// ── Main Dashboard ─────────────────────────────────────────────────────────────

export default function Dashboard({ data, blueprint, fileId }) {
  const { headers, rows } = data;

  // filteredTables now persisted via usePins
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
  const { user } = useAuth();
  const { pinnedIds, customCharts: savedCustomCharts, filteredTables, loading: pinsLoading,
          togglePin, isPinned, addCustomChart, addAndPinChart, removeCustomChart, clearAllCustomCharts, renameCustomChart,
          addFilteredTable, removeFilteredTable, renameFilteredTable, addAndPinTable, clearAllFilteredTables } = usePins(user?.uid, fileId||"default");

  // customCharts from usePins is already seeded from localStorage on first render
  // and synced from Firestore in background — use directly
  const [sessionCharts, setCustomCharts] = useState([]);
  const layoutStorageKey = useMemo(() => `dashboardLayout_${fileId || "default"}`, [fileId]);
  const minimizedStorageKey = useMemo(() => `${layoutStorageKey}_minimized`, [layoutStorageKey]);
  const [layoutLocked, setLayoutLocked] = useState(true);
  const [gridLayout, setGridLayout] = useState(() => {
    try { return JSON.parse(localStorage.getItem(layoutStorageKey) || "[]"); } catch { return []; }
  });
  const [minimizedIds, setMinimizedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(minimizedStorageKey) || "[]"); } catch { return []; }
  });
  const [maximizedId, setMaximizedId] = useState(null);
  const [customBuilderCollapsed, setCustomBuilderCollapsed] = useState(false);
  const customBuilderWrapRef = useRef(null);
  const customBuilderContentRef = useRef(null);
  const [customBuilderHeight, setCustomBuilderHeight] = useState(0);
  const [customBuilderRect, setCustomBuilderRect] = useState({ left: 0, width: 0 });
  const [customBuilderStuck, setCustomBuilderStuck] = useState(false);
  const minimizedIdsRef = useRef(minimizedIds);
  const skipNextLayoutChangeRef = useRef(false);
  const minimizedSet = useMemo(() => new Set(minimizedIds), [minimizedIds]);

  useEffect(() => {
    try { setGridLayout(JSON.parse(localStorage.getItem(layoutStorageKey) || "[]")); }
    catch { setGridLayout([]); }
  }, [layoutStorageKey]);

  useEffect(() => {
    try { setMinimizedIds(JSON.parse(localStorage.getItem(minimizedStorageKey) || "[]")); }
    catch { setMinimizedIds([]); }
  }, [minimizedStorageKey]);

  useEffect(() => {
    try { localStorage.setItem(minimizedStorageKey, JSON.stringify(minimizedIds)); } catch {}
  }, [minimizedIds, minimizedStorageKey]);

  useEffect(() => {
    minimizedIdsRef.current = minimizedIds;
  }, [minimizedIds]);

  useEffect(() => {
    if (!customBuilderContentRef.current || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(entries => {
      const entry = entries[0];
      if (!entry) return;
      const next = Math.ceil(entry.contentRect.height);
      setCustomBuilderHeight(prev => (prev === next ? prev : next));
    });
    observer.observe(customBuilderContentRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let ticking = false;
    const update = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        if (customBuilderWrapRef.current) {
          const rect = customBuilderWrapRef.current.getBoundingClientRect();
          setCustomBuilderRect(prev => (prev.left === rect.left && prev.width === rect.width ? prev : { left: rect.left, width: rect.width }));
          setCustomBuilderStuck(prev => (prev === (rect.top <= 56) ? prev : rect.top <= 56));
        }
        ticking = false;
      });
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);





  useEffect(() => {
    if (!minimizedIds.length) return;
    setGridLayout(prev => {
      let changed = false;
      const next = prev.map(item => {
        if (!minimizedSet.has(item.i)) return item;
        if (item.h === MINIMIZED_ROWS && item.minH === MINIMIZED_ROWS) return item;
        changed = true;
        return {
          ...item,
          origH: item.origH ?? item.h,
          origMinH: item.origMinH ?? item.minH,
          origMaxH: item.origMaxH ?? item.maxH,
          h: MINIMIZED_ROWS,
          minH: MINIMIZED_ROWS,
          maxH: MINIMIZED_ROWS,
        };
      });
      return changed ? next : prev;
    });
  }, [minimizedIds, minimizedSet]);


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

  const buildLongPivot = useCallback((pivotDef) => (
    generatePivot(filteredData, pivotDef.rowDim, pivotDef.colDim||null, pivotDef.measure, pivotDef.aggregation||"sum")
  ), [filteredData]);

  const pinCustomChart = useCallback((id, chartObj = null) => {
    const chart = chartObj || allCustomCharts.find(c => String(c.id) === String(id));
    if (!chart) return;
    if (!isPinned(String(id))) {
      addAndPinChart(chart); // single atomic save ??? chart + pinId together
    }
  }, [addAndPinChart, allCustomCharts, isPinned]);

  const removeCustom = useCallback((id) => {
    setCustomCharts(prev => prev.filter(c => String(c.id) !== String(id)));
    removeCustomChart(id);
  }, [removeCustomChart]);

  const renameChart = useCallback((id, newTitle) => {
    setCustomCharts(prev => prev.map(c =>
      c.id !== id ? c : { ...c, title: newTitle, spec: c.spec ? { ...c.spec, title: newTitle } : c.spec }
    ));
    renameCustomChart(id, newTitle);
  }, [renameCustomChart]);

const chartWidgets = useMemo(() => {
    const items = [];
    const addItem = (item) => items.push(item);
    const sizeFor = () => ({ w: 12, h: 11, minH: 11, minW: 6 });

    allCustomCharts.forEach(chart => {
      const pinned = isPinned(String(chart.id));
      const layoutId = `custom_${chart.id}`;
      const size = sizeFor();
      addItem({
        layoutId,
        title: chart.title || "Chart",
        badge: pinned ? "PINNED" : "CUSTOM",
        pinned,
        onPin: () => pinCustomChart(String(chart.id)),
        onClose: () => removeCustom(chart.id),
        onRename: (t) => renameChart(chart.id, t),
        defaultW: size.w,
        defaultH: size.h,
        minH: size.minH,
        minW: size.minW,
        render: () => <RenderChart chart={chart} filteredData={filteredData} />,
      });
    });

    if (isWide) {
      if (validPinnedIds.includes("wide_line") && periodData.length > 1) {
        const size = sizeFor();
        addItem({
          layoutId: "auto_wide_line",
          title: `${valueCol} over Time`,
          badge: "PINNED",
          pinned: true,
          onPin: () => togglePin("wide_line"),
          onClose: () => togglePin("wide_line"),
          defaultW: size.w,
          defaultH: size.h,
          minH: size.minH,
          minW: size.minW,
          render: () => <SimpleAreaChart data={periodData} xKey={periodCol} yKey={valueCol} />,
        });
      }
      if (validPinnedIds.includes("wide_primary") && primaryPivot) {
        const size = sizeFor();
        addItem({
          layoutId: "auto_wide_primary",
          title: `${valueCol} by ${primaryCol}`,
          badge: "PINNED",
          pinned: true,
          onPin: () => togglePin("wide_primary"),
          onClose: () => togglePin("wide_primary"),
          defaultW: size.w,
          defaultH: size.h,
          minH: size.minH,
          minW: size.minW,
          render: () => <PivotTableRenderer data={primaryPivot} />,
        });
      }
      if (validPinnedIds.includes("wide_section") && sectionPivot) {
        const size = sizeFor();
        addItem({
          layoutId: "auto_wide_section",
          title: `${valueCol} by Section`,
          badge: "PINNED",
          pinned: true,
          onPin: () => togglePin("wide_section"),
          onClose: () => togglePin("wide_section"),
          defaultW: size.w,
          defaultH: size.h,
          minH: size.minH,
          minW: size.minW,
          render: () => <PivotTableRenderer data={sectionPivot} />,
        });
      }
    } else {
      (blueprint.charts||[]).filter(c=>validPinnedIds.includes(c.id)).forEach(chart => {
        const size = sizeFor();
        addItem({
          layoutId: `auto_${chart.id}`,
          title: chart.title,
          badge: "PINNED",
          pinned: true,
          onPin: () => togglePin(chart.id),
          onClose: () => togglePin(chart.id),
          defaultW: size.w,
          defaultH: size.h,
          minH: size.minH,
          minW: size.minW,
          render: () => (
            <>
              {chart.type==="line"&&<LineChartRenderer data={filteredData} config={chart}/>}
              {chart.type==="bar"&&<ClickableBarChart data={groupForBar(filteredData,chart.x,chart.y,20)} config={{x:"name",y:"value"}} labels={{x:chart.x,y:chart.y}}/>}
              {chart.type==="donut"&&<DonutChartRenderer data={filteredData} config={chart}/>}
            </>
          ),
        });
      });
      (blueprint.pivots||[]).filter(p=>validPinnedIds.includes(p.id)).forEach(pivot => {
        const size = sizeFor();
        addItem({
          layoutId: `auto_${pivot.id}`,
          title: pivot.title,
          badge: "PINNED",
          pinned: true,
          onPin: () => togglePin(pivot.id),
          onClose: () => togglePin(pivot.id),
          defaultW: size.w,
          defaultH: size.h,
          minH: size.minH,
          minW: size.minW,
          render: () => <PivotTableRenderer data={buildLongPivot(pivot)} />,
        });
      });
    }

    return items;
  }, [
    allCustomCharts,
    blueprint.charts,
    blueprint.pivots,
    buildLongPivot,
    filteredData,
    isPinned,
    isWide,
    periodCol,
    periodData,
    pinCustomChart,
    primaryCol,
    primaryPivot,
    removeCustom,
    renameChart,
    sectionPivot,
    togglePin,
    validPinnedIds,
    valueCol,
  ]);

  useEffect(() => {
    const ids = new Set(chartWidgets.map(item => item.layoutId));
    setMinimizedIds(prev => {
      const next = prev.filter(id => ids.has(id));
      if (next.length === prev.length && next.every((id, idx) => id === prev[idx])) return prev;
      return next;
    });
    if (maximizedId && !ids.has(maximizedId)) setMaximizedId(null);
  }, [chartWidgets, maximizedId]);

  const persistLayout = useCallback((layout) => {
    try { localStorage.setItem(layoutStorageKey, JSON.stringify(layout)); } catch {}
  }, [layoutStorageKey]);

  const mergeLayout = useCallback((prevLayout, widgets, minimizedSet) => {
    const prevById = new Map(prevLayout.map(item => [item.i, item]));
    const next = [];
    let nextY = prevLayout.reduce((max, item) => Math.max(max, (item.y || 0) + (item.h || 0)), 0);
    widgets.forEach((item, index) => {
      const existing = prevById.get(item.layoutId);
      if (existing) {
        const isMinimized = minimizedSet?.has(item.layoutId);
        const minH = existing.minH ?? item.minH ?? 11;
        const minW = item.minW || 6;
        const targetW = Math.max(existing.w || 0, item.defaultW || 0, minW);
        const targetH = isMinimized ? Math.max(existing.h || 0, minH) : Math.max(existing.h || 0, item.defaultH || 0, minH);
        next.push({
          ...existing,
          w: targetW,
          h: targetH,
          minH,
          minW,
        });
        return;
      }
      const w = item.defaultW || 6;
      const h = item.defaultH || 11;
      const x = w === 12 ? 0 : (index * 6) % 12;
      const newItem = { i: item.layoutId, x, y: nextY, w, h, minW: item.minW || 6, minH: item.minH || 11 };
      next.push(newItem);
      nextY += h;
    });
    return next;
  }, []);

  const layoutsEqual = useCallback((a, b) => {
    if (a.length !== b.length) return false;
    const byId = new Map(a.map(item => [item.i, item]));
    for (const bi of b) {
      const ai = byId.get(bi.i);
      if (!ai) return false;
      if (ai.x !== bi.x || ai.y !== bi.y || ai.w !== bi.w || ai.h !== bi.h || ai.minW !== bi.minW || ai.minH !== bi.minH) {
        return false;
      }
    }
    return true;
  }, []);

  const resolvedLayout = useMemo(() => mergeLayout(gridLayout, chartWidgets, minimizedSet), [gridLayout, chartWidgets, minimizedSet, mergeLayout]);

  useEffect(() => {
    if (!layoutsEqual(gridLayout, resolvedLayout)) {
      setGridLayout(resolvedLayout);
      persistLayout(resolvedLayout);
    }
  }, [gridLayout, resolvedLayout, layoutsEqual, persistLayout]);

  const handleLayoutChange = useCallback((nextLayout) => {
    setGridLayout(prev => {
      if (skipNextLayoutChangeRef.current) {
        skipNextLayoutChangeRef.current = false;
        return prev;
      }
      const prevById = new Map(prev.map(item => [item.i, item]));
      const mergedLayout = nextLayout.map(item => {
        const prevItem = prevById.get(item.i);
        return prevItem ? { ...prevItem, ...item } : item;
      });
      if (layoutsEqual(prev, mergedLayout)) return prev;
      persistLayout(mergedLayout);
      return mergedLayout;
    });
  }, [layoutsEqual, persistLayout]);

  const toggleMinimize = useCallback((layoutId) => {
    const isMinimized = minimizedIdsRef.current.includes(layoutId);
    setGridLayout(prev => prev.map(item => {
      if (item.i !== layoutId) return item;
      if (isMinimized) {
        const { origH, origMinH, origMaxH, minH: _minH, maxH: _maxH, ...rest } = item;
        const next = {
          ...rest,
          h: origH ?? item.h,
          minH: origMinH ?? _minH,
        };
        if (origMaxH != null) next.maxH = origMaxH;
        return next;
      }
      return {
        ...item,
        origH: item.origH ?? item.h,
        origMinH: item.origMinH ?? item.minH,
        origMaxH: item.origMaxH ?? item.maxH,
        h: MINIMIZED_ROWS,
        minH: MINIMIZED_ROWS,
        maxH: MINIMIZED_ROWS,
      };
    }));
    setMinimizedIds(prev => isMinimized ? prev.filter(id => id !== layoutId) : [...prev, layoutId]);
  }, []);

  const maximizedWidget = useMemo(() => (
    chartWidgets.find(item => item.layoutId === maximizedId) || null
  ), [chartWidgets, maximizedId]);

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
        chartData: groupForBar(data, xCol, yCol, limit || 20) };
    }
    if (spec.type === "donut") {
      return { id, type: "donut", title: spec.title || "Chart", xCol, spec,
        config: { x: xCol, y: yCol, topN: limit || 10 },
        chartData: groupForBar(data, xCol, yCol, limit || 10) };
    }
    if (spec.type === "line") {
      return { id, type: "line", title: spec.title || "Chart", spec, config: { x: xCol, y: yCol } };
    }
    return null;
  };

  const handleChatResult = ({ chartSpec, filterSpec, action, targetId, updateChartId, deleteSpec, pinSpec, newChartSpecs, renameSpec, tab, modifyChartSpec, tableActionSpec }) => {
    if (action === "delete_table" && deleteTableSpec) {
      if (deleteTableSpec.deleteAll) {
        clearAllFilteredTables();
      } else {
        const match = filteredTables.find(t =>
          t.title?.toLowerCase() === deleteTableSpec.targetTitle?.toLowerCase()
        );
        if (match) removeFilteredTable(match.id);
      }
      return;
    }

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
      const { action: act, targetTitle, newTitle } = tableActionSpec;
      if (act === "deleteAll") {
        clearAllFilteredTables();
      } else if (act === "delete") {
        const match = filteredTables.find(t => t.title?.toLowerCase() === targetTitle?.toLowerCase());
        if (match) removeFilteredTable(match.id);
      } else if (act === "pinAll") {
        filteredTables.forEach(t => {
          if (!isPinned(String(t.id))) addAndPinTable(t);
        });
      } else if (act === "pin") {
        const match = filteredTables.find(t => t.title?.toLowerCase() === targetTitle?.toLowerCase());
        if (match && !isPinned(String(match.id))) addAndPinTable(match);
      } else if (act === "rename") {
        const match = filteredTables.find(t => t.title?.toLowerCase() === targetTitle?.toLowerCase());
        if (match) renameFilteredTable(match.id, newTitle);
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

  const Divider = ({label}) => (
    <div style={{position:"relative",margin:"8px 0 24px",textAlign:"center"}}>
      <div style={{height:1,background:"#e8e3d9"}}/>
      <span style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",background:LW.salt,padding:"0 16px",fontSize:10,fontWeight:700,color:"#9cafa4",letterSpacing:"0.12em",textTransform:"uppercase",whiteSpace:"nowrap"}}>{label}</span>
    </div>
  );

  return (
    <div style={{ padding: "48px 32px 80px", maxWidth: 1280, width: "100%", margin: "0 auto", fontFamily: "'Manrope',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap');
        .chart-grid { margin: 12px 0 28px; }
        .chart-widget { height:100%; min-height:400px; background: var(--color-surface-elevated); border:1px solid var(--color-border); border-radius:16px; display:flex; flex-direction:column; box-shadow: var(--color-shadow-soft); transition: box-shadow 0.2s ease, transform 0.2s ease; overflow:hidden; box-sizing:border-box; position:relative; }
        .chart-widget:hover { box-shadow: 0 10px 26px rgba(0,0,0,0.18); transform: translateY(-2px); }
        .chart-widget__header { display:flex; align-items:center; justify-content:space-between; gap:12px; height:48px; padding:0 14px; border-bottom:1px solid var(--color-border); background: linear-gradient(180deg, rgba(255,255,255,0.6), rgba(255,255,255,0)); cursor: grab; }
        .chart-widget__header.is-locked { cursor: default; }
        .chart-widget__title { display:flex; align-items:center; gap:10px; min-width:0; }
        .chart-widget__badge { font-size:10px; padding:2px 8px; border-radius:100px; font-weight:700; letter-spacing:0.08em; white-space:nowrap; }
        .chart-widget__actions { display:flex; align-items:center; gap:6px; }
        .chart-widget__pin { background:none; border:1px solid #e8e3d9; border-radius:8px; padding:4px 8px; cursor:pointer; font-size:11px; font-weight:700; color:#9cafa4; display:flex; align-items:center; justify-content:center; }
        .chart-widget__pin:hover { border-color:#046241; color:#046241; }
        .chart-widget__pin img { width:14px; height:14px; display:block; opacity:0.8; }
        .chart-widget__pin:hover img { opacity:1; }
        .chart-widget__icon { width:28px; height:26px; border-radius:8px; border:1px solid #e8e3d9; background:#fff; cursor:pointer; font-size:12px; font-weight:700; color:#5b6b62; display:flex; align-items:center; justify-content:center; transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease, background-color 0.15s ease; background-repeat:no-repeat; background-position:center; background-size:16px 16px; }
        .chart-widget__icon:hover { transform: translateY(-1px); box-shadow: 0 4px 10px rgba(0,0,0,0.12); border-color:#9cafa4; }
        .chart-widget__icon--danger { color:#b45309; }
        .chart-widget__lock.is-locked { background-color:#f3f1ed; border-color:#d6d0c6; }
        .chart-widget__lock.is-unlocked { background-color:#ecf9f1; border-color:#046241; box-shadow: 0 0 0 2px rgba(4,98,65,0.12); }
        .chart-widget__body { padding:16px; flex:1; overflow:hidden; transition: opacity 0.2s ease; }
        .chart-widget__body.is-collapsed { opacity:0; visibility:hidden; }
        .chart-widget__content { width:100%; height:100%; }
        .chart-widget.is-minimized { height:48px; min-height:48px; border-color:#d7e2dc; }
        .chart-widget.is-minimized .chart-widget__header { border-bottom:none; height:44px; padding:0 12px; }
        .chart-widget.is-minimized .chart-widget__body { display:none; }
        .react-grid-item { overflow: visible; }
        .react-resizable-handle { opacity:0; background-image:none; background:transparent; z-index:10; pointer-events:auto; }
        .react-resizable-handle::after { content:none; }
        .react-resizable-handle-se,
        .react-resizable-handle-sw,
        .react-resizable-handle-ne,
        .react-resizable-handle-nw { width:16px; height:16px; }
        .react-resizable-handle-n,
        .react-resizable-handle-s { width:100%; height:14px; left:0; transform:none; }
        .react-resizable-handle-e,
        .react-resizable-handle-w { height:100%; width:14px; top:0; transform:none; }
        .section-collapse { width:28px; height:28px; border-radius:999px; border:1px solid #f0b34a; background:#ffd896; color:#6b4b00; display:flex; align-items:center; justify-content:center; cursor:pointer; box-shadow: 0 4px 10px rgba(240,179,74,0.25); background-repeat:no-repeat; background-position:center; background-size:14px 14px; }
        .custom-builder-wrap { position: relative; }
        .custom-builder-spacer { height: 0; }
        .custom-builder-sticky { position: sticky; top: 56px; z-index: 40; }
        .react-grid-item.react-draggable-dragging .chart-widget { box-shadow: 0 16px 30px rgba(0,0,0,0.2); }
        .chart-empty { border:1px dashed #d7e2dc; border-radius:16px; padding:28px; background: var(--color-surface-elevated); text-align:center; color:#6b7a71; }
        .chart-empty h2 { margin:0 0 8px; font-size:18px; color: var(--color-text); }
        .chart-empty p { margin:0; font-size:13px; }
        .chart-modal { position: fixed; inset: 0; background: rgba(12, 18, 16, 0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; animation: chart-modal-fade 0.2s ease; }
        .chart-modal__panel { width: min(1200px, 92vw); height: min(80vh, 820px); background: var(--color-surface-elevated); border-radius: 18px; padding: 20px; box-shadow: 0 20px 60px rgba(0,0,0,0.28); animation: chart-modal-zoom 0.25s ease; display:flex; flex-direction:column; }
        .chart-modal__header { display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; }
        .chart-modal__title { font-size:16px; font-weight:800; color: var(--color-text); }
        .chart-modal__body { flex:1; overflow:auto; }
        @keyframes chart-modal-fade { from { opacity:0; } to { opacity:1; } }
        @keyframes chart-modal-zoom { from { transform: scale(0.96); opacity:0; } to { transform: scale(1); opacity:1; } }
      `}</style>

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
            const matchedRows = applyTableFilter();
            const displayRows = matchedRows.map(row => displayCols.map(col => row[col] === undefined ? null : row[col]));
            return (
              <Section key={table.id}>
                <SectionHeader
                  title={table.title}
                  subtitle={`${matchedRows.length} row${matchedRows.length !== 1 ? "s" : ""} · AI filtered`}
                  badge="AI FILTER"
                  onPin={() => togglePin(String(table.id))}
                  pinned={isPinned(String(table.id))}
                  onRemove={() => removeFilteredTable(table.id)}
                />
                <DataTable headers={displayCols} rows={displayRows}/>
              </Section>
            );
          })}

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

        </>
      )}

      {/* ── CHARTS TAB ───────────────────────────────────── */}
      {activeView==="charts" && (
        <>
          <div className="custom-builder-wrap" ref={customBuilderWrapRef}>
            <div className="custom-builder-spacer" style={{ height: customBuilderStuck ? customBuilderHeight : 0 }} />
            <div
              className="custom-builder-sticky"
              ref={customBuilderContentRef}
              style={customBuilderStuck ? { position:"fixed", top:56, left: customBuilderRect.left, width: customBuilderRect.width, zIndex:60 } : undefined}
            >
              <Section>
                <SectionHeader
                  title="Custom Builder"
                  subtitle="Build your own chart or pivot table"
                  actionSlot={
                    <button
                      className={`section-collapse ${customBuilderCollapsed ? "is-collapsed" : ""}`}
                      onClick={()=>setCustomBuilderCollapsed(v=>!v)}
                      aria-label={customBuilderCollapsed ? "Show Custom Builder" : "Hide Custom Builder"}
                      title={customBuilderCollapsed ? "Show Custom Builder" : "Hide Custom Builder"}
                      style={{ backgroundImage: `url(${customBuilderCollapsed ? downArrowIcon : upArrowIcon})` }}
                    >
                    </button>
                  }
                />
                {!customBuilderCollapsed && (
                  <ChartBuilder columns={headers} sampleData={objectData.slice(0,50)} onGenerate={(config)=>{
                    const id=Date.now(); let result;
                    const spec=config; // save full config as spec for Firestore rebuild
                    if(config.outputType==="pivot")result={id,type:"pivot",title:config.title,xCol:config.rowGroup,spec,pivotData:generatePivot(filteredData,config.rowGroup,config.columnGroup,config.metric,config.aggregation)};
                    else if(config.outputType==="bar")result={id,type:"bar",title:config.title,xCol:config.rowGroup,spec,config:{x:config.rowGroup,y:config.metric},chartData:groupForBar(filteredData,config.rowGroup,config.metric,config.topN)};
                    else if(config.outputType==="hbar")result={id,type:"hbar",title:config.title,xCol:config.rowGroup,spec,config:{x:config.rowGroup,y:config.metric},chartData:groupForBar(filteredData,config.rowGroup,config.metric,config.topN)};
                    else if(config.outputType==="line")result={id,type:"line",title:config.title,spec,config:{x:config.rowGroup,y:config.metric}};
                    else if(config.outputType==="donut")result={id,type:"donut",title:config.title,spec,config:{x:config.rowGroup,y:config.metric,topN:config.topN}};
                    if(result) {
                      setCustomCharts(prev=>[result,...prev]); // session only - persists on pin
                    }
                  }}/>
                )}
              </Section>
            </div>
          </div>
          {chartWidgets.length === 0 ? (
            <div className="chart-empty">
              <h2>Charts Dashboard</h2>
              <p>No charts added yet.</p>
              <p>Create charts using the chatbot and pin them here.</p>
            </div>
          ) : (
            <>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16, gap:16 }}>
                <div>
                  <div style={{ fontSize:18, fontWeight:800, color:LW.dark, marginBottom:4 }}>Charts Dashboard</div>
                  <div style={{ fontSize:12, color:"#9cafa4", fontWeight:500 }}>Drag charts by the header and resize when unlocked.</div>
                </div>
              </div>
              <div className="chart-grid">
                <ReactGridLayout
                  layout={resolvedLayout}
                  cols={12}
                  rowHeight={24}
                  margin={[16,16]}
                  containerPadding={[0,0]}
                  isDraggable={!layoutLocked}
                  isResizable={!layoutLocked}
                  resizeHandles={["s","e","n","w","se","sw","ne","nw"]}
                  draggableHandle=".chart-widget__header"
                  draggableCancel=".chart-widget__actions, .chart-widget__pin, input, textarea"
                  onLayoutChange={handleLayoutChange}
                  compactType="vertical"
                >
                  {chartWidgets.map(item => (
                    <div key={item.layoutId}>
                      <ChartWidget
                        item={item}
                        locked={layoutLocked}
                        minimized={minimizedIds.includes(item.layoutId)}
                        onToggleLock={() => setLayoutLocked(v=>!v)}
                        onToggleMinimize={() => toggleMinimize(item.layoutId)}
                        onMaximize={() => setMaximizedId(item.layoutId)}
                        onClose={item.onClose ? () => item.onClose() : null}
                      />
                    </div>
                  ))}
                </ReactGridLayout>
              </div>
            </>
          )}

          {maximizedWidget && (
            <div className="chart-modal" onClick={()=>setMaximizedId(null)}>
              <div className="chart-modal__panel" onClick={e=>e.stopPropagation()}>
                <div className="chart-modal__header">
                  <div className="chart-modal__title">{maximizedWidget.title}</div>
                  <button
                    className="chart-widget__icon"
                    aria-label="Close modal"
                    onClick={()=>setMaximizedId(null)}
                    style={{ backgroundImage: `url(${closeIcon})` }}
                  />
                </div>
                <div className="chart-modal__body">
                  {maximizedWidget.render()}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <DataChatbot headers={headers} rows={filteredRows} blueprint={blueprint} onResult={handleChatResult} customCharts={allCustomCharts.map(c=>({...c, pinned: isPinned(String(c.id))}))} filteredTables={filteredTables.map(t=>({...t, pinned: isPinned(String(t.id))}))}/>
    </div>
  );
}
