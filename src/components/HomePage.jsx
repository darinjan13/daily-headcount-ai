import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDrivePicker } from "../hooks/useDrivePicker";
import { useDriveFiles } from "../hooks/useDriveFiles";
import Sidebar from "./Sidebar";
import Grainient from "./Grainient";
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
            style={{ color: "var(--color-dark-serpent)", marginBottom: "4px" }}
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
          <img src={lifewoodIconText} alt="Lifewood" className="w-48 h-16 mb-2" />
          <div
            className="login-glass-card rounded-2xl w-full max-w-md border"
            style={{
              backdropFilter: "blur(8px)",
              borderColor: "rgba(19, 48, 32, 0.16)",
              boxShadow: "0 22px 48px rgba(19, 48, 32, 0.14)",
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
              <h1 className="text-3xl font-bold mb-4" style={{ color: "var(--color-dark-serpent)", marginBottom: "4px" }}>
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
