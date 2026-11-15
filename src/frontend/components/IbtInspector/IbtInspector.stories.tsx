import { replayWidgetCoverage } from '../../../types/replayCoverage';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { IbtInspectorView } from './IbtInspector';
const files = [
  {
    name: 'ferrari296gt3_nurburgring nordschleife 2026-11-14 21-57-21.ibt',
    sizeBytes: 64_560_000,
    modifiedAt: '2026-11-14T19:13:00Z',
  },
  {
    name: 'porsche992gt3r_spa 2026-11-13 18-30-00.ibt',
    sizeBytes: 48_200_000,
    modifiedAt: '2026-11-13T15:30:00Z',
  },
];
const chartSamples = Array.from({ length: 12 }, (_, index) => ({
  elapsedSeconds: (index + 1) * 10,
  intervalSeconds: 1,
  appCpuPercent: 21 + Math.sin(index / 2) * 4,
  appWorkingSetMB: 742 + index * 1.8,
  appPrivateMemoryMB: 508 + index * 1.2,
  mainV8HeapUsedMB: 40 + index * 0.1,
  mainExternalMemoryMB: 8 + index * 0.05,
  tickRateHz: 59.8 + Math.sin(index) * 0.2,
  eventLoopP99Ms: 2.5 + Math.abs(Math.sin(index * 1.7)) * 2,
  eventLoopMaxMs: 6 + Math.abs(Math.sin(index * 1.1)) * 4,
  processes: [
    {
      key: '100:1',
      pid: 100,
      creationTime: 1,
      type: 'Browser',
      name: 'irDashies',
      cpuPercent: 8 + Math.sin(index / 2),
      cpuTimeMsPerSecond: 80,
      memoryMB: 128 + index,
      privateMemoryMB: 90 + index * 0.8,
    },
    {
      key: '200:2',
      pid: 200,
      creationTime: 2,
      type: 'Tab',
      name: 'overlay-widget',
      cpuPercent: 10 + Math.cos(index / 2),
      cpuTimeMsPerSecond: 100,
      memoryMB: 260 + index * 0.5,
      privateMemoryMB: 200 + index * 0.3,
    },
    {
      key: '300:3',
      pid: 300,
      creationTime: 3,
      type: 'GPU',
      name: 'GPU Process',
      cpuPercent: 2 + Math.sin(index),
      cpuTimeMsPerSecond: 20,
      memoryMB: 180 + index * 0.2,
      privateMemoryMB: 120 + index * 0.1,
    },
  ],
  channelActivity: [
    {
      name: 'standings.snapshot',
      processorExecutions: 60,
      publications: 28 + index,
      deliveries: 100 + index * 3,
    },
    {
      name: 'track-state.snapshot',
      processorExecutions: 60,
      publications: 5,
      deliveries: 16,
    },
  ],
  rendererHeaps: [
    {
      key: '200:22',
      pid: 200,
      route: 'overlay-widget',
      usedHeapMB: 82 + index * 0.4,
      totalHeapMB: 120,
    },
    {
      key: '300:33',
      pid: 300,
      route: 'settings/standings',
      usedHeapMB: 64 + index * 0.1,
      totalHeapMB: 96,
    },
  ],
}));
const meta = {
  component: IbtInspectorView,
  parameters: { layout: 'fullscreen' },
  args: {
    directory: 'C:\\Users\\user\\Documents\\iRacing\\telemetry',
    files,
    selected: files[0].name,
    speed: '1',
    onLoop: () => undefined,
    busy: false,
    error: null,
    status: {
      file: files[0].name,
      playback: {
        position: 142,
        duration: 969.25,
        speed: 1,
        paused: false,
        canStep: true,
        ended: false,
        framesConsumed: 8521,
        framesDelivered: 8521,
      },
      coverage: replayWidgetCoverage(
        ['Throttle', 'Brake', 'SteeringWheelAngle'],
        ['input', 'radar', 'relative']
      ),
      warnings: [
        'No CarIdxLapDistPct: traffic-dependent widgets cannot be fully exercised.',
      ],
      capture: {
        active: true,
        samples: 12,
        reportPath: null,
        error: null,
        telemetry: chartSamples,
        memoryCheckpoints: [
          {
            elapsedSeconds: 40,
            appWorkingSetMB: 820,
            appPrivateMemoryMB: 534,
            mainV8HeapUsedMB: 42,
            mainExternalMemoryMB: 9,
            processes: chartSamples[3].processes,
            rendererHeaps: [
              {
                key: '200:22',
                pid: 200,
                route: 'overlay-widget',
                usedHeapMB: 83,
                totalHeapMB: 120,
              },
              {
                key: '300:33',
                pid: 300,
                route: 'settings/standings',
                usedHeapMB: 64.5,
                totalHeapMB: 96,
              },
            ],
          },
        ],
        baseline: {
          label: 'Previous capture',
          telemetry: chartSamples.map((sample) => ({
            ...sample,
            appWorkingSetMB: sample.appWorkingSetMB - 18,
            appPrivateMemoryMB: sample.appPrivateMemoryMB - 12,
            appCpuPercent: (sample.appCpuPercent ?? 0) - 3,
            mainV8HeapUsedMB: (sample.mainV8HeapUsedMB ?? 0) - 2,
          })),
          memoryCheckpoints: [],
        },
        heapSampling: { attachedTargets: 2, skippedTargets: 0 },
        hottestSections: [
          {
            name: 'processTelemetry',
            count: 720,
            totalWallMs: 1820,
            averageMs: 2.53,
            maxWallMs: 8.1,
          },
          {
            name: 'standingsProcessing',
            count: 720,
            totalWallMs: 640,
            averageMs: 0.89,
            maxWallMs: 4.3,
          },
        ],
        channelActivity: [
          {
            name: 'standings.snapshot',
            processorExecutions: 720,
            publications: 340,
            deliveries: 1280,
          },
          {
            name: 'track-state.snapshot',
            processorExecutions: 720,
            publications: 60,
            deliveries: 220,
          },
        ],
      },
    },
    onSelect: () => undefined,
    onSpeed: () => undefined,
    onAction: () => undefined,
  },
} satisfies Meta<typeof IbtInspectorView>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Recording: Story = {};
export const Empty: Story = {
  args: {
    files: [],
    selected: '',
    status: {
      file: null,
      playback: null,
      warnings: [],
      capture: {
        active: false,
        samples: 0,
        reportPath: null,
        error: null,
        telemetry: [],
        memoryCheckpoints: [],
        baseline: null,
        heapSampling: { attachedTargets: 0, skippedTargets: 0 },
        hottestSections: [],
        channelActivity: [],
      },
    },
  },
};
export const Completed: Story = {
  args: {
    status: {
      ...meta.args.status,
      playback: { ...meta.args.status.playback, position: 969.25, ended: true },
      capture: {
        active: false,
        samples: 36,
        reportPath:
          'C:\\Users\\user\\AppData\\Roaming\\irdashies\\ibt-inspector\\runs\\1794680000000\\report.json',
        error: null,
        telemetry: chartSamples,
        memoryCheckpoints: [
          {
            elapsedSeconds: 40,
            appWorkingSetMB: 820,
            appPrivateMemoryMB: 534,
            mainV8HeapUsedMB: 42,
            mainExternalMemoryMB: 9,
            processes: chartSamples[3].processes,
            rendererHeaps: [
              {
                key: '200:22',
                pid: 200,
                route: 'overlay-widget',
                usedHeapMB: 83,
                totalHeapMB: 120,
              },
            ],
          },
        ],
        baseline: {
          label: 'Previous capture',
          telemetry: chartSamples.map((sample) => ({
            ...sample,
            appWorkingSetMB: sample.appWorkingSetMB - 18,
            appPrivateMemoryMB: sample.appPrivateMemoryMB - 12,
            appCpuPercent: (sample.appCpuPercent ?? 0) - 3,
            mainV8HeapUsedMB: (sample.mainV8HeapUsedMB ?? 0) - 2,
          })),
          memoryCheckpoints: [],
        },
        heapSampling: { attachedTargets: 2, skippedTargets: 0 },
        hottestSections: [
          {
            name: 'processTelemetry',
            count: 2160,
            totalWallMs: 5320,
            averageMs: 2.46,
            maxWallMs: 8.1,
          },
        ],
        channelActivity: [
          {
            name: 'standings.snapshot',
            processorExecutions: 2160,
            publications: 1020,
            deliveries: 3840,
          },
        ],
      },
    },
  },
};

export const LiveCapture: Story = {
  args: {
    presentMon: true,
    recordTelemetry: true,
    status: {
      ...meta.args.status,
      file: null,
      playback: null,
      coverage: [],
      capture: {
        ...meta.args.status.capture,
        active: true,
        mode: 'live',
        telemetry: chartSamples.map((sample, index) => ({
          ...sample,
          gameFrames: {
            frames: 120,
            fps: 120 - index * 2,
            frameTimeMs: 8.3 + index * 0.2,
            p95FrameTimeMs: 12 + index * 0.4,
            p99FrameTimeMs: 16 + index * 0.5,
            low5Fps: 84 - index,
            low1Fps: 65 - index,
            cpuBusyMs: 4 + index * 0.1,
            gpuTimeMs: 7 + index * 0.2,
          },
        })),
      },
    },
  },
};
