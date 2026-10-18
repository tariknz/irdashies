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
import type { PitLaneAnalyticsCheckpoint } from './storage/pitLaneAnalyticsCheckpoint';

const makeProvider = () => ({
  capture: vi.fn<(event: EventMessage) => void>(),
  captureConfirmed: vi
    .fn<(event: EventMessage) => Promise<void>>()
    .mockResolvedValue(undefined),
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
    provider.captureConfirmed.mock.calls.map(([event]) => event);

  const startAndSettle = async (
    target = analytics,
    version = '2.0.0'
  ): Promise<void> => {
    await target.init(version, dashboard);
    await target.waitForCalibrationUpload();
  };

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
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    await fs.rm(userDataPath.value, { recursive: true, force: true });
  });

  it('publishes the actual validated file contents with the identified installation and version', async () => {
    await writeCalibration(tracks);
    await startAndSettle();

    expect(app.getPath).toHaveBeenCalledWith('userData');
    expect(openSpy).toHaveBeenCalledWith(
      path.join(userDataPath.value, 'pitLaneData.json'),
      'r'
    );
    expect(provider.identify).toHaveBeenCalledWith(
      expect.objectContaining({ distinctId: 'test-installation' })
    );
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
    expect(calibrationEvents()).toEqual([
      {
        distinctId: 'test-installation',
        event: 'pit_lane_calibration',
        uuid: expect.any(String),
        timestamp: expect.any(Date),
        properties: {
          version: '2.0.0',
          data_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
          track_count: 3,
          tracks,
        },
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
    await startAndSettle();
    expect(calibrationEvents()[0]?.properties?.tracks).toEqual({
      '42': tracks['42'],
    });
    expect(JSON.stringify(calibrationEvents())).not.toContain('private');
  });

  it('preserves zero and one boundary values', async () => {
    await writeCalibration({ '42': { pitEntryPct: 0, pitExitPct: 1 } });
    await startAndSettle();
    expect(calibrationEvents()[0]?.properties?.tracks).toEqual({
      '42': { pitEntryPct: 0, pitExitPct: 1 },
    });
  });

  it('publishes an existing empty calibration map', async () => {
    await writeCalibration({});
    await startAndSettle();
    expect(calibrationEvents()[0]?.properties).toEqual({
      version: '2.0.0',
      data_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
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
    await expect(startAndSettle()).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
  });

  it('skips a missing file without a warning', async () => {
    await expect(startAndSettle()).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
    expect(loggerStub.warn).not.toHaveBeenCalled();
  });

  it('does not expose paths or raw exceptions when reading fails', async () => {
    openSpy.mockRejectedValueOnce(
      new Error('/Users/private/pitLaneData.json: permission denied')
    );
    await expect(startAndSettle()).resolves.toBeUndefined();
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
    await startAndSettle();
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
    await startAndSettle();
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
    await startAndSettle();
    expect(calibrationEvents()).toEqual([]);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Skipping oversized pit lane calibration event'
    );
  });

  it('reads and publishes calibration only once if init is repeated', async () => {
    await writeCalibration(tracks);
    await Promise.all([startAndSettle(), startAndSettle()]);
    expect(
      openSpy.mock.calls.filter(([file]) =>
        String(file).endsWith('pitLaneData.json')
      )
    ).toHaveLength(1);
    expect(calibrationEvents()).toHaveLength(1);
  });

  it('does not read calibration when analytics is opted out', async () => {
    vi.mocked(getAnalyticsOptOut).mockReturnValue(true);
    await startAndSettle();
    expect(openSpy).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
    expect(calibrationEvents()).toEqual([]);
  });

  it('does not read calibration without a configured provider', async () => {
    vi.stubGlobal('POSTHOG_KEY', '');
    const disabled = new Analytics();
    expect(disabled.isInitialized()).toBe(false);
    await startAndSettle(disabled);
    expect(openSpy).not.toHaveBeenCalled();
    expect(app.getPath).not.toHaveBeenCalled();
  });

  it('rechecks opt-out before sending data read asynchronously', async () => {
    await writeCalibration(tracks);
    vi.mocked(getAnalyticsOptOut)
      .mockReturnValueOnce(false)
      .mockReturnValueOnce(true);
    await startAndSettle();
    expect(openSpy).toHaveBeenCalledOnce();
    expect(calibrationEvents()).toEqual([]);
  });

  const checkpointPath = () =>
    path.join(userDataPath.value, 'pitLaneAnalytics.json');
  const readCheckpoint = async (): Promise<PitLaneAnalyticsCheckpoint> =>
    JSON.parse(
      await fs.readFile(checkpointPath(), 'utf8')
    ) as PitLaneAnalyticsCheckpoint;
  const restart = (version = '2.0.0') =>
    startAndSettle(new Analytics(provider), version);

  it('skips unchanged acknowledged data across fresh Analytics instances and app versions', async () => {
    await writeCalibration(tracks);
    await startAndSettle();
    const acknowledged = await readCheckpoint();
    expect(acknowledged.lastAcknowledgedHash).toBe(
      calibrationEvents()[0]?.properties?.data_hash
    );
    expect(acknowledged.pending).toBeUndefined();
    const renameSpy = vi.spyOn(fs, 'rename');
    await restart('3.0.0');
    expect(calibrationEvents()).toHaveLength(1);
    expect(renameSpy).not.toHaveBeenCalled();
    expect(provider.capture).toHaveBeenCalledTimes(2);
  });

  it('ignores JSON whitespace, field and numeric-ID order, and ignored fields when hashing', async () => {
    await writeCalibration({
      '9000000001': { pitEntryPct: 0.9, pitExitPct: null },
      '8000000000': { pitEntryPct: null, pitExitPct: 0.1 },
    });
    await startAndSettle();
    await fs.writeFile(
      path.join(userDataPath.value, 'pitLaneData.json'),
      JSON.stringify(
        {
          '8000000000': {
            extra: 'ignored',
            pitExitPct: 0.1,
            pitEntryPct: null,
          },
          '9000000001': { pitExitPct: null, pitEntryPct: 0.9 },
        },
        null,
        4
      )
    );
    await restart('3.0.0');
    expect(calibrationEvents()).toHaveLength(1);
  });

  it.each([
    [
      'entry changed',
      { ...tracks, '42': { ...tracks['42'], pitEntryPct: 0.97 } },
    ],
    [
      'exit changed to null',
      { ...tracks, '42': { ...tracks['42'], pitExitPct: null } },
    ],
    [
      'null entry learned',
      { ...tracks, '237': { ...tracks['237'], pitEntryPct: 0.1 } },
    ],
    [
      'track added',
      { ...tracks, '1000': { pitEntryPct: 0.9, pitExitPct: 0.1 } },
    ],
    ['track deleted', { '42': tracks['42'], '237': tracks['237'] }],
    ['map emptied', {}],
  ])('reports a changed map when %s', async (_description, changed) => {
    await writeCalibration(tracks);
    await startAndSettle();
    await writeCalibration(changed);
    await restart();
    const events = calibrationEvents();
    expect(events).toHaveLength(2);
    expect(events[1].properties?.data_hash).not.toBe(
      events[0].properties?.data_hash
    );
    expect(events[1].properties?.tracks).toEqual(changed);
  });

  it('treats an acknowledged A -> B -> A revert as a new submission', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    await writeCalibration(tracks);
    await startAndSettle();
    vi.setSystemTime(new Date('2026-01-02T00:00:00Z'));
    await writeCalibration({ '42': tracks['42'] });
    await restart();
    vi.setSystemTime(new Date('2026-01-03T00:00:00Z'));
    await writeCalibration(tracks);
    await restart();
    const events = calibrationEvents();
    expect(events).toHaveLength(3);
    expect(events[2].properties?.data_hash).toBe(
      events[0].properties?.data_hash
    );
    expect(events[2].uuid).not.toBe(events[0].uuid);
    expect(events[2].timestamp).toEqual(new Date('2026-01-03T00:00:00Z'));
  });

  it('restores A after an uncertain B delivery instead of skipping its older acknowledged hash', async () => {
    await writeCalibration(tracks);
    await startAndSettle();
    await writeCalibration({ '42': tracks['42'] });
    provider.captureConfirmed.mockRejectedValueOnce(
      new Error('Lost acknowledgment')
    );
    await restart();
    expect((await readCheckpoint()).pending).toBeDefined();
    await writeCalibration(tracks);
    provider.captureConfirmed.mockRejectedValueOnce(
      new Error('Lost restore acknowledgment')
    );
    await restart();
    expect((await readCheckpoint()).pending?.uuid).toBe(
      calibrationEvents()[2].uuid
    );
    await restart();
    const events = calibrationEvents();
    expect(events).toHaveLength(4);
    expect(events[2].properties?.data_hash).toBe(
      events[0].properties?.data_hash
    );
    expect(events[2].uuid).not.toBe(events[0].uuid);
    expect(events[2].uuid).not.toBe(events[1].uuid);
    expect(events[3].uuid).toBe(events[2].uuid);
    expect(events[3].timestamp).toEqual(events[2].timestamp);
    expect((await readCheckpoint()).pending).toBeUndefined();
  });

  it('resolves init while delivery is blocked and acknowledges only after background delivery settles', async () => {
    await writeCalibration(tracks);
    const delivery = Promise.withResolvers<undefined>();
    provider.captureConfirmed.mockReturnValueOnce(delivery.promise);
    const initialized = vi.fn();
    const startup = analytics.init('2.0.0', dashboard).then(initialized);
    await vi.waitFor(() =>
      expect(provider.captureConfirmed).toHaveBeenCalledOnce()
    );
    expect(initialized).toHaveBeenCalledOnce();
    const pending = await readCheckpoint();
    expect(pending.lastAcknowledgedHash).toBeNull();
    expect(pending.pending?.uuid).toBe(calibrationEvents()[0].uuid);
    delivery.resolve(undefined);
    await startup;
    await analytics.waitForCalibrationUpload();
    const acknowledged = await readCheckpoint();
    expect(acknowledged.lastAcknowledgedHash).toBe(
      calibrationEvents()[0].properties?.data_hash
    );
    expect(acknowledged.pending).toBeUndefined();
  });

  it('handles rejected background delivery after init resolves and preserves pending retry identity', async () => {
    await writeCalibration(tracks);
    const delivery = Promise.withResolvers<undefined>();
    provider.captureConfirmed.mockReturnValueOnce(delivery.promise);
    await expect(analytics.init('2.0.0', dashboard)).resolves.toBeUndefined();
    await vi.waitFor(() =>
      expect(provider.captureConfirmed).toHaveBeenCalledOnce()
    );
    const pending = await readCheckpoint();
    delivery.reject(new Error('Background HTTP failed'));
    await expect(analytics.waitForCalibrationUpload()).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledExactlyOnceWith({
      event: 'app_started',
    });
    expect(await readCheckpoint()).toEqual(pending);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Could not publish pit lane calibration'
    );
  });

  it('retries failed delivery across restarts with exactly the same UUID and timestamp', async () => {
    await writeCalibration(tracks);
    provider.captureConfirmed.mockRejectedValueOnce(new Error('HTTP failed'));
    await startAndSettle();
    expect((await readCheckpoint()).lastAcknowledgedHash).toBeNull();
    await restart('3.0.0');
    const [first, retry] = calibrationEvents();
    expect(retry.uuid).toBe(first.uuid);
    expect(retry.timestamp).toEqual(first.timestamp);
    expect(retry.properties?.data_hash).toBe(first.properties?.data_hash);
    expect((await readCheckpoint()).pending).toBeUndefined();
  });

  it('uses a new identity if calibration changes while an earlier delivery is pending', async () => {
    await writeCalibration(tracks);
    provider.captureConfirmed.mockRejectedValueOnce(new Error('HTTP failed'));
    await startAndSettle();
    await writeCalibration({ '42': tracks['42'] });
    await restart();
    expect(calibrationEvents()[1].uuid).not.toBe(calibrationEvents()[0].uuid);
  });

  it('scopes acknowledged hashes to the installation distinct ID', async () => {
    await writeCalibration(tracks);
    await startAndSettle();
    vi.mocked(readData).mockReturnValue('another-installation');
    await restart();
    const events = calibrationEvents();
    expect(events).toHaveLength(2);
    expect(events[1].distinctId).toBe('another-installation');
    expect(events[1].uuid).not.toBe(events[0].uuid);
    expect(events[1].properties?.data_hash).toBe(
      events[0].properties?.data_hash
    );
  });

  it('does not send if the pending checkpoint cannot be persisted', async () => {
    await writeCalibration(tracks);
    const original = await fs.readFile(
      path.join(userDataPath.value, 'pitLaneData.json'),
      'utf8'
    );
    vi.spyOn(fs, 'rename').mockRejectedValueOnce(
      new Error('/Users/private write failed')
    );
    await startAndSettle();
    expect(calibrationEvents()).toEqual([]);
    expect(await fs.readdir(userDataPath.value)).toEqual(['pitLaneData.json']);
    expect(
      await fs.readFile(
        path.join(userDataPath.value, 'pitLaneData.json'),
        'utf8'
      )
    ).toBe(original);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Could not save pit lane delivery checkpoint'
    );
    await restart();
    expect(calibrationEvents()).toHaveLength(1);
  });

  it('retains pending retry identity when saving the acknowledged hash fails', async () => {
    await writeCalibration(tracks);
    const rename = fs.rename;
    vi.spyOn(fs, 'rename')
      .mockImplementationOnce(rename)
      .mockRejectedValueOnce(new Error('Acknowledged checkpoint write failed'));
    await startAndSettle();
    const pending = await readCheckpoint();
    expect(pending.lastAcknowledgedHash).toBeNull();
    expect(pending.pending?.uuid).toBe(calibrationEvents()[0].uuid);
    await restart();
    const [first, retry] = calibrationEvents();
    expect(retry.uuid).toBe(first.uuid);
    expect(retry.timestamp).toEqual(first.timestamp);
    expect((await readCheckpoint()).lastAcknowledgedHash).toBe(
      first.properties?.data_hash
    );
    expect((await readCheckpoint()).pending).toBeUndefined();
  });

  it.each([
    '{',
    '[]',
    ' '.repeat(4097),
    '{"version":1,"distinctId":"test-installation","lastAcknowledgedHash":"invalid"}',
  ])(
    'does not send or replace malformed/oversized checkpoint metadata %#',
    async (metadata) => {
      await writeCalibration(tracks);
      await fs.writeFile(checkpointPath(), metadata);
      await startAndSettle();
      expect(calibrationEvents()).toEqual([]);
      expect(await fs.readFile(checkpointPath(), 'utf8')).toBe(metadata);
      expect(loggerStub.warn).toHaveBeenCalledWith(
        '[Analytics] Could not read pit lane delivery checkpoint'
      );
    }
  );

  it('does not send when checkpoint metadata cannot be read', async () => {
    await writeCalibration(tracks);
    await fs.mkdir(checkpointPath());
    await expect(startAndSettle()).resolves.toBeUndefined();
    expect(calibrationEvents()).toEqual([]);
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Could not read pit lane delivery checkpoint'
    );
  });

  it('does not fail startup when the calibration event provider throws', async () => {
    await writeCalibration(tracks);
    provider.captureConfirmed.mockRejectedValueOnce(
      new Error('Provider failed')
    );
    await expect(startAndSettle()).resolves.toBeUndefined();
    expect(provider.capture).toHaveBeenCalledWith({ event: 'app_started' });
    expect(loggerStub.warn).toHaveBeenCalledWith(
      '[Analytics] Could not publish pit lane calibration'
    );
  });
});
