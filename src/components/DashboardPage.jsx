import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../context/ThemeContext";
import Dashboard from "./Dashboard";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import lifewoodIconSquared from "../assets/branding/lifewood-icon-squared.png";
import ThemeToggle from "./ThemeToggle";
import { LIFEWOOD_DARK_LOGO_URL } from "../constants/branding";

const HOST = "https://daily-headcount-ai-backend.onrender.com";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();
  const state = location.state;

  const [data, setData] = useState(state?.tableData || null);
  const [blueprint, setBlueprint] = useState(state?.blueprint || null);
  const [currentSheet, setCurrentSheet] = useState(state?.currentSheet || "");
  const [allSheets] = useState(state?.allSheets || []);
  const [fileName] = useState(state?.fileName || "");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const lifewoodLogoSrc = theme === "dark" ? LIFEWOOD_DARK_LOGO_URL : lifewoodIconText;

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
    <div className="min-h-screen w-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      {/* Top bar */}
      <div
        className="sticky top-0 z-50"
        style={{
          backgroundColor: "var(--color-surface)",
          borderBottom: "1px solid var(--color-border)",
          boxShadow: "var(--color-shadow-soft)",
        }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 py-3 flex items-center gap-4">
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => navigate("/")}
              className="cursor-pointer"
              style={{ background: "none", border: "none", padding: 0 }}
              title="Go to homepage"
              aria-label="Go to homepage"
            >
              <img
                src={lifewoodLogoSrc}
                alt="Lifewood"
                className="h-6 w-32"
                style={{ objectFit: "contain" }}
              />
            </button>
          </div>

          <div className="w-px h-6 shrink-0" style={{ backgroundColor: "var(--color-border)" }} />

          <div className="flex items-center gap-2 min-w-0">
            <img src={lifewoodIconSquared} alt="Workbook" className="w-5 h-5 shrink-0" />
            <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
              {fileName}
            </span>
          </div>

          {/* Sheet switcher — full dropdown when multiple sheets */}
          {allSheets.length > 1 && (
            <>
              <div className="w-px h-6 shrink-0" style={{ backgroundColor: "var(--color-border)" }} />
              <div className="flex items-center gap-2 shrink-0">
                <label
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--color-text)" }}
                >
                  Sheet
                </label>
                <select
                  value={currentSheet}
                  onChange={(e) => switchSheet(e.target.value)}
                  disabled={switching}
                  className="px-3 py-1.5 rounded-lg text-sm focus:outline-none focus:ring-2 cursor-pointer disabled:opacity-60"
                  style={{
                    border: "1px solid var(--color-border)",
                    color: "var(--color-text)",
                    backgroundColor: "var(--color-surface-elevated)",
                  }}
                >
                  {allSheets.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                {switching && (
                  <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24" style={{ color: "var(--color-castleton-green)" }}>
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                )}
                {switchError && <span className="text-xs" style={{ color: "var(--color-saffron)" }}>{switchError}</span>}
              </div>
            </>
          )}

          <div className="ml-auto shrink-0">
            <ThemeToggle />
          </div>
        </div>
      </div>

      <Dashboard data={data} blueprint={blueprint} fileId={driveFileId} />
    </div>
  );
}
