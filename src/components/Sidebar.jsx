import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";

export default function Sidebar({ folder, files, filesLoading, onSelectFolder, onRefresh }) {
  const { user, logout } = useAuth();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") setIsProfileMenuOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="h-full flex flex-col px-6 py-6" style={{ color: "#000000" }}>
      {/* Top brand */}
      <div className="pb-6 border-b" style={{ borderColor: "rgba(19, 48, 32, 0.08)" }}>
        <img src={lifewoodIconText} alt="Lifewood" className="h-8 w-32" />
      </div>

      {/* Middle content */}
      <div className="pt-6 space-y-5">
        <section>
          <p className="text-[11px] font-semibold tracking-wide uppercase mb-2" style={{ color: "#000000", marginBottom: "8px" }}>
            Folder
          </p>
          <div
            className="rounded-xl border p-3"
            style={{
              backgroundColor: "rgba(4, 98, 65, 0.04)",
              borderColor: "rgba(4, 98, 65, 0.12)",
            }}
          >
            <p className="text-sm font-semibold truncate" style={{ color: "#000000" }}>
              {folder ? ".../" + folder.name : "No folder selected"}
            </p>
            <p className="text-xs mt-1" style={{ color: "#000000" }}>
              {folder && files ? `${files.length || 0} file${files.length !== 1 ? "s" : ""} available` : "Select a folder to begin"}
            </p>
          </div>
        </section>

          <p className="text-[11px] font-semibold tracking-wide uppercase mb-2" style={{ color: "#000000", marginBottom: "8px" }}>
              ACTIONS
          </p>

        {onSelectFolder && (
          <button
            onClick={onSelectFolder}
            className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all"
            style={{ backgroundColor: "var(--color-saffron)", color: "#000000", border: "none" }}
          >
            {folder ? "Change folder" : "Select folder"}
          </button>
        )}

        {folder && onRefresh && (
          <button
            onClick={onRefresh}
            disabled={filesLoading}
            className="w-full text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all"
            style={{
              backgroundColor: "var(--color-castleton-green)",
              color: "var(--color-white)",
              border: "none",
              opacity: filesLoading ? 0.6 : 1,
            }}
          >
            {filesLoading && (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
            )}
            Refresh files
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Bottom profile menu */}
      {user && (
        <div className="mt-auto relative pt-4 border-t" style={{ borderColor: "rgba(19, 48, 32, 0.08)" }} ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="w-full p-2.5 rounded-xl border flex items-center gap-3 text-left"
            style={{ backgroundColor: "var(--color-white)", borderColor: "rgba(19, 48, 32, 0.14)", color: "#000000" }}
          >
            {user.photoURL && (
              <img
                src={user.photoURL}
                alt={user.displayName}
                className="w-10 h-10 rounded-full border-2"
                style={{ borderColor: "var(--color-saffron)" }}
              />
            )}
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate" style={{ color: "#000000" }}>{user.displayName}</p>
              <p className="text-xs truncate" style={{ color: "#000000" }}>{user.email}</p>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isProfileMenuOpen && (
            <div
              className="absolute bottom-[calc(100%+8px)] left-0 w-full rounded-xl border shadow-md"
              style={{ backgroundColor: "var(--color-white)", borderColor: "rgba(19, 48, 32, 0.14)", zIndex: 20 }}
            >
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-2.5 text-sm font-semibold rounded-xl"
                style={{ color: "#000000", backgroundColor: "transparent", border: "none" }}
              >
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
