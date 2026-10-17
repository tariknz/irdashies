import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockInstance,
} from 'vitest';
import type { LogMessage } from 'electron-log';
import type { EventMessage, IdentifyMessage } from 'posthog-node';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const { userDataPath } = vi.hoisted(() => ({ userDataPath: { value: '' } }));

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => userDataPath.value) },
  screen: {
    getAllDisplays: vi.fn().mockReturnValue([]),
    getPrimaryDisplay: vi
      .fn()
      .mockReturnValue({ size: { width: 0, height: 0 } }),
  },
}));

const { loggerStub } = vi.hoisted(() => ({
  loggerStub: {
    transports: {
      file: { level: 'info', maxSize: 0 },
      console: { level: 'debug' },
    } as Record<string, unknown>,
    initialize: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('electron-log/main', () => ({
  default: loggerStub,
}));

vi.mock('./storage/storage', () => ({
  readData: vi.fn(),
  writeData: vi.fn(),
}));

vi.mock('./storage/analytics', () => ({
  getAnalyticsOptOut: vi.fn().mockReturnValue(true),
}));

import { Analytics, type AnalyticsProvider } from './analytics';
import logger from './logger';
import { getAnalyticsOptOut } from './storage/analytics';
import { readData } from './storage/storage';
import { app } from 'electron';

const makeProvider = () => ({
  capture: vi.fn<(event: EventMessage) => void>(),
  identify: vi.fn<(message: IdentifyMessage) => void>(),
  shutdown: vi.fn<(shutdownTimeoutMs?: number) => void>(),
});

const emit = (level: LogMessage['level'], ...data: unknown[]): void => {
  const transport = logger.transports.posthog as unknown as (
    msg: LogMessage
  ) => void;
  transport({ level, data, date: new Date() } as LogMessage);
};

describe('Analytics.setupLogTransport', () => {
  let provider: ReturnType<typeof makeProvider>;
  let analytics: Analytics;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    provider = makeProvider();
    analytics = new Analytics(provider);
    analytics.setupLogTransport();
  });

  afterEach(() => {
    vi.useRealTimers();
    delete logger.transports.posthog;
  });

  it('forwards a log message to the provider', () => {
    emit('warn', 'something went wrong');
    expect(provider.capture).toHaveBeenCalledWith({
      event: 'log_message',
      properties: { level: 'warn', message: 'something went wrong' },
    });
  });

  it('suppresses identical messages within the dedup window', () => {
    emit('warn', 'flooded message');
    vi.advanceTimersByTime(30 * 60 * 1000);
    emit('warn', 'flooded message');
    expect(provider.capture).toHaveBeenCalledTimes(1);
  });

  it('re-emits an identical message after the dedup window elapses', () => {
    emit('warn', 'flooded message');
    vi.advanceTimersByTime(60 * 60 * 1000 + 1);
    emit('warn', 'flooded message');
    expect(provider.capture).toHaveBeenCalledTimes(2);
  });

  it('treats the same text at different levels as distinct', () => {
    emit('warn', 'same text');
    emit('error', 'same text');
    expect(provider.capture).toHaveBeenCalledTimes(2);
  });

  it('keys on the first 30 characters — messages sharing that prefix collide', () => {
    const prefix = 'a'.repeat(30);
    emit('warn', `${prefix}-foo`);
    emit('warn', `${prefix}-bar`);
    expect(provider.capture).toHaveBeenCalledTimes(1);
  });

  it('stringifies non-string log data', () => {
    emit('warn', 'context:', { code: 42 });
    expect(provider.capture).toHaveBeenCalledWith({
      event: 'log_message',
      properties: { level: 'warn', message: 'context: {"code":42}' },
    });
  });

  it('does nothing when the provider is absent', () => {
    const noopAnalytics = new Analytics(provider);
    // Force provider to null by going through the public surface
    (
      noopAnalytics as unknown as { provider: AnalyticsProvider | null }
    ).provider = null;
    delete logger.transports.posthog;
    noopAnalytics.setupLogTransport();
    expect(logger.transports.posthog).toBeUndefined();
  });
});

describe('Analytics startup pit lane calibration', () => {
  let provider: ReturnType<typeof makeProvider>;
  let analytics: Analytics;
  let openSpy: MockInstance<typeof fs.open>;
  const dashboard = { widgets: [] };
  const tracks = {
    '42': { pitEntryPct: 0.98, pitExitPct: 0.02 },
    '237': { pitEntryPct: null, pitExitPct: 0.18 },
    '999': { pitEntryPct: null, pitExitPct: null },
  };

  const writeCalibration = (value: unknown) =>
    fs.writeFile(
      path.join(userDataPath.value, 'pitLaneData.json'),
      JSON.stringify(value)
    );
  const calibrationEvents = () =>
    provider.capture.mock.calls
      .map(([event]) => event)
      .filter((event) => event.event === 'pit_lane_calibration');

  beforeEach(async () => {
    userDataPath.value = await fs.mkdtemp(
      path.join(os.tmpdir(), 'irdashies-calibration-')
    );
    vi.mocked(getAnalyticsOptOut).mockReturnValue(false);
    vi.mocked(readData).mockReturnValue('test-installation');
    vi.mocked(app.getPath).mockClear();
    loggerStub.warn.mockClear();
    openSpy = vi.spyOn(fs, 'open');
    provider = makeProvider();
    analytics = new Analytics(provider);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await fs.rm(userDataPath.value, { recursive: true, force: true });
  });

  it('publishes the actual validated file contents with the identified installation and version', async () => {
    await writeCalibration(tracks);
    await analytics.init('2.0.0', dashboard);

    expect(app.getPath).toHaveBeenCalledWith('userData');
    expect(openSpy).toHaveBeenCalledWith(
      path.join(userDataPath.value, 'pitLaneData.json'),
      'r'
    );
    expect(provider.identify).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: 'test-installation' })
    );
    expect(provider.capture.mock.calls.map(([event]) => event.event)).toEqual([
      'app_started',
      'pit_lane_calibration',
    ]);
    expect(calibrationEvents()).toEqual([
      {
        distinctId: 'test-installation',
        event: 'pit_lane_calibration',
        properties: { version: '2.0.0', track_count: 3, tracks },
      },
    ]);
  });

  it('strips unrelated fields rather than sending raw file data', async () => {
    await writeCalibration({
      '42': {
        ...tracks['42'],
        username: 'private name',
        path: '/Users/private',
      },
    });
    await analytics.init('2.0.0', dashboard);
    expect(calibrationEvents()[0]?.properties?.tracks).toEqual({
      '42': tracks['42'],
    });
    expect(JSON.stringify(calibrationEvents())).not.toContain('private');
  });

  it('preserves zero and one boundary values', async () => {
    await writeCalibration({ '42': { pitEntryPct: 0, pitExitPct: 1 } });
    await analytics.init('2.0.0', dashboard);
    expect(calibrationEvents()[0]?.properties?.tracks).toEqual({
      '42': { pitEntryPct: 0, pitExitPct: 1 },
    });
  });

  it('publishes an existing empty calibration map', async () => {
    await writeCalibration({});
    await analytics.init('2.0.0', dashboard);
    expect(calibrationEvents()[0]?.properties).toEqual({
      version: '2.0.0',
      track_count: 0,
      tracks: {},
    });
  });

  it.each([
    ['invalid JSON', '{'],
    ['null root', 'null'],
    ['array root', '[]'],
    ['string root', '"private"'],
    ['nonnumeric ID', '{"track-name":{"pitEntryPct":0.9,"pitExitPct":0.1}}'],
    ['prototype ID', '{"__proto__":{"pitEntryPct":0.9,"pitExitPct":0.1}}'],
    ['zero ID', '{"0":{"pitEntryPct":0.9,"pitExitPct":0.1}}'],
    ['noncanonical ID', '{"0042":{"pitEntryPct":0.9,"pitExitPct":0.1}}'],
    [
      'unsafe numeric ID',
      '{"9007199254740992":{"pitEntryPct":0.9,"pitExitPct":0.1}}',
    ],
    ['missing exit', '{"42":{"pitEntryPct":0.9}}'],
    ['negative entry', '{"42":{"pitEntryPct":-0.1,"pitExitPct":0.1}}'],
    ['exit over one', '{"42":{"pitEntryPct":0.9,"pitExitPct":1.1}}'],
    ['nonfinite position', '{"42":{"pitEntryPct":1e400,"pitExitPct":0.1}}'],
    ['string position', '{"42":{"pitEntryPct":"0.9","pitExitPct":0.1}}'],
    ['array calibration', '{"42":[]}'],
  ])('skips %s without breaking app_started', async (_name, text) => {
    await fs.writeFile(path.join(userDataPath.value, 'pitLaneData.json'), text);
    await expect(analytics.init('2.0.0', dashboard)).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
  });

  it('skips a missing file without a warning', async () => {
    await expect(analytics.init('2.0.0', dashboard)).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
    expect(loggerStub.warn).not.toHaveBeenCalled();
  });

  it('does not expose paths or raw exceptions when reading fails', async () => {
    openSpy.mockRejectedValueOnce(
      new Error('/Users/private/pitLaneData.json: permission denied')
    );
    await expect(analytics.init('2.0.0', dashboard)).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
    expect(loggerStub.warn).toHaveBeenCalledExactlyOnceWith(
      '[Analytics] Could not read pit lane calibration'
    );
  });

  it('skips files larger than the bounded read', async () => {
    await fs.writeFile(
      path.join(userDataPath.value, 'pitLaneData.json'),
      ' '.repeat(2 * 1024 * 1024 + 1)
    );
    await analytics.init('2.0.0', dashboard);
    expect(calibrationEvents()).toEqual([]);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Skipping oversized pit lane calibration'
    );
  });

  it('skips more than 10,000 tracks without truncating the file', async () => {
    await writeCalibration(
      Object.fromEntries(
        Array.from({ length: 10_001 }, (_, index) => [index + 1, tracks['42']])
      )
    );
    await analytics.init('2.0.0', dashboard);
    expect(calibrationEvents()).toEqual([]);
  });

  it('skips a valid map whose serialized event properties exceed 512 KiB', async () => {
    await writeCalibration(
      Object.fromEntries(
        Array.from({ length: 10_000 }, (_, index) => [
          index + 1,
          { pitEntryPct: 0.9876543210987654, pitExitPct: 0.1234567890123456 },
        ])
      )
    );
    await analytics.init('2.0.0', dashboard);
    expect(calibrationEvents()).toEqual([]);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Skipping oversized pit lane calibration event'
    );
  });

  it('reads and publishes calibration only once if init is repeated', async () => {
    await writeCalibration(tracks);
    await Promise.all([
      analytics.init('2.0.0', dashboard),
      analytics.init('2.0.0', dashboard),
    ]);
    expect(openSpy).toHaveBeenCalledOnce();
    expect(calibrationEvents()).toHaveLength(1);
  });

  it('does not read calibration when analytics is opted out', async () => {
    vi.mocked(getAnalyticsOptOut).mockReturnValue(true);
    await analytics.init('2.0.0', dashboard);
    expect(openSpy).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
    expect(calibrationEvents()).toEqual([]);
  });

  it('does not read calibration without a configured provider', async () => {
    vi.stubGlobal('POSTHOG_KEY', '');
    const disabled = new Analytics();
    expect(disabled.isInitialized()).toBe(false);
    await disabled.init('2.0.0', dashboard);
    expect(openSpy).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
  });

  it('rechecks opt-out before sending data read asynchronously', async () => {
    await writeCalibration(tracks);
    vi.mocked(getAnalyticsOptOut)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await analytics.init('2.0.0', dashboard);
    expect(openSpy).toHaveBeenCalledOnce();
    expect(calibrationEvents()).toEqual([]);
  });

  it('does not fail startup when the calibration event provider throws', async () => {
    await writeCalibration(tracks);
    provider.capture.mockImplementation((event) => {
      if (event.event === 'pit_lane_calibration')
        throw new Error('Provider failed');
    });
    await expect(analytics.init('2.0.0', dashboard)).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledWith({ event: 'app_started' });
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Could not publish pit lane calibration'
    );
  });
});
