import React, { useState } from "react";

export default function ExcelUploader({ onDataReady }) {
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transformNote, setTransformNote] = useState(null);

  const handleFileUpload = async (e) => {
    const uploadedFile = e.target.files?.[0];
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setError("");
    setTransformNote(null);
    const formData = new FormData();
    formData.append("file", uploadedFile);
    try {
      const res = await fetch("http://127.0.0.1:8000/get-sheets", { method: "POST", body: formData });
      const data = await res.json();
      setSheets(data.sheets);
      setSelectedSheet(data.sheets[0]);
    } catch {
      setError("Failed to load sheets.");
    }
  };

  const handleExtract = async () => {
    if (!file || !selectedSheet) return;
    setLoading(true);
    setError("");
    setTransformNote(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/extract-raw-table?sheet_name=${selectedSheet}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (data.wasTransformed && data.transformNote) setTransformNote(data.transformNote);
      const blueprintRes = await fetch("http://127.0.0.1:8000/generate-dashboard-blueprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const blueprint = await blueprintRes.json();
      onDataReady(data, blueprint);
    } catch {
      setError("Extraction failed. Please check the file format.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 w-full max-w-md">

        {/* Header */}
        <div className="text-center mb-9">
          <div className="text-5xl mb-3">📊</div>
          <h2 className="text-2xl font-extrabold text-emerald-800 m-0">Excel Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">Upload a spreadsheet to auto-generate your dashboard</p>
        </div>

        {/* File Upload */}
        <label className="block border-2 border-dashed border-emerald-200 rounded-xl p-8 text-center cursor-pointer bg-emerald-50 hover:border-emerald-600 transition-colors mb-5">
          <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
          {file ? (
            <>
              <div className="text-3xl mb-2">📄</div>
              <div className="font-semibold text-emerald-700 text-sm">{file.name}</div>
              <div className="text-gray-400 text-xs mt-1">Click to change file</div>
            </>
          ) : (
            <>
              <div className="text-3xl mb-2">📁</div>
              <div className="font-semibold text-gray-600 text-sm">Click to upload Excel file</div>
              <div className="text-gray-400 text-xs mt-1">.xlsx or .xls</div>
            </>
          )}
        </label>

        {/* Sheet Selector */}
        {sheets.length > 0 && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Sheet</label>
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              disabled={sheets.length === 1}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {/* Generate Button */}
        {sheets.length > 0 && (
          <button
            onClick={handleExtract}
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-base transition-colors ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800 cursor-pointer"}`}
          >
            {loading ? "Processing..." : "Generate Dashboard →"}
          </button>
        )}

        {/* Transform Notice */}
        {transformNote && (
          <div className="mt-4 p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-lg text-sm text-emerald-700">
            ✨ <strong>Auto-transformed:</strong> {transformNote}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {/* Loading hint */}
        {loading && (
          <p className="text-center text-gray-400 text-xs mt-4">Analyzing your data and building dashboard...</p>
        )}
      </div>
    </div>
  );
}