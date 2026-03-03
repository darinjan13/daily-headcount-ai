import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useDrivePicker } from "../hooks/useDrivePicker";
import { useDriveFiles } from "../hooks/useDriveFiles";

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

function FileCard({ file, onOpen, loading }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all p-5 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="text-3xl shrink-0">📗</div>
        <div className="min-w-0">
          <div className="font-bold text-gray-800 text-sm leading-tight truncate" title={file.name}>
            {file.name}
          </div>
          <div className="text-xs text-gray-400 mt-1">{formatSize(parseInt(file.size))}</div>
        </div>
      </div>
      <div className="flex items-center gap-1.5 text-xs text-gray-400">
        <span>🕐</span>
        <span>Modified {formatDate(file.modifiedTime)}</span>
      </div>
      <button
        onClick={() => onOpen(file)}
        disabled={loading}
        className={`w-full py-2 rounded-lg text-sm font-bold transition-colors border-none ${
          loading
            ? "bg-gray-100 text-gray-400 cursor-not-allowed"
            : "bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
        }`}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
            </svg>
            Opening...
          </span>
        ) : "Open Dashboard →"}
      </button>
    </div>
  );
}

function EmptyState({ folderName, onChangeFolder }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="text-5xl mb-4">📂</div>
      <h3 className="text-lg font-bold text-gray-700 mb-2">No Excel files found</h3>
      <p className="text-gray-400 text-sm mb-1">
        No .xlsx or .xls files in{" "}
        <span className="font-semibold text-emerald-700">{folderName || "this folder"}</span>
      </p>
      <p className="text-gray-300 text-xs mb-6">Upload Excel files to this folder and refresh</p>
      <button
        onClick={onChangeFolder}
        className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer bg-white"
      >
        Choose different folder
      </button>
    </div>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, accessToken, loading: authLoading, login, logout } = useAuth();
  const { openFolderPicker } = useDrivePicker();
  const { files, loading: filesLoading, error, listFiles, downloadFile } = useDriveFiles();

  const [folder, setFolder] = useState(() => {
    const saved = localStorage.getItem("lastFolder");
    return saved ? JSON.parse(saved) : null;
  });
  const [openingFile, setOpeningFile] = useState(null);
  const [openError, setOpenError] = useState("");

  // Auto-load files when folder or token is available
  useEffect(() => {
    if (folder && accessToken) {
      listFiles(folder.id, accessToken);
    }
  }, [folder, accessToken]);

  const handleFolderSelect = (selectedFolder) => {
    setFolder(selectedFolder);
    localStorage.setItem("lastFolder", JSON.stringify(selectedFolder));
    listFiles(selectedFolder.id, accessToken);
  };

  const handleOpenFile = async (file) => {
    setOpeningFile(file.id);
    setOpenError("");

    try {
      // Step 1: Download xlsx bytes from Drive
      const arrayBuffer = await downloadFile(file.id, accessToken);
      const blob = new Blob([arrayBuffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Step 2: Single call to /analyze-bytes
      // Returns tableData + blueprint + allSheets + currentSheet in one shot
      const formData = new FormData();
      formData.append("file", blob, file.name);

      const res = await fetch(`${HOST}/analyze-bytes`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);
      const { tableData, blueprint, allSheets, currentSheet } = await res.json();

      // Step 3: Navigate to dashboard
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
          // Pass blob bytes as base64 for sheet switching
          // (avoids re-downloading from Drive on sheet switch)
          accessToken,
        },
      });
    } catch (err) {
      setOpenError(`Failed to open ${file.name}: ${err.message}`);
    }

    setOpeningFile(null);
  };

  // ── Auth loading ───────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <svg className="animate-spin w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
        </svg>
      </div>
    );
  }

  // ── Not logged in ──────────────────────────────────────────
  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-12 w-full max-w-md text-center">
          <div className="text-6xl mb-4">📊</div>
          <h1 className="text-2xl font-extrabold text-emerald-800 mb-2">Excel Dashboard</h1>
          <p className="text-gray-400 text-sm mb-8">
            Connect your Google Drive to visualize Excel files in real time
          </p>
          <button
            onClick={login}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-xl text-gray-700 font-bold text-sm hover:border-emerald-400 hover:bg-emerald-50 transition-all cursor-pointer shadow-sm"
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Sign in with Google
          </button>
          <p className="text-xs text-gray-300 mt-4">Read-only access to your Drive files</p>
        </div>
      </div>
    );
  }

  // ── Logged in ──────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top bar */}
      <div className="bg-emerald-800 shadow-lg sticky top-0 z-50">
        <div className="max-w-screen-xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">📊</span>
            <div>
              <div className="text-white font-extrabold text-sm">Excel Dashboard</div>
              <div className="text-emerald-300 text-xs">Google Drive connected</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {user.photoURL && (
              <img src={user.photoURL} alt={user.displayName}
                className="w-8 h-8 rounded-full border-2 border-emerald-600" />
            )}
            <div className="text-right hidden sm:block">
              <div className="text-white text-xs font-bold">{user.displayName}</div>
              <div className="text-emerald-300 text-xs">{user.email}</div>
            </div>
            <button onClick={logout}
              className="ml-2 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold transition-colors cursor-pointer border-none">
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-screen-xl mx-auto px-6 py-8">

        {/* Header + folder controls */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-extrabold text-gray-800">
              {folder ? folder.name : "No folder selected"}
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {folder
                ? `${files.length} Excel file${files.length !== 1 ? "s" : ""} found`
                : "Select a Google Drive folder to get started"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {folder && (
              <button
                onClick={() => listFiles(folder.id, accessToken)}
                disabled={filesLoading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:border-emerald-400 hover:text-emerald-700 transition-colors cursor-pointer bg-white disabled:opacity-50"
              >
                <span className={filesLoading ? "animate-spin inline-block" : ""}>🔄</span>
                Refresh
              </button>
            )}
            <button
              onClick={() => openFolderPicker(accessToken, handleFolderSelect)}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-sm font-bold transition-colors cursor-pointer border-none"
            >
              <span>📁</span>
              {folder ? "Change Folder" : "Select Folder"}
            </button>
          </div>
        </div>

        {/* Errors */}
        {(error || openError) && (
          <div className="mb-4 p-3 bg-red-50 border-l-4 border-red-500 rounded-lg text-sm text-red-700">
            ⚠️ {error || openError}
          </div>
        )}

        {/* Loading */}
        {filesLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <svg className="animate-spin w-8 h-8 text-emerald-700" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              <p className="text-gray-400 text-sm">Loading files from Drive...</p>
            </div>
          </div>
        )}

        {/* No folder selected */}
        {!folder && !filesLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="text-6xl mb-4">📁</div>
            <h3 className="text-lg font-bold text-gray-700 mb-2">Select a folder to get started</h3>
            <p className="text-gray-400 text-sm mb-6">
              Choose a Google Drive folder containing your Excel files
            </p>
            <button
              onClick={() => openFolderPicker(accessToken, handleFolderSelect)}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-sm font-bold transition-colors cursor-pointer border-none"
            >
              <span>📁</span>
              Select Google Drive Folder
            </button>
          </div>
        )}

        {/* File grid */}
        {!filesLoading && folder && files.length > 0 && (
          <div className="grid gap-4"
            style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
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

        {/* Empty state */}
        {!filesLoading && folder && files.length === 0 && (
          <EmptyState
            folderName={folder.name}
            onChangeFolder={() => openFolderPicker(accessToken, handleFolderSelect)}
          />
        )}

      </div>
    </div>
  );
}