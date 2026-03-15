import { useState, useMemo, useEffect } from "react";
import { X } from "lucide-react";

const BRAND = {
  dark: "var(--color-text)",
  green: "var(--color-castleton-green)",
  saffron: "var(--color-saffron)",
  white: "var(--color-surface)",
  elevated: "var(--color-surface-elevated)",
  muted: "var(--color-text-light)",
  border: "var(--color-border)",
  soft: "var(--color-surface-soft)",
};

const PAGE_SIZE_OPTIONS = [5, 10, 15, 20, 25];

export default function DataTable({ headers = [], rows = [] }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [columnFilters, setColumnFilters] = useState({});
  const [visibleCols, setVisibleCols] = useState(headers);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [searchFocus, setSearchFocus] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [hiddenRows, setHiddenRows] = useState(new Set());

  useEffect(() => {
    setVisibleCols(headers);
    setColumnFilters({});
    setSelectedRows(new Set());
    setHiddenRows(new Set());
    setPage(0);
  }, [headers]);

  const normalizedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const first = rows[0];
    if (Array.isArray(first)) return rows;
    if (typeof first === "object" && first !== null) return rows.map(row => headers.map(h => row[h] ?? null));
    return rows.map(row => [row]);
  }, [rows, headers]);

  const working = useMemo(() => normalizedRows.map((row, idx) => ({ row, idx })), [normalizedRows]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = working;

    if (hiddenRows.size) {
      result = result.filter(r => !hiddenRows.has(r.idx));
    }

    // Column filters
    Object.entries(columnFilters).forEach(([col, val]) => {
      if (!val?.trim()) return;
      const idx = headers.indexOf(col);
      if (idx === -1) return;
      const q = val.trim().toLowerCase();
      result = result.filter(({ row }) => String(row[idx] ?? "").toLowerCase().includes(q));
    });

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(({ row }) => row.some(cell => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q)));
    }

    if (sortCol !== null) {
      const idx = headers.indexOf(sortCol);
      result = [...result].sort((a, b) => {
        const av = a.row[idx], bv = b.row[idx];
        const an = Number(av), bn = Number(bv);
        const isNum = !isNaN(an) && !isNaN(bn) && av !== null && bv !== null;
        const cmp = isNum ? an - bn : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }

    return result;
  }, [working, search, sortCol, sortDir, headers, columnFilters, hiddenRows]);

  const visibleHeaders = useMemo(() => headers.filter(h => visibleCols.includes(h)), [headers, visibleCols]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const goTo = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));

  const toggleRowSelection = (idx) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const selectPageRows = (checked) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      pageRows.forEach(({ idx }) => {
        if (checked) next.add(idx); else next.delete(idx);
      });
      return next;
    });
  };

  const hideSelected = () => {
    if (!selectedRows.size) return;
    setHiddenRows(prev => new Set([...prev, ...selectedRows]));
    setSelectedRows(new Set());
    setPage(0);
  };

  const clearHidden = () => {
    setHiddenRows(new Set());
    setSelectedRows(new Set());
    setPage(0);
  };

  const toggleVisibleCol = (col) => {
    setVisibleCols(prev => prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]);
    setPage(0);
  };

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: BRAND.muted, fontWeight: 600 }}>
          {filtered.length.toLocaleString()} of {working.length.toLocaleString()} rows · {visibleHeaders.length} / {headers.length} columns
          {search && filtered.length !== working.length && <span style={{ color: BRAND.saffron, marginLeft: 6, fontWeight: 700 }}>· filtered</span>}
          {hiddenRows.size > 0 && <span style={{ color: BRAND.saffron, marginLeft: 6, fontWeight: 700 }}>· {hiddenRows.size} hidden</span>}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none", color: BRAND.muted }}>🔍</span>
            <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
              onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
              placeholder="Search all columns..."
              style={{
                paddingLeft: 34, paddingRight: 32, paddingTop: 8, paddingBottom: 8, borderRadius: 10,
                border: `1.5px solid ${searchFocus ? BRAND.green : BRAND.border}`, fontSize: 12, outline: "none",
                background: BRAND.elevated, color: BRAND.dark, fontFamily: "'Manrope', sans-serif", width: 220,
                transition: "border-color 0.2s",
              }} />
            {search && (
              <button onClick={() => { setSearch(""); setPage(0); }} style={{
                position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", color: BRAND.muted, cursor: "pointer", fontSize: 13, padding: 0,
              }} aria-label="Clear search">
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: BRAND.muted, fontWeight: 600 }}>
            Page size
            <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0); }}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`, background: BRAND.elevated, color: BRAND.dark, fontWeight: 600 }}>
              {PAGE_SIZE_OPTIONS.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <div style={{ position: "relative" }}>
            <details style={{ cursor: "pointer", userSelect: "none" }}>
              <summary style={{ listStyle: "none", fontSize: 12, fontWeight: 700, color: BRAND.dark, padding: "6px 10px", border: `1.5px solid ${BRAND.border}`, borderRadius: 8, background: BRAND.elevated }}>
                Columns ({visibleHeaders.length}/{headers.length})
              </summary>
              <div style={{ position: "absolute", right: 0, zIndex: 10, background: BRAND.elevated, border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: 10, marginTop: 6, boxShadow: "var(--color-shadow-soft)", maxHeight: 220, overflow: "auto" }}>
                {headers.map(col => (
                  <label key={col} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: BRAND.dark, marginBottom: 6 }}>
                    <input type="checkbox" checked={visibleCols.includes(col)} onChange={() => toggleVisibleCol(col)} />
                    {col}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <button onClick={hideSelected} disabled={!selectedRows.size} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${BRAND.border}`, background: selectedRows.size ? BRAND.green : BRAND.elevated, color: selectedRows.size ? "#fff" : BRAND.muted, fontSize: 12, fontWeight: 700, cursor: selectedRows.size ? "pointer" : "not-allowed" }}>Hide selected</button>
          <button onClick={clearHidden} disabled={!hiddenRows.size} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${BRAND.border}`, background: hiddenRows.size ? BRAND.elevated : BRAND.soft, color: hiddenRows.size ? BRAND.dark : BRAND.muted, fontSize: 12, fontWeight: 700, cursor: hiddenRows.size ? "pointer" : "not-allowed" }}>Unhide all</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 14, boxShadow: "var(--color-shadow-soft)", border: `1px solid ${BRAND.border}`, background: BRAND.elevated }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ width: 36, background: BRAND.green }}>
                <input type="checkbox" aria-label="Select page rows" checked={pageRows.length>0 && pageRows.every(({idx})=>selectedRows.has(idx))}
                  onChange={e => selectPageRows(e.target.checked)} />
              </th>
              {visibleHeaders.map(h => (
                <th key={h} onClick={() => handleSort(h)} style={{
                  background: BRAND.green, color: "#FFFFFF", padding: "11px 14px", textAlign: "left",
                  fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", cursor: "pointer",
                  letterSpacing: "0.04em", borderRight: "1px solid rgba(255,255,255,0.08)",
                  userSelect: "none", transition: "background 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--color-dark-serpent)"}
                  onMouseLeave={e => e.currentTarget.style.background = BRAND.green}
                >
                  {h}
                  <span style={{ marginLeft: 6, fontSize: 9, opacity: sortCol === h ? 1 : 0.3 }}>
                    {sortCol === h ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                  </span>
                </th>
              ))}
            </tr>
            <tr>
              <th style={{ background: BRAND.elevated }}></th>
              {visibleHeaders.map(h => (
                <th key={`${h}-filter`} style={{ background: BRAND.elevated, padding: "6px 10px", borderBottom: `1px solid ${BRAND.border}` }}>
                  <input
                    value={columnFilters[h] || ""}
                    onChange={e => { setColumnFilters(prev => ({ ...prev, [h]: e.target.value })); setPage(0); }}
                    placeholder={`Filter ${h}`}
                    style={{ width: "100%", padding: "6px 8px", borderRadius: 8, border: `1px solid ${BRAND.border}`, fontSize: 11, background: BRAND.white, color: BRAND.dark }}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr><td colSpan={visibleHeaders.length + 1} style={{ textAlign: "center", padding: "40px 0", color: BRAND.muted, fontSize: 13 }}>
                {search || Object.values(columnFilters).some(v=>v) ? "No results match your filters" : "No data available"}
              </td></tr>
            ) : pageRows.map(({ row, idx }, i) => {
              const isSelected = selectedRows.has(idx);
              return (
                <tr key={`${idx}-${i}`} style={{ background: i % 2 === 0 ? BRAND.white : BRAND.soft, transition: "background 0.1s" }}
                  onMouseEnter={e => e.currentTarget.style.background = "var(--color-chip-bg)"}
                  onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? BRAND.white : BRAND.soft}
                >
                  <td style={{ padding: "9px 10px", borderBottom: `1px solid ${BRAND.border}`, textAlign: "center" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(idx)} />
                  </td>
                  {visibleHeaders.map((h, j) => {
                    const colIdx = headers.indexOf(h);
                    const cell = row[colIdx];
                    return (
                      <td key={`${j}-${h}`} style={{ padding: "9px 14px", borderBottom: `1px solid ${BRAND.border}`, borderRight: `1px solid ${BRAND.border}`, color: BRAND.dark, whiteSpace: "nowrap", fontWeight: 400 }}>
                        {cell === null || cell === undefined ? "" : typeof cell === "object" ? String(cell) : cell}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
          <PagBtn onClick={() => goTo(0)} disabled={page === 0}>«</PagBtn>
          <PagBtn onClick={() => goTo(page - 1)} disabled={page === 0}>‹</PagBtn>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "..." ? <span key={i} style={{ color: BRAND.muted, padding: "0 2px" }}>…</span>
              : <PagBtn key={i} onClick={() => goTo(p)} active={p === page}>{p + 1}</PagBtn>
          )}
          <PagBtn onClick={() => goTo(page + 1)} disabled={page === totalPages - 1}>›</PagBtn>
          <PagBtn onClick={() => goTo(totalPages - 1)} disabled={page === totalPages - 1}>»</PagBtn>
          <span style={{ fontSize: 11, color: BRAND.muted, marginLeft: 6, fontWeight: 600 }}>Page {page + 1} of {totalPages}</span>
        </div>
      )}
    </div>
  );
}

function PagBtn({ onClick, disabled, active, children }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: "6px 12px", borderRadius: 8, border: `1.5px solid ${active ? BRAND.green : BRAND.border}`,
      background: active ? BRAND.green : BRAND.elevated,
      color: active ? "#FFFFFF" : disabled ? "var(--color-text-light)" : BRAND.dark,
      opacity: disabled ? 0.6 : 1,
      fontSize: 12, fontWeight: 600, cursor: disabled ? "not-allowed" : "pointer",
      fontFamily: "'Manrope', sans-serif", transition: "all 0.15s",
    }}>
      {children}
    </button>
  );
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i);
  if (current < 4) return [0, 1, 2, 3, 4, "...", total - 1];
  if (current > total - 5) return [0, "...", total - 5, total - 4, total - 3, total - 2, total - 1];
  return [0, "...", current - 1, current, current + 1, "...", total - 1];
}
