/** Identifiers for every bindable action in the app */
export type KeybindingActionId =
  | 'toggle-hide-ui'
  | 'toggle-edit-mode'
  | 'save-telemetry'
  | 'recenter-vr';

export interface KeybindingEntry {
  /**
   * The bound input. Either an Electron keyboard accelerator
   * (e.g. "Alt+H", "CommandOrControl+Shift+F6") or a gamepad token
   * (e.g. "gamepad:btn0"). Use {@link isGamepadBinding} to tell them apart.
   */
  accelerator: string;
  /** Human-readable label for the settings UI */
  label: string;
  /** Human-readable description */
  description: string;
  /** If true, this binding has not been modified from factory default */
  isDefault?: boolean;
}

export type KeybindingsMap = Record<KeybindingActionId, KeybindingEntry>;

/** Prefix marking a binding value as a gamepad button rather than a keyboard accelerator. */
export const GAMEPAD_TOKEN_PREFIX = 'gamepad:';

/**
 * Gamepad button token grammar:
 *
 *   gamepad:btn<N>                 button index N, device unknown
 *   gamepad:<device>:btn<N>        button index N on a named device
 *
 * N is the button's zero-based index within the device's HID input report
 * (WebHID exposes buttons by index, not name). `<device>` is the
 * URL-encoded product name, so it never contains a raw ':' to confuse parsing.
 */
const GAMEPAD_BUTTON_RE = /^btn\d+$/;

/** True when a binding value refers to a gamepad button. */
export function isGamepadBinding(accelerator: string): boolean {
  return accelerator.startsWith(GAMEPAD_TOKEN_PREFIX);
}

/**
 * Build a gamepad token from a button index and (optionally) the device's
 * product name, e.g. (5, "Logitech G29") -> "gamepad:Logitech%20G29:btn5",
 * or (5) -> "gamepad:btn5".
 */
export function gamepadTokenFromIndex(
  index: number,
  deviceName?: string
): string {
  const button = `btn${index}`;
  return deviceName
    ? `${GAMEPAD_TOKEN_PREFIX}${encodeURIComponent(deviceName)}:${button}`
    : `${GAMEPAD_TOKEN_PREFIX}${button}`;
}

export interface ParsedGamepadToken {
  /** Decoded device product name, or undefined when the token carries none. */
  device?: string;
  /** Button id, e.g. "btn5". */
  button: string;
}

/** Parse a gamepad token into its device + button parts, or null if invalid. */
export function parseGamepadToken(token: string): ParsedGamepadToken | null {
  if (!isGamepadBinding(token)) return null;
  const body = token.slice(GAMEPAD_TOKEN_PREFIX.length);

  const sep = body.lastIndexOf(':');
  if (sep === -1) {
    return GAMEPAD_BUTTON_RE.test(body) ? { button: body } : null;
  }

  const button = body.slice(sep + 1);
  if (!GAMEPAD_BUTTON_RE.test(button)) return null;

  const encoded = body.slice(0, sep);
  let device: string | undefined;
  try {
    device = decodeURIComponent(encoded) || undefined;
  } catch {
    device = encoded || undefined;
  }
  return { device, button };
}

/** True when a string is a valid gamepad button token. */
export function isValidGamepadToken(token: string): boolean {
  return parseGamepadToken(token) !== null;
}

/** Bridge methods exposed to the renderer for keybinding management */
export interface KeybindingsBridge {
  getKeybindings: () => Promise<KeybindingsMap>;
  updateKeybinding: (
    actionId: KeybindingActionId,
    accelerator: string
  ) => Promise<KeybindingsMap>;
  resetKeybinding: (actionId: KeybindingActionId) => Promise<KeybindingsMap>;
  resetAllKeybindings: () => Promise<KeybindingsMap>;
  /**
   * Temporarily unregister keyboard shortcuts (so key presses reach the
   * settings window) and put the gamepad into capture mode.
   */
  startRecording: () => Promise<void>;
  /** Re-register keyboard shortcuts and leave gamepad capture mode. */
  stopRecording: () => Promise<void>;
  /**
   * Subscribe to gamepad button presses captured while recording. The callback
   * receives a gamepad token (e.g. "gamepad:btn0"). Returns an unsubscribe fn.
   */
  onGamepadCaptured: (callback: (token: string) => void) => () => void;
}

/**
 * Bridge exposed only to the hidden WebHID host window. Forwards a controller
 * button press (already encoded as a `gamepad:btn<N>` token) to the main process.
 */
export interface GamepadHostBridge {
  sendButton: (token: string) => void;
}

export const DEFAULT_KEYBINDINGS: KeybindingsMap = {
  'toggle-hide-ui': {
    accelerator: 'Alt+H',
    label: 'Hide / Show UI',
    description: 'Toggle visibility of all overlay windows',
    isDefault: true,
  },
  'toggle-edit-mode': {
    accelerator: 'F6',
    label: 'Edit Layout',
    description: 'Lock or unlock overlays for repositioning',
    isDefault: true,
  },
  'save-telemetry': {
    accelerator: 'F7',
    label: 'Save Telemetry',
    description: 'Capture current telemetry data and screenshots',
    isDefault: true,
  },
  'recenter-vr': {
    accelerator: 'F8',
    label: 'Recenter VR Overlay',
    description: 'Move the VR overlay in front of your current view',
    isDefault: true,
  },
};
