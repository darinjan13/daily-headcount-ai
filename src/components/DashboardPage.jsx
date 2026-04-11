import { useState, useEffect } from "react";
import ThemeToggle from "./ThemeToggle";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAnalysisTabs } from "../context/AnalysisTabsContext";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import { ChevronUp, LoaderCircle } from "lucide-react";
import lifewoodIconSquared from "../assets/branding/lifewood-icon-squared.png";

const HOST = import.meta.env.VITE_API_URL || "https://daily-headcount-ai-backend.onrender.com";

export default function DashboardPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, accessToken, loading: authLoading } = useAuth();
  const {
    tabs,
    activeTab,
    activeTabId,
    setActiveTabId,
    openAnalysisTab,
    updateAnalysisTab,
    closeAnalysisTab,
    touchAnalysisTab,
    renameAnalysisTab,
    togglePinAnalysisTab,
    clearAnalysisTabs,
  } = useAnalysisTabs();
  const state = location.state;
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [data, setData] = useState(activeTab?.tableData || null);
  const [blueprint, setBlueprint] = useState(activeTab?.blueprint || null);
  const [currentSheet, setCurrentSheet] = useState(activeTab?.currentSheet || "");
  const [switching, setSwitching] = useState(false);
  const [tabSwitching, setTabSwitching] = useState(false);
  const [hydratingTabId, setHydratingTabId] = useState(null);
  const [switchError, setSwitchError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  // Drive info for sheet switching
  const driveFileId = activeTab?.driveFileId || null;
  const allSheets = activeTab?.allSheets || [];
  const fileName = activeTab?.fileName || "";
  // accessToken comes from AuthContext (always fresh) — not from location.state (stale after 1hr)

  useEffect(() => {
    if (!state?.tableData) return;
    const tabId = openAnalysisTab({
      tableData: state.tableData,
      blueprint: state.blueprint,
      currentSheet: state.currentSheet,
      allSheets: state.allSheets,
      fileName: state.fileName,
      driveFileId: state.driveFileId,
      driveModifiedTime: state.driveModifiedTime,
      folderId: state.folderId,
      sourceUserEmail: state.sourceUserEmail,
      sourceFolderName: state.sourceFolderName,
    });
    navigate("/dashboard", { replace: true, state: { targetTabId: tabId } });
  }, [state, openAnalysisTab, navigate]);

  useEffect(() => {
    const targetTabId = state?.targetTabId;
    if (!targetTabId) return;
    const targetExists = tabs.some((tab) => tab.id === targetTabId);
    if (!targetExists) return;
    if (activeTabId !== targetTabId) {
      setTabSwitching(true);
      setActiveTabId(targetTabId);
    }
    navigate("/dashboard", { replace: true });
  }, [state, tabs, activeTabId, setActiveTabId, navigate]);

  useEffect(() => {
    if (!authLoading && !state?.tableData && !activeTab) {
      navigate("/");
    }
  }, [authLoading, state, activeTab, navigate]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!authLoading && user && !accessToken) {
      navigate("/");
    }
  }, [authLoading, user, accessToken, navigate]);

  useEffect(() => {
    const onScroll = () => {
      setShowBackToTop(window.scrollY > 500);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
        throw new Error(result.error);
      }

      setData(result.tableData);
      setBlueprint(result.blueprint);
      setCurrentSheet(result.currentSheet);
      updateAnalysisTab(activeTabId, {
        tableData: result.tableData,
        blueprint: result.blueprint,
        currentSheet: result.currentSheet,
        allSheets: result.allSheets || allSheets,
        driveModifiedTime: meta.modifiedTime || activeTab?.driveModifiedTime || null,
        latestDriveModifiedTime: meta.modifiedTime || activeTab?.latestDriveModifiedTime || null,
        isStale: false,
      });
      setRefreshKey(k => k + 1); // force Dashboard remount with fresh state
    } catch (err) {
      setSwitchError(`Refresh failed: ${err.message}`);
      throw err;
    } finally {
      setSwitching(false);
    }
  };

  useEffect(() => {
    if (!activeTab) {
      setTabSwitching(false);
      setHydratingTabId(null);
      return;
    }

    if (activeTab.tableData && activeTab.blueprint) {
      setTabSwitching(true);
      setHydratingTabId(null);
      const timer = window.setTimeout(() => {
        setData(activeTab.tableData || null);
        setBlueprint(activeTab.blueprint || null);
        setCurrentSheet(activeTab.currentSheet || "");
        setSwitchError("");
        setRefreshKey((key) => key + 1);
        setTabSwitching(false);
      }, 180);

      return () => window.clearTimeout(timer);
    }

    if (!activeTab.driveFileId) {
      setData(null);
      setBlueprint(null);
      setCurrentSheet(activeTab.currentSheet || "");
      setSwitchError("This saved analysis no longer has a Drive file id.");
      setTabSwitching(false);
      setHydratingTabId(null);
      return;
    }

    const targetSheet = activeTab.currentSheet || activeTab.allSheets?.[0] || "";
    if (!targetSheet) {
      setData(null);
      setBlueprint(null);
      setCurrentSheet("");
      setSwitchError("This saved analysis no longer has a sheet name.");
      setTabSwitching(false);
      setHydratingTabId(null);
      return;
    }

    let cancelled = false;
    setData(null);
    setBlueprint(null);
    setCurrentSheet(targetSheet);
    setHydratingTabId(activeTab.id);
    setTabSwitching(false);

    fetchSheetData(targetSheet)
      .catch((error) => {
        if (!cancelled) setSwitchError(`Failed to restore saved analysis: ${error.message}`);
      })
      .finally(() => {
        if (!cancelled) {
          setHydratingTabId(null);
          setTabSwitching(false);
        }
      });

    return () => {
      cancelled = true;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTabId]);

  const switchSheet = async (sheet) => {
    if (switching) return;
    await fetchSheetData(sheet).catch(() => {});
  };

  const refreshDashboard = async () => {
    const targetSheet = currentSheet || allSheets[0] || "";
    if (!targetSheet || switching) {
      if (!targetSheet) setSwitchError("No sheet selected to refresh");
      return;
    }
    setSwitchError("");
    await fetchSheetData(targetSheet).catch(() => {});
  };

  const handleSelectAnalysisTab = (tabId) => {
    if (!tabId || tabId === activeTabId || switching || tabSwitching || hydratingTabId) return;
    setSwitchError("");
    setTabSwitching(true);
    touchAnalysisTab(tabId);
    setActiveTabId(tabId);
  };

  const isDashboardBusy = switching || tabSwitching || Boolean(hydratingTabId);

  if (authLoading) return null;
  if (!user || !accessToken || !activeTab) return null;

  return (
    <>
    <style>{`
      .dashboard-sidebar {
        position: fixed;
        top: 0; left: 0;
        width: 340px;
        height: 100vh;
        z-index: 100;
        background: var(--color-surface);
        backdrop-filter: blur(10px);
        border-right: 1px solid var(--color-border);
        overflow: hidden;
        transform: translateX(calc(-340px + 20px));
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .dashboard-sidebar:hover,
      .dashboard-sidebar:focus-within {
        transform: translateX(0);
      }
      .dashboard-main {
        margin-left: 20px;
        width: calc(100% - 20px);
        min-height: 100vh;
        display: flex;
        flex-direction: column;
        overflow-x: hidden;
      }
      @media (max-width: 900px) {
        .dashboard-sidebar {
          position: static;
          width: 100%;
          height: auto;
          transform: none;
          border-right: none;
          border-bottom: 1px solid var(--color-border);
        }
        .dashboard-main {
          margin-left: 0;
          width: 100%;
        }
        .dashboard-topbar-inner {
          padding: 12px 16px !important;
          flex-wrap: wrap;
          justify-content: space-between !important;
        }
        .dashboard-topbar-actions {
          position: static !important;
          margin-left: auto;
          width: auto;
          justify-content: flex-end;
          flex-wrap: nowrap;
        }
        .dashboard-sheet-switcher-row {
          width: 100%;
          display: flex;
          justify-content: flex-end;
        }
        .dashboard-sheet-switcher {
          margin-left: auto;
        }
      }
      @media (max-width: 640px) {
        .dashboard-topbar-inner {
          gap: 10px !important;
        }
        .dashboard-topbar-actions {
          flex: 0 0 auto;
          gap: 0 !important;
        }
        .dashboard-sheet-switcher-row {
          justify-content: stretch;
        }
        .dashboard-sheet-switcher {
          width: 100%;
          justify-content: space-between;
          flex-wrap: wrap;
        }
        .dashboard-sheet-switcher select {
          width: 100%;
        }
      }
    `}</style>
    <div className="min-h-screen w-screen" style={{ backgroundColor: "var(--color-bg)" }}>
      <aside className="dashboard-sidebar">
        <Sidebar
          folder={{ name: fileName }}
          files={[]}
          filesLoading={isDashboardBusy}
          onSelectFolder={null}
          onRefresh={refreshDashboard}
          onBack={() => navigate("/")}
          analysisTabs={tabs}
          activeAnalysisTabId={activeTabId}
          onSelectAnalysisTab={handleSelectAnalysisTab}
          onCloseAnalysisTab={closeAnalysisTab}
          onRenameAnalysisTab={renameAnalysisTab}
          onTogglePinAnalysisTab={togglePinAnalysisTab}
          onClearAnalysisTabs={clearAnalysisTabs}
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
            className="dashboard-topbar-inner flex items-center gap-4"
            style={{ width: "100%", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}
          >
            <div className="flex items-center gap-2 min-w-0">
              <img src={lifewoodIconSquared} alt="Workbook" className="w-5 h-5 shrink-0" />
              <span className="text-sm font-semibold truncate" style={{ color: "var(--color-text)" }}>
                {fileName}
              </span>
            </div>

            <div className="dashboard-topbar-actions flex items-center gap-3 shrink-0" style={{ position: "absolute", right: 32 }}>
              <ThemeToggle />
            </div>

            {allSheets.length > 1 && (
              <div className="dashboard-sheet-switcher-row">
                <div className="dashboard-sheet-switcher flex items-center gap-2 shrink-0">
                <label
                  className="text-xs font-bold uppercase tracking-wide"
                  style={{ color: "var(--color-text)" }}
                >
                  Sheet
                </label>
                <select
                  value={currentSheet}
                  onChange={(e) => switchSheet(e.target.value)}
                  disabled={isDashboardBusy}
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
                {isDashboardBusy && (
                  <LoaderCircle className="h-4 w-4 animate-spin" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                )}
                {switchError && <span className="text-xs" style={{ color: "var(--color-saffron)" }}>{switchError}</span>}
              </div>
              </div>
            )}
          </div>
        </div>

        {/* Dashboard + loading overlay */}
        <div style={{ position: "relative", flex: 1 }}>
          {data && blueprint && (
            <Dashboard key={`${activeTabId}-${refreshKey}`} data={data} blueprint={blueprint} fileId={driveFileId} />
          )}

          {(isDashboardBusy || !data || !blueprint) && (
            <div className="flex items-center justify-center" style={{
              position: "fixed",
              top: 0,
              left: window.innerWidth <= 900 ? 0 : "20px",
              right: 0,
              bottom: 0,
              zIndex: 40,
              backgroundColor: "rgba(19, 48, 32, 0.55)",
              backdropFilter: "blur(4px)",
              WebkitBackdropFilter: "blur(4px)",
            }}>
              <div className="flex flex-col items-center gap-3">
                {!switchError && (
                  <LoaderCircle className="h-8 w-8 animate-spin" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                )}
                <p style={{ fontFamily: "'Manrope', sans-serif", fontSize: 13, fontWeight: 700, color: "#fff", letterSpacing: "0.05em", margin: 0 }}>
                  Refreshing data…
                </p>
                {hydratingTabId && (
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", margin: 0 }}>
                    Restoring saved analysis...
                  </p>
                )}
                {switchError && (
                  <p style={{ maxWidth: 360, textAlign: "center", fontSize: 12, fontWeight: 600, color: "#fff", margin: 0 }}>
                    {switchError}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {showBackToTop && (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="fixed z-40 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer border-none"
            style={{
              backgroundColor: "var(--color-castleton-green)",
              color: "#fff",
              boxShadow: "0 8px 18px rgba(4, 98, 65, 0.22)",
              width: 40,
              height: 40,
              left: "50%",
              transform: "translateX(-50%)",
              bottom: window.innerWidth <= 640 ? 88 : 24,
              padding: 0,
            }}
            title="Back to top"
            aria-label="Back to top"
          >
            <ChevronUp className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
    </>
  );
}
