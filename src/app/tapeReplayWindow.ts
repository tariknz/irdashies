import { BrowserWindow, screen } from 'electron';
import path from 'node:path';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

let replayWindow: BrowserWindow | undefined;

/** Independent of dashboard locking and profile/widget configuration. */
export function createTapeReplayWindow(): BrowserWindow {
  if (replayWindow && !replayWindow.isDestroyed()) return replayWindow;
  const { x, y, width, height } = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    title: 'irDashies - Telemetry replay',
    x: Math.round(x + (width - 620) / 2),
    y: Math.round(y + height - 128),
    width: 620,
    height: 104,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });
  replayWindow = window;
  window.on('closed', () => {
    if (replayWindow === window) replayWindow = undefined;
  });
  // Dashboard overlays use screen-saver level 1, settings use level 2.
  window.setAlwaysOnTop(true, 'screen-saver', 3);
  window.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-redirect', (event) => event.preventDefault());
  window.once('ready-to-show', () => {
    if (!window.isDestroyed()) window.showInactive();
  });
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(`${MAIN_WINDOW_VITE_DEV_SERVER_URL}#/tape-replay`);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      { hash: '/tape-replay' }
    );
  }
  return window;
}
