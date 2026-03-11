import { useState, useEffect, useCallback, useRef } from "react";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../firebase/firebaseConfig";

/**
 * usePins — persists pinned chart IDs + custom AI charts to Firestore
 * per user per file, with localStorage fallback.
 *
 * Firestore path: users/{userId}/pins/{fileId}
 */
export function usePins(userId, fileId) {
  const localKey = `pinned_${fileId || "default"}`;

  // Seed from localStorage immediately so pins show on first render
  const [pinnedIds, setPinnedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem(localKey) || "[]"); } catch { return []; }
  });
  const [customCharts, setCustomCharts] = useState(() => {
    try { return JSON.parse(localStorage.getItem(`${localKey}_charts`) || "[]"); } catch { return []; }
  });
  const [loading, setLoading] = useState(true);

  const pinnedRef = useRef(pinnedIds);
  const customRef = useRef(customCharts);
  pinnedRef.current = pinnedIds;
  customRef.current = customCharts;

  const docRef = userId && fileId
    ? doc(db, "users", userId, "pins", fileId)
    : null;

  // ── Load from Firestore, merge with localStorage ──────────────────────────
  useEffect(() => {
    if (!docRef) { setLoading(false); return; }

    getDoc(docRef)
      .then((snap) => {
        if (snap.exists()) {
          const d = snap.data();
          const ids = d.pinnedIds || [];
          const charts = d.customCharts || [];
          setPinnedIds(ids);
          setCustomCharts(charts);
          // Keep localStorage in sync
          try {
            localStorage.setItem(localKey, JSON.stringify(ids));
            localStorage.setItem(`${localKey}_charts`, JSON.stringify(charts));
          } catch {}
        }
      })
      .catch((err) => {
        console.warn("[usePins] Firestore load failed, using localStorage fallback:", err.message);
      })
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, fileId]);

  // ── Debounced save to both Firestore + localStorage ───────────────────────
  const saveTimer = useRef(null);
  const save = useCallback((nextPinned, nextCustom) => {
    // Save to localStorage immediately
    try {
      localStorage.setItem(localKey, JSON.stringify(nextPinned));
      localStorage.setItem(`${localKey}_charts`, JSON.stringify(nextCustom));
    } catch {}

    // Save to Firestore debounced
    if (!docRef) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(docRef, {
        pinnedIds: nextPinned,
        customCharts: nextCustom,
        updatedAt: serverTimestamp(),
      }).catch((err) => console.warn("[usePins] Firestore save failed:", err.message));
    }, 600);
  }, [docRef, localKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Public actions ────────────────────────────────────────────────────────
  const togglePin = useCallback((id) => {
    setPinnedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id];
      save(next, customRef.current);
      return next;
    });
  }, [save]);

  const isPinned = useCallback((id) => pinnedIds.includes(id), [pinnedIds]);

  const addCustomChart = useCallback((chart) => {
    // Strip non-serializable fields (computed pivot/chart data)
    // before saving to Firestore — these get recomputed from spec on load
    const serializable = {
      id: chart.id,
      type: chart.type,
      title: chart.title,
      xCol: chart.xCol || null,
      config: chart.config || null,
      // Save the spec so it can be rebuilt on reload
      spec: chart.spec || null,
    };

    setCustomCharts((prev) => {
      const next = [chart, ...prev]; // full chart with data for this session
      const nextSerializable = [serializable, ...prev.map(c => ({
        id: c.id, type: c.type, title: c.title,
        xCol: c.xCol || null, config: c.config || null, spec: c.spec || null,
      }))];
      setPinnedIds((prevPins) => {
        const nextPins = prevPins.includes(String(chart.id))
          ? prevPins
          : [...prevPins, String(chart.id)];
        save(nextPins, nextSerializable); // save only serializable data
        return nextPins;
      });
      return next;
    });
  }, [save]);

  const removeCustomChart = useCallback((id) => {
    setCustomCharts((prev) => {
      const next = prev.filter((c) => String(c.id) !== String(id));
      setPinnedIds((prevPins) => {
        const nextPins = prevPins.filter((p) => p !== String(id));
        save(nextPins, next);
        return nextPins;
      });
      return next;
    });
  }, [save]);

  return {
    pinnedIds,
    customCharts,
    loading,
    togglePin,
    isPinned,
    addCustomChart,
    removeCustomChart,
  };
}