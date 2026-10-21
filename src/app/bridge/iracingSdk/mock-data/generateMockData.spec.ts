import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@irdashies/types';
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

  it('emits a team racing session with distinct team names for the running mock app', () => {
    const bridge = generateMockData();
    const onSession = vi.fn();

    bridge.onSessionData(onSession);

    const session = onSession.mock.calls[0][0] as Session;
    const drivers = session.DriverInfo.Drivers.filter(
      (driver) => !driver.CarIsPaceCar
    );
    expect(session.WeekendInfo.TeamRacing).toBe(1);
    expect(drivers.every((driver) => driver.TeamID > 0)).toBe(true);
    expect(drivers.every((driver) => driver.TeamName !== driver.UserName)).toBe(
      true
    );
    expect(
      new Set(drivers.map((driver) => driver.TeamName)).size
    ).toBeGreaterThan(1);

    bridge.stop();
  });
});
