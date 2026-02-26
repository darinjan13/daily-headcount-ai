export default function PivotTableRenderer({ data }) {
  const { columns, rows, totalRow } = data;

  const formatNumber = (val) => {
    if (val === null || val === undefined || val === "") return "";
    const num = Number(val);
    if (isNaN(num)) return val;
    return num % 1 === 0
      ? num.toLocaleString()
      : num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

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
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
              {columns.map((col, j) => (
                <td
                  key={col}
                  className={`px-4 py-2 border border-gray-200 text-gray-700 whitespace-nowrap ${j === 0 ? "text-left" : "text-right"}`}
                >
                  {j === 0 ? row[col] : formatNumber(row[col])}
                </td>
              ))}
            </tr>
          ))}

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
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}