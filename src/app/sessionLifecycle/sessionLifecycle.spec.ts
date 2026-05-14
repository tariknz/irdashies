import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createSessionLifecycle } from './sessionLifecycle';
import type { Session, Telemetry } from '@irdashies/types';

const makeSession = (driverCarIdxs: number[]): Session =>
  ({
    DriverInfo: {
      Drivers: driverCarIdxs.map((CarIdx) => ({
        CarIdx,
        CarIsPaceCar: 0,
        IsSpectator: 0,
      })),
    },
  }) as unknown as Session;

const makeTelemetry = (sessionNum: number): Telemetry =>
  ({
    SessionNum: { value: [sessionNum] },
  }) as unknown as Telemetry;

describe('sessionLifecycle', () => {
  let lifecycle: ReturnType<typeof createSessionLifecycle>;

  beforeEach(() => {
    lifecycle = createSessionLifecycle();
  });

  describe('driver joins', () => {
    it('fires onDriverJoined for each new carIdx', () => {
      const joinSpy = vi.fn();
      lifecycle.onDriverJoined(joinSpy);

      lifecycle._onSession(makeSession([0, 1, 2]));

      expect(joinSpy).toHaveBeenCalledTimes(3);
      expect(joinSpy).toHaveBeenCalledWith(0);
      expect(joinSpy).toHaveBeenCalledWith(1);
      expect(joinSpy).toHaveBeenCalledWith(2);
    });

    it('only fires for newly-joined carIdxs on subsequent sessions', () => {
      const joinSpy = vi.fn();
      lifecycle.onDriverJoined(joinSpy);

      lifecycle._onSession(makeSession([0, 1]));
      joinSpy.mockClear();
      lifecycle._onSession(makeSession([0, 1, 2]));

      expect(joinSpy).toHaveBeenCalledTimes(1);
      expect(joinSpy).toHaveBeenCalledWith(2);
    });

    it('ignores pace cars and spectators', () => {
      const joinSpy = vi.fn();
      lifecycle.onDriverJoined(joinSpy);

      const session = {
        DriverInfo: {
          Drivers: [
            { CarIdx: 0, CarIsPaceCar: 0, IsSpectator: 0 },
            { CarIdx: 1, CarIsPaceCar: 1, IsSpectator: 0 },
            { CarIdx: 2, CarIsPaceCar: 0, IsSpectator: 1 },
            { CarIdx: 3, CarIsPaceCar: 0, IsSpectator: 0 },
          ],
        },
      } as unknown as Session;
      lifecycle._onSession(session);

      expect(joinSpy).toHaveBeenCalledTimes(2);
      expect(joinSpy).toHaveBeenCalledWith(0);
      expect(joinSpy).toHaveBeenCalledWith(3);
    });
  });

  describe('driver leaves', () => {
    it('fires onDriverLeft when a carIdx is no longer in the session', () => {
      const leftSpy = vi.fn();
      lifecycle.onDriverLeft(leftSpy);

      lifecycle._onSession(makeSession([0, 1, 2]));
      lifecycle._onSession(makeSession([0, 2]));

      expect(leftSpy).toHaveBeenCalledTimes(1);
      expect(leftSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('disconnect', () => {
    it('emits synthetic onDriverLeft for every known driver before firing onDisconnect', () => {
      const leftSpy = vi.fn();
      const disconnectSpy = vi.fn();
      lifecycle.onDriverLeft(leftSpy);
      lifecycle.onDisconnect(disconnectSpy);

      lifecycle._onSession(makeSession([0, 5, 17]));
      lifecycle._onDisconnect();

      expect(leftSpy).toHaveBeenCalledTimes(3);
      expect(leftSpy).toHaveBeenCalledWith(0);
      expect(leftSpy).toHaveBeenCalledWith(5);
      expect(leftSpy).toHaveBeenCalledWith(17);
      expect(disconnectSpy).toHaveBeenCalledTimes(1);
      // Leave events must fire before the generic disconnect event so
      // per-driver subscribers can release state before app-level resets.
      const leftCallOrders = leftSpy.mock.invocationCallOrder;
      const disconnectCallOrder = disconnectSpy.mock.invocationCallOrder[0];
      for (const callOrder of leftCallOrders) {
        expect(callOrder).toBeLessThan(disconnectCallOrder);
      }
    });

    it('clears known driver state so reconnect emits fresh join events', () => {
      const joinSpy = vi.fn();
      lifecycle.onDriverJoined(joinSpy);

      lifecycle._onSession(makeSession([0, 1]));
      lifecycle._onDisconnect();
      joinSpy.mockClear();

      // Same drivers reconnect — they should fire join events again.
      lifecycle._onSession(makeSession([0, 1]));
      expect(joinSpy).toHaveBeenCalledTimes(2);
    });

    it('does not double-fire leave events if disconnect is called twice in a row', () => {
      const leftSpy = vi.fn();
      lifecycle.onDriverLeft(leftSpy);

      lifecycle._onSession(makeSession([0, 1]));
      lifecycle._onDisconnect();
      leftSpy.mockClear();
      lifecycle._onDisconnect();

      expect(leftSpy).not.toHaveBeenCalled();
    });
  });

  describe('session number changes', () => {
    it('fires onSessionNumChange when SessionNum transitions to a new value', () => {
      const changeSpy = vi.fn();
      lifecycle.onSessionNumChange(changeSpy);

      // First observation does not fire (no prior baseline to compare to).
      lifecycle._onTelemetry(makeTelemetry(0));
      expect(changeSpy).not.toHaveBeenCalled();

      lifecycle._onTelemetry(makeTelemetry(1));
      expect(changeSpy).toHaveBeenCalledTimes(1);

      // No change — no fire.
      lifecycle._onTelemetry(makeTelemetry(1));
      expect(changeSpy).toHaveBeenCalledTimes(1);

      lifecycle._onTelemetry(makeTelemetry(2));
      expect(changeSpy).toHaveBeenCalledTimes(2);
    });
  });

  describe('subscription cleanup', () => {
    it('unsubscribes via the returned disposer', () => {
      const joinSpy = vi.fn();
      const unsub = lifecycle.onDriverJoined(joinSpy);

      lifecycle._onSession(makeSession([0]));
      expect(joinSpy).toHaveBeenCalledTimes(1);

      unsub();
      lifecycle._onSession(makeSession([0, 1]));
      expect(joinSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('error isolation', () => {
    it('continues firing remaining callbacks if one throws', () => {
      const goodSpy = vi.fn();
      lifecycle.onDriverJoined(() => {
        throw new Error('boom');
      });
      lifecycle.onDriverJoined(goodSpy);

      lifecycle._onSession(makeSession([0]));

      expect(goodSpy).toHaveBeenCalledTimes(1);
    });
  });
});
