import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDrivePicker } from "../hooks/useDrivePicker";
import { useDriveFiles } from "../hooks/useDriveFiles";
import Sidebar from "./Sidebar";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";

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
function FileCard({ file, onOpen, loading }) {
  return (
    <div
      className="rounded-2xl p-6 flex flex-col gap-4 transition-all hover:shadow-xl border"
      style={{
        backgroundColor: "var(--color-white)",
        borderColor: "rgba(19, 48, 32, 0.1)",
        backdropFilter: "blur(10px)",
      }}
    >
      {/* Icon and Header */}
      <div className="flex items-start gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: "rgba(19, 48, 32, 0.1)" }}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{ color: "var(--color-dark-serpent)" }}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h4
            className="font-semibold text-sm leading-tight truncate mb-2"
            title={file.name}
            style={{ color: "var(--color-dark-serpent)" }}
          >
            {file.name}
          </h4>
          <p className="text-xs" style={{ color: "var(--color-text-light)" }}>
            {formatSize(parseInt(file.size))}
          </p>
        </div>
      </div>

      {/* Metadata */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--color-text-light)" }}>
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
        className="w-full text-sm font-semibold py-3 flex items-center justify-center gap-2 rounded-lg transition-all"
        style={{
          backgroundColor: loading ? "rgba(19, 48, 32, 0.5)" : "var(--color-dark-serpent)",
          color: "var(--color-white)",
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

// Empty State Component
function EmptyState({ folderName, onChangeFolder }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div
        className="w-24 h-24 rounded-2xl flex items-center justify-center mb-8"
        style={{ backgroundColor: "rgba(19, 48, 32, 0.08)" }}
      >
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          style={{ color: "var(--color-dark-serpent)" }}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      </div>
      <h3 className="text-lg font-bold mb-3" style={{ color: "var(--color-dark-serpent)" }}>
        No Excel files found
      </h3>
      <p className="text-sm mb-3 max-w-sm" style={{ color: "var(--color-text-light)" }}>
        No .xlsx or .xls files in{" "}
        <span className="font-semibold" style={{ color: "var(--color-dark-serpent)" }}>
          {folderName || "this folder"}
        </span>
      </p>
      <p className="text-xs mb-12 max-w-sm" style={{ color: "var(--color-text-light)" }}>
        Upload Excel files to this folder and refresh to get started
      </p>
      <button
        onClick={onChangeFolder}
        className="text-sm font-semibold py-2.5 px-6 rounded-lg transition-all"
        style={{
          backgroundColor: "transparent",
          color: "var(--color-dark-serpent)",
          border: `2px solid var(--color-saffron)`,
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
  const { user, accessToken, loading: authLoading, login } = useAuth();
  const { openFolderPicker } = useDrivePicker();
  const { files, loading: filesLoading, error, listFiles, downloadFile } = useDriveFiles();

  const [folder, setFolder] = useState(() => {
    const saved = localStorage.getItem("lastFolder");
    return saved ? JSON.parse(saved) : null;
  });
  const [openingFile, setOpeningFile] = useState(null);
  const [openError, setOpenError] = useState("");

  useEffect(() => {
    if (folder && accessToken) {
      listFiles(folder.id, accessToken);
    }
  }, [folder, accessToken, listFiles]);

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
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--color-white)" }}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-10 h-10" fill="none" viewBox="0 0 24 24" style={{ color: "var(--color-dark-serpent)" }}>
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
      <div className="min-h-screen w-full flex flex-col items-center justify-center p-6" style={{ backgroundColor: "var(--color-white)" }}>
        <ScrollProgressBar />
        <img src={lifewoodIconText} alt="Lifewood" className="w-48 h-16 mb-2" />
        <div
          className="rounded-2xl w-full max-w-md border"
          style={{
            backgroundColor: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(19, 48, 32, 0.1)",
            padding: "48px 48px",
          }}
        >
          <h1 className="text-2xl font-bold mb-4 text-center" style={{ color: "var(--color-dark-serpent)" }}>
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
            className="w-full flex items-center justify-center gap-3 text-sm font-semibold py-3 rounded-lg transition-all mb-8"
            style={{
              backgroundColor: "var(--color-dark-serpent)",
              color: "var(--color-white)",
              border: "none",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Sign in with Google
          </button>
          <p className="text-xs text-center" style={{ color: "var(--color-text-light)" }}>
            Read-only access to your Google Drive files
          </p>
        </div>
      </div>
    );
  }

  // Main logged-in view
  return (
    <div style={{ backgroundColor: "var(--color-white)", minHeight: "100vh" }}>
      <ScrollProgressBar />

      <aside
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "320px",
          height: "100vh",
          zIndex: 50,
          background: "rgba(255, 255, 255, 0.98)",
          backdropFilter: "blur(10px)",
          borderRight: "1px solid rgba(19, 48, 32, 0.1)",
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
            background: "rgba(255, 255, 255, 0.95)",
            backdropFilter: "blur(10px)",
            borderColor: "rgba(19, 48, 32, 0.1)",
          }}
        >
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <div className="hidden md:block text-center">
              <p className="text-xs font-medium" style={{ color: "var(--color-text-light)" }}>
                {folder ? `Folder: ${folder.name}` : "No folder selected"}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <div className="text-xs font-semibold" style={{ color: "var(--color-dark-serpent)" }}>
                  {user.displayName}
                </div>
                <div className="text-xs" style={{ color: "var(--color-text-light)" }}>
                  {user.email}
                </div>
              </div>
              {user?.photoURL && (
                <img
                  src={user.photoURL}
                  alt={user.displayName}
                  className="w-8 h-8 rounded-full border-2"
                  style={{ borderColor: "var(--color-saffron)" }}
                />
              )}
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl mx-auto px-6 py-12 w-full">
          {/* Page Title */}
          {folder ? (
            <div className="mb-12">
              <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--color-dark-serpent)" }}>
                {folder.name}
              </h1>
              <p style={{ color: "var(--color-text-light)" }}>
                {files.length} file{files.length !== 1 ? "s" : ""} available for analysis
              </p>
            </div>
          ) : (
            <div className="mb-12">
              <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--color-dark-serpent)" }}>
                Welcome to DataViz
              </h1>
              <p style={{ color: "var(--color-text-light)" }}>
                Select a Google Drive folder to begin exploring your data
              </p>
            </div>
          )}

          {/* Error Alert */}
          {(error || openError) && (
            <div
              className="rounded-lg p-4 mb-8 flex gap-3 border"
              style={{
                backgroundColor: "rgba(255, 179, 71, 0.08)",
                borderColor: "rgba(255, 179, 71, 0.3)",
                borderLeft: `4px solid var(--color-saffron)`,
              }}
            >
              <svg
                className="w-5 h-5 flex-shrink-0 mt-0.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                style={{ color: "var(--color-dark-serpent)" }}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm" style={{ color: "var(--color-dark-serpent)" }}>
                {error || openError}
              </div>
            </div>
          )}

          {/* Loading State */}
          {filesLoading && (
            <div className="flex flex-col items-center justify-center py-24">
              <svg className="animate-spin w-10 h-10 mb-4" fill="none" viewBox="0 0 24 24" style={{ color: "var(--color-dark-serpent)" }}>
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
                style={{ backgroundColor: "rgba(19, 48, 32, 0.08)" }}
              >
                <svg
                  className="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  style={{ color: "var(--color-dark-serpent)" }}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-bold mb-4 text-center" style={{ color: "var(--color-dark-serpent)" }}>
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
                  color: "var(--color-white)",
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
            <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
              {files.map((file) => (
                <FileCard
                  key={file.id}
                  file={file}
                  onOpen={handleOpenFile}
                  loading={openingFile === file.id}
                />
              ))}
            </div>
          )}

          {/* Empty Folder State */}
          {!filesLoading && folder && files.length === 0 && (
            <EmptyState
              folderName={folder.name}
              onChangeFolder={() => openFolderPicker(accessToken, handleFolderSelect)}
            />
          )}
        </main>
      </div>
    </div>
  );
}
