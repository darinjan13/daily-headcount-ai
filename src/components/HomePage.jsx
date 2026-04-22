import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useAnalysisTabs } from "../context/AnalysisTabsContext";
import { useAnalysisJobs } from "../context/AnalysisJobsContext";
import { useTheme } from "../context/ThemeContext";
import { useDrivePicker } from "../hooks/useDrivePicker";
import { useDriveFiles } from "../hooks/useDriveFiles";
import BackgroundAnalysisDock from "./BackgroundAnalysisDock";
import BackgroundAnalysisToasts from "./BackgroundAnalysisToasts";
import Sidebar from "./Sidebar";
import Grainient from "./Grainient";
import UserAvatar from "./UserAvatar";
import ThemeToggle from "./ThemeToggle";
import {
  CalendarDays,
  ChevronDown,
  ChevronRight,
  Download,
  FileX,
  FolderOpen,
  FolderSearch,
  House,
  LoaderCircle,
  Menu,
  TriangleAlert,
  X,
} from "lucide-react";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import lifeSightsLogo from "../assets/LifeSights_LOGO.png";
import excelFileIcon from "../assets/icons/excel-file-icon.png";
import { LIFEWOOD_DARK_LOGO_URL } from "../constants/branding";
import { getAnalysisResultCache, setAnalysisResultCache } from "../utils/analysisResultCache";
import { makeAnalysisRequestKey } from "../utils/analysisRequestKey";
import { getCurrentWorkbookCache, setCurrentWorkbookCache } from "../utils/workbookCache";

const HOST = import.meta.env.VITE_API_URL || "https://daily-headcount-ai-backend.onrender.com";
const ADMIN_ROOT_FOLDER_ID = import.meta.env.VITE_ADMIN_ROOT_FOLDER_ID || "";
const PAGE_SIZE_OPTIONS = [3, 4, 6, 8, 12, 18];

function getDefaultPageSize() {
  if (typeof window === "undefined") return 6;
  const width = window.innerWidth;
  if (width >= 1440) return 8;
  if (width >= 1024) return 6;
  if (width >= 700) return 4;
  return 3;
}

function formatSize(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(isoString) {
  if (!isoString) return "—";
  return new Date(isoString).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function getSheetBasedTags(sheetNames) {
  const exactSheetNames = Array.isArray(sheetNames)
    ? sheetNames.filter((name) => typeof name === "string" && name.trim().length > 0)
    : [];
  if (exactSheetNames.length) return exactSheetNames.slice(0, 3);
  return ["No Sheets Found"];
}

function getErrorTags() {
  return ["Sheets Unavailable"];
}

function isOpenableSheetTag(tag) {
  return tag && tag !== "No Sheets Found" && tag !== "Sheets Unavailable";
}

function normalizeAdminCopyName(file) {
  if (file.mimeType === "application/vnd.google-apps.spreadsheet") {
    return file.name.toLowerCase().endsWith(".xlsx") ? file.name : `${file.name}.xlsx`;
  }
  return file.name;
}

function triggerBrowserDownload(arrayBuffer, fileName, mimeType = "application/octet-stream") {
  const blob = new Blob([arrayBuffer], { type: mimeType });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
}

// Scroll Progress Indicator
function ScrollProgressBar() {
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
      setScrollProgress(scrolled);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div
      className="scroll-progress-bar"
      style={{ width: `${scrollProgress}%` }}
      aria-hidden="true"
    />
  );
}

// File Card Component
function FileCard({ file, onOpen, onDownload, loading, openDisabled = false, downloadLoading, tags, isTagLoading, showDownload = false }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col transition-all hover:shadow-xl border"
      style={{
        backgroundColor: "var(--color-surface-elevated)",
        borderColor: "var(--color-border)",
        backdropFilter: "blur(10px)",
        }}
      >
        {/* Icon and Header */}
      <div className="flex min-h-[86px] items-start gap-4" style={{ marginBottom: "10px" }}>
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
          <img src={excelFileIcon} alt="Excel file" className="w-11 h-11" style={{ objectFit: "contain" }} />
        </div>
        <div className="min-w-0 flex-1">
          <h4
            className="mb-2 text-sm font-semibold leading-snug break-words"
            title={file.name}
            style={{ color: "var(--color-text)", marginBottom: "4px" }}
          >
            {file.name}
          </h4>
          <p className="text-xs" style={{ color: "var(--color-text-light)" }}>
            {formatSize(parseInt(file.size))}
          </p>
        </div>
      </div>

      <div
        className="flex min-h-[54px] flex-wrap items-start content-start"
        style={{ gap: "6px", marginBottom: "14px" }}
      >
        {isTagLoading ? (
          <span
            className="inline-flex items-center animate-pulse"
            style={{
              borderRadius: "20px",
              backgroundColor: "var(--color-chip-bg)",
              color: "var(--color-chip-text)",
              border: "1px solid var(--color-chip-border)",
              fontSize: "11px",
              fontWeight: 600,
              padding: "3px 9px",
              gap: "6px",
            }}
          >
            <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
            Loading Sheets
          </span>
        ) : (
          tags.map((tag) => {
            const canOpenSheet = isOpenableSheetTag(tag);
            return (
            <button
              key={`${file.id}-${tag}`}
              type="button"
              onClick={() => canOpenSheet && onOpen(file, tag)}
              disabled={!canOpenSheet || openDisabled}
              style={{
                borderRadius: "20px",
                backgroundColor: "var(--color-chip-bg)",
                color: "var(--color-chip-text)",
                border: "1px solid var(--color-chip-border)",
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 9px",
                cursor: canOpenSheet && !openDisabled ? "pointer" : "default",
                opacity: openDisabled ? 0.65 : 1,
              }}
              title={canOpenSheet ? `Open ${tag}` : tag}
            >
              {tag}
            </button>
            );
          })
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-meta-text)", marginBottom: "16px" }}>
        <CalendarDays className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
        <span>Modified {formatDate(file.modifiedTime)}</span>
      </div>

      <div className="mt-auto flex gap-3">
        <button
          onClick={() => onOpen(file)}
          disabled={openDisabled}
          className="flex-1 rounded-lg py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
          style={{
            backgroundColor: loading ? "rgba(19, 48, 32, 0.5)" : "var(--color-castleton-green)",
            color: "#FFFFFF",
            border: "none",
          }}
        >
          {loading ? (
            <>
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              Opening analysis
            </>
        ) : (
          <>
            <span>Open analysis</span>
          </>
        )}
      </button>

        {showDownload && (
          <button
            onClick={() => onDownload(file)}
            disabled={downloadLoading}
            className="rounded-lg px-4 py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              color: "var(--color-text)",
              border: "1px solid var(--color-border)",
              minWidth: "116px",
              opacity: downloadLoading ? 0.7 : 1,
            }}
          >
            {downloadLoading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            <span>{downloadLoading ? "Downloading" : "Download"}</span>
          </button>
        )}
      </div>
    </div>
  );
}

function FolderCard({ folder, onOpen }) {
  return (
    <button
      onClick={() => onOpen(folder)}
      className="w-full min-w-0 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all hover:shadow-xl border text-left cursor-pointer"
      style={{
        backgroundColor: "var(--color-surface-elevated)",
        borderColor: "var(--color-border)",
        backdropFilter: "blur(10px)",
      }}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div
          className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "var(--color-surface-soft)", color: "var(--color-castleton-green)" }}
        >
          <FolderOpen className="h-6 w-6" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h4
            className="mb-2 text-sm font-semibold leading-snug truncate"
            title={folder.name}
            style={{ color: "var(--color-text)", marginBottom: "4px", maxWidth: "100%" }}
          >
            {folder.name}
          </h4>
          <p className="text-xs" style={{ color: "var(--color-text-light)" }}>
            Open subfolder
          </p>
        </div>
      </div>
      <div
        className="inline-flex items-center justify-center rounded-xl w-11 h-11 shrink-0"
        style={{
          backgroundColor: "var(--color-castleton-green)",
          color: "#FFFFFF",
          border: "1px solid rgba(255,255,255,0.08)",
        }}
        title={`Open ${folder.name}`}
        aria-label={`Open ${folder.name}`}
      >
        <ChevronRight className="h-5 w-5" aria-hidden="true" />
      </div>
    </button>
  );
}

function FileTable({ files, fileTagsById, onOpen, onDownload, openingFile, downloadingFile, showDownload = false }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)" }}
    >
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead style={{ backgroundColor: "var(--color-surface-soft)", color: "var(--color-text)" }}>
            <tr>
              <th className="px-4 py-3 font-semibold">File</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Modified</th>
              <th className="px-4 py-3 font-semibold">Sheets</th>
              <th className="px-4 py-3 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => {
              const tags = fileTagsById[file.id];
              const isTagLoading = !tags;
              return (
                <tr key={file.id} className="border-t" style={{ borderColor: "var(--color-border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <img src={excelFileIcon} alt="Excel file" className="w-8 h-8 flex-shrink-0" style={{ objectFit: "contain" }} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate" style={{ color: "var(--color-text)" }} title={file.name}>
                          {file.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--color-text-light)" }}>
                          {file.webViewLink ? "Drive link available" : "No direct link"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--color-text)" }}>{formatSize(parseInt(file.size))}</td>
                  <td className="px-4 py-3 align-top" style={{ color: "var(--color-text)" }}>{formatDate(file.modifiedTime)}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {isTagLoading ? (
                        <span
                          className="inline-flex items-center gap-2 text-xs animate-pulse"
                          style={{
                            borderRadius: "20px",
                            backgroundColor: "var(--color-chip-bg)",
                            color: "var(--color-chip-text)",
                            border: "1px solid var(--color-chip-border)",
                            fontWeight: 600,
                            padding: "3px 9px",
                          }}
                        >
                          <LoaderCircle className="h-3 w-3 animate-spin" aria-hidden="true" />
                          Loading
                        </span>
                      ) : (
                        (tags || []).map((tag) => {
                          const canOpenSheet = isOpenableSheetTag(tag);
                          return (
                          <button
                            key={`${file.id}-${tag}`}
                            type="button"
                            onClick={() => canOpenSheet && onOpen(file, tag)}
                            disabled={!canOpenSheet || Boolean(openingFile)}
                            style={{
                              borderRadius: "20px",
                              backgroundColor: "var(--color-chip-bg)",
                              color: "var(--color-chip-text)",
                              border: "1px solid var(--color-chip-border)",
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "3px 9px",
                              cursor: canOpenSheet && !openingFile ? "pointer" : "default",
                              opacity: openingFile ? 0.65 : 1,
                            }}
                            title={canOpenSheet ? `Open ${tag}` : tag}
                          >
                            {tag}
                          </button>
                          );
                        })
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => onOpen(file)}
                        disabled={Boolean(openingFile)}
                        className="rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"
                        style={{
                          backgroundColor: openingFile === file.id ? "rgba(19, 48, 32, 0.5)" : "var(--color-castleton-green)",
                          color: "#FFFFFF",
                          border: "none",
                        }}
                        >
                          {openingFile === file.id ? (
                            <>
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                            Opening
                          </>
                        ) : (
                          "Open analysis"
                        )}
                      </button>
                      {showDownload && (
                        <button
                          onClick={() => onDownload(file)}
                          disabled={downloadingFile === file.id}
                          className="rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"
                          style={{
                            backgroundColor: "var(--color-surface-soft)",
                            color: "var(--color-text)",
                            border: "1px solid var(--color-border)",
                            opacity: downloadingFile === file.id ? 0.7 : 1,
                          }}
                        >
                          {downloadingFile === file.id ? (
                            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Download className="h-4 w-4" aria-hidden="true" />
                          )}
                          {downloadingFile === file.id ? "Downloading" : "Download"}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Empty State Component
function EmptyState({ folderName, onChangeFolder }) {
  return (
    <div
      className="w-full flex flex-col items-center text-center"
      style={{ maxWidth: "400px" }}
    >
      <div
        className="flex items-center justify-center"
        style={{
          width: "90px",
          height: "90px",
          borderRadius: "16px",
          backgroundColor: "var(--color-surface-soft)",
        }}
      >
        <FileX className="h-8 w-8" style={{ color: "var(--color-text)" }} aria-hidden="true" />
      </div>
      <h3
        style={{
          marginTop: "20px",
          fontSize: "15px",
          fontWeight: 600,
          color: "var(--color-text)",
          lineHeight: 1.35,
        }}
      >
        No Excel files found
      </h3>
      <p
        style={{
          marginTop: "6px",
          fontSize: "13px",
          color: "var(--color-text-light)",
          lineHeight: 1.4,
        }}
      >
        No .xlsx or .xls files in{" "}
        <span style={{ fontWeight: 700, color: "var(--color-text)" }}>
          {folderName || "this folder"}
        </span>
      </p>
      <p
        style={{
          marginTop: "4px",
          fontSize: "13px",
          color: "var(--color-text-light)",
          lineHeight: 1.4,
        }}
      >
        Upload Excel files to this folder and refresh to get started
      </p>
      {onChangeFolder && (
        <button
          onClick={onChangeFolder}
          className="rounded-lg transition-all"
          style={{
            marginTop: "16px",
            backgroundColor: "var(--color-surface-elevated)",
            color: "var(--color-text)",
            border: "1.5px solid var(--color-saffron)",
            borderRadius: "8px",
            padding: "10px 20px",
            fontSize: "14px",
            fontWeight: 500,
            width: "auto",
            boxShadow: "none",
          }}
        >
          Choose different folder
        </button>
      )}
    </div>
  );
}

// Main Component
export default function HomePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, accessToken, loading: authLoading, login, isAdmin } = useAuth();
  const {
    tabs,
    activeTabId,
    setActiveTabId,
    openAnalysisTab,
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
    removeJob,
    getJob,
    attachJobController,
    detachJobController,
    dismissNotification,
    markJobBackground,
    getJobByRequestKey,
  } = useAnalysisJobs();
  const { openFolderPicker } = useDrivePicker();
  const {
    files,
    folders,
    loading: filesLoading,
    error,
    listFolderContents,
    getFolderMeta,
    downloadFile,
  } = useDriveFiles();
  const lifewoodLogoSrc = theme === "dark" ? LIFEWOOD_DARK_LOGO_URL : lifewoodIconText;

  const [folder, setFolder] = useState(null);
  const [folderPath, setFolderPath] = useState([]);
  const [openingFile, setOpeningFile] = useState(null);
  const [analysisProgress, setAnalysisProgress] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);
  const [openError, setOpenError] = useState("");
  const [fileTagsById, setFileTagsById] = useState({});
  const tagLoadInProgress = useRef(new Set());
  const tagCacheRef = useRef({});
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const [pageSize, setPageSize] = useState(() => getDefaultPageSize());
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [foregroundJobId, setForegroundJobId] = useState(null);
  const pageSizeTouchedRef = useRef(false);
  const [currentPage, setCurrentPage] = useState(1);
  const toolbarDropdownGroupRef = useRef(null);
  const TAG_CACHE_KEY = "fileSheetTagsCache";
  const isMountedRef = useRef(true);
  const foregroundJobIdRef = useRef(null);
  const backgroundedJobIdsRef = useRef(new Set());
  const adoptedForegroundJobIdsRef = useRef(new Set());

  useEffect(() => {
    const handleResize = () => {
      if (!pageSizeTouchedRef.current) {
        setPageSize(getDefaultPageSize());
      }
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      const currentForegroundJobId = foregroundJobIdRef.current;
      if (currentForegroundJobId && !backgroundedJobIdsRef.current.has(currentForegroundJobId)) {
        abortJob(currentForegroundJobId);
      }
    };
  }, [abortJob]);

  useEffect(() => {
    foregroundJobIdRef.current = foregroundJobId;
  }, [foregroundJobId]);

  const foregroundJob = foregroundJobId ? getJob(foregroundJobId) : null;

  useEffect(() => {
    if (!foregroundJob || foregroundJob.status !== "running") return;
    setAnalysisProgress({
      fileName: foregroundJob.fileName,
      sheetName: foregroundJob.sheetName,
      label: foregroundJob.label,
      percent: foregroundJob.percent,
    });
  }, [foregroundJob]);

  useEffect(() => {
    if (
      !foregroundJob
      || foregroundJob.status !== "completed"
      || !foregroundJob.resultPayload
      || !adoptedForegroundJobIdsRef.current.has(foregroundJob.id)
    ) {
      return;
    }

    adoptedForegroundJobIdsRef.current.delete(foregroundJob.id);
    backgroundedJobIdsRef.current.delete(foregroundJob.id);
    dismissNotification(foregroundJob.id);
    removeJob(foregroundJob.id);
    const tabId = openAnalysisTab(foregroundJob.resultPayload);
    setForegroundJobId(null);
    setOpeningFile(null);
    setAnalysisProgress(null);
    navigate("/dashboard", { state: { targetTabId: tabId } });
  }, [foregroundJob, dismissNotification, removeJob, openAnalysisTab, navigate]);

  useEffect(() => {
    try {
      const cached = JSON.parse(localStorage.getItem(TAG_CACHE_KEY) || "{}");
      if (cached && typeof cached === "object") {
        tagCacheRef.current = cached;
      }
    } catch {
      tagCacheRef.current = {};
    }
  }, []);

  useEffect(() => {
    if (!files.length) return;
    const cachedTags = {};
    files.forEach((file) => {
      const cached = tagCacheRef.current?.[file.id];
      if (cached && cached.modifiedTime === file.modifiedTime && Array.isArray(cached.tags)) {
        cachedTags[file.id] = cached.tags;
      }
    });
    if (Object.keys(cachedTags).length) {
      setFileTagsById((prev) => ({ ...cachedTags, ...prev }));
    }
  }, [files]);

  const filteredFiles = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return files.filter((file) => {
      const lowerName = file.name.toLowerCase();
      const tags = fileTagsById[file.id] || [];
      const matchesSearch =
        term === "" ||
        lowerName.includes(term) ||
        tags.some((tag) => tag.toLowerCase().includes(term));
      const matchesType =
        selectedType === "all" ||
        (selectedType === "xlsx" && lowerName.endsWith(".xlsx")) ||
        (selectedType === "xls" && lowerName.endsWith(".xls"));
      return matchesSearch && matchesType;
    });
  }, [files, fileTagsById, searchTerm, selectedType]);

  const filteredFolders = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return folders;
    return folders.filter((subfolder) => subfolder.name.toLowerCase().includes(term));
  }, [folders, searchTerm]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, pageSize, files.length]);

  const totalPages = filteredFiles.length ? Math.ceil(filteredFiles.length / pageSize) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = filteredFiles.length ? (safePage - 1) * pageSize : 0;
  const endIndex = filteredFiles.length ? Math.min(filteredFiles.length, safePage * pageSize) : 0;
  const paginatedFiles = filteredFiles.slice(startIndex, endIndex);
  const hasActiveFileFilters = searchTerm.trim().length > 0 || selectedType !== "all";
  const emptyFilesMessage = hasActiveFileFilters
    ? "No spreadsheet files match your search or filters."
    : folders.length > 0
      ? "No spreadsheet files in this folder. Open a subfolder to continue."
      : "No spreadsheet files in this folder.";

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (authLoading || !user) return;
    if (isAdmin) {
      setFolder(null);
      setFolderPath([]);
      return;
    }

    const saved = localStorage.getItem("lastFolder");
    if (!saved) {
      setFolder(null);
      setFolderPath([]);
      return;
    }

    try {
      const parsedFolder = JSON.parse(saved);
      setFolder(parsedFolder);
      setFolderPath([parsedFolder]);
    } catch {
      setFolder(null);
      setFolderPath([]);
    }
  }, [authLoading, user, isAdmin]);

  useEffect(() => {
    if (!accessToken || !isAdmin) return;
    if (!ADMIN_ROOT_FOLDER_ID) {
      setOpenError("Admin root folder is not configured. Set VITE_ADMIN_ROOT_FOLDER_ID.");
      return;
    }

    let cancelled = false;
    const initAdminRoot = async () => {
      try {
        const rootFolder = await getFolderMeta(ADMIN_ROOT_FOLDER_ID, accessToken);
        if (cancelled) return;
        setFolder(rootFolder);
        setFolderPath([rootFolder]);
        await listFolderContents(rootFolder.id, accessToken);
      } catch (err) {
        if (!cancelled) {
          setOpenError(`Failed to open admin workspace: ${err.message}`);
        }
      }
    };

    initAdminRoot();
    return () => {
      cancelled = true;
    };
  }, [accessToken, isAdmin, getFolderMeta, listFolderContents]);

  useEffect(() => {
    if (!accessToken || isAdmin || !folder) return;
    listFolderContents(folder.id, accessToken);
  }, [folder, accessToken, isAdmin, listFolderContents]);

  useEffect(() => {
    if (!files.length || !accessToken) return;

    let isCancelled = false;
    const pendingFiles = files.filter(
      (file) => !fileTagsById[file.id] && !tagLoadInProgress.current.has(file.id)
    );
    if (!pendingFiles.length) return;

    const loadTagsForFile = async (file) => {
      tagLoadInProgress.current.add(file.id);

      try {
        const cached = tagCacheRef.current?.[file.id];
        if (cached && cached.modifiedTime === file.modifiedTime && Array.isArray(cached.tags)) {
          if (!isCancelled) {
            setFileTagsById((prev) => ({ ...prev, [file.id]: cached.tags }));
          }
          return;
        }
        const { arrayBuffer } = await downloadFile(file.id, accessToken);
        const blob = new Blob([arrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
        const formData = new FormData();
        formData.append("file", blob, file.name);

        const res = await fetch(`${HOST}/get-sheets`, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) throw new Error(`Sheet scan failed: ${res.status}`);

        const data = await res.json();
        const tags = getSheetBasedTags(data?.sheets || []);
        if (!isCancelled) {
          setFileTagsById((prev) => ({ ...prev, [file.id]: tags }));
        }
        tagCacheRef.current = {
          ...tagCacheRef.current,
          [file.id]: {
            tags,
            modifiedTime: file.modifiedTime || null,
            updatedAt: Date.now(),
          },
        };
        try {
          localStorage.setItem(TAG_CACHE_KEY, JSON.stringify(tagCacheRef.current));
        } catch {
          // ignore storage quota errors
        }
      } catch {
        if (!isCancelled) {
          setFileTagsById((prev) => ({ ...prev, [file.id]: getErrorTags() }));
        }
      } finally {
        tagLoadInProgress.current.delete(file.id);
      }
    };

    const queue = [...pendingFiles];
    const workerCount = Math.min(2, queue.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (queue.length && !isCancelled) {
        const nextFile = queue.shift();
        if (!nextFile) break;
        await loadTagsForFile(nextFile);
      }
    });

    Promise.all(workers).catch(() => {});

    return () => {
      isCancelled = true;
    };
  }, [files, accessToken, downloadFile, fileTagsById]);

  const handleFolderSelect = (selectedFolder) => {
    setFolder(selectedFolder);
    setFolderPath([selectedFolder]);
    localStorage.setItem("lastFolder", JSON.stringify(selectedFolder));
    listFolderContents(selectedFolder.id, accessToken);
  };

  const handleOpenAdminFolder = async (nextFolder) => {
    if (!accessToken || !isAdmin) return;
    setOpenError("");
    setFolder(nextFolder);
    setFolderPath((prev) => [...prev, nextFolder]);
    await listFolderContents(nextFolder.id, accessToken);
  };

  const handleAdminBreadcrumb = async (targetFolderId) => {
    if (!accessToken || !isAdmin) return;
    const nextPath = folderPath.slice(0, folderPath.findIndex((item) => item.id === targetFolderId) + 1);
    const nextFolder = nextPath[nextPath.length - 1];
    if (!nextFolder) return;
    setFolder(nextFolder);
    setFolderPath(nextPath);
    await listFolderContents(nextFolder.id, accessToken);
  };

  const handleOpenBackgroundJob = (jobId) => {
    const job = getJob(jobId);
    if (!job?.resultPayload) return;

    backgroundedJobIdsRef.current.delete(jobId);
    dismissNotification(jobId);
    removeJob(jobId);
    const tabId = openAnalysisTab(job.resultPayload);
    navigate("/dashboard", { state: { targetTabId: tabId } });
  };

  const handleOpenFile = (file, sheetName = "") => {
    const requestKey = makeAnalysisRequestKey({
      driveFileId: file.id,
      sheetName,
      modifiedTime: file.modifiedTime,
    });
    const existingJob = getJobByRequestKey(requestKey);

    if (existingJob?.status === "completed" && existingJob.resultPayload) {
      dismissNotification(existingJob.id);
      removeJob(existingJob.id);
      const tabId = openAnalysisTab({
        ...existingJob.resultPayload,
        fileName: file.name,
        driveFileId: file.id,
        driveModifiedTime: file.modifiedTime,
        folderId: folder?.id,
        sourceUserEmail: isAdmin ? folder?.name : user?.email,
        sourceFolderName: folder?.name,
      });
      navigate("/dashboard", { state: { targetTabId: tabId } });
      return;
    }

    if (existingJob?.status === "running") {
      backgroundedJobIdsRef.current.delete(existingJob.id);
      adoptedForegroundJobIdsRef.current.add(existingJob.id);
      setForegroundJobId(existingJob.id);
      setOpeningFile(file.id);
      setAnalysisProgress({
        fileName: existingJob.fileName || file.name,
        sheetName: existingJob.sheetName || sheetName,
        label: existingJob.label || "Analyzing workbook",
        percent: existingJob.percent ?? 45,
      });
      setOpenError("");
      return;
    }

    const cachedAnalysis = getAnalysisResultCache({
      driveFileId: file.id,
      sheetName: sheetName || "",
      modifiedTime: file.modifiedTime,
      allowDefaultAlias: !sheetName,
    });

    if (cachedAnalysis) {
      const tabId = openAnalysisTab({
        ...cachedAnalysis,
        fileName: file.name,
        driveFileId: file.id,
        driveModifiedTime: file.modifiedTime,
        folderId: folder?.id,
        sourceUserEmail: isAdmin ? folder?.name : user?.email,
        sourceFolderName: folder?.name,
      });
      navigate("/dashboard", { state: { targetTabId: tabId } });
      return;
    }

    const currentForegroundJobId = foregroundJobIdRef.current;
    if (currentForegroundJobId && !backgroundedJobIdsRef.current.has(currentForegroundJobId)) {
      abortJob(currentForegroundJobId);
    }

    const jobId = createJob({
      fileId: file.id,
      fileName: file.name,
      sheetName,
      label: "Downloading workbook from Drive",
      percent: 20,
      requestKey,
    });
    const controller = new AbortController();
    attachJobController(jobId, controller);

    setForegroundJobId(jobId);
    setOpeningFile(file.id);
    setAnalysisProgress({
      fileName: file.name,
      sheetName,
      label: "Downloading workbook from Drive",
      percent: 20,
    });
    setOpenError("");

    void (async () => {
      try {
        const cachedWorkbook = getCurrentWorkbookCache({
          driveFileId: file.id,
          modifiedTime: file.modifiedTime,
        });
        let arrayBuffer = cachedWorkbook?.arrayBuffer || null;
        let meta = cachedWorkbook
          ? {
            name: cachedWorkbook.fileName || file.name,
            modifiedTime: cachedWorkbook.modifiedTime || file.modifiedTime,
            version: cachedWorkbook.version,
            mimeType: cachedWorkbook.mimeType || file.mimeType,
          }
          : null;

        if (arrayBuffer) {
          updateJob(jobId, {
            label: "Using cached workbook",
            percent: 35,
          });
          if (foregroundJobIdRef.current === jobId && isMountedRef.current) {
            setAnalysisProgress({
              fileName: file.name,
              sheetName,
              label: "Using cached workbook",
              percent: 35,
            });
          }
        } else {
          const downloaded = await downloadFile(file.id, accessToken, controller.signal);
          arrayBuffer = downloaded.arrayBuffer;
          meta = downloaded.meta;
          setCurrentWorkbookCache({
            driveFileId: file.id,
            fileName: file.name,
            modifiedTime: meta?.modifiedTime || file.modifiedTime,
            version: meta?.version,
            mimeType: meta?.mimeType || file.mimeType,
            arrayBuffer,
          });
        }

        updateJob(jobId, {
          label: "Reading workbook and detecting headers",
          percent: 45,
          requestKey: makeAnalysisRequestKey({
            driveFileId: file.id,
            sheetName,
            modifiedTime: meta?.modifiedTime || file.modifiedTime,
          }),
        });
        if (foregroundJobIdRef.current === jobId && isMountedRef.current) {
          setAnalysisProgress({
            fileName: file.name,
            sheetName,
            label: "Reading workbook and detecting headers",
            percent: 45,
          });
        }

        const blob = new Blob([arrayBuffer], {
          type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });

        const formData = new FormData();
        formData.append("file", blob, file.name);

        const analyzeQuery = new URLSearchParams();
        if (sheetName) analyzeQuery.set("sheet_name", sheetName);
        analyzeQuery.set("drive_file_id", file.id);
        analyzeQuery.set("drive_modified_time", meta?.modifiedTime || file.modifiedTime || "");
        const analyzeUrl = `${HOST}/analyze-bytes?${analyzeQuery.toString()}`;

        const res = await fetch(analyzeUrl, {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        if (!res.ok) throw new Error(`Server error: ${res.status}`);

        updateJob(jobId, {
          label: "Building dashboard and AI context",
          percent: 80,
        });
        if (foregroundJobIdRef.current === jobId && isMountedRef.current) {
          setAnalysisProgress({
            fileName: file.name,
            sheetName,
            label: "Building dashboard and AI context",
            percent: 80,
          });
        }

        const { tableData, blueprint, allSheets, currentSheet, analysisSession } = await res.json();

        if (!isAdmin && ADMIN_ROOT_FOLDER_ID && user?.email) {
          const mirrorBlob = new Blob([arrayBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          });
          const mirrorFormData = new FormData();
          mirrorFormData.append("file", mirrorBlob, normalizeAdminCopyName(file));

          void fetch(
            `${HOST}/admin-mirror?user_email=${encodeURIComponent(user.email)}&file_name=${encodeURIComponent(normalizeAdminCopyName(file))}`,
            {
              method: "POST",
              body: mirrorFormData,
            }
          )
            .then(async (mirrorRes) => {
              const result = await mirrorRes.json().catch(() => ({}));
              if (!mirrorRes.ok || result.ok === false || result.error) {
                throw new Error(result.error || `Mirror request failed: ${mirrorRes.status}`);
              }
            })
            .catch((copyErr) => {
              console.warn("[admin-mirror] Failed to sync analyzed file:", copyErr.message);
            });
        }

        const payload = {
          tableData,
          blueprint,
          currentSheet,
          allSheets,
          fileName: file.name,
          driveFileId: file.id,
          driveModifiedTime: meta?.modifiedTime || file.modifiedTime,
          analysisSession: analysisSession || null,
          folderId: folder?.id,
          sourceUserEmail: isAdmin ? folder?.name : user?.email,
          sourceFolderName: folder?.name,
        };

        setAnalysisResultCache(payload, {
          requestedSheetName: sheetName,
          modifiedTime: meta?.modifiedTime || file.modifiedTime,
        });

        completeJob(jobId, payload);

        if (foregroundJobIdRef.current === jobId && !backgroundedJobIdsRef.current.has(jobId) && isMountedRef.current) {
          setAnalysisProgress({
            fileName: file.name,
            sheetName: currentSheet,
            label: "Opening dashboard",
            percent: 100,
          });
          const tabId = openAnalysisTab(payload);
          dismissNotification(jobId);
          removeJob(jobId);
          setForegroundJobId(null);
          setOpeningFile(null);
          setAnalysisProgress(null);
          navigate("/dashboard", { state: { targetTabId: tabId } });
          return;
        }

        if (foregroundJobIdRef.current === jobId && isMountedRef.current) {
          setForegroundJobId(null);
          setOpeningFile(null);
          setAnalysisProgress(null);
        }
      } catch (err) {
        if (err?.name === "AbortError") {
          return;
        }
        failJob(jobId, `Failed to open ${file.name}: ${err.message}`);
        if (foregroundJobIdRef.current === jobId && isMountedRef.current) {
          setOpenError(`Failed to open ${file.name}: ${err.message}`);
          setForegroundJobId(null);
          setOpeningFile(null);
          setAnalysisProgress(null);
        }
      } finally {
        detachJobController(jobId);
      }
    })();
  };

  const cancelCurrentAnalysis = () => {
    const currentForegroundJobId = foregroundJobIdRef.current;
    if (currentForegroundJobId) {
      backgroundedJobIdsRef.current.delete(currentForegroundJobId);
      adoptedForegroundJobIdsRef.current.delete(currentForegroundJobId);
      abortJob(currentForegroundJobId);
    }
    setForegroundJobId(null);
    setOpeningFile(null);
    setAnalysisProgress(null);
  };

  const continueCurrentAnalysisInBackground = () => {
    const currentForegroundJobId = foregroundJobIdRef.current;
    if (!currentForegroundJobId) return;
    backgroundedJobIdsRef.current.add(currentForegroundJobId);
    adoptedForegroundJobIdsRef.current.delete(currentForegroundJobId);
    markJobBackground(currentForegroundJobId);
    setForegroundJobId(null);
    setOpeningFile(null);
    setAnalysisProgress(null);
  };

  const handleDownloadFile = async (file) => {
    setDownloadingFile(file.id);
    setOpenError("");

    try {
      const { arrayBuffer } = await downloadFile(file.id, accessToken);
      triggerBrowserDownload(
        arrayBuffer,
        normalizeAdminCopyName(file),
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
    } catch (err) {
      setOpenError(`Failed to download ${file.name}: ${err.message}`);
    }

    setDownloadingFile(null);
  };

  const handleSelectAnalysisTab = (tabId) => {
    if (!tabs.some((tab) => tab.id === tabId)) return;
    touchAnalysisTab(tabId);
    setActiveTabId(tabId);
    navigate("/dashboard", { state: { targetTabId: tabId } });
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <LoaderCircle className="h-10 w-10 animate-spin" style={{ color: "var(--color-text)" }} aria-hidden="true" />
          <p style={{ color: "var(--color-text-light)" }}>Loading LifeSights</p>
        </div>
      </div>
    );
  }

  // Login state
  if (!user || !accessToken) {
    return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: "var(--color-bg)" }}>
        <ScrollProgressBar />

        <div className="absolute inset-0 pointer-events-none">
          <Grainient
            color1="#F5EEDB"
            color2="#046241"
            color3="#133020"
            timeSpeed={0.2}
            colorBalance={-0.1}
            warpStrength={1}
            warpFrequency={4.5}
            warpSpeed={1.7}
            warpAmplitude={60}
            blendAngle={0}
            blendSoftness={0.08}
            rotationAmount={260}
            noiseScale={1.7}
            grainAmount={0.08}
            grainScale={2}
            grainAnimated={false}
            contrast={1.1}
            gamma={1}
            saturation={0.95}
            centerX={0}
            centerY={0}
            zoom={0.95}
          />
        </div>

        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(180deg, rgba(245, 238, 219, 0.58) 0%, rgba(249, 247, 247, 0.72) 100%)",
          }}
        />

        <div className="relative z-10 w-full flex flex-col items-center justify-center">
          <img
            src={lifewoodLogoSrc}
            alt="Lifewood"
            className="w-48 h-16 mb-2"
            style={{ objectFit: "contain" }}
          />
          <div
            className="login-glass-card rounded-2xl w-full max-w-md border"
            style={{
              backdropFilter: "blur(8px)",
              borderColor: "var(--color-border)",
              boxShadow: "var(--color-shadow-strong)",
              padding: "48px 48px",
            }}
          >
            <div className="mb-8 flex justify-center">
              <img
                src={lifeSightsLogo}
                alt="LifeSights powered by Lifewood"
                className="h-auto w-full max-w-[260px]"
                style={{
                  objectFit: "contain",
                }}
              />
            </div>
            <div className="mb-5">
              <p className="text-sm text-center leading-relaxed" style={{ color: "var(--color-dark-serpent)", opacity: 0.82 }}>
                Connect your Google Drive to visualize and analyze Excel files in real time
              </p>
              {user && !accessToken && (
                <p className="text-xs text-center mt-3" style={{ color: "var(--color-dark-serpent)", opacity: 0.78 }}>
                  Session expired. Please sign in again to continue.
                </p>
              )}
            </div>
            <button
              onClick={login}
              className="login-google-wave-btn w-full mb-8"
              style={{
                border: "solid var(--color-dark-serpent) 2px",
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" viewBox="0 0 256 262" className="login-google-wave-svg">
                <path fill="#4285F4" d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622 38.755 30.023 2.685.268c24.659-22.774 38.875-56.282 38.875-96.027" className="blue" />
                <path fill="#34A853" d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055-34.523 0-63.824-22.773-74.269-54.25l-1.531.13-40.298 31.187-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1" className="green" />
                <path fill="#FBBC05" d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82 0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602l42.356-32.782" className="yellow" />
                <path fill="#EB4335" d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0 79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251" className="red" />
              </svg>
              <span className="login-google-wave-text">Sign in with Google</span>
            </button>
            <p className="text-xs text-center" style={{ color: "var(--color-dark-serpent)", opacity: 0.72 }}>
              Secure access to your Google Drive files
            </p>
          </div>
        </div>
      </div>
    );
  }

  const breadcrumb = isAdmin
    ? `Admin Workspace > ${folderPath.map((item) => item.name).join(" > ")}`
    : folder
      ? `Your Google Drive > ... > ${folder.name}`
      : "Your Google Drive";
  const handleToolbarDropdownToggle = (e) => {
    const currentDetails = e.currentTarget;
    if (!currentDetails?.open) return;
    const container = toolbarDropdownGroupRef.current;
    if (!container) return;

    const openDropdowns = container.querySelectorAll("details[open]");
    openDropdowns.forEach((details) => {
      if (details !== currentDetails) details.removeAttribute("open");
    });
  };

  // Main logged-in view
  return (
    <div style={{ backgroundColor: "var(--color-bg)", minHeight: "100vh" }}>
      <style>{`
        .home-page-title {
          font-size: clamp(2rem, 4vw, 3rem) !important;
          line-height: 1.05 !important;
          letter-spacing: -0.045em;
        }
        @media (max-width: 900px) {
          .home-main-shell {
            margin-left: 0 !important;
          }
          .home-header-inner {
            padding: 14px 16px !important;
            gap: 12px;
            align-items: flex-start !important;
          }
          .home-main-content {
            padding: 24px 16px 40px !important;
          }
        }
        @media (max-width: 640px) {
          .home-page-title {
            font-size: 1.75rem !important;
            line-height: 1.15 !important;
          }
          .home-toolbar-row {
            flex-direction: column;
            align-items: stretch !important;
          }
        }
      `}</style>
      <ScrollProgressBar />
      <button
        type="button"
        className={`ui-sidebar-backdrop ${isSidebarOpen ? "is-open" : ""}`}
        style={{ padding: 0, border: "none" }}
        aria-label="Close sidebar"
        onClick={() => setIsSidebarOpen(false)}
      />

      <aside
        className={`ui-auto-hide-sidebar ${isSidebarOpen ? "is-open" : ""}`}
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "var(--sidebar-width)",
          height: "100vh",
          zIndex: 50,
          background: "var(--color-surface)",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid var(--color-border)",
          overflowY: "auto",
        }}
      >
        <Sidebar
          folder={folder}
          files={files}
          filesLoading={filesLoading}
          onSelectFolder={isAdmin ? null : () => {
            setIsSidebarOpen(false);
            openFolderPicker(accessToken, handleFolderSelect);
          }}
          onRefresh={() => {
            setIsSidebarOpen(false);
            folder && listFolderContents(folder.id, accessToken);
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

      <div className="home-main-shell" style={{ marginLeft: "var(--sidebar-offset)", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {analysisProgress && (
          <div
            className="fixed inset-0 z-[130] flex items-center justify-center px-6"
            style={{
              backgroundColor: "rgba(19, 48, 32, 0.58)",
              backdropFilter: "blur(5px)",
              WebkitBackdropFilter: "blur(5px)",
            }}
          >
            <div
              className="w-full max-w-md rounded-3xl border p-6 shadow-2xl"
              style={{
                backgroundColor: "var(--color-surface-elevated)",
                borderColor: "var(--color-border)",
                color: "var(--color-text)",
              }}
            >
              <div className="mb-4 flex items-center gap-3">
                <LoaderCircle className="h-6 w-6 animate-spin" style={{ color: "var(--color-castleton-green)" }} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-extrabold" style={{ color: "var(--color-text)" }}>Analyzing workbook</p>
                  <p className="truncate text-xs" style={{ color: "var(--color-text-light)" }}>
                    {analysisProgress.fileName}{analysisProgress.sheetName ? ` - ${analysisProgress.sheetName}` : ""}
                  </p>
                </div>
              </div>
              <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold" style={{ color: "var(--color-text-light)" }}>
                <span>{analysisProgress.label}</span>
                <span>{analysisProgress.percent}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: "var(--color-surface-soft)" }}>
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${analysisProgress.percent}%`,
                    background: "linear-gradient(90deg, var(--color-castleton-green), var(--color-saffron))",
                  }}
                />
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={continueCurrentAnalysisInBackground}
                  className="mr-2 rounded-xl px-4 py-2 text-xs font-extrabold transition-all"
                  style={{
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface-soft)",
                    color: "var(--color-text)",
                  }}
                >
                  Continue in background
                </button>
                <button
                  type="button"
                  onClick={cancelCurrentAnalysis}
                  className="rounded-xl px-4 py-2 text-xs font-extrabold transition-all"
                  style={{
                    border: "1px solid var(--color-border)",
                    backgroundColor: "var(--color-surface)",
                    color: "var(--color-text)",
                  }}
                >
                  Cancel
                </button>
              </div>
              <p className="mt-3 text-[11px] font-semibold" style={{ color: "var(--color-text-light)" }}>
                Large sheets may take a little longer while LifeSights prepares rows, charts, and AI context.
              </p>
            </div>
          </div>
        )}
        {/* Header */}
        <header
          className="sticky top-0 z-40 border-b"
          style={{
            background: "var(--color-surface)",
            backdropFilter: "blur(10px)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="home-header-inner max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="flex min-w-0 items-start gap-3">
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
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold" style={{ color: "var(--color-text)" }}>
                  {breadcrumb}
                </p>
                {!folder && (
                  <p className="text-xs" style={{ color: "var(--color-text-light)" }}>
                    No folder selected
                  </p>
                )}
                {isAdmin && folderPath.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    {folderPath.map((pathFolder, index) => (
                      <button
                        key={pathFolder.id}
                        type="button"
                        onClick={() => handleAdminBreadcrumb(pathFolder.id)}
                        disabled={index === folderPath.length - 1}
                        className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                        style={{
                          border: "1px solid var(--color-border)",
                          backgroundColor: index === folderPath.length - 1 ? "var(--color-surface-soft)" : "var(--color-surface-elevated)",
                          color: "var(--color-text)",
                          opacity: index === folderPath.length - 1 ? 1 : 0.9,
                          cursor: index === folderPath.length - 1 ? "default" : "pointer",
                        }}
                      >
                        {index === 0 ? <House className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                        <span>{pathFolder.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-end">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="home-main-content flex-1 max-w-7xl mx-auto px-6 py-12 w-full flex flex-col">
          {/* Page Title */}
          <div className="mb-12">
            <h1 className="home-page-title text-3xl font-bold mb-4" style={{ color: "var(--color-text)", marginBottom: "4px" }}>
              {isAdmin ? "Admin Workspace" : "Excel Files"}
            </h1>
            <p style={{ color: "var(--color-text-light)" }}>
              {isAdmin
                ? `Browsing ${folders.length} folder${folders.length !== 1 ? "s" : ""} and ${files.length} file${files.length !== 1 ? "s" : ""} in `
                : folder
                  ? `${files.length} file${files.length !== 1 ? "s" : ""} available in `
                  : "Select a Google Drive folder to begin exploring your data"}
              {folder && <span style={{ fontWeight: 700, color: "var(--color-text)" }}>{folder.name}</span>}
            </p>
          </div>

          {/* Error Alert */}
          {(error || openError) && (
            <div
              className="rounded-lg p-4 mb-8 flex gap-3 border"
              style={{
                backgroundColor: "var(--color-alert-bg)",
                borderColor: "var(--color-alert-border)",
                borderLeft: `4px solid var(--color-saffron)`,
              }}
            >
              <TriangleAlert className="mt-0.5 h-5 w-5 flex-shrink-0" style={{ color: "var(--color-text)" }} aria-hidden="true" />
              <div className="text-sm" style={{ color: "var(--color-text)" }}>
                {error || openError}
              </div>
            </div>
          )}

          {/* Loading State */}
          {filesLoading && (
            <div className="flex flex-col items-center justify-center py-24">
              <LoaderCircle className="mb-4 h-10 w-10 animate-spin" style={{ color: "var(--color-text)" }} aria-hidden="true" />
              <p style={{ color: "var(--color-text-light)" }}>Loading files from Google Drive</p>
            </div>
          )}

          {/* No Folder Selected */}
          {!folder && !filesLoading && (
            <div className="flex flex-col items-center justify-center py-24">
              <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center mb-8"
                style={{ backgroundColor: "var(--color-surface-soft)" }}
              >
                <FolderSearch className="h-12 w-12" style={{ color: "var(--color-text)" }} aria-hidden="true" />
              </div>
              <h2 className="text-xl font-bold mb-4 text-center" style={{ color: "var(--color-text)" }}>
                Select a folder to get started
              </h2>
              <p className="text-sm mb-12 text-center max-w-sm leading-relaxed" style={{ color: "var(--color-text-light)" }}>
                {isAdmin
                  ? "Admin users are automatically scoped to the configured admin Drive workspace"
                  : "Choose a Google Drive folder containing your Excel files to start analyzing"}
              </p>
              {!isAdmin && (
                <button
                  onClick={() => openFolderPicker(accessToken, handleFolderSelect)}
                  className="text-sm font-semibold px-8 py-3 flex items-center gap-2 rounded-lg transition-all"
                  style={{
                    backgroundColor: "var(--color-dark-serpent)",
                    color: "#FFFFFF",
                    border: "none",
                  }}
                >
                  <FolderSearch className="h-5 w-5" aria-hidden="true" />
                  Select Google Drive Folder
                </button>
              )}
            </div>
          )}

          {/* File Grid */}
          {!filesLoading && folder && (files.length > 0 || folders.length > 0) && (
            <>
              <div className="mb-6 flex flex-col gap-3">
                <div className="home-toolbar-row flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[240px]">
                    <label className="sr-only" htmlFor="file-search">Search files</label>
                    <div className="relative">
                      <input
                        id="file-search"
                        type="search"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Search by file name or sheet name"
                        className="w-full rounded-lg border px-4 py-2.5 text-sm"
                        style={{
                          backgroundColor: "var(--color-surface)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3" ref={toolbarDropdownGroupRef}>

                    <details className="relative" onToggle={handleToolbarDropdownToggle}>
                      <summary
                        className="ui-dropdown-control ui-toolbar-dropdown flex items-center justify-between gap-2 cursor-pointer select-none [&::-webkit-details-marker]:hidden"
                        style={{ listStyle: "none" }}
                        aria-label="File type"
                      >
                        <span>
                          {selectedType === "all" ? "All types" : selectedType === "xlsx" ? ".xlsx" : ".xls"}
                        </span>
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </summary>

                      <div
                        className="absolute left-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border shadow-sm"
                        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-elevated)" }}
                        role="menu"
                        aria-label="File type options"
                      >
                        <button
                          type="button"
                          onClick={(e) => {
                            setSelectedType("all");
                            e.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                          className={`ui-dropdown-item ${selectedType === "all" ? "is-active" : ""}`}
                          role="menuitem"
                        >
                          All types
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            setSelectedType("xlsx");
                            e.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                          className={`ui-dropdown-item ${selectedType === "xlsx" ? "is-active" : ""}`}
                          role="menuitem"
                        >
                          .xlsx
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            setSelectedType("xls");
                            e.currentTarget.closest("details")?.removeAttribute("open");
                          }}
                          className={`ui-dropdown-item ${selectedType === "xls" ? "is-active" : ""}`}
                          role="menuitem"
                        >
                          .xls
                        </button>
                      </div>
                    </details>

                    <details className="relative" onToggle={handleToolbarDropdownToggle}>
                      <summary
                        className="ui-dropdown-control ui-toolbar-dropdown flex items-center justify-between gap-2 cursor-pointer select-none [&::-webkit-details-marker]:hidden"
                        style={{ listStyle: "none" }}
                        aria-label="Page size"
                      >
                        <span>Show {pageSize}</span>
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </summary>

                      <div
                        className="absolute left-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border shadow-sm"
                        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-elevated)" }}
                        role="menu"
                        aria-label="Page size options"
                      >
                        {PAGE_SIZE_OPTIONS.map((size) => (
                          <button
                            key={size}
                            type="button"
                            onClick={(e) => {
                              pageSizeTouchedRef.current = true;
                              setPageSize(size);
                              e.currentTarget.closest("details")?.removeAttribute("open");
                            }}
                            className={`ui-dropdown-item ${pageSize === size ? "is-active" : ""}`}
                            role="menuitem"
                          >
                            Show {size}
                          </button>
                        ))}
                      </div>
                    </details>

                    <details
                      className="relative"
                      onToggle={handleToolbarDropdownToggle}
                    >
                      <summary
                        className="ui-dropdown-control ui-toolbar-dropdown flex items-center justify-between gap-2 cursor-pointer select-none [&::-webkit-details-marker]:hidden"
                        style={{ listStyle: "none" }}
                        aria-label="View"
                      >
                        <span>View</span>
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </summary>

                      <div
                        className="absolute right-0 z-10 mt-1 w-36 overflow-hidden rounded-lg border shadow-sm"
                        style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-surface-elevated)" }}
                        role="menu"
                        aria-label="View options"
                      >
                        <button
                          type="button"
                          onClick={() => setViewMode("cards")}
                          className={`ui-dropdown-item ${viewMode === "cards" ? "is-active" : ""}`}
                          role="menuitem"
                        >
                          Cards{viewMode === "cards" ? " (current)" : ""}
                        </button>
                        <button
                          type="button"
                          onClick={() => setViewMode("table")}
                          className={`ui-dropdown-item ${viewMode === "table" ? "is-active" : ""}`}
                          role="menuitem"
                        >
                          Table{viewMode === "table" ? " (current)" : ""}
                        </button>
                      </div>
                    </details>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-sm" style={{ color: "var(--color-text-light)" }}>
                  <span>
                    {filteredFiles.length
                      ? `Showing ${startIndex + 1}-${endIndex} of ${filteredFiles.length} file${filteredFiles.length !== 1 ? "s" : ""}`
                      : emptyFilesMessage}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                      disabled={safePage === 1 || filteredFiles.length === 0}
                      className="px-3 py-2 rounded-md text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--color-surface-soft)",
                        color: "var(--color-text)",
                        border: "1px solid var(--color-border)",
                        opacity: safePage === 1 || filteredFiles.length === 0 ? 0.5 : 1,
                      }}
                    >
                      Prev
                    </button>
                    <div style={{ color: "var(--color-text)" }}>Page {safePage} / {totalPages}</div>
                    <button
                      onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                      disabled={safePage === totalPages || filteredFiles.length === 0}
                      className="px-3 py-2 rounded-md text-sm font-semibold"
                      style={{
                        backgroundColor: "var(--color-surface-soft)",
                        color: "var(--color-text)",
                        border: "1px solid var(--color-border)",
                        opacity: safePage === totalPages || filteredFiles.length === 0 ? 0.5 : 1,
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>

              {filteredFiles.length === 0 && (hasActiveFileFilters || folders.length === 0 || !isAdmin) && (
                <div className="rounded-2xl border p-6 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                  {emptyFilesMessage}
                </div>
              )}

              {isAdmin && filteredFolders.length > 0 && (
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold" style={{ color: "var(--color-text)" }}>Subfolders</h2>
                    <span className="text-sm" style={{ color: "var(--color-text-light)" }}>
                      {filteredFolders.length} folder{filteredFolders.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                    {filteredFolders.map((subfolder) => (
                      <FolderCard key={subfolder.id} folder={subfolder} onOpen={handleOpenAdminFolder} />
                    ))}
                  </div>
                </div>
              )}

              {isAdmin && folders.length > 0 && filteredFolders.length === 0 && searchTerm.trim() && (
                <div className="rounded-2xl border p-6 text-center mb-8" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                  No subfolders match your search.
                </div>
              )}

              {filteredFiles.length > 0 && viewMode === "cards" && (
                <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
                  {paginatedFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onOpen={handleOpenFile}
                      onDownload={handleDownloadFile}
                      loading={openingFile === file.id}
                      openDisabled={Boolean(openingFile)}
                      downloadLoading={downloadingFile === file.id}
                      tags={fileTagsById[file.id] || []}
                      isTagLoading={!fileTagsById[file.id]}
                      showDownload={isAdmin}
                    />
                  ))}
                </div>
              )}

              {filteredFiles.length > 0 && viewMode === "table" && (
                <FileTable
                  files={paginatedFiles}
                  fileTagsById={fileTagsById}
                  onOpen={handleOpenFile}
                  onDownload={handleDownloadFile}
                  openingFile={openingFile}
                  downloadingFile={downloadingFile}
                  showDownload={isAdmin}
                />
              )}
            </>
          )}

          {/* Empty Folder State */}
          {!filesLoading && folder && files.length === 0 && folders.length === 0 && (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "calc(-1 * (40px + 60px))",
              }}
            >
              <EmptyState
                folderName={folder.name}
                onChangeFolder={isAdmin ? null : () => openFolderPicker(accessToken, handleFolderSelect)}
              />
            </div>
          )}
        </main>
      </div>
      <BackgroundAnalysisDock />
      <BackgroundAnalysisToasts onOpenJob={handleOpenBackgroundJob} />
    </div>
  );
}
