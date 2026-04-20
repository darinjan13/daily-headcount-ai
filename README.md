# LifeSights Frontend

LifeSights is a React + Vite dashboard app for opening Excel and Google Sheets files from Google Drive, analyzing workbook data through the backend, and visualizing the results in an interactive dashboard.

Current app version: `1.1.0`

## Version 1.1 Highlights

- Admin workspace mode with a locked Google Drive admin root.
- Backend-powered admin mirroring for analyzed workbooks.
- Persistent recent analysis tabs using Firestore metadata.
- Background workbook analysis with cancel, progress, elapsed time, and ready-to-open notifications.
- Multi-level spreadsheet header support with AI-safe flattened headers.
- Backend active-sheet cache/session support for large-file chatbot accuracy.
- Environment-aware backend concurrency: safer production defaults, faster local development.
- Optimized raw data table rendering for large datasets.
- Whole-page loading state for large workbook hydration to reduce dashboard freezing.
- Dev-only KPI refresh button for tuning summary cards without full workbook re-analysis.

## What The Frontend Does

- Signs users in with Google through Firebase Auth.
- Uses the Google Drive Picker for regular users.
- Lets admins browse only the configured admin Drive root folder.
- Downloads selected Drive files in the browser and sends workbook bytes to the backend.
- Opens analyzed workbooks as sidebar tabs.
- Persists lightweight tab metadata to Firestore, not full analyzed data.
- Restores saved tabs after login and re-analyzes the Drive file only when the user opens a restored tab.
- Runs workbook analysis in the foreground or background with visible progress.
- Mirrors regular-user analyzed workbooks to the backend admin Drive mirror endpoint.
- Provides dashboard charts, filters, raw table viewing, pinned charts, and a chatbot.
- Sends backend analysis session ids to the chatbot when available, so large active datasets can use the backend cache instead of relying only on frontend-held rows.
- Keeps the whole dashboard behind a loading state while very large workbooks are still materializing rows, then shows the dashboard only after the dataset is ready.

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

## Background Analysis

Workbook analysis can continue in the background after the user starts opening a file or switching sheets. The floating background analysis dock shows running jobs, progress, elapsed time, cancellation, and completion notifications.

When a background job finishes, the user can open the completed analysis from the notification. If the user is already waiting for the same sheet in the foreground, the app suppresses the redundant "ready to open" notification.

## Dev-Only KPI Refresh

In local development, the dashboard top bar shows a `Refresh KPI` button.

This button:

- re-runs the frontend KPI card selection using the currently loaded workbook rows
- updates only `blueprint.cards`
- does not re-download or re-analyze the workbook

This is meant only for KPI tuning during development and is hidden in production builds.

## Multi-Level Headers

LifeSights supports practical multi-row and merged spreadsheet headers by separating display headers from analysis headers:

- `displayHeaderRows` preserve visual grouped headers for the data table.
- `headers` are flattened unique column names used by filters, charts, blueprints, and chatbot actions.
- `columnContexts` preserve parent header meaning for AI understanding.

This lets the table show grouped headers like `Production Key > Actual`, while the chatbot and chart logic still use stable flat names such as `Actual Hours` or `Accumulative Actual Hours`.

## Large Workbook Behavior

Large workbook handling is improved in v1.1, but it is not full backend row paging yet.

What works now:

- Analysis can continue in the background so the UI is not trapped on one modal.
- The backend can run multiple analyses locally, while production can stay conservative for limited hosting.
- The frontend table avoids unnecessary full-table conversion when only a page of rows is visible.
- The chatbot can use the backend active analysis session for large active datasets.
- The dashboard stays on a full-page loading state while large row sets are still being materialized, which avoids rendering half-ready KPI cards and reduces visible freezing.

What is still future work:

- True backend row paging, where the browser receives only the visible rows.
- Server-side search, sorting, and filtering for massive datasets.
- Optional browser workbook caching using Drive file id and modified time.
- Progressive background row hydration instead of returning every row in one response.

## Current Limitations

- Restored tabs require the user to still have Drive access to the original file.
- Full analyzed data is not persisted, so restored tabs need a backend re-analysis.
- Google Drive OAuth tokens are stored in `sessionStorage`; if the token is missing, the app forces re-login.
- Admin users can browse only the configured admin root in the app UI, but Google Drive permissions still matter.
- Very large workbooks can still be slow on first analysis because bytes are downloaded in the browser, uploaded to the backend, parsed, and returned as table data.
- Frontend table rendering is optimized, but true backend row paging is not implemented yet.
- Browser refresh clears in-memory analyzed data; restored tabs keep metadata only and re-analyze when opened.
- Only the active backend analysis session is cached server-side. Opening another sheet or workbook may replace that backend cache.
- Multi-level header support is practical and heuristic, not a full Excel layout engine.
- The production build currently emits a Vite chunk-size warning. It does not block deployment, but future code splitting would improve load performance.
- If the AI KPI planner fails or the model is unavailable, the frontend falls back to deterministic KPI selection heuristics. These are useful, but still less context-aware than a successful planner response.

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
