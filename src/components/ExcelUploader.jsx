import { useState, useRef } from "react";

export default function ExcelUploader({ onDataReady, compact = false }) {
  const [file, setFile] = useState(null);
  const [sheets, setSheets] = useState([]);
  const [selectedSheet, setSelectedSheet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transformNote, setTransformNote] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (uploadedFile) => {
    if (!uploadedFile) return;
    setFile(uploadedFile);
    setError("");
    setTransformNote(null);
    setSheets([]);
    const formData = new FormData();
    formData.append("file", uploadedFile);
    try {
      const res = await fetch("https://daily-headcount-ai-backend.onrender.com/get-sheets", { method: "POST", body: formData });
      const data = await res.json();
      setSheets(data.sheets);
      setSelectedSheet(data.sheets[0]);
      // Auto-extract if only one sheet
      if (data.sheets.length === 1) {
        await extractSheet(uploadedFile, data.sheets[0]);
      }
    } catch {
      setError("Failed to load file.");
    }
  };

  const extractSheet = async (fileToUse, sheet) => {
    const f = fileToUse || file;
    if (!f || !sheet) return;
    setLoading(true);
    setError("");
    setTransformNote(null);
    const formData = new FormData();
    formData.append("file", f);
    try {
      const res = await fetch(
        `https://daily-headcount-ai-backend.onrender.com/extract-raw-table?sheet_name=${sheet}`,
        { method: "POST", body: formData }
      );
      const data = await res.json();
      if (data.wasTransformed && data.transformNote) setTransformNote(data.transformNote);
      const blueprintRes = await fetch("https://daily-headcount-ai-backend.onrender.com/generate-dashboard-blueprint", {
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

  // ── COMPACT MODE (top bar) ─────────────────────────────────
  if (compact) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {/* File picker button */}
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-2 px-4 py-1.5 bg-white text-emerald-800 rounded-lg text-sm font-bold hover:bg-emerald-50 transition-colors cursor-pointer border-2 border-transparent hover:border-emerald-300 shrink-0"
        >
          <span>📁</span>
          <span>{file ? file.name : "Choose File"}</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleFileUpload(e.target.files?.[0])}
        />

        {/* Sheet selector — only shown when multiple sheets */}
        {sheets.length > 1 && (
          <>
            <div className="w-px h-6 bg-emerald-600" />
            <div className="flex items-center gap-2">
              <label className="text-emerald-300 text-xs font-bold uppercase tracking-wide">Sheet</label>
              <select
                value={selectedSheet}
                onChange={(e) => setSelectedSheet(e.target.value)}
                className="px-3 py-1.5 rounded-lg border border-emerald-600 text-sm text-white bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400"
              >
                {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <button
                onClick={() => extractSheet(file, selectedSheet)}
                disabled={loading}
                className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-colors ${
                  loading
                    ? "bg-emerald-600 text-emerald-300 cursor-not-allowed"
                    : "bg-white text-emerald-800 hover:bg-emerald-50 cursor-pointer"
                }`}
              >
                {loading ? "Loading..." : "Load Sheet →"}
              </button>
            </div>
          </>
        )}

        {/* Loading spinner */}
        {loading && (
          <div className="flex items-center gap-2 text-emerald-300 text-xs">
            <svg className="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Analyzing with AI...
          </div>
        )}

        {/* Transform note */}
        {transformNote && !loading && (
          <span className="text-emerald-300 text-xs">✨ {transformNote}</span>
        )}

        {/* Error */}
        {error && (
          <span className="text-red-300 text-xs">⚠️ {error}</span>
        )}

        {/* Current file info badge */}
        {file && !loading && sheets.length > 0 && (
          <div className="ml-auto flex items-center gap-2 text-emerald-300 text-xs shrink-0">
            <span className="text-emerald-400">✓</span>
            <span>{file.name}</span>
            {sheets.length > 1 && <span className="bg-emerald-700 px-1.5 py-0.5 rounded text-xs">{selectedSheet}</span>}
          </div>
        )}
      </div>
    );
  }

  // ── FULL SCREEN MODE (fallback, not used in new App.jsx) ──────
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-12 w-full max-w-md">
        <div className="text-center mb-9">
          <div className="text-5xl mb-3">📊</div>
          <h2 className="text-2xl font-extrabold text-emerald-800 m-0">Excel Dashboard</h2>
          <p className="text-gray-400 text-sm mt-1">Upload a spreadsheet to auto-generate your dashboard</p>
        </div>

        <label className="block border-2 border-dashed border-emerald-200 rounded-xl p-8 text-center cursor-pointer bg-emerald-50 hover:border-emerald-600 transition-colors mb-5">
          <input type="file" accept=".xlsx,.xls" onChange={(e) => handleFileUpload(e.target.files?.[0])} className="hidden" />
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

        {sheets.length > 1 && (
          <div className="mb-5">
            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wide mb-1.5">Sheet</label>
            <select
              value={selectedSheet}
              onChange={(e) => setSelectedSheet(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              {sheets.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        )}

        {sheets.length > 0 && (
          <button
            onClick={() => extractSheet(file, selectedSheet)}
            disabled={loading}
            className={`w-full py-3 rounded-lg text-white font-bold text-base transition-colors ${loading ? "bg-gray-400 cursor-not-allowed" : "bg-emerald-700 hover:bg-emerald-800 cursor-pointer"}`}
          >
            {loading ? "Processing..." : "Generate Dashboard →"}
          </button>
        )}

        {transformNote && (
          <div className="mt-4 p-3 bg-emerald-50 border-l-4 border-emerald-600 rounded-lg text-sm text-emerald-700">
            ✨ <strong>Auto-transformed:</strong> {transformNote}
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg text-sm text-red-700">
            ⚠️ {error}
          </div>
        )}

        {loading && (
          <p className="text-center text-gray-400 text-xs mt-4">Analyzing your data and building dashboard...</p>
        )}
      </div>
    </div>
  );
}