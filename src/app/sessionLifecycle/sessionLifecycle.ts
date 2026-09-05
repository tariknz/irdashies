import type { Session, Telemetry } from '@irdashies/types';
import logger from '../logger';

type Callback = () => void;
type CarIdxCallback = (carIdx: number) => void;
type SessionTypeCallback = (sessionType: string) => void;
type DrivingStateCallback = (isDriving: boolean) => void;
export interface SessionEnterEvent {
  replay: boolean;
}
type EnterCallback = (event: SessionEnterEvent) => void;

export interface SessionLifecycle {
  /** Called when a live or recorded telemetry source begins publishing. */
  onEnter: (cb: EnterCallback) => () => void;
  /** Called when a new driver joins (carIdx newly populated in DriverInfo). */
  onDriverJoined: (cb: CarIdxCallback) => () => void;
  /** Called when a driver leaves (carIdx removed from DriverInfo). */
  onDriverLeft: (cb: CarIdxCallback) => () => void;
  /** Called when the session number changes (practice -> quali -> race). */
  onSessionNumChange: (cb: Callback) => () => void;
  /**
   * Called when the type of the current session resolves or changes, e.g.
   * 'Practice' -> 'Race'. Unlike onSessionNumChange this also fires for the
   * first session seen, because entering an event is itself the transition a
   * consumer cares about. Two consecutive practice sessions do not fire it:
   * the number changes but the type does not.
   */
  onSessionTypeChange: (cb: SessionTypeCallback) => () => void;
  /**
   * Called when the player gets in or out of the car. False covers spotting
   * for a team-mate, spectating, sitting in the garage and replay playback —
   * anything that is not hands on the wheel.
   */
  onDrivingStateChange: (cb: DrivingStateCallback) => () => void;
  /** Called when iRacing disconnects (SDK stops publishing). */
  onDisconnect: (cb: Callback) => () => void;

  // Internal — called by iracingSdkBridge on each SDK tick.
  _onEnter: (event: SessionEnterEvent) => void;
  _onTelemetry: (telemetry: Telemetry) => void;
  _onSession: (session: Session) => void;
  _onDisconnect: () => void;
}

export function createSessionLifecycle(): SessionLifecycle {
  const enterCallbacks = new Set<EnterCallback>();
  const driverJoinedCallbacks = new Set<CarIdxCallback>();
  const driverLeftCallbacks = new Set<CarIdxCallback>();
  const sessionNumChangeCallbacks = new Set<Callback>();
  const sessionTypeChangeCallbacks = new Set<SessionTypeCallback>();
  const drivingStateChangeCallbacks = new Set<DrivingStateCallback>();
  const disconnectCallbacks = new Set<Callback>();

  // Track current state to detect deltas.
  let knownDriverCarIdxs = new Set<number>();
  let lastSessionNum = -1;
  const sessionTypesByNum = new Map<number, string>();
  let lastSessionType: string | undefined;
  let lastIsDriving: boolean | undefined;

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

  /**
   * The session number arrives on the telemetry tick and the types arrive with
   * session info, in no guaranteed order, so resolution is attempted after
   * either one moves.
   */
  function resolveSessionType(): void {
    if (lastSessionNum === -1) return;
    const sessionType = sessionTypesByNum.get(lastSessionNum);
    if (!sessionType || sessionType === lastSessionType) return;
    logger.info(
      `[sessionLifecycle] Session type: ${lastSessionType ?? 'none'} -> ${sessionType}`
    );
    lastSessionType = sessionType;
    fire(sessionTypeChangeCallbacks, sessionType);
  }

  function resolveDrivingState(telemetry: Telemetry): void {
    const flag = (key: keyof Telemetry): boolean =>
      (telemetry[key] as { value?: unknown[] } | undefined)?.value?.[0] ===
      true;

    // Mirrors the renderer's useDrivingState: in the car counts even when
    // stationary in the pit box, while the garage and replay playback do not.
    const inCar =
      flag('IsOnTrack') || flag('PlayerCarInPitStall') || flag('OnPitRoad');
    const isDriving = inCar && !flag('IsInGarage') && !flag('IsReplayPlaying');

    if (isDriving === lastIsDriving) return;
    lastIsDriving = isDriving;
    fire(drivingStateChangeCallbacks, isDriving);
  }

  return {
    onEnter(cb) {
      enterCallbacks.add(cb);
      return () => enterCallbacks.delete(cb);
    },
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
    onSessionTypeChange(cb) {
      sessionTypeChangeCallbacks.add(cb);
      return () => sessionTypeChangeCallbacks.delete(cb);
    },
    onDrivingStateChange(cb) {
      drivingStateChangeCallbacks.add(cb);
      return () => drivingStateChangeCallbacks.delete(cb);
    },
    onDisconnect(cb) {
      disconnectCallbacks.add(cb);
      return () => disconnectCallbacks.delete(cb);
    },

    _onEnter(event) {
      fire(enterCallbacks, event);
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
        resolveSessionType();
      }
      resolveDrivingState(telemetry);
    },

    _onSession(session) {
      // Built before the driver check below: a session published with no
      // drivers still carries a valid session list, and the type of the
      // session the player is in does not depend on who else is in it.
      for (const info of session?.SessionInfo?.Sessions ?? []) {
        if (info?.SessionNum != null && info.SessionType) {
          sessionTypesByNum.set(info.SessionNum, info.SessionType);
        }
      }
      resolveSessionType();

      const drivers = session?.DriverInfo?.Drivers;

      if (!drivers || drivers.length === 0) {
        if (knownDriverCarIdxs.size > 0) {
          logger.warn(
            `[sessionLifecycle] Session published with no drivers; ignoring (${knownDriverCarIdxs.size} still tracked)`
          );
        }
        return;
      }

      const currentCarIdxs = new Set<number>(
        drivers
          .filter((d) => !d.CarIsPaceCar && !d.IsSpectator)
          .map((d) => d.CarIdx)
      );

      for (const carIdx of currentCarIdxs) {
        if (!knownDriverCarIdxs.has(carIdx)) {
          logger.info(`[sessionLifecycle] Driver joined: carIdx=${carIdx}`);
          fire(driverJoinedCallbacks, carIdx);
        }
      }

      for (const carIdx of knownDriverCarIdxs) {
        if (!currentCarIdxs.has(carIdx)) {
          logger.info(`[sessionLifecycle] Driver left: carIdx=${carIdx}`);
          fire(driverLeftCallbacks, carIdx);
        }
      }

      knownDriverCarIdxs = currentCarIdxs;
    },

    _onDisconnect() {
      const knownCount = knownDriverCarIdxs.size;
      logger.info(
        `[sessionLifecycle] Disconnect detected (${knownCount} known drivers)`
      );
      for (const carIdx of knownDriverCarIdxs) {
        logger.info(
          `[sessionLifecycle] Driver left (disconnect): carIdx=${carIdx}`
        );
        fire(driverLeftCallbacks, carIdx);
      }
      if (knownCount > 0) {
        logger.info(
          `[sessionLifecycle] Released ${knownCount} per-driver slots on disconnect`
        );
      }
      knownDriverCarIdxs = new Set();
      lastSessionNum = -1;
      sessionTypesByNum.clear();
      lastSessionType = undefined;
      lastIsDriving = undefined;
      fireAll(disconnectCallbacks);
    },
  };
}
