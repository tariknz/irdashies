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
import { gamepadTokenFromIndex, gamepadTokenFromHat } from '@irdashies/shared';
import type { ButtonBit, HatField, HatDirection } from '@irdashies/types';
import {
  parseButtons,
  parseHats,
  buttonChanges,
  hatChanges,
  describeCollections,
} from './app/gamepad/hidReport';

interface DeviceState {
  buttons: ButtonBit[];
  hats: HatField[];
  pressed: Map<number, boolean>;
  hatState: Map<number, HatDirection | null>;
}

const devices = new Map<HIDDevice, DeviceState>();

/** Open a HID device (if not already), parse its controls, and relay press edges. */
async function openDevice(device: HIDDevice): Promise<void> {
  if (devices.has(device)) return;

  try {
    if (!device.opened) await device.open();
  } catch (err) {
    logger.error(`[Gamepad] failed to open ${device.productName}`, err);
    return;
  }

  const buttons = parseButtons(device.collections);
  const hats = parseHats(device.collections);
  const state: DeviceState = {
    buttons,
    hats,
    pressed: new Map(),
    hatState: new Map(),
  };
  devices.set(device, state);

  if (buttons.length === 0 && hats.length === 0) {
    logger.warn(
      `[Gamepad] ${device.productName} opened but no controls detected. ` +
        `Report layout:\n${describeCollections(device.collections)}`
    );
  }

  device.addEventListener('inputreport', (event) => {
    for (const change of buttonChanges(
      event.data,
      state.buttons,
      event.reportId,
      state.pressed
    )) {
      window.gamepadHost?.sendButton(
        gamepadTokenFromIndex(change.index, device.productName),
        change.down
      );
    }

    for (const change of hatChanges(
      event.data,
      state.hats,
      event.reportId,
      state.hatState
    )) {
      window.gamepadHost?.sendButton(
        gamepadTokenFromHat(change.index, change.direction, device.productName),
        change.down
      );
    }
  });
}

/** Wire hotplug listeners and open every controller already connected at startup. */
async function start(): Promise<void> {
  if (!navigator.hid) {
    logger.error('[Gamepad] WebHID (navigator.hid) is unavailable');
    return;
  }

  navigator.hid.addEventListener('connect', (event) => {
    logger.info(`[Gamepad] hid device connected: ${event.device.productName}`);
    void openDevice(event.device);
  });
  navigator.hid.addEventListener('disconnect', (event) => {
    devices.delete(event.device);
  });

  const available = await navigator.hid.getDevices();
  if (available.length === 0) {
    logger.info('[Gamepad] getDevices() returned no controllers');
  }
  for (const device of available) {
    await openDevice(device);
  }
}

void start();
