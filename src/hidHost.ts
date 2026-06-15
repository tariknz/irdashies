/**
 * Hidden renderer that reads game-controller input via the WebHID API and
 * forwards button presses to the main process. WebHID (unlike the focus-gated
 * Gamepad API) keeps delivering input reports while the app is unfocused, which
 * is what an iRacing overlay needs.
 *
 * This runs in its own always-alive, never-shown BrowserWindow (see
 * src/app/gamepad/gamepadHost.ts). The main process auto-grants HID permission
 * for that window's session, so `navigator.hid.getDevices()` returns the
 * connected devices without a chooser or a user gesture.
 *
 * Logs go through the frontend logger, which forwards to the main-process log
 * file (Settings → Open Log Folder), so the device/permission/parse chain can be
 * diagnosed without attaching DevTools to this hidden window.
 */
import logger from '@irdashies/utils/logger';
import { gamepadTokenFromIndex } from '@irdashies/types';
import {
  parseButtons,
  buttonEdges,
  describeCollections,
  type ButtonBit,
} from './app/gamepad/hidReport';

interface DeviceState {
  buttons: ButtonBit[];
  pressed: Map<number, boolean>;
  loggedReport: boolean;
}

const devices = new Map<HIDDevice, DeviceState>();

const hex = (n: number) => `0x${n.toString(16).padStart(4, '0')}`;
const label = (d: HIDDevice) =>
  `${d.productName || 'unknown'} ${hex(d.vendorId)}:${hex(d.productId)}`;

async function openDevice(device: HIDDevice): Promise<void> {
  if (devices.has(device)) return;
  try {
    if (!device.opened) await device.open();
  } catch (err) {
    logger.error(`[Gamepad] failed to open ${label(device)}`, err);
    return;
  }

  const buttons = parseButtons(device.collections);
  const state: DeviceState = {
    buttons,
    pressed: new Map(),
    loggedReport: false,
  };
  devices.set(device, state);

  if (buttons.length === 0) {
    logger.warn(
      `[Gamepad] ${label(device)} opened but no buttons detected. Report layout:\n` +
        describeCollections(device.collections)
    );
  } else {
    logger.info(
      `[Gamepad] opened ${label(device)} (${buttons.length} buttons)`
    );
  }

  device.addEventListener('inputreport', (event) => {
    if (!state.loggedReport) {
      state.loggedReport = true;
      logger.info(
        `[Gamepad] ${label(device)} input reports flowing ` +
          `(id=${event.reportId}, ${event.data.byteLength} bytes)`
      );
    }
    const edges = buttonEdges(
      event.data,
      state.buttons,
      event.reportId,
      state.pressed
    );
    for (const index of edges) {
      const token = gamepadTokenFromIndex(index);
      logger.info(`[Gamepad] ${label(device)} button ${index} -> ${token}`);
      if (window.gamepadHost) {
        window.gamepadHost.sendButton(token);
      } else {
        logger.error(
          '[Gamepad] gamepadHost bridge missing; cannot forward press'
        );
      }
    }
  });
}

function forgetDevice(device: HIDDevice): void {
  devices.delete(device);
}

async function start(): Promise<void> {
  if (!navigator.hid) {
    logger.error(
      '[Gamepad] WebHID (navigator.hid) is unavailable in this renderer'
    );
    return;
  }
  if (!window.gamepadHost) {
    logger.error('[Gamepad] gamepadHost preload bridge is missing');
  }

  navigator.hid.addEventListener('connect', (event) => {
    logger.info(`[Gamepad] device connected: ${label(event.device)}`);
    void openDevice(event.device);
  });
  navigator.hid.addEventListener('disconnect', (event) => {
    logger.info(`[Gamepad] device disconnected: ${label(event.device)}`);
    forgetDevice(event.device);
  });

  const available = await navigator.hid.getDevices();
  if (available.length === 0) {
    logger.warn(
      '[Gamepad] getDevices() returned no controllers. They may not be ' +
        'permitted for this window, or none are connected.'
    );
  } else {
    logger.info(
      `[Gamepad] getDevices() found ${available.length}: ` +
        available.map(label).join(', ')
    );
  }
  for (const device of available) {
    await openDevice(device);
  }
  logger.info('[Gamepad] HID host ready');
}

void start();
