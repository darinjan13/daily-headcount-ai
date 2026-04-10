import { useState, useCallback } from "react";

const DRIVE_API_ROOT = "https://www.googleapis.com/drive/v3/files";
const DRIVE_UPLOAD_ROOT = "https://www.googleapis.com/upload/drive/v3/files";

function escapeDriveQueryValue(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function ensureOk(res, fallbackMessage) {
  if (!res.ok) throw new Error(fallbackMessage || `Drive API error: ${res.status}`);
}

async function fetchJson(url, accessToken, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
}

export function useDriveFiles() {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const listFolderContents = useCallback(async (folderId, accessToken) => {
    if (!accessToken) {
      setError("No access token - please sign out and sign back in");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const query = encodeURIComponent(
        `'${folderId}' in parents and trashed = false and (` +
        `mimeType = 'application/vnd.google-apps.folder' or ` +
        `mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' or ` +
        `mimeType = 'application/vnd.ms-excel' or ` +
        `mimeType = 'application/vnd.google-apps.spreadsheet')`
      );

      const res = await fetch(
        `${DRIVE_API_ROOT}` +
        `?q=${query}` +
        `&fields=files(id,name,parents,modifiedTime,size,iconLink,webViewLink,mimeType)` +
        `&orderBy=folder,name,modifiedTime desc` +
        `&includeItemsFromAllDrives=true` +
        `&supportsAllDrives=true`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );

      if (res.status === 401) {
        sessionStorage.removeItem("driveAccessToken");
        setError("Session expired - please sign out and sign back in");
        setFiles([]);
        setFolders([]);
        setLoading(false);
        return;
      }

      if (res.status === 403) {
        const body = await res.json();
        const reason = body?.error?.errors?.[0]?.reason || "unknown";
        if (reason === "accessNotConfigured") {
          setError("Google Drive API is not enabled. Go to Google Cloud Console -> APIs & Services -> Enable Google Drive API");
        } else if (reason === "insufficientPermissions") {
          setError("Missing Drive permissions - please sign out and sign back in to re-authorize");
        } else {
          setError(`Drive API forbidden (${reason}) - check Google Cloud Console`);
        }
        setFiles([]);
        setFolders([]);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        throw new Error(`Drive API error: ${res.status}`);
      }

      const data = await res.json();
      const allItems = data.files || [];
      setFolders(
        allItems
          .filter((item) => item.mimeType === "application/vnd.google-apps.folder")
          .sort((a, b) => a.name.localeCompare(b.name))
      );
      setFiles(
        allItems
          .filter((item) => item.mimeType !== "application/vnd.google-apps.folder")
          .sort((a, b) => new Date(b.modifiedTime || 0) - new Date(a.modifiedTime || 0))
      );
    } catch (err) {
      setError(err.message);
      setFiles([]);
      setFolders([]);
    }

    setLoading(false);
  }, []);

  const listFiles = useCallback(async (folderId, accessToken) => {
    await listFolderContents(folderId, accessToken);
  }, [listFolderContents]);

  const getFolderMeta = useCallback(async (folderId, accessToken) => {
    if (!accessToken) throw new Error("No access token");
    const res = await fetchJson(
      `${DRIVE_API_ROOT}/${folderId}?fields=id,name,parents,mimeType&supportsAllDrives=true`,
      accessToken
    );
    if (res.status === 401) throw new Error("Session expired - please sign back in");
    ensureOk(res, `Failed to load folder metadata: ${res.status}`);
    const data = await res.json();
    if (data.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("Configured admin root is not a folder");
    }
    return data;
  }, []);

  const downloadFile = useCallback(async (fileId, accessToken) => {
    if (!accessToken) throw new Error("No access token");

    const metaRes = await fetchJson(
      `${DRIVE_API_ROOT}/${fileId}?fields=id,mimeType,name,modifiedTime&supportsAllDrives=true`,
      accessToken
    );
    if (metaRes.status === 401) throw new Error("Session expired - please sign back in");
    if (!metaRes.ok) throw new Error(`Failed to get file metadata: ${metaRes.status}`);
    const meta = await metaRes.json();

    const isGoogleSheet = meta.mimeType === "application/vnd.google-apps.spreadsheet";
    const downloadUrl = isGoogleSheet
      ? `${DRIVE_API_ROOT}/${fileId}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet&supportsAllDrives=true`
      : `${DRIVE_API_ROOT}/${fileId}?alt=media&supportsAllDrives=true`;

    const res = await fetch(downloadUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 401) throw new Error("Session expired - please sign back in");
    if (res.status === 403) throw new Error("Access denied - make sure you have at least Viewer access to this file");
    if (!res.ok) throw new Error(`Failed to download file: ${res.status}`);

    return {
      arrayBuffer: await res.arrayBuffer(),
      meta,
    };
  }, []);

  const findChildFolderByName = useCallback(async (parentFolderId, folderName, accessToken) => {
    const query = encodeURIComponent(
      `'${parentFolderId}' in parents and trashed = false and mimeType = 'application/vnd.google-apps.folder' and name = '${escapeDriveQueryValue(folderName)}'`
    );
    const res = await fetchJson(
      `${DRIVE_API_ROOT}?q=${query}&fields=files(id,name,parents)&pageSize=10&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      accessToken
    );
    ensureOk(res, `Failed to find folder: ${res.status}`);
    const data = await res.json();
    return data.files?.[0] || null;
  }, []);

  const createFolder = useCallback(async (folderName, parentFolderId, accessToken) => {
    const metadata = {
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentFolderId],
    };
    const res = await fetchJson(
      `${DRIVE_API_ROOT}?supportsAllDrives=true`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(metadata),
      }
    );
    ensureOk(res, `Failed to create folder: ${res.status}`);
    return await res.json();
  }, []);

  const ensureFolder = useCallback(async (parentFolderId, folderName, accessToken) => {
    const existing = await findChildFolderByName(parentFolderId, folderName, accessToken);
    if (existing) return existing;
    return await createFolder(folderName, parentFolderId, accessToken);
  }, [createFolder, findChildFolderByName]);

  const upsertAdminWorkbookCopy = useCallback(async ({
    accessToken,
    adminRootFolderId,
    userEmail,
    fileName,
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    arrayBuffer,
  }) => {
    if (!adminRootFolderId || !userEmail || !arrayBuffer) return;

    const userFolder = await ensureFolder(
      adminRootFolderId,
      userEmail.trim().toLowerCase(),
      accessToken
    );

    const query = encodeURIComponent(
      `'${userFolder.id}' in parents and trashed = false and name = '${escapeDriveQueryValue(fileName)}'`
    );
    const findRes = await fetchJson(
      `${DRIVE_API_ROOT}?q=${query}&fields=files(id,name)&pageSize=20&includeItemsFromAllDrives=true&supportsAllDrives=true`,
      accessToken
    );
    ensureOk(findRes, `Failed to query existing admin copies: ${findRes.status}`);
    const existingFiles = (await findRes.json()).files || [];

    const metadata = {
      name: fileName,
      parents: [userFolder.id],
    };
    const boundary = `drive-boundary-${Date.now()}`;
    const multipartBody = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`,
      new Uint8Array(arrayBuffer),
      `\r\n--${boundary}--`,
    ]);

    if (existingFiles.length > 0) {
      const [primary, ...duplicates] = existingFiles;
      const updateRes = await fetchJson(
        `${DRIVE_UPLOAD_ROOT}/${primary.id}?uploadType=multipart&supportsAllDrives=true`,
        accessToken,
        {
          method: "PATCH",
          headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
          body: multipartBody,
        }
      );
      ensureOk(updateRes, `Failed to update admin copy: ${updateRes.status}`);

      await Promise.all(
        duplicates.map(async (duplicate) => {
          const deleteRes = await fetchJson(
            `${DRIVE_API_ROOT}/${duplicate.id}?supportsAllDrives=true`,
            accessToken,
            { method: "DELETE" }
          );
          ensureOk(deleteRes, `Failed to remove duplicate admin copy: ${deleteRes.status}`);
        })
      );
      return;
    }

    const createRes = await fetchJson(
      `${DRIVE_UPLOAD_ROOT}?uploadType=multipart&supportsAllDrives=true`,
      accessToken,
      {
        method: "POST",
        headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
        body: multipartBody,
      }
    );
    ensureOk(createRes, `Failed to create admin copy: ${createRes.status}`);
  }, [ensureFolder]);

  const checkModified = useCallback(async (fileId, accessToken, lastKnownTime) => {
    if (!accessToken) return false;

    const res = await fetchJson(
      `${DRIVE_API_ROOT}/${fileId}?fields=modifiedTime&supportsAllDrives=true`,
      accessToken
    );

    if (!res.ok) return false;
    const data = await res.json();
    return data.modifiedTime !== lastKnownTime;
  }, []);

  return {
    files,
    folders,
    loading,
    error,
    listFiles,
    listFolderContents,
    getFolderMeta,
    downloadFile,
    upsertAdminWorkbookCopy,
    checkModified,
  };
}
