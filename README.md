# LifeSights Frontend

LifeSights is a React + Vite dashboard app for opening Excel and Google Sheets files from Google Drive, analyzing workbook data through the backend, and visualizing the results in an interactive dashboard.

## What The Frontend Does

- Signs users in with Google through Firebase Auth.
- Uses the Google Drive Picker for regular users.
- Lets admins browse only the configured admin Drive root folder.
- Downloads selected Drive files in the browser and sends workbook bytes to the backend.
- Opens analyzed workbooks as sidebar tabs.
- Persists lightweight tab metadata to Firestore, not full analyzed data.
- Restores saved tabs after login and re-analyzes the Drive file only when the user opens a restored tab.
- Mirrors regular-user analyzed workbooks to the backend admin Drive mirror endpoint.
- Provides dashboard charts, filters, raw table viewing, pinned charts, and a chatbot.

## Local Setup

Install dependencies:

```powershell
npm install
```

Create `.env.development` for local development:

```env
VITE_API_URL=http://127.0.0.1:8000
```

Create `.env.production` for production builds:

```env
VITE_API_URL=https://daily-headcount-ai-backend.onrender.com
```

Create `.env` for Firebase and Google client settings:

```env
VITE_FIREBASE_API_KEY=your-firebase-api-key
VITE_GOOGLE_CLIENT_ID=your-google-oauth-client-id
VITE_GOOGLE_API_KEY=your-google-api-key
VITE_ADMIN_ROOT_FOLDER_ID=your-admin-drive-folder-id
```

Run the app locally:

```powershell
npm run dev
```

Build for production:

```powershell
npm run build
```

## Environment Variables

- `VITE_API_URL`: Backend API base URL. Vite automatically uses `.env.development` for `npm run dev` and `.env.production` for production builds.
- `VITE_FIREBASE_API_KEY`: Firebase web API key.
- `VITE_GOOGLE_CLIENT_ID`: Google OAuth web client id.
- `VITE_GOOGLE_API_KEY`: Google API key used by the Drive Picker.
- `VITE_ADMIN_ROOT_FOLDER_ID`: Google Drive folder id used as the fixed admin workspace root.

## Admin Access

Admin identity is stored in Firestore:

```txt
admins/{email}
```

Example document:

```json
{
  "email": "admin@example.com",
  "role": "admin",
  "active": true
}
```

Admins still need Google Drive permission to view the configured admin root folder. Adding an admin in Firestore controls app role only; Drive access is still controlled by Google Drive sharing.

## Firestore Rules

The app expects authenticated users to access their own pins and saved analysis tabs:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /admins/{email} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.token.email == "darinjan13@gmail.com";
    }

    match /users/{userId}/pins/{fileId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /users/{userId}/analysisTabs/{tabId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## Analysis Tabs

Tabs are saved as lightweight metadata in Firestore:

```txt
users/{uid}/analysisTabs/{tabId}
```

Saved metadata includes file id, file name, sheet name, available sheets, folder id, and timestamps. Large `tableData` and `blueprint` objects stay in memory only.

After refresh, tabs reappear in the sidebar. Opening a restored tab downloads and re-analyzes the file again using the current Google Drive token.

## Current Limitations

- Restored tabs require the user to still have Drive access to the original file.
- Full analyzed data is not persisted, so restored tabs need a backend re-analysis.
- Google Drive OAuth tokens are stored in `sessionStorage`; if the token is missing, the app forces re-login.
- Admin users can browse only the configured admin root in the app UI, but Google Drive permissions still matter.
- Very large workbooks can be slow because bytes are downloaded in the browser and uploaded to the backend for analysis.
- The production build currently emits a Vite chunk-size warning. It does not block deployment, but future code splitting would improve load performance.

## Useful Commands

```powershell
npm run dev
npm run build
npm run lint
```

## Commit Safety

Do not commit local environment files or generated build output:

- `.env`
- `dist/`
- `node_modules/`
