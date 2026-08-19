import type {
  Incident,
  IncidentThresholds,
  CarIncidentState,
  IncidentDebugSnapshot,
} from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import { TrackLocation, GlobalFlags } from '../irsdk/types/enums';
import logger from '../logger';
import {
  baselineSpeed,
  measureDeceleration,
  SPEED_BASELINE_S,
} from './speedBaseline';

/**
 * How far apart in time two cars' incidents can be and still be treated as one
 * contact. Generous on purpose: in a real collision one car often spins
 * immediately while the other runs on and only leaves the road a second or two
 * later.
 */
const CONTACT_WINDOW_S = 3;
/** How far apart on track, in metres, two cars can be and still be paired. */
const CONTACT_DISTANCE_M = 30;
/**
 * Contact is only inferred when at least one of the pair actually lost speed.
 * Two cars running wide at the same corner at unchanged pace have not hit each
 * other — they have both just missed the apex, which is a routine off-track.
 */
const CONTACT_SPEED_LOSS_RATIO = 0.7;
/** Half-life of the peak-speed decay, so it reflects the last couple of seconds. */
const PEAK_SPEED_HALF_LIFE_S = 1.5;
/**
 * Frames of per-car history kept for incident debug snapshots (dev only).
 * At ~20Hz this is roughly 3 seconds. Ten frames — half a second — consistently
 * showed only the aftermath: a spun car was already accelerating away again by
 * the time the snapshot began, so the impact itself was never in the capture.
 */
const FRAME_HISTORY_LENGTH = 60;
/** Remote positions may repeat briefly; only a full second implies a stop. */
const STATIONARY_SAMPLE_DELAY_S = 1;
/** Position history kept: two baselines back to back, plus margin. */
const IMPACT_WINDOW_S = SPEED_BASELINE_S * 2 + 0.5;
/**
 * How long the impact condition must hold before it is reported. A real impact
 * satisfies it for roughly a baseline; a single bad position reading does not
 * survive the next frame.
 */
const IMPACT_CONFIRM_S = 0.1;
/**
 * Fastest reading treated as real. A tow, a reset to pits, or any other jump in
 * lapDistPct derives a speed no car can reach, and the next ordinary tick then
 * looks like a deceleration of thousands of km/h/s.
 */
const MAX_PLAUSIBLE_SPEED_KMH = 450;

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
    {
      name: string;
      carNumber: string;
      teamName: string;
      isPaceCar: boolean;
      isSpectator: boolean;
    }
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
    { sessionTime: number; lapDistPct: number; lostSpeed: boolean }
  >();
  private lastSubSessionId: string | null = null;
  private lastSessionNum: number | null = null;
  /**
   * SessionNum -> session type ('Race', 'Practice', 'Open Qualify', ...).
   * Diagnostics only: detection is deliberately not gated on session type, so
   * this exists to name the phase in the log and nothing more.
   */
  private sessionTypesByNum = new Map<number, string>();

  constructor(
    private thresholds: IncidentThresholds,
    isDev: boolean
  ) {
    this.isDev = isDev;
  }

  updateThresholds(thresholds: IncidentThresholds) {
    this.thresholds = thresholds;
  }

  /**
   * Forces every car to re-seed from the next frame without losing cooldowns
   * or the driver roster. Used after a replay rewind, where the previous
   * frame's position and time are no longer adjacent to the next one.
   */
  reseedCarStates(): void {
    for (const state of this.carStates.values()) {
      state.hasPrevFrame = false;
      state.slowSinceSessionTime = null;
      // slowReported stays latched. It cannot be re-derived from a single
      // seeded frame, so clearing it lets an already-reported stopped car
      // fire a second Crash after a rewind. The car re-arms it when it moves.
      state.offTrackSinceSessionTime = null;
      state.onPitRoadSinceSessionTime = null;
      state.recentPositions.length = 0;
      state.impactPendingSince = null;
    }
  }

  /**
   * Drops per-car detection state: speed history, debounce counters and
   * cooldowns. The driver roster and session-type map are session facts rather
   * than detection state, so they survive.
   *
   * Returns how many car states were dropped, for logging.
   */
  resetCarStates(): number {
    const cleared = this.carStates.size;
    this.carStates.clear();
    this.frameBuffers.clear();
    this.lastAnomaly.clear();
    return cleared;
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
          IsSpectator?: number;
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
    const phaseResolved =
      this.lastSubSessionId !== null &&
      this.lastSessionNum === null &&
      effectiveSessionNum !== null;
    const isFirstUpdate =
      this.lastSubSessionId === null && this.lastSessionNum === null;
    const shouldReset =
      sessionChanged || phaseChanged || phaseResolved || isFirstUpdate;

    // Always refresh driver map (cheap; handles late joiners / roster changes)
    const prevDrivers = this.sessionDrivers.size;
    this.sessionDrivers.clear();
    session.DriverInfo?.Drivers?.forEach((d) => {
      this.sessionDrivers.set(d.CarIdx, {
        name: d.UserName,
        carNumber: d.CarNumber,
        teamName: d.TeamName,
        isPaceCar: d.CarIsPaceCar === 1,
        isSpectator: d.IsSpectator === 1,
      });
    });

    this.sessionTypesByNum.clear();
    session.SessionInfo?.Sessions?.forEach((s) => {
      if (s.SessionNum != null && s.SessionType) {
        this.sessionTypesByNum.set(s.SessionNum, s.SessionType);
      }
    });

    const phaseName =
      effectiveSessionNum != null
        ? (this.sessionTypesByNum.get(effectiveSessionNum) ?? 'unknown')
        : 'unknown';

    if (shouldReset) {
      const prevCarStates = this.resetCarStates();

      if (isFirstUpdate) {
        logger.info(
          `[IncidentDetector] updateSession: initial load subSession=${subSessionId ?? '(none)'} sessionNum=${effectiveSessionNum ?? '(none)'} (${phaseName}); ${prevDrivers}→${this.sessionDrivers.size} drivers`
        );
      } else {
        logger.info(
          `[IncidentDetector] updateSession: RESET ${this.lastSubSessionId ?? '(none)'}/${this.lastSessionNum ?? '(none)'} → ${subSessionId ?? '(none)'}/${effectiveSessionNum ?? '(none)'} (${phaseName}); cleared ${prevCarStates} carStates; ${prevDrivers}→${this.sessionDrivers.size} drivers`
        );
      }
    } else if (prevDrivers !== this.sessionDrivers.size) {
      // Re-publish with no session change — carStates/frameBuffers are
      // preserved. iRacing republishes the session YAML roughly once a second,
      // so this only logs when the driver roster actually moved; logging every
      // republish buried the incident stream in the dev console.
      logger.debug(
        `[IncidentDetector] updateSession: roster changed ${prevDrivers}→${this.sessionDrivers.size} drivers (subSession=${subSessionId ?? '(none)'} sessionNum=${effectiveSessionNum ?? '(none)'})`
      );
    }

    if (subSessionId !== null) this.lastSubSessionId = subSessionId;
    if (effectiveSessionNum !== null) {
      this.lastSessionNum = effectiveSessionNum;
    }
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
        lastPositionChangeSessionTime: 0,
        currentAvgSpeed: 0,
        recentPositions: [],
        recentPeakSpeed: 0,
        impactPendingSince: null,
        slowSinceSessionTime: null,
        offTrackSinceSessionTime: null,
        onPitRoadSinceSessionTime: null,
        pitEntryReported: false,
        offTrackReported: false,
        slowReported: false,
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
    sessionTime: number
  ): boolean {
    const last = state.lastIncidentTime[type];
    return (
      last !== undefined && sessionTime - last < this.thresholds.cooldownSeconds
    );
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
  /**
   * True when the car is meaningfully slower than it was a moment ago. Used to
   * tell a car that was hit from one that simply ran wide at unchanged pace.
   */
  private hasLostSpeed(state: CarIncidentState): boolean {
    if (state.recentPeakSpeed <= 0) return false;
    return (
      state.currentAvgSpeed < state.recentPeakSpeed * CONTACT_SPEED_LOSS_RATIO
    );
  }

  /** Remembers where and when a car got into trouble, for contact pairing. */
  private recordAnomaly(
    carIdx: number,
    sessionTime: number,
    lapDistPct: number,
    lostSpeed: boolean
  ) {
    this.lastAnomaly.set(carIdx, { sessionTime, lapDistPct, lostSpeed });
  }

  private findContactPartner(
    carIdx: number,
    sessionTime: number,
    lapDistPct: number,
    trackLengthM: number,
    lostSpeed: boolean
  ): { name: string; carNumber: string } | null {
    if (!trackLengthM) return null;
    const maxPctApart = CONTACT_DISTANCE_M / trackLengthM;

    for (const [otherIdx, anomaly] of this.lastAnomaly) {
      if (otherIdx === carIdx) continue;
      if (Math.abs(sessionTime - anomaly.sessionTime) > CONTACT_WINDOW_S)
        continue;

      // Proximity alone pairs cars that independently ran wide at the same
      // corner, which happens constantly at some tracks. Require that the
      // incident actually cost somebody speed.
      if (!lostSpeed && !anomaly.lostSpeed) continue;

      // Shortest way round the lap, so cars either side of the start/finish
      // line still register as adjacent.
      let gap = Math.abs(lapDistPct - anomaly.lapDistPct);
      if (gap > 0.5) gap = 1 - gap;
      if (gap > maxPctApart) continue;

      const driver = this.sessionDrivers.get(otherIdx);
      if (!driver || driver.isPaceCar || driver.isSpectator) continue;
      return { name: driver.name, carNumber: driver.carNumber };
    }
    return null;
  }

  private pushFrameHistory(
    carIdx: number,
    entry: IncidentDebugSnapshot['frameHistory'][number]
  ) {
    // The rolling per-car buffer is the expensive half of the debug capture -
    // an object per car per frame, retained 60 deep. The snapshot itself is
    // built for every incident so the evidence and thresholds behind a call
    // are always available; only the frame trace is development-only.
    if (!this.isDev) return;
    const buf = this.frameBuffers.get(carIdx) ?? [];
    buf.push(entry);
    if (buf.length > FRAME_HISTORY_LENGTH) buf.shift();
    this.frameBuffers.set(carIdx, buf);
  }

  /**
   * The evidence attached to an incident: what triggered it, the thresholds in
   * force, and the readings behind the call. Built for every incident, not just
   * in dev, so a report can always be explained after the fact.
   */
  private buildDebugSnapshot(
    carIdx: number,
    state: CarIncidentState,
    sessionTime: number,
    trigger: IncidentDebugSnapshot['trigger'],
    evidence: string
  ): IncidentDebugSnapshot {
    const elapsedSince = (since: number | null) =>
      since === null ? 0 : sessionTime - since;
    return {
      trigger,
      evidence,
      thresholds: { ...this.thresholds },
      carStateAtDetection: {
        currentAvgSpeed: state.currentAvgSpeed,
        recentPositions: [...state.recentPositions],
        slowForSeconds: elapsedSince(state.slowSinceSessionTime),
        offTrackForSeconds: elapsedSince(state.offTrackSinceSessionTime),
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
    const cooldownTime = snap.sessionTime;
    const numCars = snap.carIdxLapDistPct.length;

    for (let carIdx = 0; carIdx < numCars; carIdx++) {
      const driver = this.sessionDrivers.get(carIdx);
      if (!driver || driver.isPaceCar || driver.isSpectator) continue;
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
        state.lastPositionChangeSessionTime = snap.sessionTime;
        state.prevTrackSurface = surface;
        state.prevSessionFlags = snap.carIdxSessionFlags[carIdx] ?? 0;
        // Treat a condition that is already true as already reported. Without
        // this, seeding mid-pit-stop (a fresh session, or resuming after a
        // replay) makes a stationary car look like it just entered the pits.
        state.pitEntryReported = onPitRoad;
        state.offTrackReported = surface === TrackLocation.OffTrack;
        state.hasPrevFrame = true;
        continue;
      }

      // --- Pit entry ---
      // Reports on the edge, not the level: `>=` stays true for every frame the
      // car is on pit road, so without the latch a car parked in its box emits
      // a fresh entry every time the cooldown lapses.
      if (onPitRoad) {
        state.onPitRoadSinceSessionTime ??= snap.sessionTime;
        const onPitRoadFor = snap.sessionTime - state.onPitRoadSinceSessionTime;
        if (
          onPitRoadFor >= this.thresholds.pitEntryDurationSeconds &&
          !state.pitEntryReported &&
          !this.isCoolingDown(state, IncidentType.PitEntry, cooldownTime)
        ) {
          state.pitEntryReported = true;
          state.lastIncidentTime[IncidentType.PitEntry] = cooldownTime;
          const debug = this.buildDebugSnapshot(
            carIdx,
            state,
            snap.sessionTime,
            'pit-entry',
            `Pit entry detected for car ${carIdx} after ${onPitRoadFor.toFixed(2)}s on pit road`
          );
          this.emit({
            ...this.createIncidentBase(carIdx, snap, IncidentType.PitEntry),
            debug,
          });
        }
      } else {
        state.onPitRoadSinceSessionTime = null;
        state.pitEntryReported = false;
      }

      // --- Speed calculation ---
      // Positions are recorded raw and speed is measured across a baseline, so
      // a position that has not refreshed in step with sessionTime costs a
      // small fraction of a long distance rather than distorting one reading.
      // That also removes the need to special-case remote cars whose positions
      // arrive slower than we poll: over half a second they have always moved.
      const deltaTime = snap.sessionTime - state.prevSessionTime;
      const lapDistPct = snap.carIdxLapDistPct[carIdx] ?? 0;
      if (lapDistPct !== state.prevLapDistPct) {
        state.lastPositionChangeSessionTime = snap.sessionTime;
      }

      // A tow, a reset to pits or a grid placement moves the car without it
      // driving there. History either side of that is not one continuous
      // trajectory, so measuring across the join would invent an enormous
      // acceleration and then an enormous deceleration. Drop it and start over.
      const previous = state.recentPositions[state.recentPositions.length - 1];
      if (previous) {
        const gap = snap.sessionTime - previous.sessionTime;
        let jumpPct = lapDistPct - previous.lapDistPct;
        if (jumpPct < -0.5) jumpPct += 1.0; // wrap-around
        const impliedSpeed =
          gap > 0 ? ((trackLengthM * Math.abs(jumpPct)) / gap) * 3.6 : 0;
        if (impliedSpeed > MAX_PLAUSIBLE_SPEED_KMH) {
          state.recentPositions.length = 0;
          state.impactPendingSince = null;
          // Whatever the car was doing before it was moved is no longer true
          // of where it is now. Keeping the old peak would make a car set down
          // on the grid look like one that had just been circulating.
          state.recentPeakSpeed = 0;
          state.currentAvgSpeed = 0;
        }
      }

      state.recentPositions.push({
        sessionTime: snap.sessionTime,
        lapDistPct,
      });
      const windowStart = snap.sessionTime - IMPACT_WINDOW_S;
      while (
        state.recentPositions.length > 0 &&
        state.recentPositions[0].sessionTime < windowStart
      ) {
        state.recentPositions.shift();
      }

      const baseline = baselineSpeed(
        state.recentPositions,
        state.recentPositions.length - 1,
        SPEED_BASELINE_S,
        trackLengthM
      );
      // Zero travel is only a real 0 km/h once the position has been unchanged
      // long enough that it cannot be a stalled feed. A tow or reset derives a
      // speed no car can reach, and is discarded rather than believed.
      let speedSample: number | null = null;
      if (baseline) {
        if (baseline.speed > 0) {
          speedSample =
            baseline.speed <= MAX_PLAUSIBLE_SPEED_KMH ? baseline.speed : null;
        } else if (
          snap.sessionTime - state.lastPositionChangeSessionTime >=
          STATIONARY_SAMPLE_DELAY_S
        ) {
          speedSample = 0;
        }
      }
      const hasSpeedSample = speedSample !== null;

      if (speedSample !== null) {
        state.currentAvgSpeed = speedSample;
        // Decays with time rather than with sample count, so a car whose
        // position feed stalls does not hold its peak indefinitely.
        const decay =
          deltaTime > 0 ? Math.pow(0.5, deltaTime / PEAK_SPEED_HALF_LIFE_S) : 1;
        state.recentPeakSpeed = Math.max(
          speedSample,
          state.recentPeakSpeed * decay
        );

        this.pushFrameHistory(carIdx, {
          speed: speedSample,
          lapDistPct,
          trackSurface: surface,
          sessionTime: snap.sessionTime,
        });
      }

      // --- Off-track ---
      if (surface === TrackLocation.OffTrack) {
        state.offTrackSinceSessionTime ??= snap.sessionTime;
        const offTrackFor = snap.sessionTime - state.offTrackSinceSessionTime;
        if (offTrackFor >= this.thresholds.offTrackDurationSeconds) {
          const lapDistPct = snap.carIdxLapDistPct[carIdx] ?? 0;
          // Another car in trouble at the same place and moment turns a lone
          // excursion into a contact, which is reported as a Crash so it is
          // not lost among routine off-tracks.
          const lostSpeed = this.hasLostSpeed(state);
          const partner = this.findContactPartner(
            carIdx,
            snap.sessionTime,
            lapDistPct,
            trackLengthM,
            lostSpeed
          );
          const type = partner ? IncidentType.Crash : IncidentType.OffTrack;

          // Latched for the same reason as pit entry: a car beached off track
          // satisfies `>=` on every frame, so without this it re-reports each
          // time the cooldown lapses.
          if (
            !state.offTrackReported &&
            !this.isCoolingDown(state, type, cooldownTime)
          ) {
            state.offTrackReported = true;
            state.lastIncidentTime[type] = cooldownTime;
            const debug = this.buildDebugSnapshot(
              carIdx,
              state,
              snap.sessionTime,
              'off-track',
              partner
                ? `Off-track for ${offTrackFor.toFixed(2)}s alongside #${partner.carNumber} ${partner.name} — likely contact`
                : `Off-track for ${offTrackFor.toFixed(2)}s`
            );
            this.emit({
              ...this.createIncidentBase(carIdx, snap, type),
              debug,
            });
          }
          this.recordAnomaly(carIdx, snap.sessionTime, lapDistPct, lostSpeed);
        }
      } else {
        state.offTrackSinceSessionTime = null;
        state.offTrackReported = false;
      }

      // --- Flag detection ---
      const flags = snap.carIdxSessionFlags[carIdx] ?? 0;
      const prevFlags = state.prevSessionFlags;
      const newFlags = flags & ~prevFlags;

      if (
        (newFlags & GlobalFlags.Black || newFlags & GlobalFlags.Disqualify) &&
        !this.isCoolingDown(state, IncidentType.BlackFlag, cooldownTime)
      ) {
        state.lastIncidentTime[IncidentType.BlackFlag] = cooldownTime;
        const debug = this.buildDebugSnapshot(
          carIdx,
          state,
          snap.sessionTime,
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
        !this.isCoolingDown(state, IncidentType.Slowdown, cooldownTime)
      ) {
        state.lastIncidentTime[IncidentType.Slowdown] = cooldownTime;
        const debug = this.buildDebugSnapshot(
          carIdx,
          state,
          snap.sessionTime,
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
      // No session-state or session-type gate. Detection has to work the same
      // in a race, a qualifying run, a warmup, a time trial and a test drive.
      //
      // What actually separates a stopped car from a parked one is whether it
      // was moving in the first place. A car on the grid, or sitting in the
      // garage area, has never been above the slow threshold, so it is not
      // reported; a car that was circulating and is now stationary is. That
      // holds in every session type, which the old Race-only gate did not.
      const wasMoving =
        state.recentPeakSpeed > this.thresholds.slowSpeedThreshold;
      if (!(isOnRacingSurface && !isOnPitRoad && wasMoving)) {
        state.slowSinceSessionTime = null;
        state.slowReported = false;
      } else if (hasSpeedSample) {
        if (state.currentAvgSpeed < this.thresholds.slowSpeedThreshold) {
          state.slowSinceSessionTime ??= snap.sessionTime;
          const slowFor = snap.sessionTime - state.slowSinceSessionTime;
          // Latched like pit entry and off-track. A car stopped in the gravel
          // stays below the threshold indefinitely, so on a `>=` comparison it
          // would report a fresh crash every time the cooldown lapsed.
          if (
            slowFor >= this.thresholds.slowDurationSeconds &&
            !state.slowReported
          ) {
            if (this.isCoolingDown(state, IncidentType.Crash, cooldownTime)) {
              // A crash already covers this stop - an impact, or an earlier
              // sustained-slow, started the cooldown. Latch now so it is not
              // reported a second time once the cooldown lapses.
              state.slowReported = true;
            } else {
              state.slowReported = true;
              state.lastIncidentTime[IncidentType.Crash] = cooldownTime;
              const debug = this.buildDebugSnapshot(
                carIdx,
                state,
                snap.sessionTime,
                'sustained-slow',
                `avgSpeed ${state.currentAvgSpeed.toFixed(1)} km/h < threshold ${this.thresholds.slowSpeedThreshold} km/h for ${slowFor.toFixed(2)}s`
              );
              this.emit({
                ...this.createIncidentBase(carIdx, snap, IncidentType.Crash),
                debug,
              });
              // A car that crashed has lost speed by definition.
              this.recordAnomaly(
                carIdx,
                snap.sessionTime,
                snap.carIdxLapDistPct[carIdx] ?? 0,
                true
              );
            }
          }
        } else {
          state.slowSinceSessionTime = null;
          state.slowReported = false;
        }
      }
      // No speed reading this tick: hold the slow-since stamp as-is. Resetting would
      // let a genuinely stopped car escape detection whenever its position
      // failed to refresh, and incrementing would invent evidence we don't have.

      // --- Impact ---
      // Deliberately not gated on session state or session type. It used to be
      // gated on Racing, because a session changeover lifts cars off the track
      // and sets them down stationary on the grid, which read as a crash. That
      // teleport is now discarded where it happens, when the position history
      // is cleared, so the gate no longer earns its cost - and it cost a lot:
      // it silently disabled crash detection in test drives, warmups and any
      // other session that never goes green, while off-tracks and pit entries
      // kept working and made detection look healthy.
      const impact =
        isOnRacingSurface && !isOnPitRoad
          ? measureDeceleration(state.recentPositions, trackLengthM)
          : null;
      const impactQualifies =
        impact !== null &&
        impact.fromSpeed >= this.thresholds.impactMinSpeed &&
        impact.rate >= this.thresholds.impactDecelKmhPerSec;

      if (impactQualifies) {
        // Held for a moment before reporting. A car that actually hit something
        // still satisfies this on the next frame; a single position reading
        // that arrived out of step with sessionTime does not.
        state.impactPendingSince ??= snap.sessionTime;
        const heldFor = snap.sessionTime - state.impactPendingSince;
        if (
          heldFor >= IMPACT_CONFIRM_S &&
          !this.isCoolingDown(state, IncidentType.Crash, cooldownTime)
        ) {
          state.lastIncidentTime[IncidentType.Crash] = cooldownTime;
          const debug = this.buildDebugSnapshot(
            carIdx,
            state,
            snap.sessionTime,
            'impact',
            `Decelerated at ${impact.rate.toFixed(0)} km/h/s (${(impact.rate / 12.96).toFixed(1)}g): ${impact.fromSpeed.toFixed(1)} to ${impact.toSpeed.toFixed(1)} km/h in ${impact.spanSeconds.toFixed(2)}s`
          );
          this.emit({
            ...this.createIncidentBase(carIdx, snap, IncidentType.Crash),
            debug,
          });
          // A car that crashed has lost speed by definition.
          this.recordAnomaly(
            carIdx,
            snap.sessionTime,
            snap.carIdxLapDistPct[carIdx] ?? 0,
            true
          );
        }
      } else {
        state.impactPendingSince = null;
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
