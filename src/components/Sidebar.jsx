import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import { LIFEWOOD_DARK_LOGO_URL } from "../constants/branding";
import UserAvatar from "./UserAvatar";

export default function Sidebar({ folder, files, filesLoading, onSelectFolder, onRefresh, onBack }) {
  const { user, logout } = useAuth();
  const { theme } = useTheme();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);
  const lifewoodLogoSrc = theme === "dark" ? LIFEWOOD_DARK_LOGO_URL : lifewoodIconText;

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
    <div className="h-full flex flex-col px-6 py-6" style={{ color: "var(--color-text)" }}>
      {/* Top brand */}
      <div className="pb-6 border-b" style={{ borderColor: "var(--color-border)" }}>
        <img
          src={lifewoodLogoSrc}
          alt="Lifewood"
          className="h-8 w-32"
          style={{ objectFit: "contain" }}
        />
      </div>

      {/* Middle content */}
      <div className="pt-6 space-y-5">
        <p className="text-[11px] font-semibold tracking-wide uppercase mb-2" style={{ color: "var(--color-text)", marginBottom: "8px" }}>
          Actions
        </p>

        {onBack && (
          <button
            onClick={onBack}
            className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              color: "var(--color-text)",
              border: "1.5px solid var(--color-border)",
            }}
          >
            ← Go Back
          </button>
        )}

        {onSelectFolder && (
          <button
            onClick={onSelectFolder}
            className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all"
            style={{
              backgroundColor: "var(--color-saffron)",
              color: "#000000",
              border: "1.5px solid var(--color-saffron)",
            }}
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
              color: "#FFFFFF",
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
            Refresh
          </button>
        )}
      </div>

      <div className="flex-1" />

      {/* Bottom profile menu */}
      {user && (
        <div className="mt-auto relative pt-4 border-t" style={{ borderColor: "var(--color-border)" }} ref={profileMenuRef}>
          <button
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="w-full p-2.5 rounded-xl border flex items-center gap-3 text-left"
            style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)", color: "var(--color-text)" }}
          >
            <UserAvatar
              user={user}
              size={40}
              borderColor="var(--color-saffron)"
            />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>{user.displayName}</p>
              <p className="text-xs truncate" style={{ color: "var(--color-text-light)" }}>{user.email}</p>
            </div>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {isProfileMenuOpen && (
            <div
              className="absolute bottom-[calc(100%+8px)] left-0 w-full rounded-xl border shadow-md space-y-3"
              style={{ backgroundColor: "var(--color-surface-elevated)", borderColor: "var(--color-border)", zIndex: 20, padding: "12px" }}
            >
              <button
                onClick={() => {
                  setIsProfileMenuOpen(false);
                  logout();
                }}
                className="w-full text-left px-4 py-3 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors"
                style={{
                  color: "var(--color-text)",
                  backgroundColor: "var(--color-surface-soft)",
                  border: "1px solid var(--color-border)",
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
                </svg>
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
