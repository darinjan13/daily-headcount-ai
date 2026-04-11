import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";
import { useAuth } from "./AuthContext";

const AnalysisTabsContext = createContext(null);

function makeTabId(payload) {
  const fileKey = payload?.driveFileId || payload?.fileName || "analysis";
  const sheetKey = payload?.currentSheet || "default";
  return `${fileKey}::${sheetKey}`;
}

function getTabDocId(tabId) {
  return encodeURIComponent(tabId);
}

function toPersistedTab(tab) {
  return {
    id: tab.id,
    driveFileId: tab.driveFileId || null,
    fileName: tab.fileName || "",
    currentSheet: tab.currentSheet || "",
    allSheets: Array.isArray(tab.allSheets) ? tab.allSheets : [],
    driveModifiedTime: tab.driveModifiedTime || null,
    folderId: tab.folderId || null,
    customLabel: tab.customLabel || "",
    pinned: Boolean(tab.pinned),
    lastOpenedAtMs: tab.lastOpenedAtMs || null,
    sourceUserEmail: tab.sourceUserEmail || "",
    sourceFolderName: tab.sourceFolderName || "",
  };
}

function normalizeSavedTab(data) {
  if (!data?.id || !data?.driveFileId || !data?.fileName) return null;
  return {
    ...toPersistedTab(data),
    isHydrated: false,
    isStale: false,
    latestDriveModifiedTime: data.driveModifiedTime || null,
  };
}

export function AnalysisTabsProvider({ children }) {
  const { user, accessToken } = useAuth();
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null);
  const [tabsLoaded, setTabsLoaded] = useState(false);
  const [staleCheckedKey, setStaleCheckedKey] = useState("");

  const getUserTabsCollection = useCallback(() => {
    if (!user?.uid) return null;
    return collection(db, "users", user.uid, "analysisTabs");
  }, [user?.uid]);

  const saveTabMetadata = useCallback(async (tab) => {
    if (!user?.uid || !tab?.id || !tab?.driveFileId) return;
    try {
      const tabRef = doc(db, "users", user.uid, "analysisTabs", getTabDocId(tab.id));
      await setDoc(tabRef, {
        ...toPersistedTab(tab),
        updatedAt: serverTimestamp(),
        createdAt: tab.createdAt || serverTimestamp(),
      }, { merge: true });
    } catch (error) {
      console.warn("[analysis-tabs] Failed to save tab metadata:", error.message);
    }
  }, [user?.uid]);

  const deleteTabMetadata = useCallback(async (id) => {
    if (!user?.uid || !id) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "analysisTabs", getTabDocId(id)));
    } catch (error) {
      console.warn("[analysis-tabs] Failed to delete tab metadata:", error.message);
    }
  }, [user?.uid]);

  useEffect(() => {
    let cancelled = false;

    if (!user?.uid) {
      setTabs([]);
      setActiveTabId(null);
      setTabsLoaded(false);
      return;
    }

    const loadSavedTabs = async () => {
      setTabsLoaded(false);
      try {
        const tabsCollection = getUserTabsCollection();
        if (!tabsCollection) return;
        const snapshot = await getDocs(tabsCollection);
        if (cancelled) return;

        const savedTabs = snapshot.docs
          .map((tabDoc) => normalizeSavedTab(tabDoc.data()))
          .filter(Boolean);

        setTabs((currentTabs) => {
          const currentById = new Map(currentTabs.map((tab) => [tab.id, tab]));
          savedTabs.forEach((savedTab) => {
            const currentTab = currentById.get(savedTab.id);
            currentById.set(savedTab.id, currentTab ? { ...savedTab, ...currentTab } : savedTab);
          });
          return Array.from(currentById.values());
        });
      } catch (error) {
        console.warn("[analysis-tabs] Failed to load saved tabs:", error.message);
      } finally {
        if (!cancelled) setTabsLoaded(true);
      }
    };

    loadSavedTabs();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, getUserTabsCollection]);

  useEffect(() => {
    if (!accessToken || !tabsLoaded || tabs.length === 0) return;

    const checkableTabs = tabs
      .filter((tab) => tab.driveFileId && tab.driveModifiedTime)
      .slice(0, 25);
    const nextKey = checkableTabs
      .map((tab) => `${tab.id}:${tab.driveModifiedTime}`)
      .join("|");

    if (!nextKey || nextKey === staleCheckedKey) return;

    let cancelled = false;
    setStaleCheckedKey(nextKey);

    const checkStaleTabs = async () => {
      await Promise.allSettled(checkableTabs.map(async (tab) => {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${tab.driveFileId}?fields=modifiedTime&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (!res.ok) return;
        const meta = await res.json();
        if (cancelled || !meta.modifiedTime) return;

        setTabs((currentTabs) => currentTabs.map((currentTab) => (
          currentTab.id === tab.id
            ? {
              ...currentTab,
              latestDriveModifiedTime: meta.modifiedTime,
              isStale: Boolean(currentTab.driveModifiedTime && meta.modifiedTime !== currentTab.driveModifiedTime),
            }
            : currentTab
        )));
      }));
    };

    checkStaleTabs();
    return () => {
      cancelled = true;
    };
  }, [accessToken, tabsLoaded, tabs, staleCheckedKey]);

  const openAnalysisTab = useCallback((payload) => {
    const id = makeTabId(payload);
    const now = Date.now();
    const nextTab = {
      ...payload,
      id,
      isHydrated: Boolean(payload?.tableData && payload?.blueprint),
      lastOpenedAtMs: now,
      latestDriveModifiedTime: payload?.driveModifiedTime || null,
      isStale: false,
    };

    setTabs((currentTabs) => {
      const existingIndex = currentTabs.findIndex((tab) => tab.id === id);
      if (existingIndex === -1) return [...currentTabs, nextTab];

      return currentTabs.map((tab, index) => (
        index === existingIndex ? { ...tab, ...nextTab } : tab
      ));
    });
    setActiveTabId(id);
    void saveTabMetadata(nextTab);
    return id;
  }, [saveTabMetadata]);

  const updateAnalysisTab = useCallback((id, patch) => {
    setTabs((currentTabs) => currentTabs.map((tab) => (
      tab.id === id
        ? (() => {
          const nextTab = {
            ...tab,
            ...patch,
            isHydrated: Boolean((patch.tableData ?? tab.tableData) && (patch.blueprint ?? tab.blueprint)),
            latestDriveModifiedTime: patch.latestDriveModifiedTime ?? patch.driveModifiedTime ?? tab.latestDriveModifiedTime ?? tab.driveModifiedTime ?? null,
            isStale: patch.isStale ?? tab.isStale ?? false,
          };
          void saveTabMetadata(nextTab);
          return nextTab;
        })()
        : tab
    )));
  }, [saveTabMetadata]);

  const touchAnalysisTab = useCallback((id) => {
    if (!id) return;
    const lastOpenedAtMs = Date.now();
    setTabs((currentTabs) => currentTabs.map((tab) => {
      if (tab.id !== id) return tab;
      const nextTab = { ...tab, lastOpenedAtMs };
      void saveTabMetadata(nextTab);
      return nextTab;
    }));
  }, [saveTabMetadata]);

  const renameAnalysisTab = useCallback((id, customLabel) => {
    const nextLabel = customLabel.trim();
    setTabs((currentTabs) => currentTabs.map((tab) => {
      if (tab.id !== id) return tab;
      const nextTab = { ...tab, customLabel: nextLabel };
      void saveTabMetadata(nextTab);
      return nextTab;
    }));
  }, [saveTabMetadata]);

  const togglePinAnalysisTab = useCallback((id) => {
    setTabs((currentTabs) => currentTabs.map((tab) => {
      if (tab.id !== id) return tab;
      const nextTab = { ...tab, pinned: !tab.pinned };
      void saveTabMetadata(nextTab);
      return nextTab;
    }));
  }, [saveTabMetadata]);

  const clearAnalysisTabs = useCallback(() => {
    const ids = tabs.map((tab) => tab.id);
    setTabs([]);
    setActiveTabId(null);
    ids.forEach((id) => {
      void deleteTabMetadata(id);
    });
  }, [tabs, deleteTabMetadata]);

  const closeAnalysisTab = useCallback((id) => {
    setTabs((currentTabs) => {
      const closingIndex = currentTabs.findIndex((tab) => tab.id === id);
      const nextTabs = currentTabs.filter((tab) => tab.id !== id);
      const nextActiveId = nextTabs.length
        ? nextTabs[Math.min(Math.max(closingIndex, 0), nextTabs.length - 1)].id
        : null;

      setActiveTabId((currentActiveId) => {
        if (currentActiveId !== id) return currentActiveId;
        return nextActiveId;
      });

      return nextTabs;
    });
    void deleteTabMetadata(id);
  }, [deleteTabMetadata]);

  const activeTab = useMemo(
    () => tabs.find((tab) => tab.id === activeTabId) || null,
    [tabs, activeTabId]
  );

  const sortedTabs = useMemo(() => (
    [...tabs].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
      return (b.lastOpenedAtMs || 0) - (a.lastOpenedAtMs || 0);
    })
  ), [tabs]);

  const value = useMemo(() => ({
    tabs: sortedTabs,
    activeTab,
    activeTabId,
    tabsLoaded,
    setActiveTabId,
    openAnalysisTab,
    updateAnalysisTab,
    closeAnalysisTab,
    touchAnalysisTab,
    renameAnalysisTab,
    togglePinAnalysisTab,
    clearAnalysisTabs,
  }), [
    sortedTabs,
    activeTab,
    activeTabId,
    tabsLoaded,
    openAnalysisTab,
    updateAnalysisTab,
    closeAnalysisTab,
    touchAnalysisTab,
    renameAnalysisTab,
    togglePinAnalysisTab,
    clearAnalysisTabs,
  ]);

  return (
    <AnalysisTabsContext.Provider value={value}>
      {children}
    </AnalysisTabsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAnalysisTabs() {
  const context = useContext(AnalysisTabsContext);
  if (!context) throw new Error("useAnalysisTabs must be used inside AnalysisTabsProvider");
  return context;
}
