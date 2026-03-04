export default function PivotTableRenderer({ data }) {
  const { columns, rows, totalRow, hasColDim } = data;

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
    <div className="overflow-x-auto mt-2">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr>
            {columns.map((col, i) => (
              <th
                key={col}
                className={`px-4 py-2.5 font-semibold whitespace-nowrap ${i === 0 ? "text-left" : "text-right"}`}
                style={{
                  color: "var(--color-white)",
                  border: "1px solid rgba(19, 48, 32, 0.18)",
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
                  color: "var(--color-white)",
                  border: "1px solid rgba(19, 48, 32, 0.2)",
                  backgroundColor: "var(--color-dark-serpent)",
                }}
              >
                Total
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const rowTotal = showColumnTotals
              ? valueColumns.reduce((sum, col) => sum + (Number(row[col]) || 0), 0)
              : null;

            return (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "var(--color-white)" : "rgba(4, 98, 65, 0.04)" }}>
                {columns.map((col, j) => (
                  <td
                    key={col}
                    className={`px-4 py-2 whitespace-nowrap ${j === 0 ? "text-left font-medium" : "text-right"}`}
                    style={{
                      border: "1px solid rgba(19, 48, 32, 0.1)",
                      color: "var(--color-dark-serpent)",
                    }}
                  >
                    {j === 0 ? row[col] : (row[col] != null && row[col] !== "" ? formatNumber(row[col]) : <span style={{ color: "rgba(19, 48, 32, 0.35)" }}>—</span>)}
                  </td>
                ))}
                {showColumnTotals && (
                  <td
                    className="px-4 py-2 font-semibold text-right whitespace-nowrap"
                    style={{
                      border: "1px solid rgba(19, 48, 32, 0.1)",
                      color: "var(--color-castleton-green)",
                      backgroundColor: "rgba(4, 98, 65, 0.08)",
                    }}
                  >
                    {formatNumber(rowTotal)}
                  </td>
                )}
              </tr>
            );
          })}

          {/* Grand Total Row */}
          {totalRow && (
            <tr style={{ backgroundColor: "rgba(4, 98, 65, 0.08)" }}>
              {columns.map((col, j) => (
                <td
                  key={col}
                  className={`px-4 py-2.5 font-bold whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}
                  style={{
                    border: "1px solid rgba(19, 48, 32, 0.15)",
                    color: "var(--color-dark-serpent)",
                  }}
                >
                  {j === 0 ? "Grand Total" : formatNumber(totalRow[col])}
                </td>
              ))}
              {showColumnTotals && (
                <td
                  className="px-4 py-2.5 font-bold text-right whitespace-nowrap"
                  style={{
                    border: "1px solid rgba(19, 48, 32, 0.2)",
                    color: "var(--color-white)",
                    backgroundColor: "var(--color-dark-serpent)",
                  }}
                >
                  {formatNumber(colTotals["__grandTotal"])}
                </td>
              )}
            </tr>
          )}

        </tbody>
      </table>
    </div>
  );
}