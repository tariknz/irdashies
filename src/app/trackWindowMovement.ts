import { BrowserWindow } from 'electron';
import { writeData } from './storage/storage';

const DEBOUNCE_MS = 200;

/**
 * Bounds the app itself moved a window to, as opposed to the user dragging it.
 *
 * A window rescued from off-screen is repositioned with `setBounds`. If that
 * were persisted it would overwrite the position the user actually chose, and
 * reconnecting the monitor would no longer bring the window back — turning a
 * temporary rescue into a permanent move.
 *
 * A programmatic `setBounds` does not currently raise `moved` or `resized`, so
 * nothing is persisted anyway. That is Electron's present behaviour rather than
 * a guarantee, and nothing else pins it. Recording the corrected rectangle and
 * declining to save it makes the outcome deliberate instead of incidental.
 *
 * A WeakMap so a destroyed window takes its entry with it.
 */
const correctedBounds = new WeakMap<BrowserWindow, Electron.Rectangle>();

const sameRect = (a: Electron.Rectangle, b: Electron.Rectangle): boolean =>
  a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Record that this window was moved by the app rather than by the user, so the
 * resulting position is not written back to disk. Call it alongside the
 * `setBounds` that performs the correction.
 */
export const markCorrectedBounds = (
  browserWindow: BrowserWindow,
  bounds: Electron.Rectangle
): void => {
  correctedBounds.set(browserWindow, { ...bounds });
};

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

  // Compared by value rather than suppressed with a flag and a timer: there is
  // no assumption about when, or whether, the event arrives after setBounds.
  // A user who drags the window to exactly the corrected position is not saved
  // either, which costs nothing — that position is on-screen and the next
  // launch would place the window there regardless.
  const corrected = correctedBounds.get(browserWindow);
  if (corrected && sameRect(bounds, corrected)) return;

  writeData('settingsWindowBounds', bounds);
}
