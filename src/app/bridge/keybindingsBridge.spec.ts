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
});

const invokeUpdate = (
  actionId: KeybindingActionId,
  accelerator: string,
  meta?: { label: string; description: string }
) => {
  const handler = handlers.get('keybindings:update');
  if (!handler) throw new Error('keybindings:update handler not registered');
  return handler({}, actionId, accelerator, meta);
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
      'Alt+J',
      undefined
    );
    expect(mockReloadBindings).toHaveBeenCalledOnce();
  });

  it('forwards the meta (label/description) for a dynamic widget binding', () => {
    mockIsValidAccelerator.mockReturnValue(true);
    const next = sampleBindings();
    mockUpdateKeybinding.mockReturnValue(next);
    const meta = { label: 'Standings', description: 'Show / hide Standings' };

    invokeUpdate('toggle-widget:standings', 'Alt+1', meta);

    expect(mockUpdateKeybinding).toHaveBeenCalledWith(
      'toggle-widget:standings',
      'Alt+1',
      meta
    );
    expect(mockReloadBindings).toHaveBeenCalledOnce();
  });

  it('rejects an unsupported action id without persisting', () => {
    mockIsValidAccelerator.mockReturnValue(true);

    expect(() =>
      invokeUpdate('bogus-action' as KeybindingActionId, 'Alt+J')
    ).toThrow('is not a supported keybinding action');
    expect(() =>
      invokeUpdate('toggle-widget:' as KeybindingActionId, 'Alt+J')
    ).toThrow('is not a supported keybinding action');

    expect(mockUpdateKeybinding).not.toHaveBeenCalled();
    expect(mockReloadBindings).not.toHaveBeenCalled();
  });

  it('accepts a valid gamepad token without keyboard validation', () => {
    const next = sampleBindings();
    mockUpdateKeybinding.mockReturnValue(next);

    const result = invokeUpdate('toggle-edit-mode', 'gamepad:btn0');

    expect(result).toBe(next);
    // Gamepad tokens skip the Electron accelerator check entirely.
    expect(mockIsValidAccelerator).not.toHaveBeenCalled();
    expect(mockUpdateKeybinding).toHaveBeenCalledWith(
      'toggle-edit-mode',
      'gamepad:btn0',
      undefined
    );
    expect(mockReloadBindings).toHaveBeenCalledOnce();
  });

  it('rejects an unknown gamepad token without persisting', () => {
    expect(() => invokeUpdate('toggle-edit-mode', 'gamepad:nope')).toThrow(
      'not a valid controller button'
    );
    expect(mockUpdateKeybinding).not.toHaveBeenCalled();
    expect(mockReloadBindings).not.toHaveBeenCalled();
    expect(mockLoggerError).toHaveBeenCalledWith(
      'Failed to update keybinding:',
      expect.any(Error)
    );
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
