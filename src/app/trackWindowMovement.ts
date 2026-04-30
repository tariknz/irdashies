import { BrowserWindow } from 'electron';
import { writeData } from './storage/storage';

const DEBOUNCE_MS = 200;

/**
 * Track settings window position and size changes
 */
export const trackSettingsWindowMovement = (browserWindow: BrowserWindow) => {
  let debounceTimer: ReturnType<typeof setTimeout> | undefined;
  const debouncedSave = () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(
      () => saveSettingsWindowBounds(browserWindow),
      DEBOUNCE_MS
    );
  };

  browserWindow.on('moved', debouncedSave);
  browserWindow.on('resized', debouncedSave);
};

function saveSettingsWindowBounds(browserWindow: BrowserWindow): void {
  const bounds = browserWindow.getBounds();
  writeData('settingsWindowBounds', bounds);
}
