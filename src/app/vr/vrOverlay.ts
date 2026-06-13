import { BrowserWindow } from 'electron';
import path from 'path';
import logger from '../logger';
import { VrOverlayNative, type VrPose } from './native';

// Injected by the forge vite plugin (same globals overlayManager uses).
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Offscreen render size. Fixed for the MVP; the quad aspect is set by `size`.
const OSR_WIDTH = 2048;
const OSR_HEIGHT = 2048;

const DEFAULT_POSE: VrPose = {
  position: [0, 0, -1.5],
  orientation: [0, 0, 0, 1],
  size: [0.6, 0.6],
};

let osrWindow: BrowserWindow | null = null;

/**
 * MVP gate: VR overlay is opt-in via env var while it is experimental and not
 * wired into settings yet. Windows only (native addon + OpenXR layer).
 */
export function isVrOverlayEnabled(): boolean {
  return process.platform === 'win32' && process.env.IRDASHIES_VR === '1';
}

/**
 * Render the overlay offscreen and feed each GPU frame to the native producer,
 * which publishes it over shared memory to the OpenXR layer.
 */
export function startVrOverlay(): void {
  if (osrWindow) return;

  try {
    if (!VrOverlayNative.start(DEFAULT_POSE)) {
      logger.error('[VR] native overlay start returned false');
      return;
    }
  } catch (err) {
    logger.error('[VR] failed to start native overlay', err);
    return;
  }

  const webPreferences = {
    preload: path.join(__dirname, 'preload.js'),
    backgroundThrottling: false,
    offscreen: { useSharedTexture: true },
  } as unknown as Electron.WebPreferences;

  osrWindow = new BrowserWindow({
    width: OSR_WIDTH,
    height: OSR_HEIGHT,
    show: false,
    webPreferences,
  });

  const wc = osrWindow.webContents;
  wc.on('paint', (event) => {
    const texture = (
      event as unknown as {
        texture?: { textureInfo: unknown; release: () => void };
      }
    ).texture;
    if (!texture) return;
    try {
      VrOverlayNative.submitFrame(texture.textureInfo);
    } catch (err) {
      logger.error('[VR] submitFrame failed', err);
    } finally {
      // Must release promptly or Chromium's frame pool drains and paints stop.
      texture.release();
    }
  });
  wc.setFrameRate(60);

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    wc.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    osrWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`)
    );
  }

  logger.info('[VR] overlay started (OSR -> shared memory -> OpenXR layer)');
}

export function stopVrOverlay(): void {
  try {
    VrOverlayNative.stop();
  } catch (err) {
    logger.error('[VR] native stop failed', err);
  }
  if (osrWindow) {
    osrWindow.destroy();
    osrWindow = null;
  }
}
