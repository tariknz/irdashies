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
 * Gamepad button token grammar: `gamepad:btn<N>` where N is the button's
 * zero-based index within the device's HID input report. WebHID exposes buttons
 * by index, not by name, so a controller's face button "A" and a wheel base's
 * physical button are both just indexed buttons.
 */
const GAMEPAD_BUTTON_RE = /^btn\d+$/;

/** True when a binding value refers to a gamepad button. */
export function isGamepadBinding(accelerator: string): boolean {
  return accelerator.startsWith(GAMEPAD_TOKEN_PREFIX);
}

/** Build a gamepad binding token from a button id, e.g. "btn0" -> "gamepad:btn0". */
export function gamepadToken(button: string): string {
  return `${GAMEPAD_TOKEN_PREFIX}${button}`;
}

/** Build a gamepad token from a button index, e.g. 5 -> "gamepad:btn5". */
export function gamepadTokenFromIndex(index: number): string {
  return `${GAMEPAD_TOKEN_PREFIX}btn${index}`;
}

/** Extract the button id from a gamepad token, e.g. "gamepad:btn0" -> "btn0". */
export function gamepadButtonFromToken(token: string): string {
  return token.slice(GAMEPAD_TOKEN_PREFIX.length);
}

/** True when a string is a valid gamepad button token (`gamepad:btn<N>`). */
export function isValidGamepadToken(token: string): boolean {
  if (!isGamepadBinding(token)) return false;
  return GAMEPAD_BUTTON_RE.test(gamepadButtonFromToken(token));
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
