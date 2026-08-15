import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateMockData } from './generateMockData';

describe('generateMockData', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resumes telemetry for subscribers added after stop()', () => {
    // Regression: stop() cleared the intervals but left the handles truthy,
    // so the "start the interval only once" guards blocked any restart — a
    // stop()ed instance delivered nothing to later subscribers, silently.
    const bridge = generateMockData();

    const before = vi.fn();
    bridge.onTelemetry(before);
    vi.advanceTimersByTime(100);
    expect(before).toHaveBeenCalled();

    bridge.stop();

    const after = vi.fn();
    bridge.onTelemetry(after);
    vi.advanceTimersByTime(100);
    expect(after).toHaveBeenCalled();

    bridge.stop();
  });
});
