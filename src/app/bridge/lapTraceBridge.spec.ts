import { describe, it, expect, beforeEach, vi } from 'vitest';

const mockLoggerWarn = vi.hoisted(() => vi.fn());
const mockLoggerError = vi.hoisted(() => vi.fn());

vi.mock('../logger', () => ({
  default: {
    info: vi.fn(),
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: vi.fn(),
  },
}));

const mockGetLapTrace = vi.hoisted(() => vi.fn());
const mockSaveLapTrace = vi.hoisted(() => vi.fn());
const mockClearLapTrace = vi.hoisted(() => vi.fn());

vi.mock('../storage/lapTraces', () => ({
  getLapTrace: mockGetLapTrace,
  saveLapTrace: mockSaveLapTrace,
  clearLapTrace: mockClearLapTrace,
}));

const mockGetGarage61LastFolder = vi.hoisted(() => vi.fn());
const mockSetGarage61LastFolder = vi.hoisted(() => vi.fn());
const mockGetIbtLastFolder = vi.hoisted(() => vi.fn());
const mockSetIbtLastFolder = vi.hoisted(() => vi.fn());
const mockGetGarage61SearchSession = vi.hoisted(() => vi.fn());

vi.mock('../storage/appSettings', () => ({
  getGarage61LastFolder: mockGetGarage61LastFolder,
  setGarage61LastFolder: mockSetGarage61LastFolder,
  getIbtLastFolder: mockGetIbtLastFolder,
  setIbtLastFolder: mockSetIbtLastFolder,
}));

vi.mock('../storage/garage61SearchSession', () => ({
  getGarage61SearchSession: mockGetGarage61SearchSession,
}));

const mockParseIbtFile = vi.hoisted(() => vi.fn());

vi.mock('../ibt/ibtImport', () => ({
  parseIbtFile: mockParseIbtFile,
}));

type IpcHandler = (
  event: unknown,
  ...args: unknown[]
) => unknown | Promise<unknown>;

const handlers = new Map<string, IpcHandler>();

const mockShowOpenDialog = vi.hoisted(() => vi.fn());
const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  ipcMain: {
    handle: (channel: string, handler: IpcHandler) => {
      handlers.set(channel, handler);
    },
    on: vi.fn(),
  },
  dialog: {
    showOpenDialog: mockShowOpenDialog,
  },
  app: {
    getPath: vi.fn(() => 'C:/Users/driver/Documents'),
  },
}));

vi.mock('node:fs/promises', () => ({
  readFile: mockReadFile,
}));

import { setupLapTraceBridge } from './lapTraceBridge';

const call = (channel: string, ...args: unknown[]) => {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return handler({}, ...args);
};

const validRecord = (n = 4) => ({
  schemaVersion: 2,
  source: { kind: 'best', label: 'Personal Best', importedAt: 1000 },
  trackId: 1,
  trackConfigName: 'Grand Prix',
  carPath: 'car1',
  trackLengthM: n * 5,
  lapTimeSec: 90,
  samples: {
    length: n,
    distanceM: Float32Array.from({ length: n }, (_, i) => i * 5),
    timeSec: Float32Array.from({ length: n }, (_, i) => i * 0.1),
    throttle: new Float32Array(n),
    brake: new Float32Array(n),
    speed: new Float32Array(n),
    gear: new Float32Array(n),
    absActive: new Float32Array(n),
  },
  recordedAt: 1000,
});

describe('lapTraceBridge', () => {
  beforeEach(() => {
    handlers.clear();
    mockLoggerWarn.mockReset();
    mockLoggerError.mockReset();
    mockGetLapTrace.mockReset();
    mockSaveLapTrace.mockReset();
    mockClearLapTrace.mockReset();
    mockShowOpenDialog.mockReset();
    mockReadFile.mockReset();
    mockGetGarage61LastFolder.mockReset();
    mockSetGarage61LastFolder.mockReset();
    mockGetGarage61SearchSession.mockReset();
    setupLapTraceBridge();
  });

  it('registers every channel', () => {
    expect([...handlers.keys()].sort()).toEqual([
      'lapTrace:clear',
      'lapTrace:fetchFromGarage61',
      'lapTrace:get',
      'lapTrace:getCurrentBestLapInfo',
      'lapTrace:getGarage61SearchInfo',
      'lapTrace:pickAndParseIbt',
      'lapTrace:pickGarage61Csv',
      'lapTrace:save',
    ]);
  });

  describe('lapTrace:getGarage61SearchInfo', () => {
    /** A session on iRacing track 418 in iRacing car 194. */
    const sessionOn = (trackId: number, carId: number) => ({
      getLatestSessionData: () => ({
        WeekendInfo: { TrackID: trackId },
        DriverInfo: {
          DriverCarIdx: 0,
          Drivers: [{ CarIdx: 0, CarID: carId }],
        },
      }),
    });

    const setupWith = (overlayManager: unknown) =>
      setupLapTraceBridge(
        overlayManager as Parameters<typeof setupLapTraceBridge>[0]
      );

    it("translates the session's ids into Garage 61's own", async () => {
      setupWith(sessionOn(418, 194));

      // iRacing 418/194 is Garage 61 318/178. Returning the iRacing numbers
      // would silently link to a different track and car.
      expect(await call('lapTrace:getGarage61SearchInfo')).toEqual({
        trackId: 318,
        carId: 178,
      });
    });

    it('falls back to the persisted session when iRacing is inactive', async () => {
      mockGetGarage61SearchSession.mockResolvedValue({
        trackId: 418,
        carId: 194,
      });

      expect(await call('lapTrace:getGarage61SearchInfo')).toEqual({
        trackId: 318,
        carId: 178,
      });
    });

    it('returns null for a track Garage 61 does not list', async () => {
      setupWith(sessionOn(999999, 194));

      // A track newer than the bundled table. Half a link is worse than none:
      // the caller falls back to the unfiltered search.
      expect(await call('lapTrace:getGarage61SearchInfo')).toBeNull();
    });

    it('returns null for a car Garage 61 does not list', async () => {
      setupWith(sessionOn(418, 999999));

      expect(await call('lapTrace:getGarage61SearchInfo')).toBeNull();
    });

    it('returns null when nothing is being driven and nothing was stored', async () => {
      mockGetGarage61SearchSession.mockResolvedValue(null);
      setupWith({ getLatestSessionData: () => undefined });

      expect(await call('lapTrace:getGarage61SearchInfo')).toBeNull();
    });
  });

  describe('lapTrace:getCurrentBestLapInfo', () => {
    it('returns null when no session is active', async () => {
      // setup ran with no overlayManager, so there is no live session.
      expect(await call('lapTrace:getCurrentBestLapInfo')).toBeNull();
    });

    it('reports the live track/car and whether a best is stored', async () => {
      const overlayManager = {
        getLatestSessionData: () => ({
          WeekendInfo: { TrackID: 18, TrackDisplayName: 'Spa' },
          DriverInfo: {
            DriverCarIdx: 0,
            Drivers: [{ CarIdx: 0, CarPath: 'mycar', CarScreenName: 'My Car' }],
          },
        }),
      };
      mockGetLapTrace.mockReturnValue(validRecord());
      setupLapTraceBridge(
        overlayManager as unknown as Parameters<typeof setupLapTraceBridge>[0]
      );

      expect(await call('lapTrace:getCurrentBestLapInfo')).toEqual({
        trackName: 'Spa',
        carName: 'My Car',
        hasBest: true,
      });
      expect(mockGetLapTrace).toHaveBeenCalledWith(18, 'mycar', 'best');
    });

    it('reports hasBest false when nothing is stored for the car/track', async () => {
      const overlayManager = {
        getLatestSessionData: () => ({
          WeekendInfo: { TrackID: 18, TrackName: 'spa' },
          DriverInfo: {
            DriverCarIdx: 0,
            Drivers: [{ CarIdx: 0, CarPath: 'mycar' }],
          },
        }),
      };
      mockGetLapTrace.mockReturnValue(null);
      setupLapTraceBridge(
        overlayManager as unknown as Parameters<typeof setupLapTraceBridge>[0]
      );

      expect(await call('lapTrace:getCurrentBestLapInfo')).toMatchObject({
        trackName: 'spa',
        hasBest: false,
      });
    });
  });

  describe('lapTrace:get', () => {
    it('forwards a valid request to storage', async () => {
      mockGetLapTrace.mockResolvedValue(null);
      await call('lapTrace:get', 1, 'car1', 'best');
      expect(mockGetLapTrace).toHaveBeenCalledWith(1, 'car1', 'best');
    });

    it('rejects a non-numeric track id', async () => {
      await expect(call('lapTrace:get', '1', 'car1', 'best')).rejects.toThrow(
        TypeError
      );
    });

    it('rejects a non-string car path', async () => {
      await expect(call('lapTrace:get', 1, 42, 'best')).rejects.toThrow(
        TypeError
      );
    });

    it('rejects a source outside the allowlist', async () => {
      await expect(call('lapTrace:get', 1, 'car1', 'other')).rejects.toThrow(
        TypeError
      );
    });

    it('returns null instead of throwing when storage fails', async () => {
      mockGetLapTrace.mockRejectedValue(new Error('disk on fire'));
      expect(await call('lapTrace:get', 1, 'car1', 'best')).toBeNull();
      expect(mockLoggerWarn).toHaveBeenCalled();
    });
  });

  describe('lapTrace:save', () => {
    it('forwards a valid record to storage', async () => {
      const record = validRecord();
      await call('lapTrace:save', 1, 'car1', 'best', record);
      expect(mockSaveLapTrace).toHaveBeenCalledWith(1, 'car1', 'best', record);
    });

    it('accepts plain arrays, as they arrive after IPC serialisation', async () => {
      const base = validRecord();
      const record = {
        ...base,
        samples: {
          length: 4,
          distanceM: [0, 5, 10, 15],
          timeSec: [0, 0.1, 0.2, 0.3],
          throttle: [0, 0, 0, 0],
          brake: [0, 0, 0, 0],
          speed: [0, 0, 0, 0],
          gear: [0, 0, 0, 0],
          absActive: [0, 0, 0, 0],
        },
      };
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', record)
      ).resolves.not.toThrow();
    });

    it('rejects a record whose sample arrays do not match samples.length', async () => {
      const record = validRecord();
      record.samples.throttle = new Float32Array(3);
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', record)
      ).rejects.toThrow(TypeError);
    });

    it('rejects a record missing a sample field', async () => {
      const record = validRecord() as Record<string, unknown>;
      (record.samples as Record<string, unknown>).gear = undefined;
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', record)
      ).rejects.toThrow(TypeError);
    });

    it('rejects a non-finite distance — the axis every search walks', async () => {
      const record = validRecord();
      record.samples.distanceM = Float32Array.from([0, Number.NaN, 10, 15]);
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', record)
      ).rejects.toThrow(TypeError);
    });

    it('rejects a record from another schema version', async () => {
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', {
          ...validRecord(),
          schemaVersion: 1,
        })
      ).rejects.toThrow(TypeError);
    });

    it('rejects a non-object payload', async () => {
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', null)
      ).rejects.toThrow(TypeError);
    });

    it('rejects a lap with fewer than two samples', async () => {
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', validRecord(1))
      ).rejects.toThrow(TypeError);
    });

    it('rejects a non-positive track length', async () => {
      await expect(
        call('lapTrace:save', 1, 'car1', 'best', {
          ...validRecord(),
          trackLengthM: 0,
        })
      ).rejects.toThrow(TypeError);
    });
  });

  describe('lapTrace:clear', () => {
    it('forwards a valid request', async () => {
      await call('lapTrace:clear', 1, 'car1', 'manual');
      expect(mockClearLapTrace).toHaveBeenCalledWith(1, 'car1', 'manual');
    });

    it('validates its arguments', async () => {
      await expect(call('lapTrace:clear', 1, 'car1', 'nope')).rejects.toThrow(
        TypeError
      );
    });
  });

  describe('lapTrace:pickAndParseIbt', () => {
    it('returns null when the user cancels the dialog', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

      expect(await call('lapTrace:pickAndParseIbt')).toBeNull();
      expect(mockParseIbtFile).not.toHaveBeenCalled();
      expect(mockSetIbtLastFolder).not.toHaveBeenCalled();
    });

    it('parses the chosen file and remembers its folder', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:/laps/spa/coach.ibt'],
      });
      const result = { fileName: 'coach.ibt', lapNumber: 3, lapTimeSec: 90 };
      mockParseIbtFile.mockResolvedValue(result);

      expect(await call('lapTrace:pickAndParseIbt')).toBe(result);
      expect(mockParseIbtFile).toHaveBeenCalledWith('C:/laps/spa/coach.ibt');
      expect(mockSetIbtLastFolder).toHaveBeenCalledWith('C:/laps/spa');
    });

    it('surfaces a clean error message when parsing fails', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:/laps/broken.ibt'],
      });
      const { IbtImportError } = await import('../ibt/ibtErrors');
      mockParseIbtFile.mockRejectedValue(
        new IbtImportError('no-valid-lap', 'No complete, clean lap was found')
      );

      await expect(call('lapTrace:pickAndParseIbt')).rejects.toThrow(
        /no complete, clean lap/i
      );
      expect(mockLoggerWarn).toHaveBeenCalled();
    });
  });

  describe('not-yet-implemented sources', () => {
    it('validates Garage 61 arguments before rejecting', () => {
      expect(() => call('lapTrace:fetchFromGarage61', 1, 'car1', 99)).toThrow(
        TypeError
      );
      expect(mockLoggerWarn).not.toHaveBeenCalled();
    });

    it('rejects the Garage 61 fetch with a clear message', () => {
      expect(() =>
        call('lapTrace:fetchFromGarage61', 1, 'car1', 'lap-123')
      ).toThrow(/not implemented yet/i);
      expect(mockLoggerWarn).toHaveBeenCalled();
    });
  });

  describe('lapTrace:pickGarage61Csv', () => {
    it('returns null when the user cancels the dialog', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

      expect(await call('lapTrace:pickGarage61Csv')).toBeNull();
      expect(mockReadFile).not.toHaveBeenCalled();
    });

    it('does not remember a folder when the dialog is cancelled', async () => {
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

      await call('lapTrace:pickGarage61Csv');

      expect(mockSetGarage61LastFolder).not.toHaveBeenCalled();
    });

    it('opens the dialog at the previously used folder', async () => {
      mockGetGarage61LastFolder.mockReturnValue('C:/Users/driver/Downloads');
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

      await call('lapTrace:pickGarage61Csv');

      expect(mockShowOpenDialog).toHaveBeenCalledWith(
        expect.objectContaining({ defaultPath: 'C:/Users/driver/Downloads' })
      );
    });

    it('omits defaultPath when no folder has been remembered yet', async () => {
      mockGetGarage61LastFolder.mockReturnValue(undefined);
      mockShowOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] });

      await call('lapTrace:pickGarage61Csv');

      const options = mockShowOpenDialog.mock.calls[0][0];
      expect(options).not.toHaveProperty('defaultPath');
    });

    it('remembers the folder of the picked file for next time', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:/Users/driver/Downloads/Garage 61 - lap.csv'],
      });
      mockReadFile.mockResolvedValue('Speed,LapDistPct\n1,0.1\n');

      await call('lapTrace:pickGarage61Csv');

      expect(mockSetGarage61LastFolder).toHaveBeenCalledWith(
        'C:/Users/driver/Downloads'
      );
    });

    it('still remembers the folder when the read afterwards fails', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:/Users/driver/Downloads/secret/lap.csv'],
      });
      mockReadFile.mockRejectedValue(new Error('disk on fire'));

      await expect(call('lapTrace:pickGarage61Csv')).rejects.toThrow();

      expect(mockSetGarage61LastFolder).toHaveBeenCalledWith(
        'C:/Users/driver/Downloads/secret'
      );
    });

    it('returns the file name and contents on success', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:/Users/driver/Downloads/Garage 61 - lap.csv'],
      });
      mockReadFile.mockResolvedValue('Speed,LapDistPct\n1,0.1\n');

      const result = await call('lapTrace:pickGarage61Csv');

      expect(result).toEqual({
        fileName: 'Garage 61 - lap.csv',
        csvText: 'Speed,LapDistPct\n1,0.1\n',
      });
    });

    it('throws a clear error and logs only the basename on a read failure', async () => {
      mockShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ['C:/Users/driver/Downloads/secret/lap.csv'],
      });
      mockReadFile.mockRejectedValue(new Error('disk on fire'));

      await expect(call('lapTrace:pickGarage61Csv')).rejects.toThrow(
        'Could not read the selected file'
      );
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('lap.csv'),
        expect.any(Error)
      );
    });
  });
});
