import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { IbtInspector, IbtInspectorView } from './IbtInspector';
import type { IbtInspectorBridge, IbtInspectorStatus } from '@irdashies/types';
it('plays the selected recording with capture and a whole-file loop', async () => {
  const status: IbtInspectorStatus = {
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
  };
  const bridge: IbtInspectorBridge = {
    getScenario: vi.fn(async () => null),
    saveScenario: vi.fn(),
    open: vi.fn(),
    list: vi.fn(async () => ({
      directory: 'C:\\Users\\user\\Documents\\iRacing\\telemetry',
      files: [
        {
          name: 'race.ibt',
          sizeBytes: 1024,
          modifiedAt: '2026-11-14T19:00:00Z',
        },
      ],
      truncated: false,
    })),
    status: vi.fn(async () => structuredClone(status)),
    load: vi.fn(async () => {
      status.file = 'race.ibt';
      status.playback = {
        position: 0,
        duration: 10,
        speed: 1,
        paused: true,
        canStep: true,
        ended: false,
      };
    }),
    command: vi.fn(async () => undefined),
    stop: vi.fn(async () => {
      status.file = null;
      status.playback = null;
    }),
    startCapture: vi.fn(async () => {
      status.capture.active = true;
      status.capture.mode = 'replay';
    }),
    startLiveCapture: vi.fn(async () => {
      status.capture.active = true;
      status.capture.mode = 'live';
    }),
    selectPresentMon: vi.fn(async () => true),
    stopCapture: vi.fn(async () => {
      status.capture.active = false;
    }),
    checkpointMemory: vi.fn(),
    showReport: vi.fn(),
  };
  render(<IbtInspector bridge={bridge} />);
  await screen.findByRole('option', { name: /race.ibt/ });
  expect(
    screen.queryByRole('button', { name: 'Load recording' })
  ).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Seek position')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Save scenario' })
  ).not.toBeInTheDocument();
  fireEvent.click(
    screen.getByRole('checkbox', { name: 'Loop entire recording' })
  );
  fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  await waitFor(() => expect(bridge.load).toHaveBeenCalledWith('race.ibt', 1));
  await waitFor(() =>
    expect(bridge.startCapture).toHaveBeenCalledWith({ presentMon: false })
  );
  expect(bridge.command).toHaveBeenCalledWith({
    type: 'loop',
    range: { start: 0, end: 10 },
  });
  expect(bridge.command).toHaveBeenCalledWith({ type: 'pause', paused: false });
  await screen.findByRole('button', { name: 'Stop' });
  fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
  await waitFor(() => expect(bridge.stopCapture).toHaveBeenCalledOnce());
  expect(bridge.stop).toHaveBeenCalledOnce();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Live Capture' })).toBeEnabled()
  );
  fireEvent.change(
    screen.getByRole('combobox', { name: 'Live capture contents' }),
    { target: { value: 'telemetry' } }
  );
  fireEvent.click(
    screen.getByRole('checkbox', {
      name: 'Capture iRacing frame metrics with PresentMon',
    })
  );
  await waitFor(() => expect(bridge.selectPresentMon).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Live Capture' })).toBeEnabled()
  );
  fireEvent.click(screen.getByRole('button', { name: 'Live Capture' }));
  await waitFor(() =>
    expect(bridge.startLiveCapture).toHaveBeenCalledWith({
      presentMon: true,
      recordTelemetry: true,
    })
  );
});
it('shows memory, CPU, process, section and channel telemetry charts', () => {
  const onAction = vi.fn();
  const { container } = render(
    <IbtInspectorView
      directory="/telemetry"
      files={[]}
      selected=""
      speed="1"
      status={{
        file: 'race.ibt',
        playback: null,
        warnings: [],
        capture: {
          active: true,
          samples: 2,
          reportPath: '/capture/report.json',
          error: null,
          telemetry: [
            {
              elapsedSeconds: 1,
              intervalSeconds: 1,
              appCpuPercent: 20,
              appWorkingSetMB: 400,
              appPrivateMemoryMB: 250,
              mainV8HeapUsedMB: 40,
              mainExternalMemoryMB: 8,
              tickRateHz: 60,
              eventLoopP99Ms: 2,
              eventLoopMaxMs: 5,
              processes: [
                {
                  key: '12:100',
                  pid: 12,
                  creationTime: 100,
                  type: 'Browser',
                  name: 'irDashies',
                  cpuPercent: 4,
                  cpuTimeMsPerSecond: 40,
                  memoryMB: 100,
                  privateMemoryMB: 70,
                },
              ],
              rendererHeaps: [
                {
                  key: '12:22',
                  pid: 12,
                  route: 'overlay-widget',
                  usedHeapMB: 80,
                  totalHeapMB: 120,
                },
              ],
              channelActivity: [
                {
                  name: 'standings.snapshot',
                  processorExecutions: 10,
                  publications: 5,
                  deliveries: 8,
                },
              ],
            },
            {
              elapsedSeconds: 35,
              intervalSeconds: 1,
              appCpuPercent: 24,
              appWorkingSetMB: 410,
              appPrivateMemoryMB: 260,
              mainV8HeapUsedMB: 42,
              mainExternalMemoryMB: 9,
              tickRateHz: 59,
              eventLoopP99Ms: 3,
              eventLoopMaxMs: 8,
              processes: [
                {
                  key: '12:100',
                  pid: 12,
                  creationTime: 100,
                  type: 'Browser',
                  name: 'irDashies',
                  cpuPercent: 5,
                  cpuTimeMsPerSecond: 50,
                  memoryMB: 110,
                  privateMemoryMB: 80,
                },
              ],
              rendererHeaps: [
                {
                  key: '12:22',
                  pid: 12,
                  route: 'overlay-widget',
                  usedHeapMB: 84,
                  totalHeapMB: 120,
                },
              ],
              channelActivity: [
                {
                  name: 'standings.snapshot',
                  processorExecutions: 12,
                  publications: 6,
                  deliveries: 16,
                },
              ],
            },
          ],
          baseline: null,
          memoryCheckpoints: [
            {
              elapsedSeconds: 20,
              appWorkingSetMB: 410,
              appPrivateMemoryMB: 260,
              mainV8HeapUsedMB: 42,
              mainExternalMemoryMB: 9,
              processes: [],
              rendererHeaps: [
                {
                  key: '12:22',
                  pid: 12,
                  route: 'overlay-widget',
                  usedHeapMB: 70,
                  totalHeapMB: 120,
                },
              ],
            },
          ],
          heapSampling: { attachedTargets: 1, skippedTargets: 0 },
          hottestSections: [
            {
              name: 'processTelemetry',
              count: 60,
              totalWallMs: 120,
              averageMs: 2,
              maxWallMs: 5,
            },
          ],
          channelActivity: [
            {
              name: 'standings.snapshot',
              processorExecutions: 60,
              publications: 20,
              deliveries: 40,
            },
          ],
        },
      }}
      busy={false}
      error={null}
      onSelect={vi.fn()}
      onSpeed={vi.fn()}
      onAction={onAction}
    />
  );
  expect(
    screen.getByRole('img', { name: 'Application memory over replay time' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', {
      name: 'Per-process private memory over replay time',
    })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Renderer V8 heap over replay time' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'JavaScript heap over replay time' })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', {
      name: 'Main-process event loop over replay time',
    })
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Channel deliveries over replay time' })
  ).toBeInTheDocument();
  const appWorkingSetToggle = screen.getByRole('button', {
    name: 'App working set',
  });
  expect(appWorkingSetToggle).toHaveAttribute('aria-pressed', 'true');
  expect(container.querySelector('circle title')?.textContent).toMatch(
    /App working set:/
  );
  fireEvent.click(appWorkingSetToggle);
  expect(appWorkingSetToggle).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByText('Process breakdown')).toBeInTheDocument();
  expect(screen.getByText('Renderer GC checkpoints')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Post-GC checkpoint' }));
  expect(onAction).toHaveBeenCalledWith('memoryCheckpoint');
  expect(screen.getByText('processTelemetry')).toBeInTheDocument();
  expect(screen.getAllByText('standings.snapshot')).toHaveLength(2);
  expect(screen.getByText('+10.0 MB')).toBeInTheDocument();
});

it('shows file access errors without presenting an empty successful list', async () => {
  const bridge = {
    list: vi.fn(async () => {
      throw new Error('Access denied');
    }),
    status: vi.fn(async () => ({
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
    })),
  } as unknown as IbtInspectorBridge;
  render(<IbtInspector bridge={bridge} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Access denied');
});
