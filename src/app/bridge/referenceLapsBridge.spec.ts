import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLoggerInfo = vi.hoisted(() => vi.fn());
const mockLoggerDebug = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: mockLoggerInfo,
    warn: vi.fn(),
    error: mockLoggerError,
    debug: mockLoggerDebug,
  },
}));

const mockGetReferenceLap = vi.hoisted(() => vi.fn());
const mockSaveReferenceLap = vi.hoisted(() => vi.fn());

vi.mock('../storage/referenceLaps', () => ({
  getReferenceLap: mockGetReferenceLap,
  saveReferenceLap: mockSaveReferenceLap,
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

import {
  setupReferenceLapsBridge,
  __resetReferenceLapsBridgeForTests,
} from './referenceLapsBridge';

const invokeGet = (seriesId: number, trackId: number, classId: number) => {
  const handler = handlers.get('reference:get');
  if (!handler) throw new Error('reference:get handler not registered');
  return handler({}, seriesId, trackId, classId);
};

describe('referenceLapsBridge', () => {
  beforeEach(() => {
    handlers.clear();
    __resetReferenceLapsBridgeForTests();
    mockLoggerInfo.mockReset();
    mockLoggerDebug.mockReset();
    mockLoggerError.mockReset();
    mockGetReferenceLap.mockReset();
    mockSaveReferenceLap.mockReset();
    mockGetReferenceLap.mockReturnValue(null);
    setupReferenceLapsBridge();
  });

  describe('reference:get fetch dedup', () => {
    it('logs an INFO line on the first fetch for a given key', () => {
      invokeGet(539, 127, 2523);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[Main] Fetching reference lap for Series: 539, Track: 127, Class: 2523'
      );
    });

    it('dedups subsequent fetches for the same key within the TTL window', () => {
      invokeGet(539, 127, 2523);
      invokeGet(539, 127, 2523);
      invokeGet(539, 127, 2523);

      const infoCalls = mockLoggerInfo.mock.calls.filter((call) =>
        (call[0] as string).startsWith('[Main] Fetching reference lap')
      );
      expect(infoCalls).toHaveLength(1);

      const debugCalls = mockLoggerDebug.mock.calls.filter((call) =>
        (call[0] as string).startsWith("[Main] Reference lap fetch dedup'd")
      );
      expect(debugCalls).toHaveLength(2);
    });

    it('logs distinct INFO lines for different keys', () => {
      invokeGet(539, 127, 2523);
      invokeGet(539, 127, 4011);
      invokeGet(539, 127, 4029);

      const infoCalls = mockLoggerInfo.mock.calls.filter((call) =>
        (call[0] as string).startsWith('[Main] Fetching reference lap')
      );
      expect(infoCalls).toHaveLength(3);
    });

    it("still serves the cached value from storage for dedup'd fetches", () => {
      const fakeLap = { finishTime: 60 } as unknown;
      mockGetReferenceLap.mockReturnValue(fakeLap);

      expect(invokeGet(539, 127, 2523)).toBe(fakeLap);
      expect(invokeGet(539, 127, 2523)).toBe(fakeLap);
      expect(invokeGet(539, 127, 2523)).toBe(fakeLap);

      expect(mockGetReferenceLap).toHaveBeenCalledTimes(3);
    });

    it('logs a fresh INFO line after the TTL window expires', () => {
      vi.useFakeTimers();
      try {
        vi.setSystemTime(new Date(0));
        invokeGet(539, 127, 2523);
        vi.setSystemTime(new Date(6000));
        invokeGet(539, 127, 2523);

        const infoCalls = mockLoggerInfo.mock.calls.filter((call) =>
          (call[0] as string).startsWith('[Main] Fetching reference lap')
        );
        expect(infoCalls).toHaveLength(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('reference:save', () => {
    it('logs and delegates to saveReferenceLap', () => {
      const handler = handlers.get('reference:save');
      if (!handler) throw new Error('reference:save handler not registered');
      const lap = { finishTime: 90 } as never;

      handler({}, 539, 127, 2523, lap);

      expect(mockLoggerInfo).toHaveBeenCalledWith(
        '[Main] Saving reference lap for Series: 539, Track: 127, Class: 2523'
      );
      expect(mockSaveReferenceLap).toHaveBeenCalledWith(539, 127, 2523, lap);
    });
  });
});
