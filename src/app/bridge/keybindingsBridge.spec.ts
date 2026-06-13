import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';

const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

type IpcHandler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>;

const handlers = new Map<string, IpcHandler>();

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    },
  },
}));

const mockUpdateKeybinding = vi.hoisted(() => vi.fn());
const mockGetKeybindings = vi.hoisted(() => vi.fn());
const mockResetKeybinding = vi.hoisted(() => vi.fn());
const mockResetAllKeybindings = vi.hoisted(() => vi.fn());

vi.mock('../storage/keybindings', () => ({
  getKeybindings: mockGetKeybindings,
  updateKeybinding: mockUpdateKeybinding,
  resetKeybinding: mockResetKeybinding,
  resetAllKeybindings: mockResetAllKeybindings,
}));

const mockIsValidAccelerator = vi.hoisted(() => vi.fn());
const mockReloadBindings = vi.hoisted(() => vi.fn());

vi.mock('../keybindingManager', () => ({
  KeybindingManager: class {
    static isValidAccelerator = mockIsValidAccelerator;
    reloadBindings = mockReloadBindings;
  },
}));

vi.mock('../setupTaskbar', () => ({
  rebuildTaskbarMenu: vi.fn(),
}));

import { setupKeybindingsBridge } from './keybindingsBridge';
import { KeybindingManager } from '../keybindingManager';

const sampleBindings = (): KeybindingsMap => ({
  'toggle-hide-ui': {
    accelerator: 'Alt+H',
    label: '',
    description: '',
    isDefault: true,
  },
  'toggle-edit-mode': {
    accelerator: 'F6',
    label: '',
    description: '',
    isDefault: true,
  },
  'save-telemetry': {
    accelerator: 'F7',
    label: '',
    description: '',
    isDefault: true,
  },
  'recenter-vr': {
    accelerator: 'F8',
    label: '',
    description: '',
    isDefault: true,
  },
});

const invokeUpdate = (actionId: KeybindingActionId, accelerator: string) => {
  const handler = handlers.get('keybindings:update');
  if (!handler) throw new Error('keybindings:update handler not registered');
  return handler({}, actionId, accelerator);
};

describe('keybindingsBridge keybindings:update', () => {
  beforeEach(() => {
    handlers.clear();
    mockLoggerError.mockReset();
    mockUpdateKeybinding.mockReset();
    mockReloadBindings.mockReset();
    mockIsValidAccelerator.mockReset();

    const manager = new KeybindingManager({} as never);
    setupKeybindingsBridge(manager);
  });

  it('rejects an invalid accelerator without persisting', () => {
    mockIsValidAccelerator.mockReturnValue(false);

    expect(() => invokeUpdate('toggle-hide-ui', 'Pause')).toThrow(
      '"Pause" is not a valid keyboard shortcut'
    );

    expect(mockUpdateKeybinding).not.toHaveBeenCalled();
    expect(mockReloadBindings).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to update keybinding:',
      expect.any(Error)
    );
  });

  it('persists and reloads when the accelerator is valid', () => {
    mockIsValidAccelerator.mockReturnValue(true);
    const next = sampleBindings();
    mockUpdateKeybinding.mockReturnValue(next);

    const result = invokeUpdate('toggle-hide-ui', 'Alt+J');

    expect(result).toBe(next);
    expect(mockUpdateKeybinding).toHaveBeenCalledWith(
      'toggle-hide-ui',
      'Alt+J'
    );
    expect(mockReloadBindings).toHaveBeenCalledOnce();
  });

  it('surfaces storage conflict errors to the caller', () => {
    mockIsValidAccelerator.mockReturnValue(true);
    mockUpdateKeybinding.mockImplementation(() => {
      throw new Error(
        'Accelerator "Alt+H" is already bound to "Hide / Show UI"'
      );
    });

    expect(() => invokeUpdate('toggle-edit-mode', 'Alt+H')).toThrow(
      'already bound'
    );
    expect(mockReloadBindings).not.toHaveBeenCalled();
  });
});
