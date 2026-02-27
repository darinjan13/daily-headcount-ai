import { useState, useMemo } from "react";

const PAGE_SIZE = 15;

export default function DataTable({ headers, rows }) {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState("asc");
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [density, setDensity] = useState("comfortable");
  const rowPad = density === "compact" ? "py-1.5" : "py-2.5";

  const normalizedRows = useMemo(() => {
    if (!rows || rows.length === 0) return [];
    const first = rows[0];
    // Already arrays → use directly
    if (Array.isArray(first)) return rows;
    // Objects → convert using headers as keys
    if (typeof first === "object" && first !== null)
      return rows.map((row) => headers.map((h) => row[h] ?? null));
    // Fallback: wrap primitive in array
    return rows.map((row) => [row]);
  }, [rows, headers]);

  const handleSort = (col) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
  };

  const filtered = useMemo(() => {
    let result = normalizedRows;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = normalizedRows.filter((row) =>
        row.some((cell) => cell !== null && cell !== undefined && String(cell).toLowerCase().includes(q))
      );
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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice(page * pageSize, (page + 1) * pageSize);
  const goTo = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));

  return (
    <div>
      {/* Search bar */}
      <div className="flex flex-col gap-3 mb-3 md:flex-row md:items-center md:justify-between">
        <span className="text-sm text-gray-400">
          {filtered.length.toLocaleString()} of {normalizedRows.length.toLocaleString()} rows · {headers.length} columns
          {search && filtered.length !== normalizedRows.length && (
            <span className="text-emerald-600 font-semibold ml-1">· filtered</span>
          )}
        </span>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm text-xs text-gray-500">
            <span className="font-semibold uppercase tracking-wide text-gray-400">Density</span>
            <button
              onClick={() => setDensity("comfortable")}
              className={`px-2 py-1 rounded-md border text-xs font-semibold ${density === "comfortable" ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-[rgba(4,98,65,0.06)]" : "border-transparent text-gray-500 hover:text-[var(--color-primary)]"}`}
            >Comfort</button>
            <button
              onClick={() => setDensity("compact")}
              className={`px-2 py-1 rounded-md border text-xs font-semibold ${density === "compact" ? "border-[var(--color-primary)] text-[var(--color-primary)] bg-[rgba(4,98,65,0.06)]" : "border-transparent text-gray-500 hover:text-[var(--color-primary)]"}`}
            >Compact</button>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400">Rows / page</span>
            <input
              type="number"
              min={1}
              max={200}
              value={pageSize}
              onChange={(e) => {
                const val = Number(e.target.value) || PAGE_SIZE;
                setPageSize(Math.max(1, Math.min(200, val)));
                setPage(0);
              }}
              className="w-16 px-2 py-1 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </label>

          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 text-sm">🔍</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              placeholder="Search all columns..."
              className="pl-8 pr-8 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-56"
            />
            {search && (
              <button
                onClick={() => { setSearch(""); setPage(0); }}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 text-sm border-none bg-transparent cursor-pointer"
              >✕</button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl shadow-sm shimmer-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  onClick={() => handleSort(h)}
                  className="bg-emerald-700 text-white px-4 py-2.5 text-left font-semibold border border-emerald-800 whitespace-nowrap cursor-pointer select-none hover:bg-emerald-800 transition-colors"
                >
                  {h}
                  <span className={`ml-1.5 text-xs ${sortCol === h ? "opacity-100" : "opacity-30"}`}>
                    {sortCol === h ? (sortDir === "asc" ? "▲" : "▼") : "▲"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="text-center py-10 text-gray-400">
                  {search ? "No results match your search" : "No data available"}
                </td>
              </tr>
            ) : (
              visibleRows.map((row, i) => (
                <tr
                  key={i}
                  className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} transition duration-200 hover:-translate-y-[1px] hover:bg-emerald-50/60 active:scale-[0.995]`}
                >
                  {row.map((cell, j) => (
                    <td key={j} className={`px-4 ${rowPad} border border-gray-100 text-gray-700 whitespace-nowrap transition-colors duration-200`}>
                      {cell === null || cell === undefined
                        ? ""
                        : typeof cell === "object"
                        ? String(cell)
                        : cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1.5 mt-4 bg-white/85 backdrop-blur rounded-xl px-3 py-2 shadow-sm sticky bottom-2 sm:static">
          <span className="hidden sm:inline text-xs text-gray-400 mr-2">Navigate</span>
          <PagBtn onClick={() => goTo(0)} disabled={page === 0}>«</PagBtn>
          <PagBtn onClick={() => goTo(page - 1)} disabled={page === 0}>‹</PagBtn>
          {getPageNumbers(page, totalPages).map((p, i) =>
            p === "..." ? (
              <span key={i} className="px-1 text-gray-400">…</span>
            ) : (
              <PagBtn key={i} onClick={() => goTo(p)} active={p === page}>{p + 1}</PagBtn>
            )
          )}
          <PagBtn onClick={() => goTo(page + 1)} disabled={page === totalPages - 1}>›</PagBtn>
          <PagBtn onClick={() => goTo(totalPages - 1)} disabled={page === totalPages - 1}>»</PagBtn>
          <span className="text-xs text-gray-400 ml-2">Page {page + 1} of {totalPages}</span>
          <span className="text-xs text-gray-400">· Showing {pageSize} per page</span>
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
      className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors
        ${active ? "bg-emerald-700 border-emerald-700 text-white font-bold" : ""}
        ${disabled ? "bg-gray-50 border-gray-200 text-gray-300 cursor-not-allowed" : ""}
        ${!active && !disabled ? "bg-white border-gray-200 text-gray-600 hover:border-emerald-400 cursor-pointer" : ""}
      `}
    >
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