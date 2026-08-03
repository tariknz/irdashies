import type {
  Incident,
  IncidentThresholds,
  CarIncidentState,
  IncidentDebugSnapshot,
} from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import { TrackLocation, GlobalFlags, SessionState } from '../irsdk/types/enums';
import logger from '../logger';

/**
 * How far apart in time two cars' incidents can be and still be treated as one
 * contact. Generous on purpose: in a real collision one car often spins
 * immediately while the other runs on and only leaves the road a second or two
 * later.
 */
const CONTACT_WINDOW_S = 3;
/** How far apart on track, in metres, two cars can be and still be paired. */
const CONTACT_DISTANCE_M = 30;

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
  /**
   * Most recent incident-worthy moment per car, used to infer car-to-car
   * contact. Only the latest is kept, so this is bounded by field size and
   * needs no pruning; it is cleared with carStates on a session change.
   */
  private lastAnomaly = new Map<
    number,
    { sessionTime: number; lapDistPct: number }
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
      this.lastAnomaly.clear();

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
    } else if (prevDrivers !== this.sessionDrivers.size) {
      // Re-publish with no session change — carStates/frameBuffers are
      // preserved. iRacing republishes the session YAML roughly once a second,
      // so this only logs when the driver roster actually moved; logging every
      // republish buried the incident stream in the dev console.
      logger.debug(
        `[IncidentDetector] updateSession: roster changed ${prevDrivers}→${this.sessionDrivers.size} drivers (subSession=${subSessionId ?? '(none)'} sessionNum=${effectiveSessionNum ?? '(none)'})`
      );
    }
  }

  /** Exposed for testing. Returns speed in km/h. Returns 0 for backwards movement. */
  /**
   * Speed in km/h derived from lap-distance movement, or null when no usable
   * reading can be taken this tick.
   *
   * Null is NOT the same as 0 km/h, and the distinction matters: we poll faster
   * than remote cars' CarIdxLapDistPct arrives over the network, so a car that
   * is moving perfectly normally still produces ticks where its position is
   * unchanged. Reporting those as 0 km/h drags the rolling average down and
   * makes a moving car look stopped — which is how a car trickling into the
   * pits, or any car during a paused replay, gets reported as a crash.
   */
  calculateSpeed(
    prevLapDistPct: number,
    currLapDistPct: number,
    deltaTime: number,
    trackLengthM: number
  ): number | null {
    // Clock did not advance: paused/rewound replay, or a duplicated frame.
    if (deltaTime <= 0) return null;
    let distPct = currLapDistPct - prevLapDistPct;
    if (distPct < -0.5) distPct += 1.0; // wrap-around
    // No forward movement recorded. Either the position simply has not been
    // refreshed yet, or the car nudged backwards; neither is a speed reading.
    if (distPct <= 0) return null;
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

  /**
   * Looks for another car that had an incident-worthy moment close by in both
   * time and track position, which is the best available proxy for contact —
   * iRacing's telemetry exposes no collision flag.
   *
   * Deliberately loose: cars involved in the same incident are often seconds
   * apart, because one may spin immediately while the other carries on and
   * only leaves the road later. A tight window misses those entirely. The cost
   * is that two cars independently running wide at the same corner can be
   * paired, which is why the evidence says "likely contact" rather than
   * asserting it.
   */
  /** Remembers where and when a car got into trouble, for contact pairing. */
  private recordAnomaly(
    carIdx: number,
    sessionTime: number,
    lapDistPct: number
  ) {
    this.lastAnomaly.set(carIdx, { sessionTime, lapDistPct });
  }

  private findContactPartner(
    carIdx: number,
    sessionTime: number,
    lapDistPct: number,
    trackLengthM: number
  ): { name: string; carNumber: string } | null {
    if (!trackLengthM) return null;
    const maxPctApart = CONTACT_DISTANCE_M / trackLengthM;

    for (const [otherIdx, anomaly] of this.lastAnomaly) {
      if (otherIdx === carIdx) continue;
      if (Math.abs(sessionTime - anomaly.sessionTime) > CONTACT_WINDOW_S)
        continue;

      // Shortest way round the lap, so cars either side of the start/finish
      // line still register as adjacent.
      let gap = Math.abs(lapDistPct - anomaly.lapDistPct);
      if (gap > 0.5) gap = 1 - gap;
      if (gap > maxPctApart) continue;

      const driver = this.sessionDrivers.get(otherIdx);
      if (!driver || driver.isPaceCar) continue;
      return { name: driver.name, carNumber: driver.carNumber };
    }
    return null;
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
      // A null reading means "no data this tick", not "stopped". Skipping the
      // buffers keeps the last known speed rather than polluting the rolling
      // average with zeroes; the speed-based detectors below sit this tick out.
      const deltaTime = snap.sessionTime - state.prevSessionTime;
      const speedSample = this.calculateSpeed(
        state.prevLapDistPct,
        snap.carIdxLapDistPct[carIdx] ?? 0,
        deltaTime,
        trackLengthM
      );
      const hasSpeedSample = speedSample !== null;
      const rawSpeed = speedSample ?? state.currentAvgSpeed;

      if (hasSpeedSample) {
        state.recentRawSpeeds.push(speedSample);
        if (state.recentRawSpeeds.length > this.thresholds.suddenStopFrames) {
          state.recentRawSpeeds.shift();
        }
        state.speedHistory.push(speedSample);
        if (state.speedHistory.length > 5) {
          state.speedHistory.shift();
        }
        state.currentAvgSpeed =
          state.speedHistory.reduce((a, b) => a + b, 0) /
          state.speedHistory.length;

        this.pushFrameHistory(carIdx, {
          speed: speedSample,
          lapDistPct: snap.carIdxLapDistPct[carIdx] ?? 0,
          trackSurface: surface,
          sessionTime: snap.sessionTime,
        });
      }

      // --- Off-track ---
      if (surface === TrackLocation.OffTrack) {
        state.offTrackFrameCount++;
        if (state.offTrackFrameCount === this.thresholds.offTrackDebounce) {
          const lapDistPct = snap.carIdxLapDistPct[carIdx] ?? 0;
          // Another car in trouble at the same place and moment turns a lone
          // excursion into a contact, which is reported as a Crash so it is
          // not lost among routine off-tracks.
          const partner = this.findContactPartner(
            carIdx,
            snap.sessionTime,
            lapDistPct,
            trackLengthM
          );
          const type = partner ? IncidentType.Crash : IncidentType.OffTrack;

          if (!this.isCoolingDown(state, type, nowMs)) {
            state.lastIncidentTime[type] = nowMs;
            const debug = this.buildDebugSnapshot(
              carIdx,
              state,
              'off-track',
              partner
                ? `Off-track for ${state.offTrackFrameCount} frames alongside #${partner.carNumber} ${partner.name} — likely contact`
                : `Off-track for ${state.offTrackFrameCount} frames`
            );
            this.emit({
              ...this.createIncidentBase(carIdx, snap, type),
              debug,
            });
          }
          this.recordAnomaly(carIdx, snap.sessionTime, lapDistPct);
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
      // Crash detection must cover cars that are OFF the track, not just on it:
      // a car sitting in a gravel trap or against a barrier is the most common
      // crash there is, and it reports surface OffTrack. Restricting to OnTrack
      // meant such a car only ever produced an OffTrack incident and never a
      // Crash. Pit surfaces stay excluded — a stationary car in its pit stall
      // or on pit approach is not an incident.
      const isOnRacingSurface =
        surface === TrackLocation.OnTrack || surface === TrackLocation.OffTrack;
      const isOnPitRoad = onPitRoad;
      const isRacing = snap.sessionState === SessionState.Racing;
      if (!(isOnRacingSurface && !isOnPitRoad && isRacing)) {
        // Not racing (formation/pace laps) or on pit road — drain the counter so
        // it doesn't carry over and fire immediately once the session goes green.
        state.slowFrameCount = 0;
      } else if (hasSpeedSample) {
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
            this.recordAnomaly(
              carIdx,
              snap.sessionTime,
              snap.carIdxLapDistPct[carIdx] ?? 0
            );
          }
        } else {
          state.slowFrameCount = 0;
        }
      }
      // No speed reading this tick: hold slowFrameCount as-is. Resetting would
      // let a genuinely stopped car escape detection whenever its position
      // failed to refresh, and incrementing would invent evidence we don't have.

      // --- Sudden stop ---
      // isRacing matters as much here as it does for sustained-slow. On a
      // session changeover (practice/qualifying -> race) iRacing lifts cars off
      // the track at whatever speed they were doing and sets them down
      // stationary on the grid. That teleport writes racing speeds into the
      // buffer and the car then reads as stopped, which looks exactly like a
      // crash. Gridding happens in GetInCar/Warmup/ParadeLaps, so gating on
      // Racing discards the whole sequence.
      if (
        isOnRacingSurface &&
        !isOnPitRoad &&
        isRacing &&
        hasSpeedSample &&
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
          this.recordAnomaly(
            carIdx,
            snap.sessionTime,
            snap.carIdxLapDistPct[carIdx] ?? 0
          );
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
