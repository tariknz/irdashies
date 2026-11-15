import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BrowserWindow, ipcMain } from 'electron';
import logger from '../logger';
import { setupLogBridge } from './logBridge';

vi.mock('electron', () => ({
  ipcMain: { on: vi.fn() },
  BrowserWindow: { fromWebContents: vi.fn() },
}));
vi.mock('../logger', () => ({
  default: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('log bridge', () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.unstubAllEnvs());

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

  it('attributes perf reports from the IPC sender rather than claimed renderer IDs', () => {
    vi.stubEnv('PERF_METRICS', '1');
    vi.stubEnv('PERF_METRICS_COLLECTION', 'on');
    vi.mocked(BrowserWindow.fromWebContents).mockReturnValue({
      id: 12,
    } as Electron.BrowserWindow);
    setupLogBridge();
    const handler = vi.mocked(ipcMain.on).mock.calls[0][1];
    handler(
      {
        sender: { id: 27, getOSProcessId: () => 1234 },
      } as unknown as Electron.IpcMainEvent,
      'info',
      '[PerfRenderer:JSON] ' +
        JSON.stringify({
          schemaVersion: 1,
          pid: 1,
          osPid: 999,
          webContentsId: 999,
        })
    );
    const value = JSON.parse(
      String(vi.mocked(logger.info).mock.calls[0][1]).split(
        '[PerfRenderer:JSON] '
      )[1]
    );
    expect(value).toMatchObject({
      pid: 1,
      osPid: 1234,
      webContentsId: 27,
      windowId: 12,
    });
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
