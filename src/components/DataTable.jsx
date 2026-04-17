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

function buildMergedHeaderGrid(rows) {
  if (!Array.isArray(rows) || !rows.length) return [];

  const width = Math.max(...rows.map(row => row.length));
  const normalizedRows = rows.map(row =>
    Array.from({ length: width }, (_, index) => row?.[index] || "")
  );
  const covered = normalizedRows.map(() => Array(width).fill(false));

  return normalizedRows.map((row, rowIndex) => {
    const cells = [];

    for (let colIndex = 0; colIndex < width; colIndex += 1) {
      if (covered[rowIndex][colIndex]) continue;

      const value = row[colIndex] || "";
      let colSpan = 1;

      while (
        colIndex + colSpan < width &&
        row[colIndex + colSpan] === value &&
        !covered[rowIndex][colIndex + colSpan]
      ) {
        colSpan += 1;
      }

      let rowSpan = 1;
      if (value) {
        while (rowIndex + rowSpan < normalizedRows.length) {
          let canSpanDown = true;
          for (let i = colIndex; i < colIndex + colSpan; i += 1) {
            if (normalizedRows[rowIndex + rowSpan][i] !== value) {
              canSpanDown = false;
              break;
            }
          }
          if (!canSpanDown) break;
          rowSpan += 1;
        }
      }

      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        for (let c = colIndex; c < colIndex + colSpan; c += 1) {
          if (r !== rowIndex || c !== colIndex) covered[r][c] = true;
        }
      }

      cells.push({ value, colSpan, rowSpan, start: colIndex });
    }

    return cells;
  });
}

function getGroupedHeaderStyle(rowIndex, hasValue) {
  if (!hasValue) {
    return {
      background: BRAND.elevated,
      color: BRAND.muted,
      borderRight: `1px solid ${BRAND.border}`,
      borderBottom: `1px solid ${BRAND.border}`,
    };
  }

  const palette = [
    {
      background: "var(--color-dark-serpent)",
      color: "#FFFFFF",
      borderRight: "1px solid rgba(255,255,255,0.08)",
      borderBottom: "1px solid rgba(255,255,255,0.14)",
    },
    {
      background: "rgba(4, 98, 65, 0.92)",
      color: "#FFFFFF",
      borderRight: "1px solid rgba(255,255,255,0.08)",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
    },
    {
      background: "rgba(10, 122, 84, 0.88)",
      color: "#FFFFFF",
      borderRight: "1px solid rgba(255,255,255,0.08)",
      borderBottom: "1px solid rgba(255,255,255,0.12)",
    },
  ];

  return palette[Math.min(rowIndex, palette.length - 1)];
}

function getPageNumbers(current, total) {
  if (total <= 7) {
    return Array.from({ length: total }, (_, index) => index);
  }

  const pages = [0];
  const start = Math.max(1, current - 1);
  const end = Math.min(total - 2, current + 1);

  if (start > 1) pages.push("...");
  for (let page = start; page <= end; page += 1) pages.push(page);
  if (end < total - 2) pages.push("...");

  pages.push(total - 1);
  return pages;
}

export default function DataTable({ headers = [], rows = [], displayHeaderRows = null }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);
  const [search, setSearch] = useState("");
  const [visibleCols, setVisibleCols] = useState(headers);
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [searchFocus, setSearchFocus] = useState(false);
  const [selectedRows, setSelectedRows] = useState(new Set());
  const [hiddenRows, setHiddenRows] = useState(new Set());

  useEffect(() => {
    setVisibleCols(headers);
    setSelectedRows(new Set());
    setHiddenRows(new Set());
    setPage(0);
  }, [headers]);

  const firstRow = rows?.[0];
  const rowMode = Array.isArray(firstRow) ? "array" : (firstRow && typeof firstRow === "object" ? "object" : "scalar");
  const hasActiveFilters =
    Boolean(search.trim()) ||
    sortCol !== null ||
    hiddenRows.size > 0;

  const getCellValue = (row, header, index) => {
    if (rowMode === "array") return row?.[index];
    if (rowMode === "object") return row?.[header] ?? null;
    return index === 0 ? row : null;
  };

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(direction => (direction === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  const visibleHeaders = useMemo(() => headers.filter(header => visibleCols.includes(header)), [headers, visibleCols]);
  const visibleHeaderIndices = useMemo(() => visibleHeaders.map(header => headers.indexOf(header)), [headers, visibleHeaders]);
  const visibleDisplayHeaderRows = useMemo(() => {
    if (!Array.isArray(displayHeaderRows) || displayHeaderRows.length <= 1) return null;
    return displayHeaderRows.map(row => visibleHeaderIndices.map(index => row?.[index] || ""));
  }, [displayHeaderRows, visibleHeaderIndices]);
  const visibleLeafHeaderLabels = visibleDisplayHeaderRows?.[visibleDisplayHeaderRows.length - 1] || null;
  const parentHeaderCells = useMemo(() => {
    if (!visibleDisplayHeaderRows) return null;
    return buildMergedHeaderGrid(visibleDisplayHeaderRows.slice(0, -1));
  }, [visibleDisplayHeaderRows]);

  const filteredEntries = useMemo(() => {
    if (!rows?.length) return [];

    if (!hasActiveFilters) {
      const start = page * pageSize;
      const end = start + pageSize;
      return rows.slice(start, end).map((row, offset) => ({ row, idx: start + offset }));
    }

    let result = rows.map((row, idx) => ({ row, idx }));

    if (hiddenRows.size) {
      result = result.filter(entry => !hiddenRows.has(entry.idx));
    }

    if (search.trim()) {
      const query = search.trim().toLowerCase();
      result = result.filter(({ row }) =>
        headers.some((header, index) => {
          const cell = getCellValue(row, header, index);
          return cell !== null && cell !== undefined && String(cell).toLowerCase().includes(query);
        })
      );
    }

    if (sortCol !== null) {
      const index = headers.indexOf(sortCol);
      result = [...result].sort((a, b) => {
        const aValue = getCellValue(a.row, sortCol, index);
        const bValue = getCellValue(b.row, sortCol, index);
        const aNumber = Number(aValue);
        const bNumber = Number(bValue);
        const isNumeric = !isNaN(aNumber) && !isNaN(bNumber) && aValue !== null && bValue !== null;
        const comparison = isNumeric
          ? aNumber - bNumber
          : String(aValue ?? "").localeCompare(String(bValue ?? ""));
        return sortDir === "asc" ? comparison : -comparison;
      });
    }

    return result;
  }, [rows, hasActiveFilters, page, pageSize, search, sortCol, sortDir, headers, hiddenRows]);

  const totalRows = rows?.length || 0;
  const filteredCount = hasActiveFilters ? filteredEntries.length : Math.max(totalRows - hiddenRows.size, 0);
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const pageRows = hasActiveFilters ? filteredEntries.slice(page * pageSize, (page + 1) * pageSize) : filteredEntries;
  const goTo = (targetPage) => setPage(Math.max(0, Math.min(totalPages - 1, targetPage)));

  const toggleRowSelection = (idx) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const selectPageRows = (checked) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      pageRows.forEach(({ idx }) => {
        if (checked) next.add(idx);
        else next.delete(idx);
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

  const toggleVisibleCol = (column) => {
    setVisibleCols(prev => (prev.includes(column) ? prev.filter(col => col !== column) : [...prev, column]));
    setPage(0);
  };

  return (
    <div style={{ fontFamily: "'Manrope', sans-serif" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <span style={{ fontSize: 12, color: BRAND.muted, fontWeight: 600 }}>
          {filteredCount.toLocaleString()} of {totalRows.toLocaleString()} rows · {visibleHeaders.length} / {headers.length} columns
          {hasActiveFilters && filteredCount !== totalRows && <span style={{ color: BRAND.saffron, marginLeft: 6, fontWeight: 700 }}>· filtered</span>}
          {hiddenRows.size > 0 && <span style={{ color: BRAND.saffron, marginLeft: 6, fontWeight: 700 }}>· {hiddenRows.size} hidden</span>}
        </span>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 13, pointerEvents: "none", color: BRAND.muted }}>🔍</span>
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(0); }}
              onFocus={() => setSearchFocus(true)}
              onBlur={() => setSearchFocus(false)}
              placeholder="Search all columns..."
              style={{
                paddingLeft: 34,
                paddingRight: 32,
                paddingTop: 8,
                paddingBottom: 8,
                borderRadius: 10,
                border: `1.5px solid ${searchFocus ? BRAND.green : BRAND.border}`,
                fontSize: 12,
                outline: "none",
                background: BRAND.elevated,
                color: BRAND.dark,
                fontFamily: "'Manrope', sans-serif",
                width: 220,
                transition: "border-color 0.2s",
              }}
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(0); }}
                style={{
                  position: "absolute",
                  right: 10,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: BRAND.muted,
                  cursor: "pointer",
                  fontSize: 13,
                  padding: 0,
                }}
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: BRAND.muted, fontWeight: 600 }}>
            Page size
            <select
              value={pageSize}
              onChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
              style={{ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${BRAND.border}`, background: BRAND.elevated, color: BRAND.dark, fontWeight: 600 }}
            >
              {PAGE_SIZE_OPTIONS.map(size => <option key={size} value={size}>{size}</option>)}
            </select>
          </label>
          <div style={{ position: "relative" }}>
            <details style={{ cursor: "pointer", userSelect: "none" }}>
              <summary style={{ listStyle: "none", fontSize: 12, fontWeight: 700, color: BRAND.dark, padding: "6px 10px", border: `1.5px solid ${BRAND.border}`, borderRadius: 8, background: BRAND.elevated }}>
                Columns ({visibleHeaders.length}/{headers.length})
              </summary>
              <div style={{ position: "absolute", right: 0, zIndex: 10, background: BRAND.elevated, border: `1px solid ${BRAND.border}`, borderRadius: 10, padding: 10, marginTop: 6, boxShadow: "var(--color-shadow-soft)", maxHeight: 220, overflow: "auto" }}>
                {headers.map(column => (
                  <label key={column} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: BRAND.dark, marginBottom: 6 }}>
                    <input type="checkbox" checked={visibleCols.includes(column)} onChange={() => toggleVisibleCol(column)} />
                    {column}
                  </label>
                ))}
              </div>
            </details>
          </div>
          <button onClick={hideSelected} disabled={!selectedRows.size} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${BRAND.border}`, background: selectedRows.size ? BRAND.green : BRAND.elevated, color: selectedRows.size ? "#fff" : BRAND.muted, fontSize: 12, fontWeight: 700, cursor: selectedRows.size ? "pointer" : "not-allowed" }}>Hide selected</button>
          <button onClick={clearHidden} disabled={!hiddenRows.size} style={{ padding: "7px 12px", borderRadius: 8, border: `1px solid ${BRAND.border}`, background: hiddenRows.size ? BRAND.elevated : BRAND.soft, color: hiddenRows.size ? BRAND.dark : BRAND.muted, fontSize: 12, fontWeight: 700, cursor: hiddenRows.size ? "pointer" : "not-allowed" }}>Unhide all</button>
        </div>
      </div>

      <div style={{ overflowX: "auto", borderRadius: 14, boxShadow: "var(--color-shadow-soft)", border: `1px solid ${BRAND.border}`, background: BRAND.elevated }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead>
            {parentHeaderCells?.map((headerRow, rowIdx) => (
              <tr key={`display-header-${rowIdx}`}>
                {rowIdx === 0 && (
                  <th
                    rowSpan={parentHeaderCells.length + 1}
                    style={{
                      width: 36,
                      background: BRAND.green,
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      borderBottom: "1px solid rgba(255,255,255,0.12)",
                      verticalAlign: "middle",
                    }}
                  >
                    <input
                      type="checkbox"
                      aria-label="Select page rows"
                      checked={pageRows.length > 0 && pageRows.every(({ idx }) => selectedRows.has(idx))}
                      onChange={(event) => selectPageRows(event.target.checked)}
                    />
                  </th>
                )}
                {headerRow.map(span => (
                  <th
                    key={`${rowIdx}-${span.start}-${span.value || "blank"}`}
                    colSpan={span.colSpan}
                    rowSpan={span.rowSpan}
                    style={{
                      ...getGroupedHeaderStyle(rowIdx, Boolean(span.value)),
                      padding: span.value ? "9px 14px" : "4px 8px",
                      textAlign: "center",
                      fontWeight: 800,
                      fontSize: rowIdx === 0 ? 11 : 10,
                      whiteSpace: "nowrap",
                      letterSpacing: "0.04em",
                      verticalAlign: "middle",
                    }}
                  >
                    {span.value}
                  </th>
                ))}
              </tr>
            ))}
            <tr>
              {!parentHeaderCells && (
                <th style={{ width: 36, background: BRAND.green }}>
                  <input
                    type="checkbox"
                    aria-label="Select page rows"
                    checked={pageRows.length > 0 && pageRows.every(({ idx }) => selectedRows.has(idx))}
                    onChange={(event) => selectPageRows(event.target.checked)}
                  />
                </th>
              )}
              {visibleHeaders.map((header, headerIdx) => (
                <th
                  key={header}
                  onClick={() => handleSort(header)}
                  style={{
                    background: BRAND.green,
                    color: "#FFFFFF",
                    padding: "11px 14px",
                    textAlign: "left",
                    fontWeight: 700,
                    fontSize: 11,
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    borderRight: "1px solid rgba(255,255,255,0.08)",
                    userSelect: "none",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={event => { event.currentTarget.style.background = "var(--color-dark-serpent)"; }}
                  onMouseLeave={event => { event.currentTarget.style.background = BRAND.green; }}
                >
                  {visibleLeafHeaderLabels?.[headerIdx] || header}
                  <span style={{ marginLeft: 6, fontSize: 9, opacity: sortCol === header ? 1 : 0.3 }}>
                    {sortCol === header ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={visibleHeaders.length + 1} style={{ textAlign: "center", padding: "40px 0", color: BRAND.muted, fontSize: 13 }}>
                  {search ? "No results match your search" : "No data available"}
                </td>
              </tr>
            ) : pageRows.map(({ row, idx }, rowIndex) => {
              const isSelected = selectedRows.has(idx);
              return (
                <tr
                  key={`${idx}-${rowIndex}`}
                  style={{ background: rowIndex % 2 === 0 ? BRAND.white : BRAND.soft, transition: "background 0.1s" }}
                  onMouseEnter={event => { event.currentTarget.style.background = "var(--color-chip-bg)"; }}
                  onMouseLeave={event => { event.currentTarget.style.background = rowIndex % 2 === 0 ? BRAND.white : BRAND.soft; }}
                >
                  <td style={{ padding: "9px 10px", borderBottom: `1px solid ${BRAND.border}`, textAlign: "center" }}>
                    <input type="checkbox" checked={isSelected} onChange={() => toggleRowSelection(idx)} />
                  </td>
                  {visibleHeaders.map((header, columnIndex) => {
                    const sourceIndex = headers.indexOf(header);
                    const cell = getCellValue(row, header, sourceIndex);
                    return (
                      <td key={`${columnIndex}-${header}`} style={{ padding: "9px 14px", borderBottom: `1px solid ${BRAND.border}`, borderRight: `1px solid ${BRAND.border}`, color: BRAND.dark, whiteSpace: "nowrap", fontWeight: 400 }}>
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

      {totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, marginTop: 16, flexWrap: "wrap" }}>
          <PagBtn onClick={() => goTo(0)} disabled={page === 0}>«</PagBtn>
          <PagBtn onClick={() => goTo(page - 1)} disabled={page === 0}>‹</PagBtn>
          {getPageNumbers(page, totalPages).map((pageNumber, index) =>
            pageNumber === "..." ? (
              <span key={index} style={{ color: BRAND.muted, padding: "0 2px" }}>…</span>
            ) : (
              <PagBtn key={index} onClick={() => goTo(pageNumber)} active={pageNumber === page}>{pageNumber + 1}</PagBtn>
            )
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
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: `1.5px solid ${active ? BRAND.green : BRAND.border}`,
        background: active ? BRAND.green : BRAND.elevated,
        color: active ? "#FFFFFF" : disabled ? "var(--color-text-light)" : BRAND.dark,
        opacity: disabled ? 0.6 : 1,
        fontSize: 12,
        fontWeight: 600,
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "'Manrope', sans-serif",
        transition: "all 0.15s",
      }}
    >
      {children}
    </button>
  );
}
