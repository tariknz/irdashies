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
  slowDurationSeconds: 1,
  impactDecelKmhPerSec: 150,
  impactMinSpeed: 20,
  offTrackDurationSeconds: 0.3,
  pitEntryDurationSeconds: 0.6,
  cooldownSeconds: 5,
};

export interface IncidentProcessorOptions {
  thresholds?: IncidentThresholds;
  isDev?: boolean;
}

export class IncidentProcessor implements TelemetryProcessor<Incident[]> {
  // Required by TelemetryProcessor but inert here: IncidentRuntime drives this
  // processor directly, so ProcessorHost never reads either value.
  readonly channel = 'raceControl.incidents';
  readonly tickRateHz = 'event' as const;

  private readonly detector: IncidentDetector;
  private trackLengthM = 0;
  private currentSessionNum: number | null = null;
  private lastSession: Session | null = null;
  private emittedThisFrame: Incident[] = [];
  /** Furthest session time already detected on, so rewinds can be skipped. */
  private maxSessionTimeSeen: number | null = null;
  private rewound = false;

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

    // Only detect on session time we have not already covered. Reviewing an
    // incident rewinds the replay and replays frames we detected live, which
    // would append duplicates; those frames sit at or behind the high-water
    // mark and are skipped.
    //
    // Deliberately not gated on IsReplayPlaying: spectating a session without
    // a car of your own reports as replay playing for the whole race, and
    // gating on it silently disables detection for the Gantry's main use case.
    const frameSessionTime = frame.SessionTime?.value?.[0] ?? 0;
    // Session time restarts with each session, so a phase change is not a
    // rewind. Drop the high-water mark first or the new session would be
    // suppressed for as long as the previous one ran.
    if ((frame.SessionNum?.value?.[0] ?? 0) !== this.currentSessionNum) {
      this.maxSessionTimeSeen = null;
      this.rewound = false;
    }
    if (
      this.maxSessionTimeSeen !== null &&
      frameSessionTime <= this.maxSessionTimeSeen
    ) {
      this.rewound = true;
      return;
    }
    if (this.rewound) {
      this.rewound = false;
      // prev* state is from before the rewind, so a stale delta would produce
      // a bogus speed. Re-seed from this frame; the seeding path re-arms the
      // pit/off-track latches so nothing is re-reported.
      this.detector.reseedCarStates();
    }
    this.maxSessionTimeSeen = frameSessionTime;

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
      this.maxSessionTimeSeen = null;
      this.rewound = false;
      this.detector.resetCarStates();
      return;
    }
    // Entering a session must not inherit the previous one's speed history or
    // debounce counters. sessionNumChange is deliberately not handled here —
    // onFrame already owns that transition.
    if (event.type === 'enter') {
      this.maxSessionTimeSeen = null;
      this.rewound = false;
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
