import { useState, useMemo, useEffect } from "react";

function parseDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val) ? null : val;
  if (typeof val === "number" && val > 10000) {
    const d = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(d) ? null : d;
  }
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function toYMD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(ymd) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function detectDateCol(headers, rows) {
  if (!headers?.length || !rows?.length) return null;
  const sample = rows.slice(0, 30);
  const namePriority = headers.filter(h => /date|day|time|period/i.test(h));
  const candidates = [...namePriority, ...headers.filter(h => !namePriority.includes(h))];
  for (const col of candidates) {
    const vals = sample.map(r => r[col]).filter(Boolean);
    if (vals.length === 0) continue;
    const parsed = vals.map(parseDate).filter(Boolean);
    if (parsed.length / vals.length >= 0.7) return col;
  }
  return null;
}

function detectCategoryCols(headers, rows, dateCol) {
  if (!headers?.length || !rows?.length) return [];
  const sample = rows.slice(0, 30);
  return headers.filter(col => {
    if (col === dateCol) return false;
    const vals = sample.map(r => r[col]).filter(v => v != null && String(v).trim() !== "");
    if (vals.length === 0) return false;
    const numRatio = vals.filter(v => !isNaN(Number(v))).length / vals.length;
    if (numRatio > 0.8) return false;
    const unique = new Set(vals.map(v => String(v).trim().toLowerCase()));
    if (unique.size > 20) return false;
    return true;
  });
}

function detectNumericCols(headers, rows, dateCol) {
  if (!headers?.length || !rows?.length) return [];
  const sample = rows.slice(0, 30);
  return headers.filter(col => {
    if (col === dateCol) return false;
    const vals = sample.map(r => r[col]).filter(v => v != null && String(v).trim() !== "");
    if (vals.length < 3) return false;
    return vals.filter(v => !isNaN(Number(v))).length / vals.length > 0.8;
  });
}

function buildDayStats(dayRows, dateCol, categoryCols, numericCols) {
  const stats = [];
  stats.push({ id: "__total", label: "Total Entries", value: dayRows.length, type: "count", icon: "📋" });
  categoryCols.slice(0, 4).forEach(col => {
    const vals = dayRows.map(r => r[col]).filter(v => v != null && String(v).trim() !== "");
    if (vals.length === 0) return;
    const grouped = {};
    vals.forEach(v => { const k = String(v).trim(); grouped[k] = (grouped[k] || 0) + 1; });
    stats.push({ id: col, label: col, value: Object.entries(grouped).sort((a, b) => b[1] - a[1]), type: "breakdown", icon: "🏷️" });
  });
  numericCols.slice(0, 3).forEach(col => {
    const vals = dayRows.map(r => r[col]).filter(v => v != null && !isNaN(Number(v))).map(Number);
    if (vals.length === 0) return;
    stats.push({ id: col + "_sum", label: `Total ${col}`, value: vals.reduce((a, b) => a + b, 0), type: "sum", icon: "🔢" });
  });
  return stats;
}

function StatCard({ stat }) {
  const fmt = (n) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n % 1 === 0 ? n.toLocaleString() : n.toFixed(2);
  };

  if (stat.type === "breakdown") {
    const total = stat.value.reduce((a, b) => a + b[1], 0);
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 min-w-0">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-base">{stat.icon}</span>
          <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">{stat.label}</span>
        </div>
        <div className="space-y-2">
          {stat.value.slice(0, 5).map(([name, count]) => (
            <div key={name} className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-0.5">
                <span className="text-xs text-gray-700 font-medium truncate max-w-[70%]">{name}</span>
                <span className="text-xs font-bold text-emerald-700 ml-1">{count}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((count / total) * 100)}%` }} />
              </div>
            </div>
          ))}
          {stat.value.length > 5 && <div className="text-xs text-gray-400 text-right mt-1">+{stat.value.length - 5} more</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col justify-between min-w-0">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-base">{stat.icon}</span>
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wide truncate">{stat.label}</span>
      </div>
      <div className="text-3xl font-extrabold text-emerald-700 tracking-tight leading-none">{fmt(stat.value)}</div>
    </div>
  );
}

function MiniCalendar({ year, month, availableDates, selectedDate, onSelect, onMonthChange }) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
  const pad = (n) => String(n).padStart(2, "0");
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 select-none w-64 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => onMonthChange(-1)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer bg-transparent border-none text-sm font-bold">‹</button>
        <span className="text-sm font-bold text-gray-700">{monthLabel}</span>
        <button onClick={() => onMonthChange(1)} className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer bg-transparent border-none text-sm font-bold">›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-xs text-gray-300 font-bold py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((d, i) => {
          if (!d) return <div key={`e-${i}`} />;
          const ymd = `${year}-${pad(month + 1)}-${pad(d)}`;
          const hasData = availableDates.has(ymd);
          const isSelected = selectedDate === ymd;
          return (
            <button key={ymd} onClick={() => hasData && onSelect(isSelected ? null : ymd)} disabled={!hasData}
              className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all mx-auto flex items-center justify-center border-none
                ${isSelected ? "bg-emerald-700 text-white shadow-sm cursor-pointer" : ""}
                ${hasData && !isSelected ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold cursor-pointer" : ""}
                ${!hasData ? "text-gray-200 cursor-not-allowed bg-transparent" : ""}
              `}>
              {d}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-gray-50">
        <div className="w-4 h-4 rounded bg-emerald-50 border border-emerald-200" />
        <span className="text-xs text-gray-400">Has data</span>
      </div>
    </div>
  );
}

export default function DateNavigator({ headers, rows }) {
  const today = new Date();
  const [calYear, setCalYear] = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(null);

  // Guard: don't render if no data yet
  if (!headers?.length || !rows?.length) return null;

  const dateCol = useMemo(() => detectDateCol(headers, rows), [headers, rows]);
  const categoryCols = useMemo(() => detectCategoryCols(headers, rows, dateCol), [headers, rows, dateCol]);
  const numericCols = useMemo(() => detectNumericCols(headers, rows, dateCol), [headers, rows, dateCol]);

  const dateMap = useMemo(() => {
    if (!dateCol) return {};
    const map = {};
    rows.forEach(row => {
      const d = parseDate(row[dateCol]);
      if (!d) return;
      const ymd = toYMD(d);
      if (!map[ymd]) map[ymd] = [];
      map[ymd].push(row);
    });
    return map;
  }, [rows, dateCol]);

  const availableDates = useMemo(() => new Set(Object.keys(dateMap)), [dateMap]);

  // useEffect (not useMemo) to jump calendar to latest date with data
  useEffect(() => {
    const dates = Object.keys(dateMap).sort();
    if (dates.length > 0) {
      const last = dates[dates.length - 1];
      const [y, m] = last.split("-").map(Number);
      setCalYear(y);
      setCalMonth(m - 1);
    }
  }, [dateMap]);

  const handleMonthChange = (dir) => {
    let m = calMonth + dir;
    let y = calYear;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y);
  };

  const dayRows = selectedDate ? (dateMap[selectedDate] || []) : [];
  const dayStats = useMemo(
    () => selectedDate ? buildDayStats(dayRows, dateCol, categoryCols, numericCols) : [],
    [selectedDate, dayRows, dateCol, categoryCols, numericCols]
  );

  if (!dateCol) return null;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-base">📅</div>
        <div>
          <h3 className="text-base font-bold text-gray-800 leading-tight m-0">Date Explorer</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Date column: <span className="font-mono font-semibold text-emerald-600">{dateCol}</span>
            {" · "}{availableDates.size} dates with data
          </p>
        </div>
        {selectedDate && (
          <button onClick={() => setSelectedDate(null)}
            className="ml-auto text-xs text-gray-400 hover:text-gray-600 bg-transparent border-none cursor-pointer">
            ✕ Clear
          </button>
        )}
      </div>

      <div className="flex gap-6 items-start flex-wrap">
        <MiniCalendar
          year={calYear} month={calMonth}
          availableDates={availableDates} selectedDate={selectedDate}
          onSelect={setSelectedDate} onMonthChange={handleMonthChange}
        />

        <div className="flex-1 min-w-0">
          {!selectedDate ? (
            <div className="flex flex-col items-center justify-center h-40 text-center">
              <div className="text-4xl mb-2">👆</div>
              <div className="text-sm font-semibold text-gray-500">Select a highlighted date</div>
              <div className="text-xs text-gray-400 mt-1">Green dates have data</div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <div className="text-xs text-gray-400 uppercase tracking-wide font-bold mb-0.5">Selected</div>
                <div className="text-lg font-extrabold text-gray-800">{formatDisplay(selectedDate)}</div>
                <div className="text-xs text-emerald-600 font-medium mt-0.5">
                  {dayRows.length} {dayRows.length === 1 ? "entry" : "entries"}
                </div>
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))" }}>
                {dayStats.map(stat => <StatCard key={stat.id} stat={stat} />)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}