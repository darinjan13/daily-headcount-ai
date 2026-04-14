import { useState, useEffect, useRef } from "react";
import ThemeToggle from "./ThemeToggle";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAnalysisTabs } from "../context/AnalysisTabsContext";
import { useAnalysisJobs } from "../context/AnalysisJobsContext";
import BackgroundAnalysisDock from "./BackgroundAnalysisDock";
import BackgroundAnalysisToasts from "./BackgroundAnalysisToasts";
import Dashboard from "./Dashboard";
import Sidebar from "./Sidebar";
import { ChevronUp, LoaderCircle, Menu, X } from "lucide-react";
import lifewoodIconSquared from "../assets/branding/lifewood-icon-squared.png";
import { getAnalysisResultCache, setAnalysisResultCache } from "../utils/analysisResultCache";
import { getCurrentWorkbookCache, setCurrentWorkbookCache } from "../utils/workbookCache";

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
  const {
    createJob,
    updateJob,
    completeJob,
    failJob,
    abortJob,
    attachJobController,
    detachJobController,
    markJobBackground,
    removeJob,
    getJob,
    dismissNotification,
  } = useAnalysisJobs();
  const state = location.state;
  const [showBackToTop, setShowBackToTop] = useState(false);

  const [data, setData] = useState(activeTab?.tableData || null);
  const [blueprint, setBlueprint] = useState(activeTab?.blueprint || null);
  const [currentSheet, setCurrentSheet] = useState(activeTab?.currentSheet || "");
  const [switching, setSwitching] = useState(false);
  const [tabSwitching, setTabSwitching] = useState(false);
  const [hydratingTabId, setHydratingTabId] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [switchError, setSwitchError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const analysisAbortRef = useRef(null);
  const [foregroundJobId, setForegroundJobId] = useState(null);
  const foregroundJobIdRef = useRef(null);
  const backgroundedJobIdsRef = useRef(new Set());

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

  useEffect(() => () => {
    analysisAbortRef.current?.abort();
  }, []);

  useEffect(() => {
    foregroundJobIdRef.current = foregroundJobId;
  }, [foregroundJobId]);

  const fetchSheetData = async (sheet, options = {}) => {
    const {
      tabToLoad = activeTab,
      targetTabId = activeTabId,
      autoActivate = true,
      forceRemount = autoActivate,
      ignoreAnalysisCache = false,
    } = options;

    if (!tabToLoad?.driveFileId) {
      throw new Error("No Drive file available for this analysis.");
    }

    if (analysisAbortRef.current) {
      analysisAbortRef.current.abort();
    }
    const controller = new AbortController();
    analysisAbortRef.current = controller;
    const jobId = createJob({
      fileId: tabToLoad.driveFileId,
      fileName: tabToLoad.fileName || fileName,
      sheetName: sheet,
      label: "Checking Drive file",
      percent: 20,
    });
    attachJobController(jobId, controller);
    setForegroundJobId(jobId);
    setSwitching(true);
    setAnalysisProgress({ label: "Checking Drive file", percent: 20, sheetName: sheet });
    setSwitchError("");

    try {
      // Check mimeType to decide download strategy
      const metaRes = await fetch(
        `https://www.googleapis.com/drive/v3/files/${tabToLoad.driveFileId}?fields=version,modifiedTime,name,mimeType&supportsAllDrives=true`,
        { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: controller.signal }
      );
      if (!metaRes.ok) throw new Error(`Drive metadata error: ${metaRes.status}`);
      const meta = await metaRes.json();
      const isGoogleSheet = meta.mimeType === "application/vnd.google-apps.spreadsheet";
      const cachedAnalysis = ignoreAnalysisCache ? null : getAnalysisResultCache({
        driveFileId: tabToLoad.driveFileId,
        sheetName: sheet,
        modifiedTime: meta.modifiedTime || tabToLoad?.driveModifiedTime || null,
      });

      if (cachedAnalysis) {
        const shouldActivate = autoActivate && !backgroundedJobIdsRef.current.has(jobId);
        updateJob(jobId, { label: "Using cached analysis", percent: 65 });
        setAnalysisProgress({ label: "Using cached analysis", percent: 65, sheetName: sheet });
        updateAnalysisTab(targetTabId, {
          tableData: cachedAnalysis.tableData,
          blueprint: cachedAnalysis.blueprint,
          currentSheet: cachedAnalysis.currentSheet || sheet,
          allSheets: cachedAnalysis.allSheets || tabToLoad?.allSheets || [],
          driveModifiedTime: meta.modifiedTime || tabToLoad?.driveModifiedTime || null,
          analysisSession: cachedAnalysis.analysisSession || tabToLoad?.analysisSession || null,
          latestDriveModifiedTime: meta.modifiedTime || tabToLoad?.latestDriveModifiedTime || null,
          isStale: false,
        });
        if (shouldActivate) {
          setData(cachedAnalysis.tableData);
          setBlueprint(cachedAnalysis.blueprint);
          setCurrentSheet(cachedAnalysis.currentSheet || sheet);
          if (targetTabId && targetTabId !== activeTabId) {
            setActiveTabId(targetTabId);
          }
          if (forceRemount) {
            setRefreshKey((k) => k + 1);
          }
        }
        completeJob(jobId, {
          ...cachedAnalysis,
          fileName: tabToLoad.fileName || cachedAnalysis.fileName,
          driveFileId: tabToLoad.driveFileId,
          driveModifiedTime: meta.modifiedTime || tabToLoad?.driveModifiedTime || null,
          folderId: tabToLoad?.folderId || cachedAnalysis.folderId || null,
          sourceUserEmail: tabToLoad?.sourceUserEmail || cachedAnalysis.sourceUserEmail || "",
          sourceFolderName: tabToLoad?.sourceFolderName || cachedAnalysis.sourceFolderName || "",
        }, { suppressNotification: shouldActivate });
        return cachedAnalysis;
      }

      const cachedWorkbook = getCurrentWorkbookCache({
        driveFileId: tabToLoad.driveFileId,
        modifiedTime: meta.modifiedTime,
        version: meta.version,
      });

      let arrayBuffer = cachedWorkbook?.arrayBuffer || null;
      if (arrayBuffer) {
        updateJob(jobId, { label: "Using cached workbook", percent: 50 });
        setAnalysisProgress({ label: "Using cached workbook", percent: 50, sheetName: sheet });
      } else {
        updateJob(jobId, { label: "Downloading workbook", percent: 40 });
        setAnalysisProgress({ label: "Downloading workbook", percent: 40, sheetName: sheet });

        const downloadUrl = isGoogleSheet
          ? `https://www.googleapis.com/drive/v3/files/${tabToLoad.driveFileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true&t=${Date.now()}`
          : `https://www.googleapis.com/drive/v3/files/${tabToLoad.driveFileId}?alt=media&supportsAllDrives=true&v=${meta.version}`;

        const dlRes = await fetch(downloadUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Cache-Control": "no-cache, no-store",
          },
          cache: "no-store",
          signal: controller.signal,
        });
        if (!dlRes.ok) throw new Error("Failed to download file from Drive");

        arrayBuffer = await dlRes.arrayBuffer();
        setCurrentWorkbookCache({
          driveFileId: tabToLoad.driveFileId,
          fileName: meta.name || tabToLoad.fileName || fileName,
          modifiedTime: meta.modifiedTime,
          version: meta.version,
          mimeType: meta.mimeType,
          arrayBuffer,
        });
      }

      if (arrayBuffer.byteLength < 1000) {
        throw new Error("Drive returned an empty file. Make sure it's saved before refreshing.");
      }
      updateJob(jobId, { label: "Analyzing sheet and headers", percent: 65 });
      setAnalysisProgress({ label: "Analyzing sheet and headers", percent: 65, sheetName: sheet });

      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const formData = new FormData();
      formData.append("file", blob, tabToLoad.fileName || fileName);

      const analyzeQuery = new URLSearchParams({
        sheet_name: sheet,
        drive_file_id: tabToLoad.driveFileId,
        drive_modified_time: meta.modifiedTime || tabToLoad?.driveModifiedTime || "",
      });
      const res = await fetch(
        `${HOST}/analyze-bytes?${analyzeQuery.toString()}`,
        { method: "POST", body: formData, signal: controller.signal }
      );
      const result = await res.json();
      updateJob(jobId, { label: "Updating dashboard", percent: 90 });
      setAnalysisProgress({ label: "Updating dashboard", percent: 90, sheetName: sheet });

      if (result.error) {
        setSwitchError(result.error);
        setSwitching(false);
        throw new Error(result.error);
      }

      const nextPayload = {
        tableData: result.tableData,
        blueprint: result.blueprint,
        currentSheet: result.currentSheet,
        allSheets: result.allSheets || tabToLoad?.allSheets || [],
        fileName: tabToLoad.fileName || fileName,
        driveFileId: tabToLoad.driveFileId,
        driveModifiedTime: meta.modifiedTime || tabToLoad?.driveModifiedTime || null,
        analysisSession: result.analysisSession || null,
        folderId: tabToLoad?.folderId || null,
        sourceUserEmail: tabToLoad?.sourceUserEmail || "",
        sourceFolderName: tabToLoad?.sourceFolderName || "",
      };

      setAnalysisResultCache(nextPayload, {
        requestedSheetName: sheet,
        modifiedTime: meta.modifiedTime || tabToLoad?.driveModifiedTime || null,
      });

        updateAnalysisTab(targetTabId, {
          tableData: result.tableData,
          blueprint: result.blueprint,
          currentSheet: result.currentSheet,
          allSheets: result.allSheets || tabToLoad?.allSheets || [],
          driveModifiedTime: meta.modifiedTime || tabToLoad?.driveModifiedTime || null,
          analysisSession: result.analysisSession || null,
          latestDriveModifiedTime: meta.modifiedTime || tabToLoad?.latestDriveModifiedTime || null,
          isStale: false,
        });
      completeJob(jobId, nextPayload, {
        suppressNotification: autoActivate && !backgroundedJobIdsRef.current.has(jobId),
      });
        if (autoActivate && !backgroundedJobIdsRef.current.has(jobId)) {
          setData(result.tableData);
          setBlueprint(result.blueprint);
          setCurrentSheet(result.currentSheet);
          if (targetTabId && targetTabId !== activeTabId) {
            setActiveTabId(targetTabId);
          }
          if (forceRemount) {
            setRefreshKey(k => k + 1); // force Dashboard remount with fresh state
          }
        }
        return nextPayload;
      } catch (err) {
      if (err?.name === "AbortError") {
        return null;
      }
      failJob(jobId, `Refresh failed: ${err.message}`);
      setSwitchError(`Refresh failed: ${err.message}`);
      throw err;
    } finally {
      if (analysisAbortRef.current === controller) {
        analysisAbortRef.current = null;
      }
      detachJobController(jobId);
      if (foregroundJobIdRef.current === jobId) {
        setForegroundJobId(null);
      }
      setSwitching(false);
      setAnalysisProgress(null);
    }
  };

  const cancelCurrentAnalysis = () => {
    const currentForegroundJobId = foregroundJobIdRef.current;
    if (currentForegroundJobId) {
      backgroundedJobIdsRef.current.delete(currentForegroundJobId);
      abortJob(currentForegroundJobId);
    } else {
      analysisAbortRef.current?.abort();
      analysisAbortRef.current = null;
    }
    setForegroundJobId(null);
    setSwitching(false);
    setAnalysisProgress(null);
    setHydratingTabId(null);
    setTabSwitching(false);
    setSwitchError("");
  };

  const continueCurrentAnalysisInBackground = () => {
    const currentForegroundJobId = foregroundJobIdRef.current;
    if (!currentForegroundJobId || !data || !blueprint) return;
    backgroundedJobIdsRef.current.add(currentForegroundJobId);
    markJobBackground(currentForegroundJobId);
    setForegroundJobId(null);
    setSwitching(false);
    setAnalysisProgress(null);
    setHydratingTabId(null);
    setTabSwitching(false);
    setSwitchError("");
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

    fetchSheetData(targetSheet, { tabToLoad: activeTab, targetTabId: activeTab.id, autoActivate: true })
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
    await fetchSheetData(sheet, { tabToLoad: activeTab, targetTabId: activeTabId, autoActivate: true }).catch(() => {});
  };

  const refreshDashboard = async () => {
    const targetSheet = currentSheet || allSheets[0] || "";
    if (!targetSheet || switching) {
      if (!targetSheet) setSwitchError("No sheet selected to refresh");
      return;
    }
    setSwitchError("");
    await fetchSheetData(targetSheet, { tabToLoad: activeTab, targetTabId: activeTabId, autoActivate: true }).catch(() => {});
  };

  const refreshActiveAnalysisSession = async () => {
    const targetSheet = currentSheet || activeTab?.currentSheet || allSheets[0] || "";
    if (!targetSheet || switching || !activeTab) return null;
    const refreshed = await fetchSheetData(targetSheet, {
      tabToLoad: activeTab,
      targetTabId: activeTabId,
      autoActivate: true,
      forceRemount: false,
      ignoreAnalysisCache: true,
    }).catch(() => null);
    return refreshed?.analysisSession || null;
  };

  const handleSelectAnalysisTab = (tabId) => {
    if (!tabId || tabId === activeTabId || switching || tabSwitching || hydratingTabId) return;
    const targetTab = tabs.find((tab) => tab.id === tabId);
    if (!targetTab) return;
    setSwitchError("");
    touchAnalysisTab(tabId);
    if (targetTab.tableData && targetTab.blueprint) {
      setTabSwitching(true);
      setActiveTabId(tabId);
      return;
    }
    const targetSheet = targetTab.currentSheet || targetTab.allSheets?.[0] || "";
    if (!targetSheet) {
      setSwitchError("This saved analysis no longer has a sheet name.");
      return;
    }
    setHydratingTabId(tabId);
    setTabSwitching(false);
    setAnalysisProgress({ label: "Checking Drive file", percent: 20, sheetName: targetSheet });
    void fetchSheetData(targetSheet, { tabToLoad: targetTab, targetTabId: tabId, autoActivate: true })
      .then(() => {
        if (!backgroundedJobIdsRef.current.has(foregroundJobIdRef.current)) {
          setHydratingTabId(null);
        }
      })
      .catch((error) => {
        setSwitchError(`Failed to restore saved analysis: ${error.message}`);
        setHydratingTabId(null);
      })
      .finally(() => {
        if (!backgroundedJobIdsRef.current.has(foregroundJobIdRef.current)) {
          setHydratingTabId(null);
        }
      });
  };

  const isDashboardBusy = switching || tabSwitching || Boolean(hydratingTabId);
  const busyLabel = analysisProgress?.label
    || (hydratingTabId ? "Restoring saved analysis" : "Refreshing data");
  const busyDetail = analysisProgress?.sheetName
    || (hydratingTabId ? "Re-analyzing the saved workbook from Drive" : currentSheet);

  const handleOpenBackgroundJob = (jobId) => {
    const job = getJob(jobId);
    if (!job?.resultPayload) return;
    dismissNotification(jobId);
    removeJob(jobId);
    const tabId = openAnalysisTab(job.resultPayload);
    setData(job.resultPayload.tableData || null);
    setBlueprint(job.resultPayload.blueprint || null);
    setCurrentSheet(job.resultPayload.currentSheet || "");
    setRefreshKey((key) => key + 1);
    navigate("/dashboard", { state: { targetTabId: tabId } });
  };

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
      .dashboard-sidebar.is-open {
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
          position: fixed;
          width: min(88vw, 390px);
          height: 100vh;
          transform: translateX(-105%);
          border-right: 1px solid var(--color-border);
          border-bottom: none;
          box-shadow: 18px 0 48px rgba(6, 24, 17, 0.18);
        }
        .dashboard-sidebar:hover,
        .dashboard-sidebar:focus-within {
          transform: translateX(-105%);
        }
        .dashboard-sidebar.is-open {
          transform: translateX(0);
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
      <button
        type="button"
        className={`ui-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`}
        style={{ padding: 0, border: "none" }}
        aria-label="Close sidebar"
        onClick={() => setIsSidebarOpen(false)}
      />
      <aside className={`dashboard-sidebar ${isSidebarOpen ? "is-open" : ""}`}>
        <Sidebar
          folder={{ name: fileName }}
          files={[]}
          filesLoading={isDashboardBusy}
          onSelectFolder={null}
          onRefresh={() => {
            setIsSidebarOpen(false);
            refreshDashboard();
          }}
          onBack={() => {
            setIsSidebarOpen(false);
            navigate("/");
          }}
          analysisTabs={tabs}
          activeAnalysisTabId={activeTabId}
          onSelectAnalysisTab={(tabId) => {
            setIsSidebarOpen(false);
            handleSelectAnalysisTab(tabId);
          }}
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
            <button
              type="button"
              className="ui-sidebar-toggle"
              aria-label={isSidebarOpen ? "Close sidebar" : "Open sidebar"}
              aria-expanded={isSidebarOpen}
              onClick={() => setIsSidebarOpen((current) => !current)}
            >
              {isSidebarOpen ? (
                <X size={22} strokeWidth={2.5} color="currentColor" aria-hidden="true" />
              ) : (
                <Menu size={22} strokeWidth={2.5} color="currentColor" aria-hidden="true" />
              )}
            </button>
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
            <Dashboard
              key={`${activeTabId}-${refreshKey}`}
              data={data}
              blueprint={blueprint}
              fileId={driveFileId}
              analysisSession={activeTab?.analysisSession || null}
              onAnalysisSessionExpired={refreshActiveAnalysisSession}
            />
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
                  {busyLabel}
                </p>
                {busyDetail && !switchError && (
                  <p style={{ maxWidth: 420, textAlign: "center", fontSize: 12, fontWeight: 700, color: "#fff", margin: 0, opacity: 0.88 }}>
                    {busyDetail}
                  </p>
                )}
                {analysisProgress && !switchError && (
                  <div style={{ width: 260, maxWidth: "70vw" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "#fff", fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                      <span>Analysis progress</span>
                      <span>{analysisProgress.percent}%</span>
                    </div>
                    <div style={{ height: 7, overflow: "hidden", borderRadius: 999, background: "rgba(255,255,255,0.22)" }}>
                      <div
                        style={{
                          width: `${analysisProgress.percent}%`,
                          height: "100%",
                          borderRadius: 999,
                          background: "linear-gradient(90deg, var(--color-castleton-green), var(--color-saffron))",
                          transition: "width 0.45s ease",
                        }}
                      />
                    </div>
                  </div>
                )}
                {analysisProgress && !switchError && (
                  data && blueprint && (
                    <button
                      type="button"
                      onClick={continueCurrentAnalysisInBackground}
                      style={{
                        marginTop: 2,
                        padding: "8px 14px",
                        borderRadius: 12,
                        border: "1px solid rgba(255,255,255,0.28)",
                        background: "rgba(255,255,255,0.12)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      Continue in background
                    </button>
                  )
                )}
                {analysisProgress && !switchError && (
                  <button
                    type="button"
                    onClick={cancelCurrentAnalysis}
                    style={{
                      marginTop: 2,
                      padding: "8px 14px",
                      borderRadius: 12,
                      border: "1px solid rgba(255,255,255,0.28)",
                      background: "rgba(255,255,255,0.12)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
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
      <BackgroundAnalysisDock />
      <BackgroundAnalysisToasts onOpenJob={handleOpenBackgroundJob} />
    </div>
    </>
  );
}
