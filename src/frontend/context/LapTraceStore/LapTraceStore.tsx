import { create } from 'zustand';
import type {
  LapTraceBridge,
  LapTraceRecord,
  LapTraceSampleSnapshot,
  LapTraceSource,
  LapTraceView,
} from '@irdashies/types';
import { LAP_TRACE_SCHEMA_VERSION } from '@irdashies/types';
import logger from '@irdashies/utils/logger';
import {
  SampleBuffer,
  normalisePct,
  scaleDistances,
} from '../../domain/lapTrace/lapSamples';
import { MAX_METERS_BEHIND } from '../../domain/lapTrace/lapTraceWindow';
import { hydrateLapTrace } from '../../domain/lapTrace/hydrateLapTrace';
import {
  type PedalEventTracker,
  createPedalEventTracker,
  pedalEventTrackerPush,
  resetPedalEventTracker,
} from '../../domain/lapTrace/pedalEvents';
import {
  IBT_IMPORT_CAR_PATH,
  IBT_IMPORT_TRACK_ID,
} from '../../domain/lapTrace/ibtLapImport';
import {
  GARAGE61_IMPORT_CAR_PATH,
  GARAGE61_IMPORT_TRACK_ID,
  parseGarage61Csv,
} from '../../domain/lapTrace/garage61CsvImport';
import { ibtSamplesToLapTrace } from '../../domain/lapTrace/ibtLapImport';
import { detectPositionJump } from '../../domain/lapTrace/positionJump';

declare global {
  interface Window {
    lapTraceBridge?: LapTraceBridge;
  }
}

/**
 * Records the player's inputs sample by sample and holds the saved reference
 * lap the widget plots against.
 *
 * MEMORY CAP (R3.2): exactly two laps are ever resident — the one being driven
 * and the reference. The active lap's SampleBuffer grows by doubling up to
 * MAX_LAP_SAMPLES during the first lap on a track and is then reset in place
 * at every lap boundary, so a session of any length allocates no more than its
 * first lap did. The only per-lap allocation happens when a lap is promoted to
 * a new personal best, at which point its samples are copied out so the active
 * buffer can keep being reused.
 */

const SOURCE_LABELS: Record<LapTraceSource, string> = {
  best: 'Personal Best',
  manual: 'Imported Lap',
  garage61: 'Garage 61',
};

/** Shown when 'garage61' is selected but nothing has been imported yet. */
export const GARAGE61_NOT_IMPORTED_MESSAGE =
  'Import a Garage 61 lap in Settings to use this';

/** Shown when '.ibt' (manual) is selected but nothing has been imported. */
export const IBT_NOT_IMPORTED_MESSAGE =
  'Import an .ibt lap in Settings to use this';

/**
 * Electron wraps whatever an IPC handler throws as "Error invoking remote
 * method '<channel>': <original>". The channel is an internal name that means
 * nothing to a driver and buries the sentence that does, so it is stripped
 * before the message is shown.
 */
const unwrapIpcError = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error) || !error.message) return fallback;
  const unwrapped = /^Error invoking remote method '[^']*':\s*([\s\S]*)$/.exec(
    error.message
  );
  return (unwrapped?.[1] ?? error.message).trim() || fallback;
};

/** Lap-complete detection window, matching ReferenceLapStore. */
const LAP_END_PCT = 0.95;
const LAP_START_PCT = 0.05;

/**
 * How far the car travels between `set({ activeLap })` notifications. The
 * plot reads the buffer directly from its frame loop and needs none; this is
 * for React consumers (recording progress, the corner panel), which must not
 * re-render at telemetry rate.
 */
const NOTIFY_INTERVAL_M = 5;

/**
 * How much of a finished lap is carried past the start/finish line for the
 * plot to draw behind the car. The widest window the settings allow, so the
 * carry-over is never the thing that runs out.
 */
const GHOST_CARRYOVER_M = MAX_METERS_BEHIND;

/**
 * Initial capacity of the carry-over buffer. GHOST_CARRYOVER_M of track at
 * 60 Hz is a few hundred samples at any racing speed; the buffer grows on its
 * own for the rare lap that ends crawling.
 */
const CARRY_OVER_CAPACITY = 1024;

export interface ActiveLap {
  /** Every accepted frame of this lap, in order. */
  samples: SampleBuffer;
  /**
   * The tail of the lap before this one, carried across the start/finish line
   * so the plot can draw the driver's own trace behind the car just after a
   * crossing. Empty on the first lap of a session, and after anything that
   * breaks the line's continuity (a reset to the pits, a tow, a replay
   * scrub) — the road behind the line was not driven into it in those cases.
   */
  carryOver: SampleBuffer;
  /** Pedal application points, kept in step with `samples`. */
  events: PedalEventTracker;

  startTime: number;
  /** SessionTime of the lap's first sample; `samples.timeSec` is relative to it. */
  firstSampleTime: number;
  lastTrackedPct: number;
  /**
   * SessionTime of the last frame recorded, or -1 before the first. Paired
   * with `lastTrackedPct` to tell driving from a teleport: a move is only a
   * jump relative to the time it had to happen in.
   */
  lastTrackedTime: number;
  isCleanLap: boolean;
  /**
   * PlayerCarMyIncidentCount as it stood when this lap began. Compared against
   * the live count every frame — a rise means this lap picked up an incident
   * (off track, contact, etc.) and can never be promoted, however fast.
   */
  incidentCountAtStart: number;
  /**
   * LapLastLapTime and LapCompleted as they stood on the previous frame.
   * Frame memory, not lap state: they are deliberately left alone by
   * `resetActiveLap`, because a crossing needs to know what the official time
   * was showing *before* that frame. iRacing can publish the finished lap's
   * time in the very frame the line is crossed, and taking the crossing
   * frame's value as the baseline would make the lap wait for a change that
   * only the next lap's time can supply.
   */
  prevLastLapTime: number;
  prevLapCompleted: number;
  /**
   * Running speed range for this lap. Tracked incrementally so the plot has a
   * stable vertical scale before any reference lap exists, without rescanning
   * every sample each frame.
   */
  speedMinMs: number;
  speedMaxMs: number;

  /** Distance at the last subscriber notification. */
  lastNotifiedM: number;
  /**
   * Bumps on every lap reset, so a frame loop holding the (reused) buffer can
   * tell "new lap" from "more samples of the same lap".
   */
  lapSerial: number;
}

interface PendingBest {
  /** Samples already copied out of the active lap; lapTimeSec is a placeholder
   *  until the official LapLastLapTime arrives. */
  record: LapTraceRecord;
  /** LapLastLapTime as seen at the crossing — still the *previous* lap's time.
   *  The official time for this lap is the next value that differs from it. */
  lastLapTimeAtBoundary: number;
  /**
   * PlayerCarMyIncidentCount as seen at the crossing. An incident picked up in
   * the last instants before the line can be reported a tick or two late —
   * after this lap was already snapshotted as clean and the next one started
   * — so finalisation re-checks the count against this baseline rather than
   * trusting isCleanLap alone.
   */
  incidentCountAtBoundary: number;
  /**
   * LapCompleted as seen at the crossing, which is this lap's identity. The
   * counter can lag the line by a tick, so the lap that just finished is
   * either this number or one more; anything beyond that means a further lap
   * has completed and LapLastLapTime no longer describes the pending one.
   */
  lapCompletedAtBoundary: number;
}

export interface LapTraceState {
  trackId: number | null;
  trackConfigName: string;
  carPath: string;
  trackLengthM: number;

  activeLap: ActiveLap | null;
  referenceLap: LapTraceView | null;
  referenceError: string | null;
  /**
   * Which source the displayed reference came from. Promotion only swaps the
   * reference when this is 'best' — a driver comparing against an imported lap
   * must not have it silently replaced by their own.
   */
  referenceSource: LapTraceSource;
  /** Lap time of the stored personal best, used to decide promotion. */
  bestLapTimeSec: number;
  /**
   * Whether `bestLapTimeSec` reflects what is actually on disk.
   *
   * False from the moment a session is initialized until the stored best has
   * been read back. Promotion is blocked while it is false: the threshold
   * starts at infinity, so a lap completed in that window — or after a read
   * that failed — would beat it and overwrite a genuinely faster stored lap.
   * Declining to record a best is recoverable; destroying one is not.
   */
  bestLapLoaded: boolean;

  /**
   * A clean lap captured at the start/finish crossing, waiting for its official
   * LapLastLapTime to arrive (it lags the crossing by a few ticks). Promotion
   * is decided only once that time settles — so the best is timed to full
   * telemetry precision rather than the coarse sessionTime delta. Not rendered.
   */
  pendingBest: PendingBest | null;

  /**
   * Bootstrap for a track/car combination. Allocates the active lap and loads
   * the stored best. Safe to call repeatedly; it no-ops when nothing that
   * matters has changed.
   */
  initialize: (
    bridge: LapTraceBridge | undefined,
    trackId: number,
    trackConfigName: string,
    carPath: string,
    trackLengthM: number
  ) => Promise<void>;

  /**
   * Record one telemetry frame. Called at telemetry rate — allocation-free
   * once the sample buffer has reached its working size.
   */
  collectPlayerFrame: (
    bridge: LapTraceBridge | undefined,
    sample: LapTraceSampleSnapshot
  ) => void;

  /** Load the reference lap for a source, or report why it is unavailable. */
  setReferenceFromSource: (
    bridge: LapTraceBridge | undefined,
    kind: LapTraceSource
  ) => Promise<void>;

  /**
   * Open the Garage 61 CSV file picker, parse the result, and store it under
   * the fixed sentinel key. If 'garage61' is already the active reference
   * source, updates referenceLap immediately so the widget reflects the new
   * import without waiting for the reference-source dropdown to be toggled
   * (the only other trigger for a re-fetch — see useLapTraceRecorder).
   */
  importGarage61Lap: (bridge: LapTraceBridge) => Promise<
    | {
        ok: true;
        label: string;
        lapTimeSec: number;
        driver?: string;
        car?: string;
        track?: string;
      }
    | { ok: false; error: string }
    | { ok: 'cancelled' }
  >;

  /**
   * Open the .ibt file picker, parse the fastest valid lap in the main
   * process, and store it in the single imported-.ibt slot so it surfaces
   * whatever is being driven. Refreshes the visible reference immediately when
   * .ibt is the active source.
   */
  importIbtLap: (bridge: LapTraceBridge) => Promise<
    | {
        ok: true;
        label: string;
        lapTimeSec: number;
        fileName: string;
        driver?: string;
        car?: string;
        track?: string;
      }
    | { ok: false; error: string }
    | { ok: 'cancelled' }
  >;

  /**
   * Throw away the stored lap for an import source and clear it from the
   * screen. Used when an import fails, so a stale lap is never left looking
   * like the file that just failed to load.
   */
  discardImportedLap: (
    bridge: LapTraceBridge,
    kind: 'garage61' | 'manual'
  ) => Promise<void>;

  /**
   * Delete the stored personal best for the track/car currently loaded and
   * reset the promotion threshold so the next clean lap becomes the new best.
   * Clears the on-screen reference too when 'best' is the active source. A
   * no-op when no track/car is loaded (nothing is being driven).
   */
  clearBestLap: (bridge: LapTraceBridge | undefined) => Promise<void>;

  reset: () => void;
}

function createActiveLap(): ActiveLap {
  return {
    samples: new SampleBuffer(),
    // Only ever holds GHOST_CARRYOVER_M of track, so it starts far smaller
    // than a lap buffer and grows only if a lap ends at a crawl.
    carryOver: new SampleBuffer(CARRY_OVER_CAPACITY),
    events: createPedalEventTracker(),
    startTime: -1,
    firstSampleTime: -1,
    lastTrackedPct: -1,
    lastTrackedTime: -1,
    isCleanLap: false,
    incidentCountAtStart: 0,
    prevLastLapTime: -1,
    prevLapCompleted: -1,
    speedMinMs: Number.POSITIVE_INFINITY,
    speedMaxMs: Number.NEGATIVE_INFINITY,
    lastNotifiedM: Number.NEGATIVE_INFINITY,
    lapSerial: 0,
  };
}

/**
 * Rewind the active lap in place, ready for the next lap. No allocation.
 *
 * `carryTail` says whether the lap being rewound ran into the start/finish
 * line. At a genuine crossing its last stretch is the road immediately behind
 * the new lap's start, and is kept so the plot can draw it; anywhere else
 * (a session starting mid-lap, a reset, a tow) it is not, and the carry-over
 * is dropped rather than drawn somewhere the car never went.
 */
function resetActiveLap(
  lap: ActiveLap,
  startTime: number,
  startPct: number,
  isClean: boolean,
  incidentCountAtStart: number,
  carryTail = false
): void {
  if (carryTail) lap.samples.copyTailInto(lap.carryOver, GHOST_CARRYOVER_M);
  else lap.carryOver.reset();
  lap.samples.reset();
  resetPedalEventTracker(lap.events);
  lap.startTime = startTime;
  lap.firstSampleTime = -1;
  lap.lastTrackedPct = startPct;
  // Not `startTime`: an un-timeable lap carries MAX_SAFE_INTEGER, and seeding
  // the jump detector's clock with it would read the next frame as time going
  // backwards. Every caller sets it from the live SessionTime instead.
  lap.lastTrackedTime = -1;
  lap.isCleanLap = isClean;
  lap.incidentCountAtStart = incidentCountAtStart;
  lap.speedMinMs = Number.POSITIVE_INFINITY;
  lap.speedMaxMs = Number.NEGATIVE_INFINITY;
  lap.lastNotifiedM = Number.NEGATIVE_INFINITY;
  lap.lapSerial += 1;
}

/** Copy the active lap's samples out so its buffer can keep being reused. */
function snapshotActiveLap(
  lap: ActiveLap,
  state: LapTraceState,
  lapTimeSec: number
): LapTraceRecord {
  return {
    schemaVersion: LAP_TRACE_SCHEMA_VERSION,
    source: {
      kind: 'best',
      label: SOURCE_LABELS.best,
      importedAt: Date.now(),
    },
    trackId: state.trackId ?? -1,
    trackConfigName: state.trackConfigName,
    carPath: state.carPath,
    trackLengthM: state.trackLengthM,
    lapTimeSec,
    samples: lap.samples.toRecordSamples(),
    recordedAt: Date.now(),
  };
}

/**
 * Bring a stored record onto the current session.
 *
 * WeekendInfo.TrackLength is only 2dp on some tracks, so a lap saved in one
 * session can carry a slightly different length from another; its distances
 * are rescaled so the reference lines up with the car. A different track
 * *config* is a different circuit though, and replaying it would be actively
 * misleading — so that case is rejected. So is any record from another schema
 * version: the format is unreleased and nothing migrates it.
 */
function adaptStoredRecord(
  record: LapTraceRecord,
  state: LapTraceState
): LapTraceRecord | null {
  if (record.schemaVersion !== LAP_TRACE_SCHEMA_VERSION) {
    logger.info(
      `[LapTrace] Ignoring saved lap from schema ${record.schemaVersion}`
    );
    return null;
  }
  if (!record.samples || record.samples.length < 2) return null;
  if (
    record.trackConfigName &&
    state.trackConfigName &&
    record.trackConfigName !== state.trackConfigName
  ) {
    logger.info(
      `[LapTrace] Ignoring saved lap for a different track config (${record.trackConfigName})`
    );
    return null;
  }
  if (
    state.trackLengthM > 0 &&
    record.trackLengthM > 0 &&
    record.trackLengthM !== state.trackLengthM
  ) {
    logger.info(
      `[LapTrace] Rescaling saved lap from ${record.trackLengthM} m to ${state.trackLengthM} m`
    );
    return {
      ...record,
      trackLengthM: state.trackLengthM,
      samples: scaleDistances(
        record.samples,
        state.trackLengthM / record.trackLengthM
      ),
    };
  }
  return record;
}

/*
 * Both `initialize` and `setReferenceFromSource` read from disk across an
 * await, and either can be called again (a track change, a flick through the
 * reference dropdown) while the previous read is still in flight. Reads can
 * resolve out of order, so each tags itself with the generation current when it
 * started and drops its result if a newer call has since superseded it —
 * otherwise the older session's best time, or the previously selected source,
 * lands on top of the newer one. The counters are deliberately outside the
 * store: they gate writes and nothing renders from them.
 */
let sessionGeneration = 0;
let referenceGeneration = 0;

export const useLapTraceStore = create<LapTraceState>((set, get) => ({
  trackId: null,
  trackConfigName: '',
  carPath: '',
  trackLengthM: 0,

  activeLap: null,
  referenceLap: null,
  referenceError: null,
  referenceSource: 'best',
  bestLapTimeSec: Number.POSITIVE_INFINITY,
  bestLapLoaded: false,
  pendingBest: null,

  initialize: async (
    bridge,
    trackId,
    trackConfigName,
    carPath,
    trackLengthM
  ) => {
    if (!(trackLengthM > 0) || !carPath || trackId <= 0) return;

    // This call now owns the session; anything still in flight is stale. The
    // reference generation moves too — the cleared referenceLap below belongs
    // to this session, and a pending source read for the old one must not
    // repaint it.
    const generation = ++sessionGeneration;
    referenceGeneration++;

    set({
      trackId,
      trackConfigName,
      carPath,
      trackLengthM,
      activeLap: createActiveLap(),
      referenceLap: null,
      referenceError: null,
      bestLapTimeSec: Number.POSITIVE_INFINITY,
      bestLapLoaded: false,
      pendingBest: null,
    });

    // Seed the promotion threshold from the stored best, independently of
    // whichever source the user has chosen to display. Nothing may be promoted
    // until this resolves, or the first lap of the session would overwrite a
    // faster stored one simply by finishing before the read did.
    if (!bridge) {
      // No persistence at all, so there is no stored lap to protect.
      set({ bestLapLoaded: true });
      return;
    }
    try {
      const stored = await bridge.getLapTrace(trackId, carPath, 'best');
      if (generation !== sessionGeneration) return;
      const adapted = stored ? adaptStoredRecord(stored, get()) : null;
      set({
        bestLapLoaded: true,
        ...(adapted && adapted.lapTimeSec > 0
          ? { bestLapTimeSec: adapted.lapTimeSec }
          : {}),
      });
    } catch (e) {
      // Left unloaded on purpose: a best that could not be read is not a best
      // that can be beaten.
      if (generation !== sessionGeneration) return;
      logger.warn('[LapTrace] Failed to load stored best lap', e);
    }
  },

  collectPlayerFrame: (bridge, sample) => {
    const state = get();
    const lap = state.activeLap;
    if (!lap || !(state.trackLengthM > 0)) return;

    const {
      lapDistPct,
      sessionTime,
      throttle,
      brake,
      speed,
      gear,
      brakeAbsActive,
      onPitRoad,
      isOnTrack,
      lastLapTime,
      lapCompleted,
      incidentCount,
    } = sample;
    if (lapDistPct < 0 || sessionTime < 0) return;

    const pct = normalisePct(lapDistPct);

    if (lap.lastTrackedPct < 0) {
      // First frame after initialize: only start timing the lap if we happen
      // to be at the line, otherwise this is a partial lap we cannot time.
      const atLine = pct < LAP_START_PCT;
      resetActiveLap(
        lap,
        atLine ? sessionTime : Number.MAX_SAFE_INTEGER,
        pct,
        atLine && isOnTrack && !onPitRoad,
        incidentCount
      );
    } else if (
      detectPositionJump(
        lap.lastTrackedPct * state.trackLengthM,
        pct * state.trackLengthM,
        lap.lastTrackedTime,
        sessionTime,
        state.trackLengthM
      ) !== 'none'
    ) {
      // An Active Reset (or a tow, or a replay scrub): the car did not drive
      // here. Everything recorded so far belongs to a lap that no longer
      // exists, and the buffer's tail now sits ahead of the car, so nothing
      // driven from here would be stored until the old furthest distance was
      // passed again. Rewind and resynchronise at the new position — this
      // frame becomes the restarted lap's first sample, as at a crossing.
      //
      // MAX_SAFE_INTEGER marks the restarted lap un-timeable and it starts
      // dirty, so this partial can never be promoted however fast it is; the
      // next genuine start/finish crossing begins a normal lap again. The
      // crossing test in the branch below is deliberately not reached on this
      // frame — a reset point just past the line would otherwise snapshot a
      // lap whose last stretch was never driven.
      //
      // pendingBest is left alone: it is an already-completed lap whose
      // official LapLastLapTime lands a few ticks after the line, long before
      // any realistic reset.
      resetActiveLap(lap, Number.MAX_SAFE_INTEGER, pct, false, incidentCount);
      logger.info(
        `[LapTrace] Position jump to ${(pct * 100).toFixed(1)}% — restarting the lap in progress`
      );
    } else {
      // Finalise a lap captured at the previous crossing once its official
      // LapLastLapTime has arrived. That value lags the line by a few ticks,
      // so the fresh time is the first one that differs from what was showing
      // when the lap crossed. Telemetry-only: a lap whose time never differs
      // is left pending and dropped at the next crossing rather than
      // mis-timed.
      const pending = state.pendingBest;
      // LapCompleted can lag the line by a tick, so the lap waiting here is
      // either the number seen at the crossing or the one after it. Beyond
      // that, a further lap has finished and LapLastLapTime has moved on to
      // describe that one instead — this lap can no longer be timed.
      if (pending && lapCompleted > pending.lapCompletedAtBoundary + 1) {
        set({ pendingBest: null });
      } else if (
        pending &&
        lastLapTime > 0 &&
        lastLapTime !== pending.lastLapTimeAtBoundary
      ) {
        // An incident right at the line can be reported a tick or two late —
        // after the lap was already snapshotted as clean and the next one
        // started — so this is re-checked here rather than trusting the
        // snapshot's isCleanLap alone.
        const invalidatedLate = incidentCount > pending.incidentCountAtBoundary;
        if (
          !invalidatedLate &&
          state.bestLapLoaded &&
          lastLapTime < state.bestLapTimeSec
        ) {
          const record = pending.record;
          record.lapTimeSec = lastLapTime;
          // The new best is saved, but only becomes the displayed reference
          // when the driver is comparing against their best — swapping it in
          // under an imported Garage 61 lap would replace their chosen target
          // silently.
          const isShowingBest = state.referenceSource === 'best';
          set({
            bestLapTimeSec: lastLapTime,
            pendingBest: null,
            ...(isShowingBest
              ? { referenceLap: hydrateLapTrace(record), referenceError: null }
              : {}),
          });
          bridge
            ?.saveLapTrace(record.trackId, record.carPath, 'best', record)
            .catch((e: Error) =>
              logger.error('[LapTrace] Failed to save best lap', e)
            );
          logger.info(
            `[LapTrace] New best lap recorded (${lastLapTime.toFixed(3)}s, lap ${lapCompleted})`
          );
        } else {
          set({ pendingBest: null });
        }
      }

      if (lap.lastTrackedPct > LAP_END_PCT && pct < LAP_START_PCT) {
        // A clean lap just crossed the line: capture it now (its samples are
        // copied out immediately) and wait for its official LapLastLapTime.
        // The placeholder time is patched in on finalise. Any still-unresolved
        // pending lap is dropped here — after this crossing LapLastLapTime
        // moves to a different lap, so the old one can no longer be trusted.
        // The cleanliness check that compares the live incident count against
        // the lap's baseline runs below this block, so an incident registered
        // on the crossing frame itself is not in `isCleanLap` yet — and the
        // reset a few lines down moves the baseline on to this frame's count,
        // putting it out of reach. Compare it here, against the baseline of
        // the lap that is finishing.
        const finishedClean =
          lap.isCleanLap && incidentCount <= lap.incidentCountAtStart;
        if (finishedClean) {
          const record = snapshotActiveLap(lap, state, -1);
          set({
            pendingBest: {
              record,
              // The previous frame's value, not this one's: iRacing can
              // publish the finished lap's official time in the same frame
              // the line is crossed, and a baseline taken from that frame
              // would hide the very change being waited for.
              lastLapTimeAtBoundary: lap.prevLastLapTime,
              incidentCountAtBoundary: incidentCount,
              lapCompletedAtBoundary: lapCompleted,
            },
          });
        } else if (state.pendingBest) {
          set({ pendingBest: null });
        }

        // The crossing frame is the new lap's first sample, and the lap just
        // finished is the road behind it.
        resetActiveLap(
          lap,
          sessionTime,
          pct,
          isOnTrack && !onPitRoad,
          incidentCount,
          true
        );
      }
    }

    if (
      lap.isCleanLap &&
      (onPitRoad || !isOnTrack || incidentCount > lap.incidentCountAtStart)
    ) {
      lap.isCleanLap = false;
    }

    const distanceM = pct * state.trackLengthM;
    if (lap.firstSampleTime < 0) lap.firstSampleTime = sessionTime;
    const pushed = lap.samples.push(
      distanceM,
      sessionTime - lap.firstSampleTime,
      throttle,
      brake,
      speed,
      gear,
      brakeAbsActive ? 1 : 0
    );

    if (pushed === 'backward' || pushed === 'full') {
      // A spin, a reset, or a lap too long to hold — none of them a lap that
      // can stand as a reference.
      lap.isCleanLap = false;
    } else if (pushed !== 'dropped') {
      // A teleport is stored (the trace shows where the car reappeared) but
      // continuity is gone: every metre must be driven for the lap to count.
      if (pushed === 'gap') lap.isCleanLap = false;

      // Feed the tracker the value the buffer stored, not the raw double, so
      // the live events and deriveEvents() over the saved lap are identical.
      pedalEventTrackerPush(
        lap.events,
        lap.samples.distanceM[lap.samples.length - 1],
        throttle,
        brake
      );

      if (speed < lap.speedMinMs) lap.speedMinMs = speed;
      if (speed > lap.speedMaxMs) lap.speedMaxMs = speed;

      if (distanceM - lap.lastNotifiedM >= NOTIFY_INTERVAL_M) {
        lap.lastNotifiedM = distanceM;
        set({ activeLap: lap });
      }
    }

    lap.lastTrackedPct = pct;
    lap.lastTrackedTime = sessionTime;
    lap.prevLastLapTime = lastLapTime;
    lap.prevLapCompleted = lapCompleted;
  },

  setReferenceFromSource: async (bridge, kind) => {
    if (!bridge) return;

    const generation = ++referenceGeneration;

    // Both import sources are single global slots, not scoped to the live
    // session's track/car, so they are reachable even before a session has
    // ever initialized this store. Only 'best' is keyed to what is being
    // driven, because only 'best' was driven here.
    const isGarage61 = kind === 'garage61';
    const isIbt = kind === 'manual';
    const state = get();
    if (!isGarage61 && !isIbt && (state.trackId === null || !state.carPath)) {
      return;
    }

    const lookupTrackId = isGarage61
      ? GARAGE61_IMPORT_TRACK_ID
      : isIbt
        ? IBT_IMPORT_TRACK_ID
        : state.trackId;
    const lookupCarPath = isGarage61
      ? GARAGE61_IMPORT_CAR_PATH
      : isIbt
        ? IBT_IMPORT_CAR_PATH
        : state.carPath;

    try {
      const stored = await bridge.getLapTrace(
        lookupTrackId as number,
        lookupCarPath,
        kind
      );
      if (generation !== referenceGeneration) return;
      if (stored) {
        const adapted = adaptStoredRecord(stored, get());
        if (adapted) {
          set({
            referenceLap: hydrateLapTrace(adapted),
            referenceError: null,
            referenceSource: kind,
          });
          return;
        }
      }
      set({
        referenceLap: null,
        referenceError: isGarage61
          ? GARAGE61_NOT_IMPORTED_MESSAGE
          : kind === 'manual'
            ? IBT_NOT_IMPORTED_MESSAGE
            : null,
        referenceSource: kind,
      });
    } catch (e) {
      if (generation !== referenceGeneration) return;
      logger.warn(`[LapTrace] Failed to load ${kind} reference lap`, e);
      set({
        referenceLap: null,
        referenceError: isGarage61
          ? GARAGE61_NOT_IMPORTED_MESSAGE
          : kind === 'manual'
            ? IBT_NOT_IMPORTED_MESSAGE
            : 'Could not load lap',
        referenceSource: kind,
      });
    }
  },

  /**
   * Drop the stored lap for an import source and take it off screen.
   *
   * Called whenever an import fails. Leaving the previous import in place
   * looks like the new file loaded and came out wrong: the two slots are
   * global, so an older lap from a different circuit is rescaled to the
   * current track length and draws a trace that lines up with nothing. Better
   * to show the "nothing imported" message and the error beside it.
   */
  discardImportedLap: async (bridge, kind) => {
    const trackId =
      kind === 'garage61' ? GARAGE61_IMPORT_TRACK_ID : IBT_IMPORT_TRACK_ID;
    const carPath =
      kind === 'garage61' ? GARAGE61_IMPORT_CAR_PATH : IBT_IMPORT_CAR_PATH;
    try {
      await bridge.clearLapTrace(trackId, carPath, kind);
    } catch (e) {
      logger.warn(`[LapTrace] Failed to clear the stored ${kind} lap`, e);
    }

    if (get().referenceSource === kind) {
      referenceGeneration++;
      set({
        referenceLap: null,
        referenceError:
          kind === 'garage61'
            ? GARAGE61_NOT_IMPORTED_MESSAGE
            : IBT_NOT_IMPORTED_MESSAGE,
      });
    }
    // Always, not just when this window was showing it: the lap is gone from
    // disk, and Settings — which does this on the Clear links — has no live
    // reference of its own to clear.
    bridge.notifyReferenceUpdated?.();
  },

  importGarage61Lap: async (bridge) => {
    const fail = async (error: string) => {
      await get().discardImportedLap(bridge, 'garage61');
      return { ok: false as const, error };
    };

    let picked;
    try {
      picked = await bridge.pickGarage61Csv();
    } catch (e) {
      logger.warn('[LapTrace] Garage 61 file picker failed', e);
      return fail(unwrapIpcError(e, 'Could not open the file picker'));
    }
    if (!picked) return { ok: 'cancelled' };

    const result = parseGarage61Csv(picked.csvText, picked.fileName);
    if (!result.ok) {
      logger.warn(`[LapTrace] Garage 61 CSV parse failed: ${result.message}`);
      return fail(result.message);
    }

    const { record } = result;
    try {
      await bridge.saveLapTrace(
        GARAGE61_IMPORT_TRACK_ID,
        GARAGE61_IMPORT_CAR_PATH,
        'garage61',
        record
      );
    } catch (e) {
      logger.error('[LapTrace] Failed to save imported Garage 61 lap', e);
      return fail(unwrapIpcError(e, 'Could not save the imported lap'));
    }

    // If garage61 is already selected (with or without a prior import),
    // refresh the visible reference immediately.
    const state = get();
    if (
      state.referenceLap?.source.kind === 'garage61' ||
      state.referenceError === GARAGE61_NOT_IMPORTED_MESSAGE
    ) {
      const adapted = adaptStoredRecord(record, state) ?? record;
      referenceGeneration++;
      set({
        referenceLap: hydrateLapTrace(adapted),
        referenceError: null,
        referenceSource: 'garage61',
      });
    }

    // Tell the overlay (a separate window/store) to reload its reference.
    bridge.notifyReferenceUpdated?.();

    return {
      ok: true,
      label: record.source.label,
      lapTimeSec: record.lapTimeSec,
      driver: record.source.driver,
      car: record.source.car,
      track: record.source.track,
    };
  },

  importIbtLap: async (bridge) => {
    const fail = async (error: string) => {
      await get().discardImportedLap(bridge, 'manual');
      return { ok: false as const, error };
    };

    let result;
    try {
      result = await bridge.pickAndParseIbtLap();
    } catch (e) {
      logger.warn('[LapTrace] .ibt import failed', e);
      return fail(unwrapIpcError(e, 'Could not import the .ibt file'));
    }
    if (!result) return { ok: 'cancelled' };

    let record: LapTraceRecord;
    try {
      record = ibtSamplesToLapTrace(result);
    } catch (e) {
      logger.warn('[LapTrace] Failed to build lap from .ibt samples', e);
      return fail(unwrapIpcError(e, 'The .ibt lap could not be processed'));
    }

    try {
      await bridge.saveLapTrace(
        IBT_IMPORT_TRACK_ID,
        IBT_IMPORT_CAR_PATH,
        'manual',
        record
      );
    } catch (e) {
      logger.error('[LapTrace] Failed to save imported .ibt lap', e);
      return fail(unwrapIpcError(e, 'Could not save the imported lap'));
    }

    // Refresh the visible reference immediately when .ibt is the active
    // source, or when it is selected and waiting on an import. The slot is
    // global, so the lap shows whatever session is running.
    const state = get();
    if (
      state.referenceSource === 'manual' ||
      state.referenceError === IBT_NOT_IMPORTED_MESSAGE
    ) {
      const adapted = adaptStoredRecord(record, state) ?? record;
      referenceGeneration++;
      set({
        referenceLap: hydrateLapTrace(adapted),
        referenceError: null,
        referenceSource: 'manual',
      });
    }

    // Tell the overlay (a separate window/store) to reload its reference.
    bridge.notifyReferenceUpdated?.();

    return {
      ok: true,
      label: record.source.label,
      lapTimeSec: result.lapTimeSec,
      fileName: result.fileName,
      driver: record.source.driver,
      car: record.source.car,
      track: record.source.track,
    };
  },

  clearBestLap: async (bridge) => {
    const { trackId, carPath, referenceSource } = get();
    if (referenceSource === 'best') referenceGeneration++;
    if (bridge && trackId != null && trackId > 0 && carPath) {
      try {
        await bridge.clearLapTrace(trackId, carPath, 'best');
      } catch (e) {
        logger.warn('[LapTrace] Failed to clear stored best lap', e);
      }
    }
    // Reset the promotion threshold so the next clean lap becomes the new best,
    // and drop the on-screen reference when it is the best being shown. The
    // slot is known to be empty now, so promotion is unblocked even if the
    // load that would normally confirm that had failed.
    set({
      bestLapLoaded: true,
      bestLapTimeSec: Number.POSITIVE_INFINITY,
      pendingBest: null,
      ...(referenceSource === 'best'
        ? { referenceLap: null, referenceError: null }
        : {}),
    });
  },

  reset: () => {
    sessionGeneration++;
    referenceGeneration++;
    set({
      trackId: null,
      trackConfigName: '',
      carPath: '',
      trackLengthM: 0,
      activeLap: null,
      referenceLap: null,
      referenceError: null,
      referenceSource: 'best',
      bestLapTimeSec: Number.POSITIVE_INFINITY,
      bestLapLoaded: false,
      pendingBest: null,
    });
  },
}));

/** Progress through the lap currently being recorded, 0..1. */
export const useLapTraceRecordingProgress = (): number =>
  useLapTraceStore((s) =>
    s.activeLap && s.trackLengthM > 0
      ? Math.min(
          1,
          Math.max(0, s.activeLap.samples.lastDistanceM()) / s.trackLengthM
        )
      : 0
  );
