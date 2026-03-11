import { useEffect, useMemo, useState } from "react";

export default function PivotTableRenderer({ data, defaultPageSize = 15 }) {
  const { columns, rows, totalRow, hasColDim } = data;
  const valueColumns = columns.slice(1);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  useEffect(() => {
    setPageSize(defaultPageSize);
    setPage(0);
  }, [rows, defaultPageSize]);

  const formatNumber = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const num = Number(val);
    if (Number.isNaN(num)) return val;
    return num % 1 === 0
      ? num.toLocaleString()
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  const colTotals = {};
  if (hasColDim && valueColumns.length > 1) {
    valueColumns.forEach((col) => {
      colTotals[col] = rows.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);
    });
    colTotals.__grandTotal = Object.values(colTotals).reduce((a, b) => a + b, 0);
  }

  const showColumnTotals = hasColDim && valueColumns.length > 1;
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = useMemo(
    () => rows.slice(page * pageSize, (page + 1) * pageSize),
    [rows, page, pageSize],
  );
  const goTo = (p) => setPage(Math.max(0, Math.min(totalPages - 1, p)));

  return (
    <div className="mt-2" style={{ overflowX: "auto", overflowY: "hidden" }}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col}
                className={`px-4 py-2.5 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                style={{
                  color: "#FFFFFF",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-castleton-green)",
                }}
              >
                {col}
              </th>
            ))}
            {showColumnTotals && (
              <th
                className="px-4 py-2.5 font-semibold whitespace-nowrap text-right"
                style={{
                  color: "#FFFFFF",
                  border: "1px solid var(--color-border)",
                  backgroundColor: "var(--color-castleton-green)",
                }}
              >
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {pageRows.map((row, i) => {
            const rowTotal = showColumnTotals
              ? valueColumns.reduce((sum, col) => sum + (Number(row[col]) || 0), 0)
              : null;

            return (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "var(--color-white)" : "var(--color-surface-soft)" }}>
                {columns.map((col, j) => (
                  <td
                    key={col}
                    className={`px-4 py-2 whitespace-nowrap ${j === 0 ? "text-left font-medium" : "text-right"}`}
                    style={{
                      border: "1px solid var(--color-border)",
                      color: "var(--color-text)",
                    }}
                  >
                    {j === 0 ? row[col] : (row[col] != null && row[col] !== ""
                      ? formatNumber(row[col])
                      : <span style={{ color: "var(--color-text-light)" }}>—</span>)}
                  </td>
                ))}
                {showColumnTotals && (
                  <td
                    className="px-4 py-2 font-semibold text-right whitespace-nowrap"
                    style={{
                      border: "1px solid var(--color-border)",
                      color: "var(--color-castleton-green)",
                      backgroundColor: "var(--color-chip-bg)",
                    }}
                  >
                    {formatNumber(rowTotal)}
                  </td>
                )}
              </tr>
            );
          })}

          {totalRow && (
            <tr style={{ backgroundColor: "var(--color-chip-bg)" }}>
              {columns.map((col, j) => (
                <td
                  key={col}
                  className={`px-4 py-2.5 font-bold whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                  }}
                >
                  {j === 0 ? "Grand Total" : formatNumber(totalRow[col])}
                </td>
              ))}
              {showColumnTotals && (
                <td
                  className="px-4 py-2.5 font-bold text-right whitespace-nowrap"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "#FFFFFF",
                    backgroundColor: "var(--color-dark-serpent)",
                  }}
                >
                  {formatNumber(colTotals.__grandTotal)}
                </td>
              )}
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 10, marginTop: 18 }}>
          <span style={{ fontSize: 11, color: "var(--color-text-light)", fontWeight: 600 }}>
            {rows.length.toLocaleString()} rows
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            <PagBtn onClick={() => goTo(page - 1)} disabled={page === 0}>Prev</PagBtn>
            <span style={{ fontSize: 11, color: "var(--color-text-light)", fontWeight: 600 }}>
              Page {page + 1} of {totalPages}
            </span>
            <PagBtn onClick={() => goTo(page + 1)} disabled={page === totalPages - 1}>Next</PagBtn>
          </div>
          <span />
        </div>
      )}
    </div>
  );
}

function PagBtn({ onClick, disabled, children }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: "1.5px solid var(--color-border)",
        background: "var(--color-surface-elevated)",
        color: disabled ? "var(--color-text-light)" : "var(--color-text)",
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
