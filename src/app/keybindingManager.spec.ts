import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KeybindingsMap } from '@irdashies/types';
import { KEYBINDING_MESSAGES } from '@irdashies/types';

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

vi.mock('./storage/storage', () => ({
  readData: vi.fn(),
  writeData: vi.fn(),
  writeDataAsync: vi.fn(),
}));
vi.mock('./storage/keybindings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./storage/keybindings')>()),
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
  'prev-profile': {
    accelerator: 'Alt+PageUp',
    label: 'Previous Profile',
    description: '',
    isDefault: true,
  },
  'next-profile': {
    accelerator: 'Alt+PageDown',
    label: 'Next Profile',
    description: '',
    isDefault: true,
  },
  'radar-flip-pole-side': {
    accelerator: '',
    label: 'Radar: Flip Pole Side',
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
      expect(manager.getRegistrationErrors()['toggle-hide-ui']).toBe(
        KEYBINDING_MESSAGES.invalid
      );
      expect(mockLoggerError).not.toHaveBeenCalled();
    });

    it('reports recoverable unavailability when register returns false', () => {
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

      expect(manager.getRegistrationErrors()['toggle-edit-mode']).toBe(
        KEYBINDING_MESSAGES.unavailable
      );
      expect(mockLoggerError).not.toHaveBeenCalled();
      mockRegister.mockReturnValue(true);
      manager.registerAll();
      expect(
        manager.getRegistrationErrors()['toggle-edit-mode']
      ).toBeUndefined();
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
      expect(mockLoggerError).not.toHaveBeenCalled();
    });
  });

  describe('gamepad bindings', () => {
    const gamepadBinding = (): KeybindingsMap =>
      ({
        'toggle-edit-mode': {
          accelerator: 'gamepad:btn0',
          label: 'Edit Layout',
          description: '',
          isDefault: false,
        },
      }) as unknown as KeybindingsMap;

    // The token -> action routing, capture mode, and host lifecycle now live in
    // GamepadManager (see gamepadManager.spec.ts). KeybindingManager only has to
    // keep gamepad bindings out of the global keyboard-shortcut registry.
    it('does not register gamepad bindings as global keyboard shortcuts', () => {
      mockGetKeybindings.mockReturnValue(gamepadBinding());
      mockIsRegistered.mockReturnValue(false);
      mockRegister.mockReturnValue(true);

      const manager = new KeybindingManager(fakeOverlayManager);
      manager.registerAll();

      expect(mockRegister).not.toHaveBeenCalled();
    });
  });

  describe('checkAccelerator', () => {
    it('returns available when registration succeeds and unregisters the trial', () => {
      mockRegister.mockReturnValue(true);

      const result = KeybindingManager.checkAccelerator('F8');

      expect(result).toBe('available');
      expect(mockRegister).toHaveBeenCalledWith('F8', expect.any(Function));
      expect(mockUnregister).toHaveBeenCalledWith('F8');
    });

    it('returns invalid when Electron throws on the accelerator string', () => {
      mockRegister.mockImplementation(() => {
        throw new TypeError(
          'Error processing argument at index 0, conversion failure from Pause'
        );
      });

      const result = KeybindingManager.checkAccelerator('Pause');

      expect(result).toBe('invalid');
      expect(mockUnregister).not.toHaveBeenCalled();
    });

    it('returns unavailable when register returns false without throwing', () => {
      mockRegister.mockReturnValue(false);

      const result = KeybindingManager.checkAccelerator('Alt+H');

      expect(result).toBe('unavailable');
      // Nothing was actually registered, so no unregister
      expect(mockUnregister).not.toHaveBeenCalled();
    });
  });
  it.each(['Super', 'Meta'])(
    'reports persisted %s aliases as duplicates and keeps the first callback',
    (alias) => {
      const bindings = bindingsWithBadAccelerator();
      bindings['toggle-hide-ui'].accelerator = 'Command+H';
      bindings['toggle-edit-mode'].accelerator = `${alias}+H`;
      mockGetKeybindings.mockReturnValue(bindings);
      mockRegister.mockReturnValue(true);
      const manager = new KeybindingManager(fakeOverlayManager);
      manager.registerAll();
      expect(manager.getRegistrationErrors()['toggle-edit-mode']).toContain(
        'already bound'
      );
      expect(mockRegister).not.toHaveBeenCalledWith(
        `${alias}+H`,
        expect.any(Function)
      );
    }
  );

  it('preserves app-owned callbacks and propagates unexpected probe errors', () => {
    mockIsRegistered.mockReturnValue(true);
    expect(KeybindingManager.checkAccelerator('F6')).toBe('available');
    expect(mockUnregister).not.toHaveBeenCalled();
    mockIsRegistered.mockReturnValue(false);
    mockRegister.mockImplementation(() => {
      throw new Error('OS failed');
    });
    expect(() => KeybindingManager.checkAccelerator('F6')).toThrow('OS failed');
  });
});
