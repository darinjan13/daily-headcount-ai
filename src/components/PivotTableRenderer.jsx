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
          {rows.map((row, i) => {
            const rowTotal = showColumnTotals
              ? valueColumns.reduce((sum, col) => sum + (Number(row[col]) || 0), 0)
              : null;

            return (
              <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                {columns.map((col, j) => (
                  <td
                    key={col}
                    className={`px-4 py-2 border border-gray-200 text-gray-700 whitespace-nowrap ${j === 0 ? "text-left font-medium" : "text-right"}`}
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
                  className={`px-4 py-2.5 border border-gray-300 font-bold text-emerald-700 whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}
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
  );
}