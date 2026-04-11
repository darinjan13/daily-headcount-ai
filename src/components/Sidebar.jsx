import { useEffect, useRef, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import lifewoodIconText from "../assets/branding/lifewood-icon-text.png";
import { LIFEWOOD_DARK_LOGO_URL } from "../constants/branding";
import UserAvatar from "./UserAvatar";
import { ArrowLeft, Check, ChevronDown, FileSpreadsheet, LoaderCircle, LogOut, MoreVertical, Pencil, Pin, PinOff, Trash2, X } from "lucide-react";

function formatTabTime(timestamp) {
  if (!timestamp) return "Not opened yet";
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getTabLabel(tab) {
  if (tab.customLabel?.trim()) return tab.customLabel.trim();
  return tab.currentSheet ? `${tab.fileName} - ${tab.currentSheet}` : tab.fileName;
}

function groupTabs(tabs, isAdmin) {
  if (!isAdmin) return [{ key: "my-tabs", label: "My analyses", tabs }];

  const grouped = new Map();
  tabs.forEach((tab) => {
    const label = tab.sourceUserEmail || tab.sourceFolderName || "Admin workspace";
    if (!grouped.has(label)) grouped.set(label, []);
    grouped.get(label).push(tab);
  });

  return Array.from(grouped.entries()).map(([label, groupTabs]) => ({
    key: label,
    label,
    tabs: groupTabs,
  }));
}

export default function Sidebar({
  folder,
  filesLoading,
  onSelectFolder,
  onRefresh,
  onBack,
  analysisTabs = [],
  activeAnalysisTabId = null,
  onSelectAnalysisTab,
  onCloseAnalysisTab,
  onRenameAnalysisTab,
  onTogglePinAnalysisTab,
  onClearAnalysisTabs,
}) {
  const { user, logout, isAdmin } = useAuth();
  const { theme } = useTheme();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [openTabMenuId, setOpenTabMenuId] = useState(null);
  const [editingTabId, setEditingTabId] = useState(null);
  const [editingLabel, setEditingLabel] = useState("");
  const profileMenuRef = useRef(null);
  const lifewoodLogoSrc = theme === "dark" ? LIFEWOOD_DARK_LOGO_URL : lifewoodIconText;

  const startRenameTab = (tab, fallbackLabel) => {
    setOpenTabMenuId(null);
    setEditingTabId(tab.id);
    setEditingLabel(tab.customLabel?.trim() || fallbackLabel);
  };

  const commitRenameTab = (tab) => {
    onRenameAnalysisTab?.(tab.id, editingLabel);
    setEditingTabId(null);
    setEditingLabel("");
  };

  const cancelRenameTab = () => {
    setEditingTabId(null);
    setEditingLabel("");
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setIsProfileMenuOpen(false);
      }
      if (!event.target.closest?.("[data-tab-menu]")) {
        setOpenTabMenuId(null);
      }
    };

    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setIsProfileMenuOpen(false);
        setOpenTabMenuId(null);
        cancelRenameTab();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div className="h-full flex flex-col px-5 py-6" style={{ color: "var(--color-text)" }}>
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

      <div className="flex-1 min-h-0 pt-6">
        {analysisTabs.length > 0 && (
          <div className="h-full min-h-0 flex flex-col">
            <div className="flex items-end justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-[11px] font-bold tracking-wide uppercase" style={{ color: "var(--color-text)", margin: 0 }}>
                  Recent analyses
                </p>
                <p className="text-[10px] truncate" style={{ color: "var(--color-text-light)", margin: 0 }}>
                  Restored from workspace
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-bold" style={{ backgroundColor: "var(--color-surface-soft)", color: "var(--color-text)" }}>
                  {analysisTabs.length}
                </span>
                {analysisTabs.length > 0 && onClearAnalysisTabs && (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("Clear all saved analysis tabs for this workspace?")) {
                        onClearAnalysisTabs();
                      }
                    }}
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-full px-3"
                    style={{ color: "var(--color-text)", border: "1px solid var(--color-border)", backgroundColor: "var(--color-surface-elevated)", fontSize: 11, fontWeight: 800, boxShadow: "none", transform: "none" }}
                    title="Clear workspace"
                    aria-label="Clear workspace"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            <div className="space-y-2 overflow-y-auto pr-1.5">
              {groupTabs(analysisTabs, isAdmin).map((group) => (
                <div key={group.key} className="space-y-2">
                  {isAdmin && analysisTabs.length > 1 && (
                    <p className="px-1 pt-1 text-[10px] font-bold uppercase tracking-wide truncate" style={{ color: "var(--color-text-light)", margin: 0 }}>
                      {group.label}
                    </p>
                  )}
                  {group.tabs.map((tab) => {
                    const isActive = tab.id === activeAnalysisTabId;
                    const fullLabel = getTabLabel(tab);
                    const label = tab.customLabel?.trim() || tab.fileName || "Untitled workbook";
                    const openedLabel = `Last opened ${formatTabTime(tab.lastOpenedAtMs)}`;
                    return (
                      <div
                        key={tab.id}
                        className="group relative rounded-2xl border p-2.5 transition-colors"
                        style={{
                          backgroundColor: isActive ? "var(--color-castleton-green)" : "var(--color-surface-elevated)",
                          borderColor: tab.isStale ? "var(--color-saffron)" : isActive ? "var(--color-castleton-green)" : "var(--color-border)",
                          color: isActive ? "#FFFFFF" : "var(--color-text)",
                          boxShadow: "none",
                        }}
                        title={fullLabel}
                      >
                        <div className="flex items-start gap-2.5">
                          {editingTabId === tab.id ? (
                            <form
                              className="flex min-w-0 flex-1 items-start gap-2 rounded-xl p-1"
                              onSubmit={(event) => {
                                event.preventDefault();
                                commitRenameTab(tab);
                              }}
                            >
                              <span
                                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: isActive ? "rgba(255,255,255,0.13)" : "var(--color-surface-soft)" }}
                              >
                                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <input
                                  type="text"
                                  value={editingLabel}
                                  autoFocus
                                  onChange={(event) => setEditingLabel(event.target.value)}
                                  onKeyDown={(event) => {
                                    if (event.key === "Escape") {
                                      event.preventDefault();
                                      cancelRenameTab();
                                    }
                                  }}
                                  className="w-full rounded-lg border px-2 py-1 text-[12px] font-bold"
                                  style={{
                                    backgroundColor: isActive ? "rgba(255,255,255,0.14)" : "var(--color-surface)",
                                    borderColor: isActive ? "rgba(255,255,255,0.32)" : "var(--color-border)",
                                    color: "inherit",
                                    outline: "none",
                                  }}
                                  placeholder="Tab name"
                                />
                                <span className="mt-1 block truncate text-[10px] font-semibold leading-4" style={{ color: isActive ? "rgba(255,255,255,0.68)" : "var(--color-text-light)" }}>
                                  Enter to save, Esc to cancel
                                </span>
                              </span>
                              <span className="flex shrink-0 items-center gap-1 pt-0.5">
                                <button
                                  type="submit"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                                  style={{
                                    color: "inherit",
                                    backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "var(--color-surface-soft)",
                                    boxShadow: "none",
                                    transform: "none",
                                    padding: 0,
                                  }}
                                  title="Save name"
                                >
                                  <Check className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <button
                                  type="button"
                                  className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                                  style={{
                                    color: "inherit",
                                    backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "var(--color-surface-soft)",
                                    boxShadow: "none",
                                    transform: "none",
                                    padding: 0,
                                  }}
                                  onClick={cancelRenameTab}
                                  title="Cancel rename"
                                >
                                  <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </span>
                            </form>
                          ) : (
                            <button
                              type="button"
                              onClick={() => onSelectAnalysisTab?.(tab.id)}
                              onDoubleClick={(event) => {
                                event.stopPropagation();
                                startRenameTab(tab, label);
                              }}
                              className="flex min-w-0 flex-1 items-start gap-2 rounded-xl p-1 text-left"
                              style={{
                                backgroundColor: "transparent",
                                color: "inherit",
                                boxShadow: "none",
                                transform: "none",
                              }}
                              title="Open analysis. Double-click to rename."
                            >
                              <span
                                className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                                style={{ backgroundColor: isActive ? "rgba(255,255,255,0.13)" : "var(--color-surface-soft)" }}
                              >
                                <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-extrabold leading-5">{label}</span>
                                <span className="block truncate text-[10px] font-semibold leading-4" style={{ color: isActive ? "rgba(255,255,255,0.68)" : "var(--color-text-light)" }}>
                                  {openedLabel}
                                </span>
                              </span>
                            </button>
                          )}

                          {editingTabId !== tab.id && (
                          <span className="relative shrink-0 pt-1" data-tab-menu style={{ color: "inherit" }}>
                            <button
                              type="button"
                              aria-label={`Open options for ${fullLabel}`}
                              className="inline-flex h-7 w-7 items-center justify-center rounded-lg"
                              style={{
                                color: "inherit",
                                backgroundColor: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                                boxShadow: "none",
                                transform: "none",
                                padding: 0,
                              }}
                              onClick={(event) => {
                                event.stopPropagation();
                                setOpenTabMenuId((current) => current === tab.id ? null : tab.id);
                              }}
                              title="Tab options"
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>

                            {openTabMenuId === tab.id && (
                              <div
                                className="absolute right-0 top-9 z-30 w-40 overflow-hidden rounded-xl border py-1 shadow-lg"
                                style={{
                                  backgroundColor: "var(--color-surface-elevated)",
                                  borderColor: "var(--color-border)",
                                  color: "var(--color-text)",
                                }}
                              >
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold"
                                  style={{ backgroundColor: "transparent", color: "inherit", boxShadow: "none", transform: "none" }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    startRenameTab(tab, label);
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold"
                                  style={{ backgroundColor: "transparent", color: "inherit", boxShadow: "none", transform: "none" }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenTabMenuId(null);
                                    onTogglePinAnalysisTab?.(tab.id);
                                  }}
                                >
                                  {tab.pinned ? <PinOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Pin className="h-3.5 w-3.5" aria-hidden="true" />}
                                  {tab.pinned ? "Unpin" : "Pin"}
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-bold"
                                  style={{ backgroundColor: "transparent", color: "#B42318", boxShadow: "none", transform: "none" }}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenTabMenuId(null);
                                    onCloseAnalysisTab?.(tab.id);
                                  }}
                                >
                                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                                  Close
                                </button>
                              </div>
                            )}
                          </span>
                          )}
                        </div>

                          {tab.isStale && editingTabId !== tab.id && (
                          <div className="pl-10">
                            <span className="mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold" style={{ backgroundColor: "var(--color-saffron)", color: "#000" }}>
                              Updated in Drive
                            </span>
                          </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

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
              <div className="flex items-center gap-2 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: "var(--color-text)" }}>{user.displayName}</p>
                {isAdmin && (
                  <span
                    className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: "var(--color-saffron)", color: "#000" }}
                  >
                    Admin
                  </span>
                )}
              </div>
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
