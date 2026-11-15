import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWidgetPreviewRuntime } from './widgetPreviewRuntime';
import fixture from '../irsdk/node/utils/mock-data/telemetry.json';

afterEach(() => vi.useRealTimers());

describe('widget preview runtime', () => {
  it('pauses hidden demo work and resumes the same playback without duplicate timers', async () => {
    vi.useFakeTimers();
    let visible = true;
    const send = vi.fn();
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const errors = vi.fn();
    const runtime = createWidgetPreviewRuntime(
      {
        id: 1,
        isDestroyed: () => false,
        isVisible: () => visible,
        send,
      },
      metrics,
      errors
    );
    runtime.subscribe('lap-times.snapshot', 5);
    runtime.subscribe('driver-controls.snapshot', 25);
    await vi.advanceTimersByTimeAsync(1000);
    const before = runtime.getTelemetry()?.SessionTime.value[0];
    expect(before).toBeTypeOf('number');
    const activeTimers = vi.getTimerCount();
    visible = false;
    runtime.hide();
    runtime.hide();
    send.mockClear();
    metrics.markStart.mockClear();
    await vi.advanceTimersByTimeAsync(10000);
    expect(metrics.markStart).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(runtime.getTelemetry()?.SessionTime.value[0]).toBe(before);
    expect(vi.getTimerCount()).toBe(0);
    // A stale show event must not restart a window that is still hidden.
    runtime.show();
    expect(vi.getTimerCount()).toBe(0);
    visible = true;
    runtime.show();
    runtime.show();
    expect(vi.getTimerCount()).toBe(activeTimers);
    await vi.advanceTimersByTimeAsync(1000);
    expect(metrics.markStart).toHaveBeenCalledWith('widgetPreviewProcessing');
    expect(send).toHaveBeenCalled();
    const after = runtime.getTelemetry()?.SessionTime.value[0] ?? 0;
    expect(after).toBeGreaterThan(before ?? 0);
    expect(after - (before ?? 0)).toBeLessThan(1.1);
    expect(runtime.getSession().DriverInfo.Drivers.length).toBeGreaterThan(0);
    expect(errors).not.toHaveBeenCalled();
    runtime.dispose();
    runtime.show();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('initializes a hidden connection without running demo timers', async () => {
    vi.useFakeTimers();
    let visible = false;
    const metrics = { markStart: vi.fn(), markEnd: vi.fn() };
    const errors = vi.fn();
    const runtime = createWidgetPreviewRuntime(
      {
        id: 1,
        isDestroyed: () => false,
        isVisible: () => visible,
        send: vi.fn(),
      },
      metrics,
      errors
    );
    expect(runtime.getSession().DriverInfo.Drivers.length).toBeGreaterThan(0);
    runtime.subscribe('driver-controls.snapshot', 25);
    await vi.advanceTimersByTimeAsync(10000);
    expect(metrics.markStart).not.toHaveBeenCalled();
    expect(runtime.getTelemetry()).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    visible = true;
    runtime.show();
    await vi.advanceTimersByTimeAsync(100);
    expect(runtime.getTelemetry()).not.toBeNull();
    visible = false;
    runtime.hide();
    runtime.dispose();
    visible = true;
    runtime.show();
    expect(vi.getTimerCount()).toBe(0);
    expect(errors).not.toHaveBeenCalled();
  });

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
});
