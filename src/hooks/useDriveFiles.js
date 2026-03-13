import { useState, useCallback } from "react";

export function useDriveFiles() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const listFiles = useCallback(async (folderId, accessToken) => {
    if (!accessToken) {
      setError("No access token — please sign out and sign back in");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = encodeURIComponent(
        `'${folderId}' in parents and trashed = false and (` +
        `mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or ` +
        `mimeType = 'application/vnd.ms-excel' or ` +
        `mimeType = 'application/vnd.google-apps.spreadsheet')`
      );

      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files` +
        `?q=${query}` +
        `&fields=files(id,name,modifiedTime,size,iconLink,webViewLink,mimeType)` +
        `&orderBy=modifiedTime+desc` +
        `&includeItemsFromAllDrives=true` +
        `&supportsAllDrives=true`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      // Handle token expired
      if (res.status === 401) {
        sessionStorage.removeItem("driveAccessToken");
        setError("Session expired — please sign out and sign back in");
        setFiles([]);
        setLoading(false);
        return;
      }

      // Handle forbidden — usually means Drive API not enabled
      // or wrong scopes
      if (res.status === 403) {
        const body = await res.json();
        const reason = body?.error?.errors?.[0]?.reason || "unknown";
        if (reason === "accessNotConfigured") {
          setError("Google Drive API is not enabled. Go to Google Cloud Console → APIs & Services → Enable Google Drive API");
        } else if (reason === "insufficientPermissions") {
          setError("Missing Drive permissions — please sign out and sign back in to re-authorize");
        } else {
          setError(`Drive API forbidden (${reason}) — check Google Cloud Console`);
        }
        setFiles([]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Drive API error: ${res.status}`);
      }

      const data = await res.json();
      setFiles(data.files || []);
    } catch (err) {
      setError(err.message);
      setFiles([]);
    }

    setLoading(false);
  }, []);

  const downloadFile = useCallback(async (fileId, accessToken) => {
    if (!accessToken) throw new Error("No access token");

    // First get the mimeType so we know how to download
    const metaRes = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name&supportsAllDrives=true`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (metaRes.status === 401) throw new Error("Session expired — please sign back in");
    if (!metaRes.ok) throw new Error(`Failed to get file metadata: ${metaRes.status}`);
    const meta = await metaRes.json();

    const isGoogleSheet = meta.mimeType === "application/vnd.google-apps.spreadsheet";

    // Google Sheets → export as xlsx; regular files → download directly
    const downloadUrl = isGoogleSheet
      ? `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true`
      : `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (res.status === 401) throw new Error("Session expired — please sign back in");
    if (res.status === 403) throw new Error("Access denied — make sure you have at least Viewer access to this file");
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);

    return await res.arrayBuffer();
  }, []);

  const checkModified = useCallback(async (fileId, accessToken, lastKnownTime) => {
    if (!accessToken) return false;

    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=modifiedTime`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );

    if (!res.ok) return false;
    const data = await res.json();
    return data.modifiedTime !== lastKnownTime;
  }, []);

  return { files, loading, error, listFiles, downloadFile, checkModified };
}