import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useDrivePicker } from "../hooks/useDrivePicker";
import { useDriveFiles } from "../hooks/useDriveFiles";
import Sidebar from "./Sidebar";
import Grainient from "./Grainient";
import ThemeToggle from "./ThemeToggle";
import UserAvatar from "./UserAvatar";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import excelFileIcon from "../assets/icons/excel-file-icon.png";
import { LIFEWOOD_DARK_LOGO_URL } from "../constants/branding";

const HOST = "https://daily-headcount-ai-backend.onrender.com";

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
function FileCard({ file, onOpen, loading, tags, isTagLoading }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col transition-all hover:shadow-xl border"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "var(--color-border)",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Icon and Header */}
      <div className="flex min-h-[86px] items-start gap-4" style={{ marginBottom: "10px" }}>
        <div className="w-12 h-12 flex items-center justify-center flex-shrink-0">
          <img
            src={excelFileIcon}
            alt="Excel file"
            className="w-11 h-11"
            style={{ objectFit: "contain" }}
          />
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
            <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Loading Sheets
          </span>
        ) : (
          tags.map((tag) => (
            <span
              key={`${file.id}-${tag}`}
              style={{
                borderRadius: "20px",
                backgroundColor: "var(--color-chip-bg)",
                color: "var(--color-chip-text)",
                border: "1px solid var(--color-chip-border)",
                fontSize: "11px",
                fontWeight: 600,
                padding: "3px 9px",
              }}
            >
              {tag}
            </span>
          ))
        )}
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-meta-text)", marginBottom: "16px" }}>
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <span>Modified {formatDate(file.modifiedTime)}</span>
      </div>

      {/* Action Button */}
      <button
        onClick={() => onOpen(file)}
        disabled={loading}
        className="mt-auto w-full rounded-lg py-3 text-sm font-semibold transition-all flex items-center justify-center gap-2"
        style={{
          backgroundColor: loading ? "rgba(19, 48, 32, 0.5)" : "var(--color-castleton-green)",
          color: "#FFFFFF",
          border: "none",
        }}
      >
        {loading ? (
          <>
            <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
            </svg>
            Opening analysis
          </>
        ) : (
          <>
            <span>Open analysis</span>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </>
        )}
      </button>
    </div>
  );
}

function FileTable({ files, fileTagsById, onOpen, openingFile }) {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--color-white)", borderColor: "var(--color-border)" }}
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
                      <img
                        src={excelFileIcon}
                        alt="Excel file"
                        className="w-8 h-8 flex-shrink-0"
                        style={{ objectFit: "contain" }}
                      />
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
                          <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                        </svg>
                          Loading
                        </span>
                      ) : (
                        (tags || []).map((tag) => (
                          <span
                            key={`${file.id}-${tag}`}
                            style={{
                              borderRadius: "20px",
                              backgroundColor: "var(--color-chip-bg)",
                              color: "var(--color-chip-text)",
                              border: "1px solid var(--color-chip-border)",
                              fontSize: "11px",
                              fontWeight: 600,
                              padding: "3px 9px",
                            }}
                          >
                            {tag}
                          </span>
                        ))
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right align-top">
                    <button
                      onClick={() => onOpen(file)}
                      disabled={openingFile === file.id}
                      className="rounded-lg px-3 py-2 text-sm font-semibold inline-flex items-center justify-center gap-2"
                      style={{
                        backgroundColor: openingFile === file.id ? "rgba(19, 48, 32, 0.5)" : "var(--color-castleton-green)",
                        color: "#FFFFFF",
                        border: "none",
                      }}
                    >
                      {openingFile === file.id ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                          </svg>
                          Opening
                        </>
                      ) : (
                        "Open analysis"
                      )}
                    </button>
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
        <svg
          className="w-8 h-8"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: "var(--color-text)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
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
    </div>
  );
}

// Main Component
export default function HomePage() {
  const navigate = useNavigate();
  const { theme } = useTheme();
  const { user, accessToken, loading: authLoading, login } = useAuth();
  const { openFolderPicker } = useDrivePicker();
  const { files, loading: filesLoading, error, listFiles, downloadFile } = useDriveFiles();
  const lifewoodLogoSrc = theme === "dark" ? LIFEWOOD_DARK_LOGO_URL : lifewoodIconText;

  const [folder, setFolder] = useState(() => {
    const saved = localStorage.getItem("lastFolder");
    return saved ? JSON.parse(saved) : null;
  });
  const [openingFile, setOpeningFile] = useState(null);
  const [openError, setOpenError] = useState("");
  const [fileTagsById, setFileTagsById] = useState({});
  const tagLoadInProgress = useRef(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [viewMode, setViewMode] = useState("cards");
  const [pageSize, setPageSize] = useState(6);
  const [currentPage, setCurrentPage] = useState(1);

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

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedType, pageSize, files.length]);

  const totalPages = filteredFiles.length ? Math.ceil(filteredFiles.length / pageSize) : 1;
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = filteredFiles.length ? (safePage - 1) * pageSize : 0;
  const endIndex = filteredFiles.length ? Math.min(filteredFiles.length, safePage * pageSize) : 0;
  const paginatedFiles = filteredFiles.slice(startIndex, endIndex);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (folder && accessToken) {
      listFiles(folder.id, accessToken);
    }
  }, [folder, accessToken, listFiles]);

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
        const arrayBuffer = await downloadFile(file.id, accessToken);
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
    localStorage.setItem("lastFolder", JSON.stringify(selectedFolder));
    listFiles(selectedFolder.id, accessToken);
  };

  const handleOpenFile = async (file) => {
    setOpeningFile(file.id);
    setOpenError("");

    try {
      const arrayBuffer = await downloadFile(file.id, accessToken);
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const formData = new FormData();
      formData.append("file", blob, file.name);

      const res = await fetch(`${HOST}/analyze-bytes`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const { tableData, blueprint, allSheets, currentSheet } = await res.json();

      navigate("/dashboard", {
        state: {
          tableData,
          blueprint,
          currentSheet,
          allSheets,
          fileName: file.name,
          driveFileId: file.id,
          driveModifiedTime: file.modifiedTime,
          folderId: folder.id,
          accessToken,
        },
      });
    } catch (err) {
      setOpenError(`Failed to open ${file.name}: ${err.message}`);
    }

    setOpeningFile(null);
  };

  // Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-bg)" }}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10" fill="none" viewBox="0 0 24 24" style={{ color: "var(--color-text)" }}>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
          </svg>
          <p style={{ color: "var(--color-text-light)" }}>Loading DataViz</p>
        </div>
      </div>
    );
  }

  // Login state
  if (!user) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6 relative overflow-hidden" style={{ backgroundColor: "var(--color-sea-salt)" }}>
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
            <h1 className="text-2xl font-bold mb-4 text-center" style={{ color: "var(--color-text)" }}>
              DataViz
            </h1>
            <div className="mb-5">
              <p className="text-xs text-center mb-8" style={{ color: "var(--color-text-light)" }}>
                Powered by Lifewood PH
              </p>
            </div>
            <div className="mb-5">
              <p className="text-sm text-center leading-relaxed" style={{ color: "var(--color-text-light)" }}>
                Connect your Google Drive to visualize and analyze Excel files in real time
              </p>
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
            <p className="text-xs text-center" style={{ color: "var(--color-text-light)" }}>
              Read-only access to your Google Drive files
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Main logged-in view
  return (
    <div style={{ backgroundColor: "var(--color-bg)", minHeight: "100vh" }}>
      <ScrollProgressBar />

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
          overflowY: "auto",
        }}
      >
        <Sidebar
          folder={folder}
          files={files}
          filesLoading={filesLoading}
          onSelectFolder={() => openFolderPicker(accessToken, handleFolderSelect)}
          onRefresh={() => folder && listFiles(folder.id, accessToken)}
        />
      </aside>

      <div style={{ marginLeft: "320px", minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        {/* Header */}
        <header
          className="sticky top-0 z-40 border-b"
          style={{
            background: "var(--color-surface)",
            backdropFilter: "blur(10px)",
            borderColor: "var(--color-border)",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="hidden md:block text-center">
              <p className="text-xs font-medium" style={{ color: "var(--color-text-light)" }}>
                {folder ? `Folder: ${folder.name}` : "No folder selected"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold" style={{ color: "var(--color-text)" }}>
                  {user.displayName}
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-light)" }}>
                  {user.email}
                </div>
              </div>
              <UserAvatar
                user={user}
                size={32}
                borderColor="var(--color-saffron)"
              />
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full flex flex-col">
          {/* Page Title */}
          <div className="mb-12">
            <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--color-text)", marginBottom: "4px" }}>
              Excel Files
            </h1>
            <p style={{ color: "var(--color-text-light)" }}>
              {folder
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
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "var(--color-text)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm" style={{ color: "var(--color-text)" }}>
                {error || openError}
              </div>
            </div>
          )}

          {/* Loading State */}
          {filesLoading && (
            <div className="flex flex-col items-center justify-center py-24">
              <svg className="animate-spin w-10 h-10 mb-4" fill="none" viewBox="0 0 24 24" style={{ color: "var(--color-text)" }}>
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
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
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: "var(--color-text)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-4 text-center" style={{ color: "var(--color-text)" }}>
                Select a folder to get started
              </h2>
              <p className="text-sm mb-12 text-center max-w-sm leading-relaxed" style={{ color: "var(--color-text-light)" }}>
                Choose a Google Drive folder containing your Excel files to start analyzing
              </p>
              <button
                onClick={() => openFolderPicker(accessToken, handleFolderSelect)}
                className="text-sm font-semibold px-8 py-3 flex items-center gap-2 rounded-lg transition-all"
                style={{
                  backgroundColor: "var(--color-dark-serpent)",
                  color: "#FFFFFF",
                  border: "none",
                }}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                Select Google Drive Folder
              </button>
            </div>
          )}

          {/* File Grid */}
          {!filesLoading && folder && files.length > 0 && (
            <>
              <div className="mb-6 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-3">
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
                          backgroundColor: "var(--color-white)",
                          borderColor: "var(--color-border)",
                          color: "var(--color-text)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">

                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: "var(--color-white)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    >
                      <option value="all">All types</option>
                      <option value="xlsx">.xlsx</option>
                      <option value="xls">.xls</option>
                    </select>

                    <select
                      value={pageSize}
                      onChange={(e) => setPageSize(parseInt(e.target.value, 10))}
                      className="rounded-lg border px-3 py-2 text-sm"
                      style={{ backgroundColor: "var(--color-white)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
                    >
                      {[6, 12, 18].map((size) => (
                        <option key={size} value={size}>
                          Show {size}
                        </option>
                      ))}
                    </select>

                    <div className="flex items-center gap-1 rounded-lg border p-1" style={{ borderColor: "var(--color-border)", backgroundColor: "var(--color-white)" }}>
                      <button
                        onClick={() => setViewMode("cards")}
                        className="px-3 py-2 text-sm font-semibold rounded-md"
                        style={{
                          backgroundColor: viewMode === "cards" ? "var(--color-castleton-green)" : "transparent",
                          color: viewMode === "cards" ? "#FFFFFF" : "var(--color-text)",
                          border: "none",
                        }}
                      >
                        Cards
                      </button>
                      <button
                        onClick={() => setViewMode("table")}
                        className="px-3 py-2 text-sm font-semibold rounded-md"
                        style={{
                          backgroundColor: viewMode === "table" ? "var(--color-castleton-green)" : "transparent",
                          color: viewMode === "table" ? "#FFFFFF" : "var(--color-text)",
                          border: "none",
                        }}
                      >
                        Table
                      </button>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-sm" style={{ color: "var(--color-text-light)" }}>
                  <span>
                    {filteredFiles.length
                      ? `Showing ${startIndex + 1}-${endIndex} of ${filteredFiles.length} file${filteredFiles.length !== 1 ? "s" : ""}`
                      : "No files match your search or filters"}
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

              {filteredFiles.length === 0 && (
                <div className="rounded-2xl border p-6 text-center" style={{ borderColor: "var(--color-border)", color: "var(--color-text)" }}>
                  No files match your search or filters.
                </div>
              )}

              {filteredFiles.length > 0 && viewMode === "cards" && (
                <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
                  {paginatedFiles.map((file) => (
                    <FileCard
                      key={file.id}
                      file={file}
                      onOpen={handleOpenFile}
                      loading={openingFile === file.id}
                      tags={fileTagsById[file.id] || []}
                      isTagLoading={!fileTagsById[file.id]}
                    />
                  ))}
                </div>
              )}

              {filteredFiles.length > 0 && viewMode === "table" && (
                <FileTable
                  files={paginatedFiles}
                  fileTagsById={fileTagsById}
                  onOpen={handleOpenFile}
                  openingFile={openingFile}
                />
              )}
            </>
          )}

          {/* Empty Folder State */}
          {!filesLoading && folder && files.length === 0 && (
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
                onChangeFolder={() => openFolderPicker(accessToken, handleFolderSelect)}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
