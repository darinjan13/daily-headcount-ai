import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import { ChevronUp, LoaderCircle } from "lucide-react";
import lifewoodIconSquared from "../assets/branding/lifewood-icon-squared.png";

const HOST = "https://daily-headcount-ai-backend.onrender.com";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, accessToken, loading: authLoading } = useAuth();
  const state = location.state;
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [data, setData] = useState(state?.tableData || null);
  const [blueprint, setBlueprint] = useState(state?.blueprint || null);
  const [currentSheet, setCurrentSheet] = useState(state?.currentSheet || "");
  const [allSheets] = useState(state?.allSheets || []);
  const [fileName] = useState(state?.fileName || "");
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Drive info for sheet switching
  const driveFileId = state?.driveFileId || null;
  // accessToken comes from AuthContext (always fresh) — not from location.state (stale after 1hr)

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
      // Check mimeType to decide download strategy
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${driveFileId}?fields=version,modifiedTime,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
      );
      if (!metaRes.ok) throw new Error(`Drive metadata error: ${metaRes.status}`);
      const meta = await metaRes.json();
      const isGoogleSheet = meta.mimeType === "application/vnd.google-apps.spreadsheet";

      const downloadUrl = isGoogleSheet
        ? `https://www.googleapis.com/drive/v3/files/${driveFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true&t=${Date.now()}`
        : `https://www.googleapis.com/drive/v3/files/${driveFileId}?alt=media&supportsAllDrives=true&v=${meta.version}`;

      const dlRes = await fetch(downloadUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Cache-Control": "no-cache, no-store",
        },
        cache: "no-store",
      });
      if (!dlRes.ok) throw new Error("Failed to download file from Drive");

      const arrayBuffer = await dlRes.arrayBuffer();
      if (arrayBuffer.byteLength < 1000) {
        throw new Error("Drive returned an empty file. Make sure it's saved before refreshing.");
      }

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
      setRefreshKey(k => k + 1); // force Dashboard remount with fresh state
    } catch (err) {
      setSwitchError(`Refresh failed: ${err.message}`);
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
    setSwitchError("");
    await fetchSheetData(targetSheet);
  };

  return (
    <>
    <style>{`
      .dashboard-sidebar {
        position: fixed;
        top: 0; left: 0;
        width: 280px;
        height: 100vh;
        z-index: 100;
        background: var(--color-surface);
        backdrop-filter: blur(10px);
        border-right: 1px solid var(--color-border);
        overflow: hidden;
        transform: translateX(calc(-280px + 16px));
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .dashboard-sidebar:hover,
      .dashboard-sidebar:focus-within {
        transform: translateX(0);
      }
      .dashboard-main {
        margin-left: 16px;
        width: calc(100% - 16px);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
      }
    `}</style>
    <div className="min-h-screen w-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <aside className="dashboard-sidebar">
        <Sidebar
          folder={{ name: fileName }}
          files={[]}
          filesLoading={switching}
          onSelectFolder={null}
          onRefresh={refreshDashboard}
          onBack={() => navigate("/")}
        />
      </aside>

      <div className="dashboard-main">
        {/* Top bar */}
        <div
          className="sticky top-0"
          style={{
            zIndex: 40,
            backgroundColor: "var(--color-surface)",
            borderBottom: "1px solid var(--color-border)",
            boxShadow: "var(--color-shadow-soft)",
          }}
        >
          <div
            className="flex items-center gap-4"
            style={{ width: "100%", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <img src={lifewoodIconSquared} alt="Workbook" className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                {fileName}
              </span>
            </div>

            {/* Right side: theme toggle + sheet switcher */}
            <div className="flex items-center gap-3 shrink-0" style={{ position: "absolute", right: 32 }}>
              <ThemeToggle />
              {allSheets.length > 1 && (
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
                  <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                )}
                {switchError && <span className="text-xs" style={{ color: "var(--color-saffron)" }}>{switchError}</span>}
              </div>
              )}
            </div>
          </div>
        </div>

        {/* Dashboard + loading overlay */}
        <div style={{ position: "relative", flex: 1 }}>
          <Dashboard key={refreshKey} data={data} blueprint={blueprint} fileId={driveFileId} />

          {switching && (
            <div className="flex items-center justify-center" style={{
              position: "fixed",
              top: 0,
              left: "16px",
              right: 0,
              bottom: 0,
              zIndex: 40,
              backgroundColor: "rgba(19, 48, 32, 0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}>
              <div className="flex flex-col items-center gap-3">
                <LoaderCircle className="h-8 w-8 animate-spin" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", margin: 0 }}>
                  Refreshing data…
                </p>
              </div>
            </div>
          )}
        </div>

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
            <ChevronUp className="h-5 w-5" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
    </>
  );
}
