import { useState, useEffect, useCallback, useRef } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * usePins — persists pinned IDs, custom charts, and filtered tables to Firestore
 * per user per file, with localStorage fallback.
 *
 * Firestore path: users/{userId}/pins/{fileId}
 * Shape: { pinnedIds, customCharts, filteredTables, updatedAt }
 */
export function usePins(userId, fileId) {
  const localKey = `pinned_${fileId || "default"}`;

  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(localKey) || "[]"); } catch { return []; }
  });
  const [customCharts, setCustomCharts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`${localKey}_charts`) || "[]"); } catch { return []; }
  });
  const [filteredTables, setFilteredTables] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`${localKey}_tables`) || "[]"); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);

  const pinnedRef = useRef(pinnedIds);
  const customRef = useRef(customCharts);
  const tablesRef = useRef(filteredTables);
  pinnedRef.current = pinnedIds;
  customRef.current = customCharts;
  tablesRef.current = filteredTables;

  const docRef = userId && fileId
    ? doc(db, "users", userId, "pins", fileId)
    : null;

  // ── Load from Firestore ───────────────────────────────────────────────────
  useEffect(() => {
    if (!docRef) { setLoading(false); return; }

    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const ids = d.pinnedIds || [];
          const charts = d.customCharts || [];
          const tables = d.filteredTables || [];
          setPinnedIds(ids);
          setCustomCharts(charts);
          setFilteredTables(tables);
          try {
            localStorage.setItem(localKey, JSON.stringify(ids));
            localStorage.setItem(`${localKey}_charts`, JSON.stringify(charts));
            localStorage.setItem(`${localKey}_tables`, JSON.stringify(tables));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn("[usePins] Firestore load failed, using localStorage fallback:", err.message);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fileId]);

  // ── Debounced save ────────────────────────────────────────────────────────
  const saveTimer = useRef(null);
  const save = useCallback((nextPinned, nextCustom, nextTables) => {
    const tables = nextTables !== undefined ? nextTables : tablesRef.current;
    try {
      localStorage.setItem(localKey, JSON.stringify(nextPinned));
      localStorage.setItem(`${localKey}_charts`, JSON.stringify(nextCustom));
      localStorage.setItem(`${localKey}_tables`, JSON.stringify(tables));
    } catch {}

    if (!docRef) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(docRef, {
        pinnedIds: nextPinned,
        customCharts: nextCustom,
        filteredTables: tables,
        updatedAt: serverTimestamp(),
      }).catch((err) => console.warn("[usePins] Firestore save failed:", err.message));
    }, 600);
  }, [docRef, localKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── pinnedIds ─────────────────────────────────────────────────────────────
  const togglePin = useCallback((id) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      save(next, customRef.current, tablesRef.current);
      return next;
    });
  }, [save]);

  const isPinned = useCallback((id) => pinnedIds.includes(id), [pinnedIds]);

  // ── customCharts ──────────────────────────────────────────────────────────
  const toSerializable = (chart) => ({
    id: chart.id,
    type: chart.type,
    title: chart.title,
    xCol: chart.xCol || null,
    config: chart.config || null,
    spec: chart.spec || null,
  });

  const addCustomChart = useCallback((chart) => {
    const serializable = toSerializable(chart);
    setCustomCharts((prev) => {
      const exists = prev.some(c => String(c.id) === String(chart.id));
      const next = exists
        ? prev.map(c => String(c.id) === String(chart.id) ? chart : c)
        : [chart, ...prev];
      const nextSerializable = exists
        ? prev.map(c => String(c.id) === String(chart.id) ? serializable : toSerializable(c))
        : [serializable, ...prev.map(toSerializable)];
      save(pinnedRef.current, nextSerializable, tablesRef.current);
      return next;
    });
  }, [save]);

  // Atomic: save chart + pin ID in one operation — no race condition
  const addAndPinChart = useCallback((chart) => {
    const serializable = toSerializable(chart);
    const chartId = String(chart.id);
    setCustomCharts((prev) => {
      const exists = prev.some(c => String(c.id) === chartId);
      const nextCharts = exists
        ? prev.map(c => String(c.id) === chartId ? chart : c)
        : [chart, ...prev];
      const nextSerializable = exists
        ? prev.map(c => String(c.id) === chartId ? serializable : toSerializable(c))
        : [serializable, ...prev.map(toSerializable)];
      setPinnedIds((prevPins) => {
        const nextPins = prevPins.includes(chartId) ? prevPins : [...prevPins, chartId];
        save(nextPins, nextSerializable, tablesRef.current);
        return nextPins;
      });
      return nextCharts;
    });
  }, [save]);

  const removeCustomChart = useCallback((id) => {
    setCustomCharts((prev) => {
      const next = prev.filter((c) => String(c.id) !== String(id));
      setPinnedIds((prevPins) => {
        const nextPins = prevPins.filter((p) => p !== String(id));
        save(nextPins, next, tablesRef.current);
        return nextPins;
      });
      return next;
    });
  }, [save]);

  const clearAllCustomCharts = useCallback(() => {
    setCustomCharts([]);
    setPinnedIds((prevPins) => {
      // Only keep pins for auto-charts (non-timestamp IDs like wide_line, chart_0, etc.)
      // Custom charts have numeric timestamp IDs — remove those
      const nextPins = prevPins.filter(id => isNaN(Number(id)));
      save(nextPins, [], tablesRef.current);
      return nextPins;
    });
  }, [save]);

  const renameCustomChart = useCallback((id, newTitle) => {
    setCustomCharts((prev) => {
      const next = prev.map(c =>
        String(c.id) !== String(id) ? c
          : { ...c, title: newTitle, spec: c.spec ? { ...c.spec, title: newTitle } : c.spec }
      );
      save(pinnedRef.current, next, tablesRef.current);
      return next;
    });
  }, [save]);

  // ── filteredTables ────────────────────────────────────────────────────────
  const addFilteredTable = useCallback((table) => {
    setFilteredTables((prev) => {
      const exists = prev.some(t => String(t.id) === String(table.id));
      const next = exists ? prev : [table, ...prev];
      save(pinnedRef.current, customRef.current, next);
      return next;
    });
  }, [save]);

  const removeFilteredTable = useCallback((id) => {
    setFilteredTables((prev) => {
      const next = prev.filter((t) => String(t.id) !== String(id));
      setPinnedIds((prevPins) => {
        const nextPins = prevPins.filter((p) => p !== String(id));
        save(nextPins, customRef.current, next);
        return nextPins;
      });
      return next;
    });
  }, [save]);

  const renameFilteredTable = useCallback((id, newTitle) => {
    setFilteredTables((prev) => {
      const next = prev.map(t => String(t.id) === String(id) ? { ...t, title: newTitle } : t);
      save(pinnedRef.current, customRef.current, next);
      return next;
    });
  }, [save]);

  // Atomic: save table + pin ID in one operation
  const addAndPinTable = useCallback((table) => {
    const tableId = String(table.id);
    setFilteredTables((prev) => {
      const exists = prev.some(t => String(t.id) === tableId);
      const next = exists ? prev : [table, ...prev];
      setPinnedIds((prevPins) => {
        const nextPins = prevPins.includes(tableId) ? prevPins : [...prevPins, tableId];
        save(nextPins, customRef.current, next);
        return nextPins;
      });
      return next;
    });
  }, [save]);

  const updateFilteredTable = useCallback((table) => {
    setFilteredTables((prev) => {
      const next = prev.map(t => String(t.id) === String(table.id) ? table : t);
      save(pinnedRef.current, customRef.current, next);
      return next;
    });
  }, [save]);

  const clearAllFilteredTables = useCallback(() => {
    setFilteredTables([]);
    setPinnedIds((prevPins) => {
      const tableIds = new Set(tablesRef.current.map(t => String(t.id)));
      const nextPins = prevPins.filter(id => !tableIds.has(id));
      save(nextPins, customRef.current, []);
      return nextPins;
    });
  }, [save]);

  return {
    pinnedIds,
    customCharts,
    filteredTables,
    loading,
    togglePin,
    isPinned,
    addCustomChart,
    addAndPinChart,
    removeCustomChart,
    clearAllCustomCharts,
    renameCustomChart,
    addFilteredTable,
    removeFilteredTable,
    updateFilteredTable,
    renameFilteredTable,
    addAndPinTable,
    clearAllFilteredTables,
  };
}