/** Fixed, app-level actions with a factory default binding. */
export type StaticKeybindingActionId =
  | 'toggle-hide-ui'
  | 'toggle-edit-mode'
  | 'save-telemetry'
  | 'prev-profile'
  | 'next-profile';

/**
 * Dynamic per-widget show/hide action, keyed by the widget instance id, e.g.
 * `toggle-widget:standings`. These have no factory default — they are bound by
 * the user and derived from the current dashboard's widget list.
 */
export type WidgetToggleActionId = `toggle-widget:${string}`;

/** Identifiers for every bindable action in the app */
export type KeybindingActionId =
  | StaticKeybindingActionId
  | WidgetToggleActionId;

export interface KeybindingEntry {
  /**
   * The bound input. Either an Electron keyboard accelerator
   * (e.g. "Alt+H", "CommandOrControl+Shift+F6") or a gamepad token
   * (e.g. "gamepad:btn0"). Use `isGamepadBinding` to tell them apart.
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

/** Bridge methods exposed to the renderer for keybinding management */
export interface KeybindingsBridge {
  getKeybindings: () => Promise<KeybindingsMap>;
  updateKeybinding: (
    actionId: KeybindingActionId,
    accelerator: string,
    /**
     * Friendly name + description, used when creating a binding for a dynamic
     * action (e.g. a widget toggle) that has no factory default entry.
     */
    meta?: { label: string; description: string }
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
  'prev-profile': {
    accelerator: 'Alt+PageUp',
    label: 'Previous Profile',
    description: 'Switch to the previous configuration profile',
    isDefault: true,
  },
  'next-profile': {
    accelerator: 'Alt+PageDown',
    label: 'Next Profile',
    description: 'Switch to the next configuration profile',
    isDefault: true,
  },
};
