import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { KeybindingActionId, KeybindingsMap } from '@irdashies/types';
import { KEYBINDING_MESSAGES } from '@irdashies/types';

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

vi.mock('../storage/storage', () => ({
  readData: vi.fn(),
  writeData: vi.fn(),
  writeDataAsync: vi.fn(),
}));
vi.mock('../storage/keybindings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage/keybindings')>()),
  getKeybindings: mockGetKeybindings,
  updateKeybinding: mockUpdateKeybinding,
  resetKeybinding: mockResetKeybinding,
  resetAllKeybindings: mockResetAllKeybindings,
  persistKeybindingMigrations: vi.fn(async () => undefined),
}));

const mockCheckAccelerator = vi.hoisted(() => vi.fn());
const mockReloadBindings = vi.hoisted(() => vi.fn());

vi.mock('../keybindingManager', () => ({
  KeybindingManager: class {
    static checkAccelerator = mockCheckAccelerator;
    reloadBindings = mockReloadBindings;
    getRegistrationErrors = () => ({});
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
  'prev-profile': {
    accelerator: 'Alt+PageUp',
    label: '',
    description: '',
    isDefault: true,
  },
  'next-profile': {
    accelerator: 'Alt+PageDown',
    label: '',
    description: '',
    isDefault: true,
  },
  'radar-flip-pole-side': {
    accelerator: '',
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
    mockCheckAccelerator.mockReset();
    mockGetKeybindings.mockReturnValue(sampleBindings());

    const manager = new KeybindingManager({} as never);
    setupKeybindingsBridge(manager);
  });

  it.each(['invalid', 'unavailable'] as const)(
    'reports %s without persisting or logging an application fault',
    (status) => {
      mockCheckAccelerator.mockReturnValue(status);
      expect(invokeUpdate('toggle-hide-ui', 'Pause')).toEqual({
        error: KEYBINDING_MESSAGES[status],
      });
      expect(mockUpdateKeybinding).not.toHaveBeenCalled();
      expect(mockReloadBindings).not.toHaveBeenCalled();
      expect(mockLoggerError).not.toHaveBeenCalled();
    }
  );

  it('persists and reloads when the accelerator is valid', () => {
    mockCheckAccelerator.mockReturnValue('available');
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
    mockCheckAccelerator.mockReturnValue('available');
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
    mockCheckAccelerator.mockReturnValue('available');

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
    expect(mockCheckAccelerator).not.toHaveBeenCalled();
    expect(mockUpdateKeybinding).toHaveBeenCalledWith(
      'toggle-edit-mode',
      'gamepad:btn0',
      undefined
    );
    expect(mockReloadBindings).toHaveBeenCalledOnce();
  });

  it('rejects an unknown gamepad token without persisting', () => {
    expect(invokeUpdate('toggle-edit-mode', 'gamepad:nope')).toMatchObject({
      error: expect.stringContaining('Invalid controller'),
    });
    expect(mockUpdateKeybinding).not.toHaveBeenCalled();
    expect(mockLoggerError).not.toHaveBeenCalled();
  });

  it('surfaces storage conflict errors to the caller', () => {
    mockCheckAccelerator.mockReturnValue('available');
    expect(invokeUpdate('toggle-edit-mode', 'Alt+H')).toMatchObject({
      error: expect.stringContaining('already bound'),
    });
    expect(mockUpdateKeybinding).not.toHaveBeenCalled();
    expect(mockCheckAccelerator).not.toHaveBeenCalled();
    expect(mockReloadBindings).not.toHaveBeenCalled();
  });
  it('logs and propagates unexpected errors', () => {
    mockCheckAccelerator.mockImplementation(() => {
      throw new Error('Unexpected failure');
    });
    expect(() => invokeUpdate('toggle-edit-mode', 'F8')).toThrow(
      'Unexpected failure'
    );
    expect(mockLoggerError).toHaveBeenCalled();
  });
});
