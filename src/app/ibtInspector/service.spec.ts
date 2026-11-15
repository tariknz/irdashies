import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { PerfReport } from '../perfMetrics';
import { importIbt } from './importIbt';
import {
  downsampleIbtTelemetry,
  IbtInspectorService,
  parseCaptureReport,
  validateIbtName,
} from './service';
const metrics = vi.hoisted(() => ({
  listener: undefined as ((report: PerfReport) => void) | undefined,
}));
vi.mock('../perfMetrics', () => ({
  onPerfReport: (listener: (report: PerfReport) => void) => {
    metrics.listener = listener;
    return () => {
      metrics.listener = undefined;
    };
  },
}));
vi.mock('./importIbt', () => ({
  importIbt: vi.fn(async (_input: string, output: string) => {
    await writeFile(output, 'normalized');
    return { warnings: ['IBT snapshot'], frames: 10 };
  }),
}));
let directory: string;
let deps: ConstructorParameters<typeof IbtInspectorService>[0];
let service: IbtInspectorService;
beforeEach(async () => {
  directory = await mkdtemp(path.join(tmpdir(), 'ibt-inspector-'));
  await mkdir(path.join(directory, 'telemetry'));
  deps = {
    directory: path.join(directory, 'telemetry'),
    workDirectory: path.join(directory, 'work'),
    enabled: () => true,
    switchSource: vi.fn(async () => undefined),
    getPlayback: () => ({
      position: 0,
      duration: 10,
      speed: 1,
      paused: true,
      ended: false,
      framesConsumed: 1,
      framesDelivered: 1,
    }),
    command: vi.fn(),
  };
  service = new IbtInspectorService(deps);
  await writeFile(path.join(deps.directory, 'race.ibt'), 'original');
});
afterEach(async () => {
  await service.stop();
  await rm(directory, { recursive: true, force: true });
  vi.clearAllMocks();
});
it('downsamples evenly while preserving the full capture range', () => {
  const samples = Array.from({ length: 1000 }, (_, index) => ({
    elapsedSeconds: index,
  })) as unknown as Parameters<typeof downsampleIbtTelemetry>[0];
  const downsampled = downsampleIbtTelemetry(samples, 100);
  expect(downsampled).toHaveLength(100);
  expect(downsampled[0].elapsedSeconds).toBe(0);
  expect(downsampled.at(-1)?.elapsedSeconds).toBe(999);
});

it.each([
  '../race.ibt',
  'C:\\race.ibt',
  '/race.ibt',
  'race.irdt',
  'race.ibt/other',
  'a\0.ibt',
])('rejects unsafe file name %s', (name) =>
  expect(() => validateIbtName(name)).toThrow()
);
it('lists only local IBT files and treats a missing directory as empty', async () => {
  await writeFile(path.join(deps.directory, 'notes.txt'), 'text');
  await symlink(
    path.join(deps.directory, 'race.ibt'),
    path.join(deps.directory, 'link.ibt')
  );
  expect((await service.list()).files.map((file) => file.name)).toEqual([
    'race.ibt',
  ]);
  deps.directory = path.join(directory, 'missing');
  expect((await service.list()).files).toEqual([]);
});
it('rejects disabled tools and paths escaping through symlinks', async () => {
  deps.enabled = () => false;
  await expect(service.load('race.ibt', 1)).rejects.toThrow('Enable Dev Tool');
  deps.enabled = () => true;
  await writeFile(path.join(directory, 'outside.ibt'), 'secret');
  await symlink(
    path.join(directory, 'outside.ibt'),
    path.join(deps.directory, 'escape.ibt')
  );
  await expect(service.load('escape.ibt', 1)).rejects.toThrow('inside');
  expect(deps.switchSource).not.toHaveBeenCalled();
});
it('serializes source replacement and stop, preserving the original recording', async () => {
  await Promise.all([service.load('race.ibt', 4), service.stop()]);
  expect(
    vi
      .mocked(deps.switchSource)
      .mock.calls.map((args) => (args[0] === null ? 'live' : 'tape'))
  ).toEqual(['tape', 'live']);
  expect(service.status().file).toBeNull();
  expect(await readFile(path.join(deps.directory, 'race.ibt'), 'utf8')).toBe(
    'original'
  );
  expect(await readdir(deps.workDirectory)).toEqual([]);
});
it('restores source and removes temporary data after source initialization fails', async () => {
  vi.mocked(deps.switchSource).mockRejectedValueOnce(
    new Error('native failure')
  );
  await expect(service.load('race.ibt', 'max')).rejects.toThrow(
    'native failure'
  );
  expect(deps.switchSource).toHaveBeenLastCalledWith(null);
  expect(await readdir(deps.workDirectory)).toEqual([]);
});
it('captures bounded periodic data and prevents seek during capture', async () => {
  const rendererHeapSampler = {
    start: vi.fn(() => ({ attachedTargets: 2, skippedTargets: 1 })),
    sample: vi.fn(async () => [
      {
        key: '20:2',
        pid: 20,
        route: 'overlay-widget',
        usedHeapMB: 35,
        totalHeapMB: 50,
      },
    ]),
    collectGarbageAndSample: vi.fn(async () => [
      {
        key: '20:2',
        pid: 20,
        route: 'overlay-widget',
        usedHeapMB: 30,
        totalHeapMB: 48,
      },
    ]),
    stop: vi.fn(),
  };
  deps.rendererHeapSampler = rendererHeapSampler;
  deps.getProcessMemorySnapshot = () => [
    {
      key: '10:100',
      pid: 10,
      creationTime: 100,
      type: 'Browser',
      cpuPercent: null,
      cpuTimeMsPerSecond: null,
      memoryMB: 41,
      privateMemoryMB: 21,
    },
  ];
  await service.load('race.ibt', 1);
  await service.startCapture();
  await expect(service.command({ type: 'seek', seconds: 0 })).rejects.toThrow(
    'Stop capture'
  );
  metrics.listener?.({
    tickRateHz: 60,
    eventLoopDelayMs: { p99: 2, max: 7 },
    sections: { sdkWait: { count: 2, avgMs: 3, maxMs: 4 } },
    processes: [
      {
        pid: 10,
        creationTime: 100,
        type: 'Browser',
        cpuPercent: 3,
        cpuTimeMsPerSecond: 10,
        memoryMB: 40,
        privateMemoryMB: 20,
      },
    ],
    totalAppCpuPercent: 5,
    totalAppMemoryMB: 100,
    totalAppPrivateMemoryMB: 70,
    channelMetrics: {
      processorExecutions: { 'standings.snapshot': 2 },
      publications: { 'standings.snapshot': 1 },
      deliveries: { 'standings.snapshot': 3 },
    },
  } as unknown as PerfReport);
  await service.checkpointMemory();
  await service.stopCapture();
  const status = service.status();
  expect(status.capture).toMatchObject({
    active: false,
    samples: 1,
    error: null,
    memoryCheckpoints: [
      {
        appWorkingSetMB: 41,
        appPrivateMemoryMB: 21,
        rendererHeaps: [
          {
            key: '20:2',
            usedHeapMB: 30,
            totalHeapMB: 48,
          },
        ],
      },
    ],
    heapSampling: { attachedTargets: 2, skippedTargets: 1 },
    telemetry: [
      {
        appCpuPercent: 5,
        appWorkingSetMB: 100,
        appPrivateMemoryMB: 70,
        tickRateHz: 60,
        eventLoopP99Ms: 2,
        eventLoopMaxMs: 7,
        rendererHeaps: [
          {
            key: '20:2',
            pid: 20,
            route: 'overlay-widget',
            usedHeapMB: 35,
            totalHeapMB: 50,
          },
        ],
        processes: [
          {
            key: '10:100',
            type: 'Browser',
            cpuPercent: 3,
            memoryMB: 40,
            privateMemoryMB: 20,
          },
        ],
      },
    ],
    hottestSections: [
      {
        name: 'sdkWait',
        count: 2,
        totalWallMs: 6,
        averageMs: 3,
        maxWallMs: 4,
      },
    ],
    channelActivity: [
      {
        name: 'standings.snapshot',
        processorExecutions: 2,
        publications: 1,
        deliveries: 3,
      },
    ],
  });
  const reportText = await readFile(status.capture.reportPath ?? '', 'utf8');
  const report = JSON.parse(reportText);
  expect(Buffer.byteLength(reportText)).toBeLessThan(5 * 1024 * 1024);
  expect(parseCaptureReport(report)).not.toBeNull();
  const samplePath = path.join(
    path.dirname(status.capture.reportPath ?? ''),
    'samples.ndjson'
  );
  const rawSamples = (await readFile(samplePath, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line));
  const rawSample = rawSamples.find((sample) => sample.inspectorMemory);
  expect(rawSample.inspectorMemory).toMatchObject({
    rendererHeaps: [
      {
        key: '20:2',
        usedHeapMB: 35,
        totalHeapMB: 50,
      },
    ],
  });
  expect(rawSample.inspectorMemory.mainV8HeapUsedMB).toBeGreaterThan(0);
  expect(rawSamples.some((sample) => sample.inspectorCheckpoint)).toBe(true);
  expect(report.schemaVersion).toBe(2);
  expect(report.memoryTrends.appPrivateMemory.delta).toBeNull();
  expect(report.memoryCheckpoints).toHaveLength(1);
  expect(report.sections.sdkWait).toEqual({
    count: 2,
    totalWallMs: 6,
    maxWallMs: 4,
  });
  expect(report.averageCpuMsPerSecond).toBe(10);
  expect(metrics.listener).toBeUndefined();
  expect(rendererHeapSampler.start).toHaveBeenCalledOnce();
  expect(rendererHeapSampler.sample).toHaveBeenCalledOnce();
  expect(rendererHeapSampler.collectGarbageAndSample).toHaveBeenCalledOnce();
  expect(rendererHeapSampler.stop).toHaveBeenCalledOnce();
  const restored = new IbtInspectorService(deps);
  const runDirectories = await readdir(path.join(deps.workDirectory, 'runs'));
  expect(runDirectories).toHaveLength(1);
  expect(runDirectories[0]).toMatch(/^\d+-[a-f0-9-]+$/);
  expect(restored.status().capture.reportPath).toBeNull();
  await restored.restoreLastCapture();
  expect(restored.status().capture).toMatchObject({
    samples: 1,
    memoryCheckpoints: [
      {
        appPrivateMemoryMB: 21,
        rendererHeaps: [{ usedHeapMB: 30 }],
      },
    ],
  });
  await restored.stop();
  await service.command({ type: 'seek', seconds: 0 });
  expect(deps.command).toHaveBeenCalled();
});
it('restores the latest chart and exposes the preceding capture as a baseline', async () => {
  await service.load('race.ibt', 1);
  const report = (privateMemoryMB: number) =>
    ({
      intervalMs: 1000,
      tickRateHz: 60,
      eventLoopDelayMs: { p99: 2, max: 5 },
      sections: {},
      processes: [
        {
          pid: 10,
          creationTime: 100,
          type: 'Browser',
          cpuPercent: 2,
          cpuTimeMsPerSecond: 20,
          memoryMB: privateMemoryMB + 10,
          privateMemoryMB,
        },
      ],
      totalAppCpuPercent: 3,
      totalAppMemoryMB: privateMemoryMB + 20,
      totalAppPrivateMemoryMB: privateMemoryMB,
    }) as unknown as PerfReport;

  await service.startCapture();
  metrics.listener?.(report(50));
  await service.stopCapture();
  const previousPath = service.status().capture.reportPath;

  await service.startCapture();
  metrics.listener?.(report(70));
  await service.stopCapture();
  const latestPath = service.status().capture.reportPath;
  expect(latestPath).not.toBe(previousPath);

  const restored = new IbtInspectorService(deps);
  await expect(restored.restoreLastCapture()).resolves.toBe(true);
  const capture = restored.status().capture;
  expect(capture.telemetry.at(-1)?.appPrivateMemoryMB).toBe(70);
  expect(capture.baseline?.telemetry.at(-1)?.appPrivateMemoryMB).toBe(50);
  await restored.stop();
});

it('keeps unavailable CPU measurements unknown', async () => {
  await service.load('race.ibt', 1);
  await service.startCapture();
  await service.stopCapture();
  const report = JSON.parse(
    await readFile(service.status().capture.reportPath ?? '', 'utf8')
  );
  expect(report.averageCpuMsPerSecond).toBeNull();
  expect(report.samples).toBe(0);
});

it('keeps an existing replay when a replacement recording fails validation', async () => {
  await service.load('race.ibt', 1);
  vi.mocked(importIbt).mockRejectedValueOnce(new Error('Truncated IBT'));
  await expect(service.load('race.ibt', 4)).rejects.toThrow('Truncated IBT');
  expect(service.status().file).toBe('race.ibt');
  expect(deps.switchSource).toHaveBeenCalledTimes(1);
});
it('retains at most ten completed captures', async () => {
  await service.load('race.ibt', 1);
  for (let i = 0; i < 12; i++) {
    await service.startCapture();
    await service.stopCapture();
  }
  expect((await readdir(path.join(deps.workDirectory, 'runs'))).length).toBe(
    10
  );
});

it('rejects native startup failure with its reason and restores the prior source', async () => {
  deps.getPlayback = () => ({
    position: 0,
    duration: 0,
    speed: 1,
    paused: false,
    ended: false,
    failed: true,
    error: 'IRDASHIES_TELEMETRY_REPLAY is not set',
  });
  await expect(service.load('race.ibt', 1)).rejects.toThrow(
    'IRDASHIES_TELEMETRY_REPLAY is not set'
  );
  expect(deps.switchSource).toHaveBeenLastCalledWith(null);
  expect(service.status().file).toBeNull();
  expect(await readdir(deps.workDirectory)).toEqual([]);
});

it('reports missing fields per enabled widget and saves source-derived scenario state', async () => {
  deps.getWidgetTypes = () => ['input', 'radar'];
  deps.getProfileId = () => 'my-profile';
  deps.saveScenario = vi.fn(async () => undefined);
  await service.load('race.ibt', 1);
  expect(service.status().coverage).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        widget: 'radar',
        status: 'missing-fields',
        missing: expect.arrayContaining(['CarIdxLapDistPct']),
      }),
    ])
  );
  await service.saveScenario();
  expect(deps.saveScenario).toHaveBeenCalledWith({
    file: 'race.ibt',
    profileId: 'my-profile',
    speed: 1,
    position: 0,
    loop: null,
  });
  await service.stop();
  await expect(service.saveScenario()).rejects.toThrow('Load an IBT first');
});

it('prevents steps and loop/speed changes from contaminating an active capture', async () => {
  await service.load('race.ibt', 1);
  await service.startCapture();
  for (const command of [
    { type: 'step' },
    { type: 'loop', range: { start: 0, end: 2 } },
    { type: 'speed', speed: 2 },
  ] as const)
    await expect(service.command(command)).rejects.toThrow('Stop capture');
  await service.stopCapture();
  await service.command({ type: 'loop', range: { start: 0, end: 2 } });
  expect(deps.command).toHaveBeenLastCalledWith({
    type: 'loop',
    range: { start: 0, end: 2 },
  });
});
