const DEFAULT_SHEET_KEY = "__default__";

function normalizePart(value, fallback = "") {
  return String(value ?? fallback).trim();
}

export function normalizeAnalysisSheetName(sheetName) {
  return normalizePart(sheetName, DEFAULT_SHEET_KEY) || DEFAULT_SHEET_KEY;
}

export function makeAnalysisRequestKey({ driveFileId, sheetName, modifiedTime }) {
  const fileId = normalizePart(driveFileId);
  const fileVersion = normalizePart(modifiedTime);
  if (!fileId || !fileVersion) return "";
  return [fileId, normalizeAnalysisSheetName(sheetName), fileVersion].join("::");
}

