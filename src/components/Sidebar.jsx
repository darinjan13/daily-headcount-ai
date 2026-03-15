import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import { LIFEWOOD_DARK_LOGO_URL } from "../constants/branding";
import UserAvatar from "./UserAvatar";
import { ArrowLeft, ChevronDown, LoaderCircle, LogOut } from "lucide-react";

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
            className="w-full text-sm font-semibold py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
            style={{
              backgroundColor: "var(--color-surface-soft)",
              color: "var(--color-text)",
              border: "1.5px solid var(--color-border)",
            }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Go Back
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
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
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
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
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
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
