import type { Session, Telemetry } from '@irdashies/types';
import logger from '../logger';

type Callback = () => void;
type CarIdxCallback = (carIdx: number) => void;

export interface SessionLifecycle {
  /** Called when a new driver joins (carIdx newly populated in DriverInfo). */
  onDriverJoined: (cb: CarIdxCallback) => () => void;
  /** Called when a driver leaves (carIdx removed from DriverInfo). */
  onDriverLeft: (cb: CarIdxCallback) => () => void;
  /** Called when the session number changes (practice -> quali -> race). */
  onSessionNumChange: (cb: Callback) => () => void;
  /** Called when iRacing disconnects (SDK stops publishing). */
  onDisconnect: (cb: Callback) => () => void;

  // Internal — called by iracingSdkBridge on each SDK tick.
  _onTelemetry: (telemetry: Telemetry) => void;
  _onSession: (session: Session) => void;
  _onDisconnect: () => void;
}

export function createSessionLifecycle(): SessionLifecycle {
  const driverJoinedCallbacks = new Set<CarIdxCallback>();
  const driverLeftCallbacks = new Set<CarIdxCallback>();
  const sessionNumChangeCallbacks = new Set<Callback>();
  const disconnectCallbacks = new Set<Callback>();

  // Track current state to detect deltas.
  let knownDriverCarIdxs = new Set<number>();
  let lastSessionNum = -1;

  function fire<T>(callbacks: Set<(arg: T) => void>, arg: T): void {
    callbacks.forEach((cb) => {
      try {
        cb(arg);
      } catch (err) {
        logger.error('[sessionLifecycle] callback error:', err);
      }
    });
  }

  function fireAll(callbacks: Set<Callback>): void {
    callbacks.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        logger.error('[sessionLifecycle] callback error:', err);
      }
    });
  }

  return {
    onDriverJoined(cb) {
      driverJoinedCallbacks.add(cb);
      return () => driverJoinedCallbacks.delete(cb);
    },
    onDriverLeft(cb) {
      driverLeftCallbacks.add(cb);
      return () => driverLeftCallbacks.delete(cb);
    },
    onSessionNumChange(cb) {
      sessionNumChangeCallbacks.add(cb);
      return () => sessionNumChangeCallbacks.delete(cb);
    },
    onDisconnect(cb) {
      disconnectCallbacks.add(cb);
      return () => disconnectCallbacks.delete(cb);
    },

    _onTelemetry(telemetry) {
      const sessionNum = telemetry.SessionNum?.value?.[0];
      if (sessionNum !== undefined && sessionNum !== lastSessionNum) {
        if (lastSessionNum !== -1) {
          logger.info(
            `[sessionLifecycle] SessionNum changed: ${lastSessionNum} -> ${sessionNum}`
          );
          fireAll(sessionNumChangeCallbacks);
        }
        lastSessionNum = sessionNum;
      }
    },

    _onSession(session) {
      const drivers = session?.DriverInfo?.Drivers ?? [];
      const currentCarIdxs = new Set<number>(
        drivers
          .filter((d) => !d.CarIsPaceCar && !d.IsSpectator)
          .map((d) => d.CarIdx)
      );

      // Detect joins
      for (const carIdx of currentCarIdxs) {
        if (!knownDriverCarIdxs.has(carIdx)) {
          logger.info(`[sessionLifecycle] Driver joined: carIdx=${carIdx}`);
          fire(driverJoinedCallbacks, carIdx);
        }
      }

      // Detect leaves
      for (const carIdx of knownDriverCarIdxs) {
        if (!currentCarIdxs.has(carIdx)) {
          logger.info(`[sessionLifecycle] Driver left: carIdx=${carIdx}`);
          fire(driverLeftCallbacks, carIdx);
        }
      }

      knownDriverCarIdxs = currentCarIdxs;
    },

    _onDisconnect() {
      logger.info('[sessionLifecycle] Disconnect detected');
      knownDriverCarIdxs = new Set();
      lastSessionNum = -1;
      fireAll(disconnectCallbacks);
    },
  };
}
