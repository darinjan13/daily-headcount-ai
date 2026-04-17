let currentWorkbookCache = null;
const DEFAULT_MIN_WORKBOOK_CACHE_BYTES = 10 * 1024 * 1024;

function makeCacheSignature({ driveFileId, modifiedTime, version }) {
  if (!driveFileId) return "";
  return [driveFileId, modifiedTime || "", version || ""].join("::");
}

export function setCurrentWorkbookCache({
  driveFileId,
  fileName,
  modifiedTime,
  version,
  mimeType,
  arrayBuffer,
  minCacheBytes = DEFAULT_MIN_WORKBOOK_CACHE_BYTES,
}) {
  if (!driveFileId || !arrayBuffer) {
    currentWorkbookCache = null;
    return;
  }

  if (arrayBuffer.byteLength < minCacheBytes) {
    return;
  }

  currentWorkbookCache = {
    driveFileId,
    fileName: fileName || "",
    modifiedTime: modifiedTime || "",
    version: version || "",
    mimeType: mimeType || "",
    signature: makeCacheSignature({ driveFileId, modifiedTime, version }),
    // Keep an isolated in-memory copy so callers can safely build Blob/FormData.
    arrayBuffer: arrayBuffer.slice(0),
    cachedAt: Date.now(),
  };
}

export function getCurrentWorkbookCache({ driveFileId, modifiedTime, version }) {
  if (!currentWorkbookCache || currentWorkbookCache.driveFileId !== driveFileId) {
    return null;
  }

  if (!version && modifiedTime) {
    if (currentWorkbookCache.modifiedTime !== modifiedTime) return null;
    return {
      ...currentWorkbookCache,
      arrayBuffer: currentWorkbookCache.arrayBuffer.slice(0),
    };
  }

  const nextSignature = makeCacheSignature({ driveFileId, modifiedTime, version });
  if (nextSignature !== currentWorkbookCache.signature) {
    return null;
  }

  return {
    ...currentWorkbookCache,
    arrayBuffer: currentWorkbookCache.arrayBuffer.slice(0),
  };
}

export function clearCurrentWorkbookCache() {
  currentWorkbookCache = null;
}

export { DEFAULT_MIN_WORKBOOK_CACHE_BYTES };
