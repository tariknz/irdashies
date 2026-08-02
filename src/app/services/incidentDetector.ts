import type {
  Incident,
  IncidentThresholds,
  CarIncidentState,
  IncidentDebugSnapshot,
} from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import { TrackLocation, GlobalFlags, SessionState } from '../irsdk/types/enums';
import logger from '../logger';

interface TelemetrySnapshot {
  sessionTime: number;
  sessionNum: number;
  sessionState: number;
  replayFrameNum: number;
  carIdxLapDistPct: number[];
  carIdxLap: number[];
  carIdxTrackSurface: number[];
  carIdxSessionFlags: number[];
  carIdxOnPitRoad: boolean[];
}

type IncidentListener = (incident: Incident) => void;

export class IncidentDetector {
  private carStates = new Map<number, CarIncidentState>();
  private listeners = new Set<IncidentListener>();
  private sessionDrivers = new Map<
    number,
    { name: string; carNumber: string; teamName: string; isPaceCar: boolean }
  >();
  private isDev: boolean;
  private frameBuffers = new Map<
    number,
    IncidentDebugSnapshot['frameHistory']
  >();
  private lastSubSessionId: string | null = null;
  private lastSessionNum: number | null = null;

  constructor(
    private thresholds: IncidentThresholds,
    isDev: boolean
  ) {
    this.isDev = isDev;
  }

  updateThresholds(thresholds: IncidentThresholds) {
    this.thresholds = thresholds;
  }

  updateSession(
    session: {
      WeekendInfo?: {
        SubSessionID?: number | string;
      };
      SessionInfo?: {
        Sessions?: { SessionNum?: number; SessionType?: string }[];
      };
      DriverInfo?: {
        Drivers?: {
          CarIdx: number;
          UserName: string;
          CarNumber: string;
          TeamName: string;
          CarIsPaceCar: number;
        }[];
      };
    },
    sessionNum?: number
  ) {
    const subSessionId =
      session.WeekendInfo?.SubSessionID != null
        ? String(session.WeekendInfo.SubSessionID)
        : null;
    const effectiveSessionNum = sessionNum ?? null;

    const sessionChanged =
      this.lastSubSessionId !== null &&
      subSessionId !== null &&
      this.lastSubSessionId !== subSessionId;
    const phaseChanged =
      this.lastSessionNum !== null &&
      effectiveSessionNum !== null &&
      this.lastSessionNum !== effectiveSessionNum;
    const isFirstUpdate =
      this.lastSubSessionId === null && this.lastSessionNum === null;
    const shouldReset = sessionChanged || phaseChanged || isFirstUpdate;

    // Always refresh driver map (cheap; handles late joiners / roster changes)
    const prevDrivers = this.sessionDrivers.size;
    this.sessionDrivers.clear();
    session.DriverInfo?.Drivers?.forEach((d) => {
      this.sessionDrivers.set(d.CarIdx, {
        name: d.UserName,
        carNumber: d.CarNumber,
        teamName: d.TeamName,
        isPaceCar: d.CarIsPaceCar === 1,
      });
    });

    if (shouldReset) {
      const prevCarStates = this.carStates.size;
      this.carStates.clear();
      this.frameBuffers.clear();

      const phaseName =
        effectiveSessionNum != null
          ? (session.SessionInfo?.Sessions?.find(
              (s) => s.SessionNum === effectiveSessionNum
            )?.SessionType ?? 'unknown')
          : 'unknown';

      if (isFirstUpdate) {
        logger.info(
          `[IncidentDetector] updateSession: initial load subSession=${subSessionId ?? '(none)'} sessionNum=${effectiveSessionNum ?? '(none)'} (${phaseName}); ${prevDrivers}→${this.sessionDrivers.size} drivers`
        );
      } else {
        logger.info(
          `[IncidentDetector] updateSession: RESET ${this.lastSubSessionId ?? '(none)'}/${this.lastSessionNum ?? '(none)'} → ${subSessionId ?? '(none)'}/${effectiveSessionNum ?? '(none)'} (${phaseName}); cleared ${prevCarStates} carStates; ${prevDrivers}→${this.sessionDrivers.size} drivers`
        );
      }

      this.lastSubSessionId = subSessionId;
      this.lastSessionNum = effectiveSessionNum;
    } else {
      // Re-publish with no real change — preserve carStates/frameBuffers
      logger.debug(
        `[IncidentDetector] updateSession: refresh (no change) subSession=${subSessionId ?? '(none)'} sessionNum=${effectiveSessionNum ?? '(none)'}; ${prevDrivers}→${this.sessionDrivers.size} drivers`
      );
    }
  }

  /** Exposed for testing. Returns speed in km/h. Returns 0 for backwards movement. */
  calculateSpeed(
    prevLapDistPct: number,
    currLapDistPct: number,
    deltaTime: number,
    trackLengthM: number
  ): number {
    if (deltaTime <= 0) return 0;
    let distPct = currLapDistPct - prevLapDistPct;
    if (distPct < -0.5) distPct += 1.0; // wrap-around
    if (distPct <= 0) return 0;
    const distanceM = trackLengthM * distPct;
    return (distanceM / deltaTime) * 3.6;
  }

  onIncident(cb: IncidentListener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  private getOrCreateState(carIdx: number): CarIncidentState {
    if (!this.carStates.has(carIdx)) {
      this.carStates.set(carIdx, {
        prevTrackSurface: TrackLocation.OnTrack,
        prevSessionFlags: 0,
        prevOnPitRoad: false,
        prevLapDistPct: 0,
        prevSessionTime: 0,
        speedHistory: [],
        currentAvgSpeed: 0,
        recentRawSpeeds: [],
        slowFrameCount: 0,
        offTrackFrameCount: 0,
        onPitRoadFrameCount: 0,
        lastIncidentTime: {} as Record<string, number>,
        hasPrevFrame: false,
      });
    }
    const state = this.carStates.get(carIdx);
    if (!state)
      throw new Error(`CarIncidentState missing for carIdx ${carIdx}`);
    return state;
  }

  private isCoolingDown(
    state: CarIncidentState,
    type: IncidentType,
    nowMs: number
  ): boolean {
    const last = state.lastIncidentTime[type] ?? 0;
    return nowMs - last < this.thresholds.cooldownSeconds * 1000;
  }

  private pushFrameHistory(
    carIdx: number,
    entry: IncidentDebugSnapshot['frameHistory'][number]
  ) {
    if (!this.isDev) return;
    const buf = this.frameBuffers.get(carIdx) ?? [];
    buf.push(entry);
    if (buf.length > 10) buf.shift();
    this.frameBuffers.set(carIdx, buf);
  }

  private buildDebugSnapshot(
    carIdx: number,
    state: CarIncidentState,
    trigger: IncidentDebugSnapshot['trigger'],
    evidence: string
  ): IncidentDebugSnapshot | undefined {
    if (!this.isDev) return undefined;
    return {
      trigger,
      evidence,
      thresholds: { ...this.thresholds },
      carStateAtDetection: {
        speedHistory: [...state.speedHistory],
        currentAvgSpeed: state.currentAvgSpeed,
        recentRawSpeeds: [...state.recentRawSpeeds],
        slowFrameCount: state.slowFrameCount,
        offTrackFrameCount: state.offTrackFrameCount,
        prevTrackSurface: state.prevTrackSurface,
        prevSessionFlags: state.prevSessionFlags,
        prevOnPitRoad: state.prevOnPitRoad,
        prevLapDistPct: state.prevLapDistPct,
      },
      frameHistory: [...(this.frameBuffers.get(carIdx) ?? [])],
    };
  }

  private createIncidentBase(
    carIdx: number,
    telemetry: TelemetrySnapshot,
    type: IncidentType
  ): Omit<Incident, 'debug'> {
    const driver = this.sessionDrivers.get(carIdx);
    return {
      id: `${carIdx}-${telemetry.sessionTime}-${type}`,
      carIdx,
      driverName: driver?.name ?? 'Unknown',
      carNumber: driver?.carNumber ?? '?',
      teamName: driver?.teamName ?? '',
      sessionNum: telemetry.sessionNum,
      sessionTime: telemetry.sessionTime,
      lapNum: telemetry.carIdxLap[carIdx] ?? 0,
      replayFrameNum: telemetry.replayFrameNum,
      type,
      lapDistPct: telemetry.carIdxLapDistPct[carIdx] ?? 0,
      timestamp: Date.now(),
    };
  }

  processTelemetry(snap: TelemetrySnapshot, trackLengthM: number) {
    const nowMs = Date.now();
    const numCars = snap.carIdxLapDistPct.length;

    for (let carIdx = 0; carIdx < numCars; carIdx++) {
      const driver = this.sessionDrivers.get(carIdx);
      if (!driver || driver.isPaceCar) continue;
      if (snap.carIdxTrackSurface[carIdx] === TrackLocation.NotInWorld)
        continue;

      const state = this.getOrCreateState(carIdx);
      const surface = snap.carIdxTrackSurface[carIdx] ?? TrackLocation.OnTrack;
      const onPitRoad = snap.carIdxOnPitRoad[carIdx] ?? false;

      // First frame: seed prev* state and skip detection to avoid garbage
      // speed derived from zeroed prevLapDistPct/prevSessionTime.
      if (!state.hasPrevFrame) {
        state.prevOnPitRoad = onPitRoad;
        state.prevLapDistPct = snap.carIdxLapDistPct[carIdx] ?? 0;
        state.prevSessionTime = snap.sessionTime;
        state.prevTrackSurface = surface;
        state.prevSessionFlags = snap.carIdxSessionFlags[carIdx] ?? 0;
        state.hasPrevFrame = true;
        continue;
      }

      // --- Pit entry ---
      if (onPitRoad) {
        state.onPitRoadFrameCount++;
        if (
          state.onPitRoadFrameCount === this.thresholds.pitEntryDebounce &&
          !this.isCoolingDown(state, IncidentType.PitEntry, nowMs)
        ) {
          state.lastIncidentTime[IncidentType.PitEntry] = nowMs;
          const debug = this.buildDebugSnapshot(
            carIdx,
            state,
            'pit-entry',
            `Pit entry detected for car ${carIdx} after ${state.onPitRoadFrameCount} frames`
          );
          this.emit({
            ...this.createIncidentBase(carIdx, snap, IncidentType.PitEntry),
            debug,
          });
        }
      } else {
        state.onPitRoadFrameCount = 0;
      }

      // --- Speed calculation ---
      const deltaTime = snap.sessionTime - state.prevSessionTime;
      const rawSpeed =
        deltaTime > 0
          ? this.calculateSpeed(
              state.prevLapDistPct,
              snap.carIdxLapDistPct[carIdx] ?? 0,
              deltaTime,
              trackLengthM
            )
          : 0;

      state.recentRawSpeeds.push(rawSpeed);
      if (state.recentRawSpeeds.length > this.thresholds.suddenStopFrames) {
        state.recentRawSpeeds.shift();
      }
      state.speedHistory.push(rawSpeed);
      if (state.speedHistory.length > 5) {
        state.speedHistory.shift();
      }
      state.currentAvgSpeed =
        state.speedHistory.reduce((a, b) => a + b, 0) /
        state.speedHistory.length;

      this.pushFrameHistory(carIdx, {
        speed: rawSpeed,
        lapDistPct: snap.carIdxLapDistPct[carIdx] ?? 0,
        trackSurface: surface,
        sessionTime: snap.sessionTime,
      });

      // --- Off-track ---
      if (surface === TrackLocation.OffTrack) {
        state.offTrackFrameCount++;
        if (
          state.offTrackFrameCount === this.thresholds.offTrackDebounce &&
          !this.isCoolingDown(state, IncidentType.OffTrack, nowMs)
        ) {
          state.lastIncidentTime[IncidentType.OffTrack] = nowMs;
          const debug = this.buildDebugSnapshot(
            carIdx,
            state,
            'off-track',
            `Off-track for ${state.offTrackFrameCount} frames`
          );
          this.emit({
            ...this.createIncidentBase(carIdx, snap, IncidentType.OffTrack),
            debug,
          });
        }
      } else {
        state.offTrackFrameCount = 0;
      }

      // --- Flag detection ---
      const flags = snap.carIdxSessionFlags[carIdx] ?? 0;
      const prevFlags = state.prevSessionFlags;
      const newFlags = flags & ~prevFlags;

      if (
        (newFlags & GlobalFlags.Black || newFlags & GlobalFlags.Disqualify) &&
        !this.isCoolingDown(state, IncidentType.BlackFlag, nowMs)
      ) {
        state.lastIncidentTime[IncidentType.BlackFlag] = nowMs;
        const debug = this.buildDebugSnapshot(
          carIdx,
          state,
          'black-flag',
          `Black flag for car ${carIdx}`
        );
        this.emit({
          ...this.createIncidentBase(carIdx, snap, IncidentType.BlackFlag),
          debug,
        });
      }
      if (
        newFlags & GlobalFlags.Furled &&
        !this.isCoolingDown(state, IncidentType.Slowdown, nowMs)
      ) {
        state.lastIncidentTime[IncidentType.Slowdown] = nowMs;
        const debug = this.buildDebugSnapshot(
          carIdx,
          state,
          'slowdown-flag',
          `Slowdown flag for car ${carIdx}`
        );
        this.emit({
          ...this.createIncidentBase(carIdx, snap, IncidentType.Slowdown),
          debug,
        });
      }

      // --- Sustained slow crash ---
      const isOnTrack = surface === TrackLocation.OnTrack;
      const isOnPitRoad = onPitRoad;
      const isRacing = snap.sessionState === SessionState.Racing;
      if (isOnTrack && !isOnPitRoad && isRacing) {
        if (state.currentAvgSpeed < this.thresholds.slowSpeedThreshold) {
          state.slowFrameCount++;
          if (
            state.slowFrameCount === this.thresholds.slowFrameThreshold &&
            !this.isCoolingDown(state, IncidentType.Crash, nowMs)
          ) {
            state.lastIncidentTime[IncidentType.Crash] = nowMs;
            const debug = this.buildDebugSnapshot(
              carIdx,
              state,
              'sustained-slow',
              `avgSpeed ${state.currentAvgSpeed.toFixed(1)} km/h < threshold ${this.thresholds.slowSpeedThreshold} km/h for ${state.slowFrameCount} frames`
            );
            this.emit({
              ...this.createIncidentBase(carIdx, snap, IncidentType.Crash),
              debug,
            });
          }
        } else {
          state.slowFrameCount = 0;
        }
      } else {
        // Not racing (formation/pace laps) or on pit road — drain counter so
        // it doesn't carry over and fire immediately once the session goes green.
        state.slowFrameCount = 0;
      }

      // --- Sudden stop ---
      if (
        isOnTrack &&
        !isOnPitRoad &&
        state.recentRawSpeeds.length >= this.thresholds.suddenStopFrames
      ) {
        const oldestSpeed = state.recentRawSpeeds[0];
        const currentSpeed = rawSpeed;
        if (
          oldestSpeed > this.thresholds.suddenStopFromSpeed &&
          currentSpeed < this.thresholds.suddenStopToSpeed &&
          !this.isCoolingDown(state, IncidentType.Crash, nowMs)
        ) {
          state.lastIncidentTime[IncidentType.Crash] = nowMs;
          const debug = this.buildDebugSnapshot(
            carIdx,
            state,
            'sudden-stop',
            `Speed dropped from ${state.recentRawSpeeds[0]?.toFixed(1)} to ${rawSpeed.toFixed(1)} km/h`
          );
          this.emit({
            ...this.createIncidentBase(carIdx, snap, IncidentType.Crash),
            debug,
          });
        }
      }

      // Update state
      state.prevOnPitRoad = onPitRoad;
      state.prevLapDistPct = snap.carIdxLapDistPct[carIdx] ?? 0;
      state.prevSessionTime = snap.sessionTime;
      state.prevTrackSurface = surface;
      state.prevSessionFlags = snap.carIdxSessionFlags[carIdx] ?? 0;
    }
  }

  private emit(incident: Incident) {
    logger.info(
      `[IncidentDetector] emit type=${incident.type} car=${incident.carIdx} lap=${incident.lapNum} lapDistPct=${incident.lapDistPct.toFixed(3)} sessionTime=${incident.sessionTime.toFixed(2)}${incident.debug ? ` trigger=${incident.debug.trigger} evidence="${incident.debug.evidence}"` : ''}`
    );
    this.listeners.forEach((cb) => cb(incident));
  }
}
