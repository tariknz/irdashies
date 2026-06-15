import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KeybindingsMap } from '@irdashies/types';

const mockLoggerError = vi.hoisted(() => vi.fn());
const mockLoggerInfo = vi.hoisted(() => vi.fn());

vi.mock('./logger', () => ({
  default: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

const mockIsRegistered = vi.hoisted(() => vi.fn());
const mockRegister = vi.hoisted(() => vi.fn());
const mockUnregister = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  globalShortcut: {
    isRegistered: mockIsRegistered,
    register: mockRegister,
    unregister: mockUnregister,
  },
  desktopCapturer: {
    getSources: vi.fn(),
  },
}));

const mockGetKeybindings = vi.hoisted(() => vi.fn());

vi.mock('./storage/keybindings', () => ({
  getKeybindings: mockGetKeybindings,
}));

import { KeybindingManager } from './keybindingManager';
import type { OverlayManager } from './overlayManager';

const fakeOverlayManager = {
  getOverlays: () => [],
  toggleLockOverlays: () => undefined,
} as unknown as OverlayManager;

const bindingsWithBadAccelerator = (): KeybindingsMap => ({
  'toggle-hide-ui': {
    accelerator: 'Pause',
    label: 'Hide / Show UI',
    description: '',
    isDefault: false,
  },
  'toggle-edit-mode': {
    accelerator: 'F6',
    label: 'Edit Layout',
    description: '',
    isDefault: true,
  },
  'save-telemetry': {
    accelerator: 'F7',
    label: 'Save Telemetry',
    description: '',
    isDefault: true,
  },
  'recenter-vr': {
    accelerator: 'F8',
    label: 'Recenter VR Overlay',
    description: '',
    isDefault: true,
  },
});

describe('KeybindingManager', () => {
  beforeEach(() => {
    mockLoggerError.mockReset();
    mockLoggerInfo.mockReset();
    mockIsRegistered.mockReset();
    mockRegister.mockReset();
    mockUnregister.mockReset();
    mockGetKeybindings.mockReset();
  });

  describe('registerAll', () => {
    it('skips an unparseable accelerator and still registers the rest', () => {
      mockGetKeybindings.mockReturnValue(bindingsWithBadAccelerator());
      // Electron throws a TypeError when asked about an invalid accelerator
      mockIsRegistered.mockImplementation((accel: string) => {
        if (accel === 'Pause') {
          throw new TypeError(
            'Error processing argument at index 0, conversion failure from Pause'
          );
        }
        return false;
      });
      mockRegister.mockReturnValue(true);

      const manager = new KeybindingManager(fakeOverlayManager);
      manager.registerAll();

      // The two valid accelerators were still registered
      expect(mockRegister).toHaveBeenCalledWith('F6', expect.any(Function));
      expect(mockRegister).toHaveBeenCalledWith('F7', expect.any(Function));
      // The bad one was not
      expect(mockRegister).not.toHaveBeenCalledWith(
        'Pause',
        expect.any(Function)
      );
      // And the failure was logged
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Invalid accelerator "Pause"'),
        expect.any(Error)
      );
    });

    it('logs and continues when register returns false', () => {
      mockGetKeybindings.mockReturnValue({
        'toggle-edit-mode': {
          accelerator: 'F6',
          label: '',
          description: '',
          isDefault: true,
        },
      } as unknown as KeybindingsMap);
      mockIsRegistered.mockReturnValue(false);
      mockRegister.mockReturnValue(false);

      const manager = new KeybindingManager(fakeOverlayManager);
      manager.registerAll();

      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('Failed to register shortcut "F6"')
      );
    });

    it('skips bindings that are already registered (idempotent)', () => {
      mockGetKeybindings.mockReturnValue({
        'toggle-edit-mode': {
          accelerator: 'F6',
          label: '',
          description: '',
          isDefault: true,
        },
      } as unknown as KeybindingsMap);
      mockIsRegistered.mockReturnValue(true);

      const manager = new KeybindingManager(fakeOverlayManager);
      manager.registerAll();

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('unregisterAll', () => {
    it('skips an unparseable accelerator and still unregisters the rest', () => {
      mockGetKeybindings.mockReturnValue(bindingsWithBadAccelerator());
      mockIsRegistered.mockImplementation((accel: string) => {
        if (accel === 'Pause') {
          throw new TypeError(
            'Error processing argument at index 0, conversion failure from Pause'
          );
        }
        return true;
      });

      const manager = new KeybindingManager(fakeOverlayManager);
      manager.unregisterAll();

      expect(mockUnregister).toHaveBeenCalledWith('F6');
      expect(mockUnregister).toHaveBeenCalledWith('F7');
      expect(mockUnregister).not.toHaveBeenCalledWith('Pause');
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid accelerator "Pause" while unregistering'
        ),
        expect.any(Error)
      );
    });
  });

  describe('gamepad bindings', () => {
    const overlayWith = (toggleLockOverlays: () => void) =>
      ({
        getOverlays: () => [],
        toggleLockOverlays,
      }) as unknown as OverlayManager;

    const gamepadBinding = (): KeybindingsMap =>
      ({
        'toggle-edit-mode': {
          accelerator: 'gamepad:btn0',
          label: 'Edit Layout',
          description: '',
          isDefault: false,
        },
      }) as unknown as KeybindingsMap;

    // handleGamepadButton is private; the WebHID host callback is its only
    // caller, passing a ready-made gamepad token.
    const fireButton = (manager: KeybindingManager, token: string) =>
      (
        manager as unknown as {
          handleGamepadButton: (token: string) => void;
        }
      ).handleGamepadButton(token);

    it('does not register gamepad bindings as global keyboard shortcuts', () => {
      mockGetKeybindings.mockReturnValue(gamepadBinding());
      mockIsRegistered.mockReturnValue(false);
      mockRegister.mockReturnValue(true);

      const manager = new KeybindingManager(fakeOverlayManager);
      manager.registerAll();

      expect(mockRegister).not.toHaveBeenCalled();
    });

    it('triggers the mapped action when its bound pad button is pressed', () => {
      const toggleLock = vi.fn();
      mockGetKeybindings.mockReturnValue(gamepadBinding());
      mockIsRegistered.mockReturnValue(false);

      const manager = new KeybindingManager(overlayWith(toggleLock));
      manager.registerAll(); // builds the gamepad token -> action map

      fireButton(manager, 'gamepad:btn0');
      expect(toggleLock).toHaveBeenCalledOnce();
    });

    it('does not trigger an action for an unbound pad button', () => {
      const toggleLock = vi.fn();
      mockGetKeybindings.mockReturnValue(gamepadBinding());
      mockIsRegistered.mockReturnValue(false);

      const manager = new KeybindingManager(overlayWith(toggleLock));
      manager.registerAll();

      fireButton(manager, 'gamepad:btn1');
      expect(toggleLock).not.toHaveBeenCalled();
    });

    it('forwards to the capture callback instead of triggering while recording', () => {
      const toggleLock = vi.fn();
      mockGetKeybindings.mockReturnValue(gamepadBinding());
      mockIsRegistered.mockReturnValue(false);

      const manager = new KeybindingManager(overlayWith(toggleLock));
      manager.registerAll();

      const captured: string[] = [];
      manager.startGamepadCapture((token) => captured.push(token));
      fireButton(manager, 'gamepad:btn0');

      expect(captured).toEqual(['gamepad:btn0']);
      expect(toggleLock).not.toHaveBeenCalled();

      manager.stopGamepadCapture();
      fireButton(manager, 'gamepad:btn0');
      expect(toggleLock).toHaveBeenCalledOnce();
    });
  });

  describe('isValidAccelerator', () => {
    it('returns true when registration succeeds and unregisters the trial', () => {
      mockRegister.mockReturnValue(true);

      const result = KeybindingManager.isValidAccelerator('F8');

      expect(result).toBe(true);
      expect(mockRegister).toHaveBeenCalledWith('F8', expect.any(Function));
      expect(mockUnregister).toHaveBeenCalledWith('F8');
    });

    it('returns false when Electron throws on the accelerator string', () => {
      mockRegister.mockImplementation(() => {
        throw new TypeError(
          'Error processing argument at index 0, conversion failure from Pause'
        );
      });

      const result = KeybindingManager.isValidAccelerator('Pause');

      expect(result).toBe(false);
      expect(mockUnregister).not.toHaveBeenCalled();
    });

    it('returns false when register returns false without throwing', () => {
      mockRegister.mockReturnValue(false);

      const result = KeybindingManager.isValidAccelerator('Alt+H');

      expect(result).toBe(false);
      // Nothing was actually registered, so no unregister
      expect(mockUnregister).not.toHaveBeenCalled();
    });
  });
});
