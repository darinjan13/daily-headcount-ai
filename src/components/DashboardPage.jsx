import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Dashboard from "./Dashboard";

const HOST = "http://127.0.0.1:8000";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state;

  const [data, setData] = useState(state?.tableData || null);
  const [blueprint, setBlueprint] = useState(state?.blueprint || null);
  const [currentSheet, setCurrentSheet] = useState(state?.currentSheet || "");
  const [allSheets] = useState(state?.allSheets || []);
  const [fileName] = useState(state?.fileName || "");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");

  // Drive info for sheet switching + real-time (future)
  const driveFileId = state?.driveFileId || null;
  const accessToken = state?.accessToken || null;

  useEffect(() => {
    if (!state?.tableData) navigate("/");
  }, [state, navigate]);

  if (!data || !blueprint) return null;

  const switchSheet = async (sheet) => {
    if (sheet === currentSheet || switching) return;
    setSwitching(true);
    setSwitchError("");

    try {
      // Re-download file from Drive
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!dlRes.ok) throw new Error("Failed to download file from Drive");

      const arrayBuffer = await dlRes.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Single call — extract + blueprint for the selected sheet
      const formData = new FormData();
      formData.append("file", blob, fileName);

      const res = await fetch(
        `${HOST}/analyze-bytes?sheet_name=${encodeURIComponent(sheet)}`,
        { method: "POST", body: formData }
      );
      const result = await res.json();

      if (result.error) {
        setSwitchError(result.error);
        setSwitching(false);
        return;
      }

      setData(result.tableData);
      setBlueprint(result.blueprint);
      setCurrentSheet(result.currentSheet);
    } catch (err) {
      setSwitchError(`Failed to load sheet: ${err.message}`);
    }

    setSwitching(false);
  };

  return (
    <div className="min-h-screen w-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-emerald-800 shadow-lg sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4">

          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-1.5 text-emerald-300 hover:text-white text-sm font-medium transition-colors cursor-pointer bg-transparent border-none shrink-0"
          >
            ← Home
          </button>

          <div className="w-px h-6 bg-emerald-600 shrink-0" />

          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xl">📊</span>
            <div>
              <div className="text-white font-extrabold text-sm leading-tight">AI Dashboard</div>
              <div className="text-emerald-300 text-xs">Generator</div>
            </div>
          </div>

          <div className="w-px h-6 bg-emerald-600 shrink-0" />

          <div className="flex items-center gap-2 min-w-0">
            <span className="text-lg shrink-0">📗</span>
            <span className="text-white text-sm font-semibold truncate">{fileName}</span>
          </div>

          {/* Sheet switcher — full dropdown when multiple sheets */}
          {allSheets.length > 1 && (
            <>
              <div className="w-px h-6 bg-emerald-600 shrink-0" />
              <div className="flex items-center gap-2 shrink-0">
                <label className="text-emerald-300 text-xs font-bold uppercase tracking-wide">Sheet</label>
                <select
                  value={currentSheet}
                  onChange={(e) => switchSheet(e.target.value)}
                  disabled={switching}
                  className="px-3 py-1.5 rounded-lg border border-emerald-600 text-sm text-white bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer disabled:opacity-60"
                >
                  {allSheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {switching && (
                  <svg className="animate-spin w-4 h-4 text-emerald-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {switchError && <span className="text-red-300 text-xs">{switchError}</span>}
              </div>
            </>
          )}
        </div>
      </div>

      <Dashboard data={data} blueprint={blueprint} fileId={driveFileId} />
    </div>
  );
}