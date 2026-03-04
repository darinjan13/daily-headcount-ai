import { useState, useMemo } from "react";

const BRAND = {
  dark: "var(--color-dark-serpent)",
  green: "var(--color-castleton-green)",
  saffron: "var(--color-saffron)",
  white: "var(--color-white)",
  muted: "var(--color-text-light)",
  border: "rgba(19, 48, 32, 0.14)",
  soft: "rgba(4, 98, 65, 0.04)",
};
const PAGE_SIZE = 15;

export default function DataTable({ headers, rows }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [searchFocus, setSearchFocus] = useState(false);

  const normalizedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const first = rows[0];
    if (Array.isArray(first)) return rows;
    if (typeof first === "object" && first !== null) return rows.map(row => headers.map(h => row[h] ?? null));
    return rows.map(row => [row]);
  }, [rows, headers]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = normalizedRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = normalizedRows.filter(row => row.some(cell => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q)));
    }
    if (sortCol !== null) {
      const idx = headers.indexOf(sortCol);
      result = [...result].sort((a, b) => {
        const av = a[idx], bv = b[idx];
        const an = Number(av), bn = Number(bv);
        const isNum = !isNaN(an) && !isNaN(bn) && av !== null && bv !== null;
        const cmp = isNum ? an - bn : String(av ?? "").localeCompare(String(bv ?? ""));
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return result;
  }, [normalizedRows, search, sortCol, sortDir, headers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const visibleRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const goTo = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: BRAND.muted, fontWeight: 600 }}>
          {filtered.length.toLocaleString()} of {normalizedRows.length.toLocaleString()} rows · {headers.length} columns
          {search && filtered.length !== normalizedRows.length && <span style={{ color: BRAND.saffron, marginLeft: 6, fontWeight: 700 }}>· filtered</span>}
        </span>
        <div style={{ position: "relative" }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none", color: BRAND.muted }}>🔍</span>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            onFocus={() => setSearchFocus(true)} onBlur={() => setSearchFocus(false)}
            placeholder="Search all columns..."
            style={{
              paddingLeft: 34, paddingRight: 32, paddingTop: 8, paddingBottom: 8, borderRadius: 10,
              border: `1.5px solid ${searchFocus ? BRAND.green : BRAND.border}`, fontSize: 12, outline: "none",
              background: BRAND.white, color: BRAND.dark, fontFamily: "'Manrope', sans-serif", width: 220,
              transition: "border-color 0.2s",
            }} />
          {search && (
            <button onClick={() => { setSearch(""); setPage(0); }} style={{
              position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
              background: "none", border: "none", color: BRAND.muted, cursor: "pointer", fontSize: 13, padding: 0,
            }}>✕</button>
          )}
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto", borderRadius: 14, boxShadow: "0 1px 8px rgba(19,48,32,0.07)", border: `1px solid ${BRAND.border}` }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            <tr>
              {headers.map(h => (
                <th key={h} onClick={() => handleSort(h)} style={{
                  background: BRAND.dark, color: BRAND.white, padding: "11px 14px", textAlign: "left",
                  fontWeight: 700, fontSize: 11, whiteSpace: "nowrap", cursor: "pointer",
                  letterSpacing: "0.04em", borderRight: "1px solid rgba(255,255,255,0.08)",
                  userSelect: "none", transition: "background 0.15s",
                }}
                  onMouseEnter={e => e.currentTarget.style.background = BRAND.green}
                  onMouseLeave={e => e.currentTarget.style.background = BRAND.dark}
                >
                  {h}
                  <span style={{ marginLeft: 6, fontSize: 9, opacity: sortCol === h ? 1 : 0.3 }}>
                    {sortCol === h ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr><td colSpan={headers.length} style={{ textAlign: "center", padding: "40px 0", color: BRAND.muted, fontSize: 13 }}>
                {search ? "No results match your search" : "No data available"}
              </td></tr>
            ) : visibleRows.map((row, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? BRAND.white : BRAND.soft, transition: "background 0.1s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(4, 98, 65, 0.08)"}
                onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? BRAND.white : BRAND.soft}
              >
                {row.map((cell, j) => (
                  <td key={j} style={{ padding: "9px 14px", borderBottom: `1px solid ${BRAND.border}`, borderRight: `1px solid ${BRAND.border}`, color: BRAND.dark, whiteSpace: "nowrap", fontWeight: 400 }}>
                    {cell === null || cell === undefined ? "" : typeof cell === "object" ? String(cell) : cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16 }}>
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
      background: active ? BRAND.green : BRAND.white,
      color: active ? BRAND.white : disabled ? "rgba(19, 48, 32, 0.4)" : BRAND.dark,
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