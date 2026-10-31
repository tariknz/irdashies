import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_KEYBINDINGS, KEYBINDING_MESSAGES } from '@irdashies/types';

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  check: vi.fn(),
  reload: vi.fn(),
  unregister: vi.fn(),
  register: vi.fn(),
  startCapture: vi.fn(),
  stopCapture: vi.fn(),
  statuses: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  reset: vi.fn(),
  resetAll: vi.fn(),
}));
vi.mock('../logger', () => ({
  default: { error: mocks.error, warn: vi.fn() },
}));
type Handler = (event: unknown, ...args: unknown[]) => unknown;
const handlers = new Map<string, Handler>();
vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: Handler) =>
      handlers.set(channel, handler),
  },
}));
vi.mock('../storage/storage', () => ({
  readData: vi.fn(),
  writeData: vi.fn(),
  writeDataAsync: vi.fn(),
}));
vi.mock('../storage/keybindings', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../storage/keybindings')>()),
  getKeybindings: mocks.get,
  updateKeybinding: mocks.update,
  resetKeybinding: mocks.reset,
  resetAllKeybindings: mocks.resetAll,
  persistKeybindingMigrations: vi.fn(async () => undefined),
}));
vi.mock('../keybindingManager', () => ({
  KeybindingManager: class {
    static checkAccelerator = mocks.check;
    reloadBindings = mocks.reload;
    unregisterAll = mocks.unregister;
    registerAll = mocks.register;
    startGamepadCapture = mocks.startCapture;
    stopGamepadCapture = mocks.stopCapture;
    getRegistrationStatuses = mocks.statuses;
  },
}));
vi.mock('../setupTaskbar', () => ({ rebuildTaskbarMenu: vi.fn() }));
import { setupKeybindingsBridge } from './keybindingsBridge';
import { KeybindingManager } from '../keybindingManager';
import { KeybindingConflictError } from '../storage/keybindings';
const invoke = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(`keybindings:${channel}`);
  if (!handler) throw new Error(`Missing handler: ${channel}`);
  return handler({}, ...args);
};

describe('keybindings bridge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.check.mockReset().mockReturnValue('available');
    mocks.get.mockReturnValue(DEFAULT_KEYBINDINGS);
    mocks.update.mockReset().mockReturnValue(DEFAULT_KEYBINDINGS);
    setupKeybindingsBridge(new KeybindingManager({} as never));
  });

  it.each(['invalid', 'unavailable'] as const)(
    'returns recoverable %s feedback without persisting or reporting an app error',
    (status) => {
      mocks.check.mockReturnValue(status);
      expect(invoke('update', 'toggle-hide-ui', 'Alt+J')).toEqual({
        ok: false,
        message: KEYBINDING_MESSAGES[status],
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.reload).not.toHaveBeenCalled();
      expect(mocks.error).not.toHaveBeenCalled();
    }
  );

  it('checks duplicates before OS availability and leaves the existing action intact', () => {
    expect(invoke('update', 'toggle-edit-mode', 'Alt+H')).toEqual({
      ok: false,
      message: expect.stringContaining(
        'already bound to "Hide / Show UI" in irDashies'
      ),
    });
    expect(mocks.check).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('returns typed success and forwards dynamic action metadata', () => {
    const meta = { label: 'Standings', description: 'Show / hide Standings' };
    expect(invoke('update', 'toggle-widget:standings', 'Alt+1', meta)).toEqual({
      ok: true,
      bindings: DEFAULT_KEYBINDINGS,
    });
    expect(mocks.update).toHaveBeenCalledWith(
      'toggle-widget:standings',
      'Alt+1',
      meta
    );
    expect(mocks.reload).toHaveBeenCalledOnce();
  });

  it('accepts reselecting the same action shortcut', () => {
    expect(invoke('update', 'toggle-hide-ui', 'Alt+H')).toHaveProperty(
      'ok',
      true
    );
  });

  it.each(['bogus-action', 'toggle-widget:', null])(
    'rejects unsupported action %s',
    (action) => {
      expect(() => invoke('update', action, 'Alt+J')).toThrow();
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );

  it.each([[null], [42], ['F8', { label: 2, description: '' }]])(
    'validates IPC arguments: %s',
    (...args) => {
      expect(() => invoke('update', 'toggle-hide-ui', ...args)).toThrow(
        'Invalid keybinding arguments'
      );
      expect(mocks.update).not.toHaveBeenCalled();
    }
  );

  it.each(['', 'gamepad:btn0', 'gamepad:btn0+gamepad:btn5'])(
    'accepts unbinding or gamepad input %s without keyboard probing',
    (accelerator) => {
      expect(invoke('update', 'toggle-edit-mode', accelerator)).toHaveProperty(
        'ok',
        true
      );
      expect(mocks.check).not.toHaveBeenCalled();
    }
  );

  it('returns recoverable feedback for invalid gamepad input', () => {
    expect(invoke('update', 'toggle-edit-mode', 'gamepad:nope')).toHaveProperty(
      'ok',
      false
    );
    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it('preserves storage conflict feedback', () => {
    mocks.update.mockImplementation(() => {
      throw new KeybindingConflictError('already bound');
    });
    expect(invoke('update', 'toggle-edit-mode', 'F8')).toEqual({
      ok: false,
      message: 'already bound',
    });
    expect(mocks.reload).not.toHaveBeenCalled();
    expect(mocks.error).not.toHaveBeenCalled();
  });

  it.each(['probe', 'storage'])(
    'logs and propagates unexpected %s errors',
    (source) => {
      const error = new Error('Unexpected failure');
      (source === 'probe' ? mocks.check : mocks.update).mockImplementation(
        () => {
          throw error;
        }
      );
      expect(() => invoke('update', 'toggle-hide-ui', 'Alt+J')).toThrow(error);
      expect(mocks.error).toHaveBeenCalledWith(
        'Failed to update keybinding:',
        error
      );
    }
  );

  it('exposes startup registration results separately from saved bindings', () => {
    const statuses = {
      'toggle-hide-ui': {
        status: 'unavailable',
        message: KEYBINDING_MESSAGES.unavailable,
      },
    };
    mocks.statuses.mockReturnValue(statuses);
    expect(invoke('get')).toBe(DEFAULT_KEYBINDINGS);
    expect(invoke('registrationStatuses')).toBe(statuses);
  });

  it('releases keys for recording and re-registers them on stop, preserving gamepad capture', () => {
    invoke('startRecording');
    expect(mocks.unregister).toHaveBeenCalledOnce();
    expect(mocks.startCapture).toHaveBeenCalledWith(expect.any(Function));
    invoke('stopRecording');
    expect(mocks.stopCapture).toHaveBeenCalledOnce();
    expect(mocks.register).toHaveBeenCalledOnce();
  });

  it('reloads registrations after resets and validates reset action ids', () => {
    invoke('reset', 'toggle-edit-mode');
    invoke('resetAll');
    expect(mocks.reload).toHaveBeenCalledTimes(2);
    expect(() => invoke('reset', 'bogus')).toThrow('not a supported');
  });
});
