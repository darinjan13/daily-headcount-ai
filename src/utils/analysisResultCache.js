const DEFAULT_SHEET_CACHE_KEY = "__default__";

let analysisResultCache = new Map();

function normalizeSheetCacheKey(sheetName) {
  return String(sheetName || DEFAULT_SHEET_CACHE_KEY).trim() || DEFAULT_SHEET_CACHE_KEY;
}

function makeAnalysisResultCacheKey({ driveFileId, sheetName, modifiedTime }) {
  if (!driveFileId || !modifiedTime) return "";
  return [driveFileId, normalizeSheetCacheKey(sheetName), modifiedTime].join("::");
}

function cloneValue(value) {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
}

export function setAnalysisResultCache(payload, options = {}) {
  const driveFileId = payload?.driveFileId;
  const currentSheet = payload?.currentSheet;
  const modifiedTime = payload?.driveModifiedTime || options.modifiedTime;

  if (!driveFileId || !currentSheet || !modifiedTime || !payload?.tableData || !payload?.blueprint) {
    return;
  }

  const nextPayload = cloneValue({
    ...payload,
    driveModifiedTime: modifiedTime,
  });

  const keys = new Set([
    makeAnalysisResultCacheKey({ driveFileId, sheetName: currentSheet, modifiedTime }),
  ]);

  if (options.requestedSheetName !== undefined && options.requestedSheetName !== null) {
    keys.add(
      makeAnalysisResultCacheKey({
        driveFileId,
        sheetName: options.requestedSheetName || DEFAULT_SHEET_CACHE_KEY,
        modifiedTime,
      })
    );
  }

  keys.forEach((key) => {
    if (!key) return;
    analysisResultCache.set(key, {
      payload: nextPayload,
      cachedAt: Date.now(),
    });
  });
}

export function getAnalysisResultCache({ driveFileId, sheetName, modifiedTime, allowDefaultAlias = false }) {
  const exactKey = makeAnalysisResultCacheKey({ driveFileId, sheetName, modifiedTime });
  const exactHit = exactKey ? analysisResultCache.get(exactKey) : null;
  if (exactHit?.payload) {
    return cloneValue(exactHit.payload);
  }

  if (!allowDefaultAlias) return null;

  const defaultKey = makeAnalysisResultCacheKey({
    driveFileId,
    sheetName: DEFAULT_SHEET_CACHE_KEY,
    modifiedTime,
  });
  const defaultHit = defaultKey ? analysisResultCache.get(defaultKey) : null;
  if (!defaultHit?.payload) return null;
  return cloneValue(defaultHit.payload);
}

export function clearAnalysisResultCache() {
  analysisResultCache = new Map();
}

export { DEFAULT_SHEET_CACHE_KEY };
