import { useMemo, useState } from "react";

const DEFAULT_PAGE_SIZE = 15;

export default function PivotTableRenderer({ data }) {
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [density, setDensity] = useState("comfortable");
  const rowPad = density === "compact" ? "py-1.5" : "py-2.5";
  const { columns, rows, totalRow, hasColDim } = data;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(rows.length / pageSize)), [rows.length, pageSize]);
  const visibleRows = useMemo(
    () => rows.slice(page * pageSize, (page + 1) * pageSize),
    [rows, page, pageSize]
  );
  const goTo = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));

  const formatNumber = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const num = Number(val);
    if (isNaN(num)) return val;
    return num % 1 === 0
      ? num.toLocaleString()
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // Value columns = everything except the first (label) column
  const valueColumns = columns.slice(1);

  // Column totals — sum each value column across all rows
  const colTotals = {};
  if (hasColDim && valueColumns.length > 1) {
    valueColumns.forEach((col) => {
      colTotals[col] = rows.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
    });
    // Grand total of all column totals
    colTotals["__grandTotal"] = Object.values(colTotals).reduce((a, b) => a + b, 0);
  }

  const showColumnTotals = hasColDim && valueColumns.length > 1;

  return (
    <div className="mt-2">
      <div className="flex flex-col gap-2 mb-2 sm:flex-row sm:items-center sm:justify-between">
        <span className="text-xs text-gray-400">{rows.length.toLocaleString()} rows</span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm w-fit">
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

          <label className="flex items-center gap-2 text-xs text-gray-500 bg-white border border-gray-200 rounded-lg px-3 py-2 shadow-sm w-fit">
            <span className="font-semibold uppercase tracking-wide text-gray-400">Rows / page</span>
            <input
              type="number"
              min={1}
              max={200}
              value={pageSize}
              onChange={(e) => {
                const val = Number(e.target.value) || DEFAULT_PAGE_SIZE;
                setPageSize(Math.max(1, Math.min(200, val)));
                setPage(0);
              }}
              className="w-16 px-2 py-1 rounded-md border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </label>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl shadow-sm shimmer-border">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              {columns.map((col, i) => (
                <th
                  key={col}
                  className={`px-4 py-2.5 font-semibold text-white border border-emerald-800 bg-emerald-700 whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                >
                  {col}
                </th>
              ))}
              {/* Total header — only for cross-tabs */}
              {showColumnTotals && (
                <th className="px-4 py-2.5 font-semibold text-white border border-emerald-800 bg-emerald-800 whitespace-nowrap text-right">
                  Total
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((row, i) => {
              const rowTotal = showColumnTotals
                ? valueColumns.reduce((sum, col) => sum + (Number(row[col]) || 0), 0)
                : null;

              return (
                <tr
                  key={i}
                  className={`${i % 2 === 0 ? "bg-white" : "bg-gray-50"} transition duration-200 hover:-translate-y-[1px] hover:bg-emerald-50/60 active:scale-[0.995]`}
                >
                  {columns.map((col, j) => (
                    <td
                      key={col}
                      className={`px-4 ${rowPad} border border-gray-200 text-gray-700 whitespace-nowrap transition-colors duration-200 ${j === 0 ? "text-left font-medium" : "text-right"}`}
                    >
                      {j === 0 ? row[col] : (row[col] != null && row[col] !== "" ? formatNumber(row[col]) : <span className="text-gray-300">—</span>)}
                    </td>
                  ))}
                  {showColumnTotals && (
                    <td className="px-4 py-2 border border-gray-200 font-semibold text-emerald-700 text-right whitespace-nowrap bg-emerald-50">
                      {formatNumber(rowTotal)}
                    </td>
                  )}
                </tr>
              );
            })}

            {/* Grand Total Row */}
            {totalRow && (
              <tr className="bg-emerald-50">
                {columns.map((col, j) => (
                  <td
                    key={col}
                    className={`px-4 ${rowPad} border border-gray-300 font-bold text-emerald-700 whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}
                  >
                    {j === 0 ? "Grand Total" : formatNumber(totalRow[col])}
                  </td>
                ))}
                {/* Grand total of grand totals — bottom-right corner */}
                {showColumnTotals && (
                  <td className="px-4 py-2.5 border border-gray-300 font-bold text-white bg-emerald-700 text-right whitespace-nowrap">
                    {formatNumber(colTotals["__grandTotal"])}
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

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
