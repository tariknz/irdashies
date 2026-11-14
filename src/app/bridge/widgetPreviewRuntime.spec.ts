import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWidgetPreviewRuntime } from './widgetPreviewRuntime';
import fixture from '../irsdk/node/utils/mock-data/telemetry.json';

afterEach(() => vi.useRealTimers());

describe('widget preview runtime', () => {
  it('runs real demo channels in separate buses and stops all timers on disposal', async () => {
    vi.useFakeTimers();
    const originalFlags = [...fixture.SessionFlags.value];
    const firstSend = vi.fn();
    const secondSend = vi.fn();
    const target = (send: typeof firstSend) => ({
      id: 1,
      isDestroyed: () => false,
      isVisible: () => true,
      send,
    });
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const errors = vi.fn();
    const first = createWidgetPreviewRuntime(
      target(firstSend),
      metrics,
      errors
    );
    const second = createWidgetPreviewRuntime(
      target(secondSend),
      metrics,
      errors
    );
    expect(first.getSession().DriverInfo.Drivers.length).toBeGreaterThan(0);
    first.subscribe('driver-controls.snapshot', 25);
    second.subscribe('track-state.snapshot', 5);
    await vi.advanceTimersByTimeAsync(300);
    expect(
      firstSend.mock.calls.some(
        (call) => call[1] === 'driver-controls.snapshot'
      )
    ).toBe(true);
    expect(
      firstSend.mock.calls.some((call) => call[1] === 'track-state.snapshot')
    ).toBe(false);
    expect(
      secondSend.mock.calls.some(
        (call) => call[1] === 'driver-controls.snapshot'
      )
    ).toBe(false);
    expect(errors).not.toHaveBeenCalled();
    expect(fixture.SessionFlags.value).toEqual(originalFlags);
    first.dispose();
    firstSend.mockClear();
    await vi.advanceTimersByTimeAsync(300);
    expect(firstSend).not.toHaveBeenCalled();
    second.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses in place: no frames while paused, then carries on from the same session time', async () => {
    vi.useFakeTimers();
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const runtime = createWidgetPreviewRuntime(
      { id: 1, isDestroyed: () => false, isVisible: () => true, send: vi.fn() },
      metrics,
      vi.fn()
    );
    const sessionTime = () =>
      runtime.getTelemetry()?.SessionTime.value[0] ?? Number.NaN;
    await vi.advanceTimersByTimeAsync(500);
    const beforePause = sessionTime();
    // The demo starts ten minutes in.
    expect(beforePause).toBeGreaterThan(600);

    runtime.setRunning(false);
    runtime.setRunning(false);
    const framesAtPause = metrics.markStart.mock.calls.length;
    await vi.advanceTimersByTimeAsync(2000);
    expect(metrics.markStart.mock.calls.length).toBe(framesAtPause);
    expect(sessionTime()).toBe(beforePause);
    // The generator's own timers are stopped, not just ignored.
    expect(vi.getTimerCount()).toBe(0);

    runtime.setRunning(true);
    runtime.setRunning(true);
    await vi.advanceTimersByTimeAsync(500);
    expect(sessionTime()).toBeGreaterThan(beforePause);
    expect(sessionTime()).toBeLessThan(beforePause + 1);
    expect(runtime.getSession().DriverInfo.Drivers.length).toBeGreaterThan(0);

    runtime.dispose();
    runtime.setRunning(true);
    expect(vi.getTimerCount()).toBe(0);
  });
});
