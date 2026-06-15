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
}

const devices = new Map<HIDDevice, DeviceState>();

async function openDevice(device: HIDDevice): Promise<void> {
  if (devices.has(device)) return;
  try {
    if (!device.opened) await device.open();
  } catch (err) {
    logger.error(`[Gamepad] failed to open ${device.productName}`, err);
    return;
  }

  const buttons = parseButtons(device.collections);
  const state: DeviceState = { buttons, pressed: new Map() };
  devices.set(device, state);

  if (buttons.length === 0) {
    logger.warn(
      `[Gamepad] ${device.productName} opened but no buttons detected. ` +
        `Report layout:\n${describeCollections(device.collections)}`
    );
  }

  device.addEventListener('inputreport', (event) => {
    const edges = buttonEdges(
      event.data,
      state.buttons,
      event.reportId,
      state.pressed
    );
    for (const index of edges) {
      window.gamepadHost?.sendButton(
        gamepadTokenFromIndex(index, device.productName)
      );
    }
  });
}

function forgetDevice(device: HIDDevice): void {
  devices.delete(device);
}

async function start(): Promise<void> {
  if (!navigator.hid) {
    logger.error('[Gamepad] WebHID (navigator.hid) is unavailable');
    return;
  }

  navigator.hid.addEventListener('connect', (event) => {
    void openDevice(event.device);
  });
  navigator.hid.addEventListener('disconnect', (event) => {
    forgetDevice(event.device);
  });

  const available = await navigator.hid.getDevices();
  if (available.length === 0) {
    logger.warn('[Gamepad] getDevices() returned no controllers');
  }
  for (const device of available) {
    await openDevice(device);
  }
}

void start();
