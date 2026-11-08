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
});
