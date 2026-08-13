import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { Incident, IncidentThresholds } from '../../types/raceControl';
import { IncidentDetector } from '../services/incidentDetector';
import type { TelemetryProcessor } from './TelemetryProcessor';
import logger from '../logger';

/** Parse "5.12 km" -> 5120 (metres) */
function parseTrackLengthM(str: string): number {
  return parseFloat(str) * 1000;
}

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  pitEntryDebounce: 3,
  cooldownSeconds: 5,
};

export interface IncidentProcessorOptions {
  thresholds?: IncidentThresholds;
  isDev?: boolean;
}

export class IncidentProcessor implements TelemetryProcessor<Incident[]> {
  readonly channel = 'raceControl.incidents';
  readonly tickRateHz = 'event' as const;

  private readonly detector: IncidentDetector;
  private trackLengthM = 0;
  private currentSessionNum: number | null = null;
  private lastSession: Session | null = null;
  private emittedThisFrame: Incident[] = [];
  private wasReplayPlaying = false;

  constructor(options: IncidentProcessorOptions = {}) {
    this.detector = new IncidentDetector(
      options.thresholds ?? defaultThresholds,
      options.isDev ?? false
    );
    this.detector.onIncident((incident) => {
      this.emittedThisFrame.push(incident);
    });
  }

  init(session: Session): void {
    this.lastSession = session;
    this.detector.updateSession(session, this.currentSessionNum ?? undefined);
    const trackLen = session?.WeekendInfo?.TrackLength;
    if (trackLen) {
      const parsed = parseTrackLengthM(trackLen);
      if (Number.isFinite(parsed) && parsed > 0) {
        this.trackLengthM = parsed;
      } else {
        logger.warn('[RaceControl] Could not parse track length:', trackLen);
      }
    }
  }

  onFrame(frame: Telemetry): void {
    this.emittedThisFrame = [];
    if (!this.trackLengthM) return;

    // Reviewing an incident scrubs the sim's replay, and those frames arrive
    // here looking live. Re-detecting them appends duplicates to the session
    // file, and because the debounce counters use strict equality a counter can
    // complete on a different frame than it did live, minting a brand new id
    // for the same event. Skip detection entirely, and drop the per-car state
    // on the way back to live so replay speeds cannot seed a live incident.
    const isReplayPlaying = Boolean(frame.IsReplayPlaying?.value?.[0]);
    if (isReplayPlaying) {
      this.wasReplayPlaying = true;
      return;
    }
    if (this.wasReplayPlaying) {
      this.wasReplayPlaying = false;
      const cleared = this.detector.resetCarStates();
      logger.info(
        `[RaceControl] replay ended; cleared ${cleared} car states before resuming detection`
      );
    }

    const snap = {
      sessionTime: frame.SessionTime?.value?.[0] ?? 0,
      sessionNum: frame.SessionNum?.value?.[0] ?? 0,
      sessionState: frame.SessionState?.value?.[0] ?? 0,
      replayFrameNum: frame.ReplayFrameNum?.value?.[0] ?? 0,
      carIdxLapDistPct: frame.CarIdxLapDistPct?.value ?? [],
      carIdxLap: frame.CarIdxLap?.value ?? [],
      carIdxTrackSurface: frame.CarIdxTrackSurface?.value ?? [],
      carIdxSessionFlags: frame.CarIdxSessionFlags?.value ?? [],
      carIdxOnPitRoad: frame.CarIdxOnPitRoad?.value ?? [],
    };

    // Detect session-phase change (e.g. Practice -> Qualify -> Race within the
    // same SubSessionID). When it changes, immediately re-run updateSession so
    // the detector resets cleanly before the next tick.
    if (snap.sessionNum !== this.currentSessionNum) {
      const prev = this.currentSessionNum;
      this.currentSessionNum = snap.sessionNum;
      logger.info(
        `[RaceControl] telemetry SessionNum changed: ${prev ?? '(none)'} -> ${snap.sessionNum}`
      );
      if (this.lastSession) {
        this.detector.updateSession(this.lastSession, this.currentSessionNum);
      }
    }

    this.detector.processTelemetry(snap, this.trackLengthM);
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'disconnect') {
      this.lastSession = null;
      this.trackLengthM = 0;
      this.currentSessionNum = null;
      this.wasReplayPlaying = false;
      this.detector.resetCarStates();
      return;
    }
    // Entering a session must not inherit the previous one's speed history or
    // debounce counters. sessionNumChange is deliberately not handled here —
    // onFrame already owns that transition.
    if (event.type === 'enter') {
      this.wasReplayPlaying = false;
      this.detector.resetCarStates();
    }
  }

  snapshot(): Incident[] {
    return this.emittedThisFrame;
  }

  updateThresholds(thresholds: IncidentThresholds): void {
    this.detector.updateThresholds(thresholds);
  }
}
