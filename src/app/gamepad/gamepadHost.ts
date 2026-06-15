import { BrowserWindow, ipcMain, session } from 'electron';
import path from 'node:path';
import logger from '../logger';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string;
declare const MAIN_WINDOW_VITE_NAME: string;

/** IPC channel the hidden WebHID host renderer uses to forward button presses. */
const BUTTON_CHANNEL = 'gamepad:button';

/**
 * In-memory session partition for the HID host window. Scoping the auto-grant
 * permission handlers to this partition keeps them off the default session that
 * every other window shares.
 */
const HID_PARTITION = 'hid-host';

/**
 * Owns the hidden renderer that reads controllers via WebHID. Mirrors the small
 * start/stop surface the KeybindingManager expects: it creates an always-alive,
 * never-shown window, auto-grants HID access for that window's session, and
 * relays each `gamepad:btn<N>` token to the supplied callback.
 */
export class GamepadHost {
  private window?: BrowserWindow;
  private onButton?: (token: string) => void;
  private permissionsGranted = false;
  private readonly handleButton = (_event: unknown, token: string): void => {
    this.onButton?.(token);
  };

  start(onButton: (token: string) => void): void {
    this.onButton = onButton;
    if (this.window && !this.window.isDestroyed()) return;

    this.grantHidPermissions();
    ipcMain.removeListener(BUTTON_CHANNEL, this.handleButton);
    ipcMain.on(BUTTON_CHANNEL, this.handleButton);

    this.window = new BrowserWindow({
      show: false,
      width: 1,
      height: 1,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        backgroundThrottling: false,
        partition: HID_PARTITION,
      },
    });

    const wc = this.window.webContents;
    wc.on('did-finish-load', () =>
      logger.info('[Gamepad] HID host page loaded')
    );
    wc.on('did-fail-load', (_e, code, desc, url) =>
      logger.error(`[Gamepad] HID host failed to load ${url}: ${code} ${desc}`)
    );

    if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      const base = MAIN_WINDOW_VITE_DEV_SERVER_URL.replace(/\/$/, '');
      this.window.loadURL(`${base}/index-hid-host.html`);
    } else {
      this.window.loadFile(
        path.join(
          __dirname,
          `../renderer/${MAIN_WINDOW_VITE_NAME}/index-hid-host.html`
        )
      );
    }

    logger.info('[Gamepad] WebHID host window started');
  }

  stop(): void {
    ipcMain.removeListener(BUTTON_CHANNEL, this.handleButton);
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy();
    }
    this.window = undefined;
  }

  isRunning(): boolean {
    return !!this.window && !this.window.isDestroyed();
  }

  /**
   * Auto-grant HID access for the host window's session so the renderer can
   * enumerate controllers via `navigator.hid.getDevices()` without a chooser or
   * a user gesture.
   *
   * The handlers grant unconditionally: this is a dedicated in-memory partition
   * that only this app's own hidden HID-host renderer ever loads, so there is no
   * untrusted origin to guard against. (Filtering on `permission === 'hid'` or
   * `details.deviceType === 'hid'` risks silently denying enumeration if those
   * fields differ across call contexts — which would leave getDevices() empty.)
   */
  private grantHidPermissions(): void {
    if (this.permissionsGranted) return;
    this.permissionsGranted = true;

    const ses = session.fromPartition(HID_PARTITION);
    ses.setPermissionCheckHandler(() => true);
    ses.setDevicePermissionHandler(() => true);
    ses.on('select-hid-device', (event, details, callback) => {
      // Only fires if the renderer ever calls requestDevice(); auto-pick the
      // first match so no picker UI is shown.
      event.preventDefault();
      callback(details.deviceList[0]?.deviceId);
    });
  }
}
