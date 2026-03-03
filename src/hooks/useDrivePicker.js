import { useCallback } from "react";

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

export function useDrivePicker() {
    console.log(API_KEY);
    
  const openFolderPicker = useCallback((accessToken, onFolderSelected) => {
    // Load the picker API
    window.gapi.load("picker", () => {
      const picker = new window.google.picker.PickerBuilder()
        .setOAuthToken(accessToken)
        .setDeveloperKey(API_KEY)
        // Only show folders
        .addView(
          new window.google.picker.DocsView()
            .setIncludeFolders(true)
            .setSelectFolderEnabled(true)
            .setMimeTypes("application/vnd.google-apps.folder")
        )
        .setTitle("Select a folder containing Excel files")
        .setCallback((data) => {
          if (data.action === window.google.picker.Action.PICKED) {
            const folder = data.docs[0];
            onFolderSelected({
              id: folder.id,
              name: folder.name,
              url: folder.url,
            });
          }
        })
        .build();

      picker.setVisible(true);
    });
  }, []);

  return { openFolderPicker };
}