import { BrowserWindow, screen } from 'electron';
import path from 'path';
import logger from '../logger';
import type { OverlayManager } from '../overlayManager';
import { VrOverlayNative, type VrPose } from './native';

// Injected by the forge vite plugin (same globals overlayManager uses).
declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

// Quad placement. The offscreen surface matches the primary display so widget
// pixel layouts land 1:1; the quad's physical height is derived from that
// aspect so the texture is not stretched.
const QUAD_DISTANCE_METERS = 1.4; // distance in front of the user
const QUAD_WIDTH_METERS = 1.8; // physical width; height follows display aspect

// Supersampling: render the overlay at N x the display's pixel dimensions so the
// quad has more texels and aliases less in the headset. The page still lays out
// as if at the display size (via zoom factor); only the backing texture grows.
const VR_SUPERSAMPLE = 2;
const VR_MAX_TEXTURE_DIM = 4096; // clamp longest side on high-res displays

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
export function startVrOverlay(overlayManager: OverlayManager): void {
  if (osrWindow) return;

  // Lay out at the primary display size (so widget pixel coordinates land where
  // intended) but render into a larger backing texture for supersampling.
  const { width: displayW, height: displayH } = screen.getPrimaryDisplay().size;
  let scale = Math.min(
    VR_SUPERSAMPLE,
    VR_MAX_TEXTURE_DIM / Math.max(displayW, displayH)
  );
  scale = Math.max(1, scale);
  const texW = Math.round(displayW * scale);
  const texH = Math.round(displayH * scale);
  const zoomFactor = texW / displayW;

  const pose: VrPose = {
    position: [0, 0, -QUAD_DISTANCE_METERS],
    orientation: [0, 0, 0, 1],
    size: [QUAD_WIDTH_METERS, QUAD_WIDTH_METERS * (displayH / displayW)],
  };

  try {
    if (!VrOverlayNative.start(pose)) {
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
    width: texW,
    height: texH,
    show: false,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    webPreferences,
  });

  // Receive dashboard/telemetry/running broadcasts like a real overlay window
  // (it is not display/bounds managed, so it renders all enabled widgets).
  overlayManager.addExternalWindow(osrWindow);

  const wc = osrWindow.webContents;
  // Apply the supersample zoom on load: zoom shrinks the CSS viewport back to
  // the display size while the backing texture stays at texW x texH.
  wc.on('did-finish-load', () => {
    if (osrWindow && !osrWindow.isDestroyed()) wc.setZoomFactor(zoomFactor);
  });
  let paintCount = 0;
  let submitOk = 0;
  let loggedFirstPaint = false;
  let loggedNoTexture = false;
  wc.on('paint', (event) => {
    paintCount++;
    const texture = (
      event as unknown as {
        texture?: { textureInfo: unknown; release: () => void };
      }
    ).texture;

    if (!texture) {
      if (!loggedNoTexture) {
        loggedNoTexture = true;
        logger.warn(
          '[VR] paint has no GPU texture (useSharedTexture inactive - ' +
            'hardware acceleration off or GPU compositing disabled). ' +
            'CPU-only offscreen frames are not supported.'
        );
      }
      return;
    }

    if (!loggedFirstPaint) {
      loggedFirstPaint = true;
      const info = texture.textureInfo as {
        pixelFormat?: string;
        codedSize?: { width: number; height: number };
        visibleRect?: { width: number; height: number };
      };
      logger.info(
        `[VR] first GPU frame: format=${info.pixelFormat} ` +
          `coded=${info.codedSize?.width}x${info.codedSize?.height} ` +
          `visible=${info.visibleRect?.width}x${info.visibleRect?.height}`
      );
    }

    try {
      const ok = VrOverlayNative.submitFrame(texture.textureInfo);
      if (ok) submitOk++;
      if (paintCount % 120 === 0) {
        logger.info(
          `[VR] frames: paint=${paintCount} submitOk=${submitOk}` +
            (submitOk === 0 ? ' (producer not publishing - check adapter)' : '')
        );
      }
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

/**
 * Recenter the VR overlay quad to the user's current head pose. No-op if VR is
 * not running.
 */
export function recenterVrOverlay(): void {
  if (!osrWindow) return;
  try {
    VrOverlayNative.recenter();
  } catch (err) {
    logger.error('[VR] recenter failed', err);
  }
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
