import { useState } from "react";
import ExcelUploader from "./components/ExcelUploader";
import Dashboard from "./components/Dashboard";

function App() {
  const [data, setData] = useState(null);
  const [blueprint, setBlueprint] = useState(null);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Bar — always visible */}
      <div className="bg-emerald-800 shadow-lg sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-6">
          {/* Logo / Title */}
          <div className="flex items-center gap-2.5 shrink-0">
            <span className="text-2xl">📊</span>
            <div>
              <div className="text-white font-extrabold text-base leading-tight tracking-tight">
                AI Dashboard
              </div>
              <div className="text-emerald-300 text-xs leading-tight">Generator</div>
            </div>
          </div>

          <div className="w-px h-8 bg-emerald-600" />

          {/* Compact Uploader — takes remaining space */}
          <div className="flex-1">
            <ExcelUploader
              compact
              onDataReady={(extracted, bp) => {
                setData(extracted);
                setBlueprint(bp);
              }}
            />
          </div>
        </div>
      </div>

      {/* Dashboard or empty state */}
      {data && blueprint ? (
        <Dashboard data={data} blueprint={blueprint} />
      ) : (
        <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
          <div className="text-6xl mb-4">📂</div>
          <h2 className="text-2xl font-extrabold text-gray-700 mb-2">
            Upload an Excel file to get started
          </h2>
          <p className="text-gray-400 text-sm max-w-sm">
            Select a <strong>.xlsx</strong> or <strong>.xls</strong> file using the uploader above.
            The AI will automatically analyze your data and generate a dashboard.
          </p>
        </div>
      )}
    </div>
  );
}

export default App;