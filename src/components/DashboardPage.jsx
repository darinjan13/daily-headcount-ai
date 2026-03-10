import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import lifewoodIconSquared from "../assets/branding/lifewood-icon-squared.png";

const HOST = "https://daily-headcount-ai-backend.onrender.com";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const state = location.state;
  const [showBackToTop, setShowBackToTop] = useState(false);

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

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (authLoading) return null;
  if (!data || !blueprint || !user) return null;

  const fetchSheetData = async (sheet) => {
    setSwitching(true);
    setSwitchError("");

    try {
      const dlRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!dlRes.ok) throw new Error("Failed to download file from Drive");

      const arrayBuffer = await dlRes.arrayBuffer();
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

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

  const switchSheet = async (sheet) => {
    if (switching) return;
    await fetchSheetData(sheet);
  };

  const refreshDashboard = async () => {
    const targetSheet = currentSheet || allSheets[0] || "";
    if (!targetSheet || switching) {
      if (!targetSheet) setSwitchError("No sheet selected to refresh");
      return;
    }
    await fetchSheetData(targetSheet);
  };

  return (
    <div className="min-h-screen w-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "320px",
          height: "100vh",
          zIndex: 50,
          background: "var(--color-surface)",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid var(--color-border)",
          overflow: "hidden",
        }}
      >
        <Sidebar
          folder={{ name: fileName }}
          files={[]}
          filesLoading={switching}
          onSelectFolder={null}
          onRefresh={refreshDashboard}
          onBack={() => navigate("/")}
        />
      </aside>

      <div style={{ marginLeft: "320px", width: "calc(100% - 320px)", minHeight: "100vh", display: "flex", flexDirection: "column", overflowX: "hidden" }}>
        {/* Top bar */}
        <div
          className="sticky top-0 z-50"
          style={{
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            boxShadow: "var(--color-shadow-soft)",
          }}
        >
          <div
            className="flex items-center gap-4"
            style={{ maxWidth: "1280px", width: "100%", margin: "0 auto", padding: "12px 24px" }}
          >
            <div className="flex items-center gap-3 min-w-0" style={{ flex: 1 }}>
              <div className="flex items-center gap-2 min-w-0">
                <img src={lifewoodIconSquared} alt="Workbook" className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                  {fileName}
                </span>
              </div>
            </div>

            {/* Sheet switcher — full dropdown when multiple sheets */}
            {allSheets.length > 1 && (
              <div className="flex items-center gap-2 shrink-0" style={{ marginLeft: "auto" }}>
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
            )}
          </div>
        </div>

        <Dashboard data={data} blueprint={blueprint} fileId={driveFileId} />

        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed bottom-6 right-24 z-40 w-12 h-12 rounded-full shadow-xl flex items-center justify-center text-xl transition-all duration-200 cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-castleton-green)",
              color: "#fff",
              boxShadow: "0 10px 25px rgba(4, 98, 65, 0.25)",
            }}
            title="Back to top"
          >
            ^
          </button>
        )}
      </div>
    </div>
  );
}
