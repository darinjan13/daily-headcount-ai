let currentWorkbookCache = null;

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
}) {
  if (!driveFileId || !arrayBuffer) {
    currentWorkbookCache = null;
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
