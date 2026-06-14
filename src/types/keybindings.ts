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
   * (e.g. "gamepad:a", "gamepad:lefttrigger"). Use {@link isGamepadBinding}
   * to tell them apart.
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
 * Controller button names accepted as bindings. These match @kmamal/sdl's
 * `Controller.Button` names, plus the two analog triggers which GamepadManager
 * reports as edge-triggered pseudo-buttons.
 */
export const GAMEPAD_BUTTONS = [
  'a',
  'b',
  'x',
  'y',
  'back',
  'guide',
  'start',
  'leftStick',
  'rightStick',
  'leftShoulder',
  'rightShoulder',
  'dpadUp',
  'dpadDown',
  'dpadLeft',
  'dpadRight',
  'paddle1',
  'paddle2',
  'paddle3',
  'paddle4',
  'leftTrigger',
  'rightTrigger',
] as const;

export type GamepadButton = (typeof GAMEPAD_BUTTONS)[number];

/** True when a binding value refers to a gamepad button. */
export function isGamepadBinding(accelerator: string): boolean {
  return accelerator.startsWith(GAMEPAD_TOKEN_PREFIX);
}

/** Build a gamepad binding token from an SDL button name, e.g. "a" -> "gamepad:a". */
export function gamepadToken(button: string): string {
  return `${GAMEPAD_TOKEN_PREFIX}${button}`;
}

/** Extract the SDL button name from a gamepad token, e.g. "gamepad:a" -> "a". */
export function gamepadButtonFromToken(token: string): string {
  return token.slice(GAMEPAD_TOKEN_PREFIX.length);
}

/** Raw joystick button token, e.g. "button5" (wheel bases, unmapped pads). */
const JOYSTICK_BUTTON_RE = /^button\d+$/;
/** Raw joystick POV-hat token, e.g. "hat0_up". */
const JOYSTICK_HAT_RE =
  /^hat\d+_(up|down|left|right|leftup|leftdown|rightup|rightdown)$/;

/**
 * True when a string is a gamepad token referencing either a named controller
 * button or a raw joystick button/hat.
 */
export function isValidGamepadToken(token: string): boolean {
  if (!isGamepadBinding(token)) return false;
  const button = gamepadButtonFromToken(token);
  return (
    (GAMEPAD_BUTTONS as readonly string[]).includes(button) ||
    JOYSTICK_BUTTON_RE.test(button) ||
    JOYSTICK_HAT_RE.test(button)
  );
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
   * receives a gamepad token (e.g. "gamepad:a"). Returns an unsubscribe fn.
   */
  onGamepadCaptured: (callback: (token: string) => void) => () => void;
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
