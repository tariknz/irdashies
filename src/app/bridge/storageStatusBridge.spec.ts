import { beforeEach, expect, it, vi } from 'vitest';
import { reportStorageResult } from '../storage/storageStatus';

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (event: unknown, value?: unknown) => unknown>(),
  send: vi.fn(),
  show: vi.fn(),
  close: vi.fn(),
}));
vi.mock('electron', () => ({
  app: { on: vi.fn(), removeListener: vi.fn() },
  ipcMain: {
    handle: (
      name: string,
      handler: (event: unknown, value?: unknown) => unknown
    ) => mocks.handlers.set(name, handler),
    removeHandler: (name: string) => mocks.handlers.delete(name),
  },
  contextBridge: {},
  ipcRenderer: {},
  BrowserWindow: {
    getAllWindows: () => [
      {
        isDestroyed: () => false,
        isVisible: () => true,
        webContents: { id: 1, send: mocks.send },
      },
    ],
  },
  Notification: class {
    static isSupported() {
      return true;
    }
    show = mocks.show;
    close = mocks.close;
  },
}));
vi.mock('../logger', () => ({ default: { warn: vi.fn() } }));
import { setupStorageStatusBridge } from './storageStatusBridge';

beforeEach(() => {
  reportStorageResult('fuel');
  reportStorageResult('referenceLaps');
  vi.clearAllMocks();
  mocks.handlers.clear();
});

it('validates subscriptions, sends initial status and deduplicates OS notifications across files', () => {
  const dispose = setupStorageStatusBridge();
  const sender = {
    id: 1,
    send: mocks.send,
    once: vi.fn(),
    removeListener: vi.fn(),
  };
  const subscribe =
    mocks.handlers.get('storageStatus:subscribe') ??
    (() => {
      throw new Error('Missing subscribe handler');
    });
  expect(() => subscribe({ sender }, '../bad')).toThrow('Invalid');
  expect(() =>
    mocks.handlers.get('storageStatus:unsubscribe')?.({ sender }, {})
  ).toThrow('Invalid');
  subscribe({ sender }, 'status');
  expect(mocks.send).toHaveBeenLastCalledWith('storageStatus:changed', {
    diskFull: false,
  });
  reportStorageResult('fuel', { code: 'ENOSPC' });
  reportStorageResult('referenceLaps', { code: 'ENOSPC' });
  reportStorageResult('fuel', { code: 'ENOSPC' });
  expect(mocks.show).toHaveBeenCalledOnce();
  reportStorageResult('fuel');
  expect(mocks.close).not.toHaveBeenCalled();
  reportStorageResult('referenceLaps');
  expect(mocks.close).toHaveBeenCalledOnce();
  expect(mocks.send).toHaveBeenLastCalledWith('storageStatus:changed', {
    diskFull: false,
  });
  reportStorageResult('fuel', { code: 'ENOSPC' });
  expect(mocks.show).toHaveBeenCalledTimes(2);
  dispose();
});
