import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RendererPerfSample } from '@irdashies/types';

const send = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({ ipcRenderer: { send } }));

vi.mock('./perfRendererArguments', () => ({
  readRendererPerfArguments: () => ({
    enabled: true,
    runId: 'run',
    scenario: 'spec',
    reportIntervalMs: 1000,
  }),
}));

describe('renderer perf samples', () => {
  let onFrame: FrameRequestCallback | undefined;
  let frameTime = 0;

  /** One animation frame, so the interval has a frame time and is reported. */
  const frame = () => {
    frameTime += 16;
    const callback = onFrame;
    onFrame = undefined;
    callback?.(frameTime);
  };

  const reported = (): RendererPerfSample[] =>
    send.mock.calls.map(([, , line]) =>
      JSON.parse(String(line).replace('[PerfRenderer:JSON] ', ''))
    );

  beforeEach(() => {
    vi.resetModules();
    send.mockClear();
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      onFrame = cb;
      return 1;
    });
    vi.stubGlobal('document', { visibilityState: 'visible' });
    vi.stubGlobal('window', { location: { hash: '#/laptrace' } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  // The analyzer takes a measure's rate over the windows that report it. A
  // window that never runs the loop reporting a count of 0 added its whole
  // interval to the time, dividing the rate by the number of windows.
  it('reports a measure only from a window that has run it', async () => {
    const { recordRendererMeasure, startRendererPerfMetrics } =
      await import('./rendererPerfMetrics');
    startRendererPerfMetrics();

    frame();
    frame();
    recordRendererMeasure('lapTraceFrame', 0.5);
    vi.advanceTimersByTime(1000);

    // Then an interval in which the loop is idle.
    frame();
    frame();
    vi.advanceTimersByTime(1000);

    const [running, idle] = reported();
    expect(running.lapTraceFrameMs?.count).toBe(1);
    // Never run in this window: absent, not zero.
    expect(running).not.toHaveProperty('lapTraceBrakeCueMs');
    expect(running).not.toHaveProperty('trackMapAnimationFrameMs');
    // Still this window's loop while idle, so its time still counts.
    expect(idle.lapTraceFrameMs?.count).toBe(0);
    expect(idle).not.toHaveProperty('lapTraceBrakeCueMs');
  });
});
