import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ipcMain } from 'electron';
import logger from '../logger';
import { setupLogBridge } from './logBridge';

vi.mock('electron', () => ({ ipcMain: { on: vi.fn() } }));
vi.mock('../logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('log bridge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('forwards structured diagnostics for every allowed literal level', () => {
    setupLogBridge();
    const handler = vi.mocked(ipcMain.on).mock.calls[0][1];
    const error = {
      name: 'NotAllowedError',
      message: 'Failed to open device',
      code: 0,
    };
    for (const level of ['debug', 'info', 'warn', 'error'] as const) {
      handler({} as Electron.IpcMainEvent, level, 'HID error', error);
      expect(logger[level]).toHaveBeenCalledWith(
        '[renderer]',
        'HID error',
        error
      );
    }
  });

  it('rejects unknown levels without dispatching arbitrary logger properties', () => {
    setupLogBridge();
    const handler = vi.mocked(ipcMain.on).mock.calls[0][1];
    for (const level of ['initialize', '__proto__', null, {}, 42]) {
      expect(() =>
        handler({} as Electron.IpcMainEvent, level, 'unsafe')
      ).not.toThrow();
    }
    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.debug).not.toHaveBeenCalled();
  });
});
