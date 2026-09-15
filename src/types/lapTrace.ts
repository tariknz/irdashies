/**
 * Distance-indexed input trace for a single lap.
 *
 * Unlike the time-indexed Input Trace widget, a lap trace is indexed by
 * position on track, so a saved lap can be replayed against wherever the
 * driver currently is. The lap is stored as the telemetry samples themselves —
 * one row per frame, each carrying its own lap distance — never aggregated
 * onto a grid. Every source (the live recorder, an `.ibt` file, a Garage 61
 * CSV) already delivers pedals and position co-sampled per row, so this keeps
 * exactly what the sim measured. Every record is source-tagged so the sources
 * drop in without a schema rewrite.
 *
 * Samples are always raw SI — throttle/brake 0..1, speed m/s, gear as the raw
 * iRacing integer. Unit conversion happens only at the render boundary, so
 * importers never have to think about it.
 */

/**
 * Schema 2 replaced the bucketed `channels` grid with per-sample arrays.
 * Records with any other version are discarded on load — the format shipped
 * only on a feature branch, so there is nothing to migrate.
 */
export const LAP_TRACE_SCHEMA_VERSION = 2;

/**
 * Hard cap on samples per lap. Above `MAX_LAP_TIME_SEC` (1200 s) at 60 Hz with
 * margin; a Nordschleife lap is ~36k. The live buffer stops growing here and
 * marks the lap dirty; importers reject the lap.
 */
export const MAX_LAP_SAMPLES = 80_000;

/** Where a stored lap came from. Only 'best' is populated today. */
export type LapTraceSource = 'best' | 'manual' | 'garage61';

export interface LapTraceSourceMeta {
  kind: LapTraceSource;
  /** Short label for the widget header, e.g. "Personal Best", "spa_gt3.ibt". */
  label: string;
  /**
   * Provenance handle. For 'manual', the basename of the imported .ibt (never
   * the absolute path). For 'garage61', the lap id. Unset for 'best'.
   */
  ref?: string;
  /** Epoch ms this record entered the store. */
  importedAt: number;
  /** Driver name parsed from import filename/source. */
  driver?: string;
  /** Car name parsed from import filename/source. */
  car?: string;
  /** Track name parsed from import filename/source. */
  track?: string;
}

/**
 * One lap as parallel per-sample arrays, one entry per telemetry frame.
 *
 * Only the first `length` entries are meaningful — the live recorder's buffer
 * over-allocates, so readers must index by `length`, never by an array's own
 * `.length`. A persisted record is trimmed to exactly `length`.
 *
 * Invariants every producer upholds (see SampleBuffer, the single writer):
 *  - `distanceM` is strictly ascending within `[0, trackLengthM)`;
 *  - `timeSec` is non-decreasing and starts at 0 at the lap's first sample;
 *  - the arrays are the same length.
 *
 * Everything is Float32Array, including the integer-valued gear and ABS flag,
 * so storage has one serialisation rule rather than one per class.
 */
export interface LapTraceSamples {
  length: number;
  /** Metres from the start/finish line. */
  distanceM: Float32Array;
  /** Seconds since the lap's first sample. */
  timeSec: Float32Array;
  /** 0..1 */
  throttle: Float32Array;
  /** 0..1 */
  brake: Float32Array;
  /** metres per second */
  speed: Float32Array;
  /** raw iRacing gear: -1 reverse, 0 neutral, 1..n */
  gear: Float32Array;
  /** 0 | 1, from BrakeABSactive */
  absActive: Float32Array;
}

/**
 * Pedal application points, in metres along the lap, at full precision.
 *
 * Never persisted — derived from the samples on hydrate (and incrementally on
 * the live lap) by the same threshold-crossing interpolation, so a threshold
 * change applies to every stored lap. "Where exactly did the reference brake"
 * is the number the widget exists to answer. Each array is ascending.
 */
export interface LapTraceEvents {
  /** Where the brake first came on. */
  brakeOnM: Float32Array;
  /** Where the brake was fully released. */
  brakeOffM: Float32Array;
  /** Where the throttle was first re-applied. */
  throttleOnM: Float32Array;
}

/**
 * Brake-countdown cues. Three beeps and a distinct tone at the point itself;
 * the sound name is the seconds remaining when it fires.
 */
export type BrakeCueSound = 'count3' | 'count2' | 'count1' | 'brake';

/**
 * Sentinel `brakeCueOutputDeviceId` meaning "whatever Windows is using".
 * Deliberately not the empty string so a stored config never looks unset, and
 * deliberately not a real `MediaDeviceInfo.deviceId` — Chromium's own 'default'
 * id is filtered out of the picker in favour of this.
 */
export const DEFAULT_AUDIO_OUTPUT_DEVICE_ID = 'default';

/** Colour of the countdown bar strip, warming as the brake point approaches. */
export type BrakeCueTone = 'off' | 'green' | 'amber' | 'orange' | 'red';

/**
 * User-configurable plot colours. All hex strings so a native `<input
 * type="color">` can edit them directly. Defaults in DEFAULT_LAP_TRACE_COLORS.
 */
export interface LapTraceColors {
  /** Saved reference lap. */
  referenceThrottle: string;
  referenceBrake: string;
  referenceSpeed: string;
  /** Fill under the reference throttle/brake curves when "filled" is on. */
  referenceThrottleFill: string;
  referenceBrakeFill: string;
  /** Live driver ("ghost") lap. */
  ghostThrottle: string;
  ghostBrake: string;
  ghostSpeed: string;
  /** ABS highlight line on the driver's brake trace. */
  abs: string;
  /** Fill under the driver's brake trace where ABS engaged ('bar' style). */
  absFill: string;
  /** Reference brake-application marker line. */
  brakeMarker: string;
  /** Reference throttle-application marker line. */
  throttleMarker: string;
  /** Horizontal gridlines behind the trace. */
  grid: string;
  /** Brake-cue countdown ladder, warming as the reference brake point nears. */
  brakeCueGreen: string;
  brakeCueAmber: string;
  brakeCueOrange: string;
  brakeCueRed: string;
}

/** One synthesised countdown tone. Mirrors the Web Audio oscillator + envelope. */
export interface LapTraceSoundCue {
  /** Pitch in Hz. */
  frequency: number;
  type: OscillatorType;
  /** Note length in seconds. */
  durationSec: number;
  /** Relative level before the master gain, 0..1. */
  peak: number;
}

/** The four brake-countdown tones (three beeps, then the brake tone). */
export interface LapTraceSound {
  count3: LapTraceSoundCue;
  count2: LapTraceSoundCue;
  count1: LapTraceSoundCue;
  brake: LapTraceSoundCue;
}

/**
 * Default plot colours — the single source of truth shared by the default
 * dashboard config and the settings "restore defaults" button. A few mirror
 * former getColor() theme values as fixed hex (sky-300/400, emerald/red/yellow
 * -500) so a colour picker has a concrete value to show and store.
 */
export const DEFAULT_LAP_TRACE_COLORS: LapTraceColors = {
  referenceThrottle: '#1C6D4C',
  referenceBrake: '#8B3D40',
  referenceSpeed: '#78A5BA',
  referenceThrottleFill: '#337162',
  referenceBrakeFill: '#690B24',
  ghostThrottle: '#00D18B',
  ghostBrake: '#ef4444',
  ghostSpeed: '#21ACE8',
  abs: '#FFD147',
  absFill: '#8D8058',
  brakeMarker: '#FF0008',
  throttleMarker: '#2EB87E',
  grid: '#293C58',
  brakeCueGreen: '#2a9953',
  brakeCueAmber: '#cf8a13',
  brakeCueOrange: '#d66819',
  brakeCueRed: '#e62e2e',
};

/** Default countdown tones — matches the built-in CUES in brakeCueAudio.ts. */
export const DEFAULT_LAP_TRACE_SOUND: LapTraceSound = {
  count3: { frequency: 880, type: 'sine', durationSec: 0.07, peak: 1 },
  count2: { frequency: 880, type: 'sine', durationSec: 0.07, peak: 1 },
  count1: { frequency: 880, type: 'sine', durationSec: 0.07, peak: 1 },
  brake: { frequency: 1100, type: 'triangle', durationSec: 0.18, peak: 0.6 },
};

/** The persisted shape. Pure data — nothing derived. */
export interface LapTraceRecord {
  schemaVersion: number;
  source: LapTraceSourceMeta;

  /** WeekendInfo.TrackID */
  trackId: number;
  /**
   * WeekendInfo.TrackConfigName. Guards against layout collisions — a reverse
   * or short config can share a TrackID with the full circuit, and replaying a
   * reverse lap against a forward one would be worse than showing nothing.
   */
  trackConfigName: string;
  /** DriverInfo.Drivers[playerCarIdx].CarPath */
  carPath: string;

  /**
   * Track length in metres the sample distances were computed from. On load
   * the distances are rescaled if the live session reports a different length
   * (WeekendInfo.TrackLength is only 2dp on some tracks).
   */
  trackLengthM: number;

  /** Lap time in seconds, or -1 when unknown. */
  lapTimeSec: number;

  samples: LapTraceSamples;

  /** Epoch ms the lap was recorded/imported. Used by the storage cap prune. */
  recordedAt: number;
}

/**
 * In-memory view. Everything here is derived once by hydrateLapTrace() on load
 * or promotion — deliberately NOT persisted, so an importer only has to
 * produce a LapTraceRecord.
 */
export interface LapTraceView extends LapTraceRecord {
  /** Min/max over the samples, for speed normalisation. */
  speedMinMs: number;
  speedMaxMs: number;
  /** Derived from the samples; see LapTraceEvents. */
  events: LapTraceEvents;
  /**
   * The subset of `events.throttleOnM` worth drawing a marker at: every
   * application except the ones a gear change produced — a downshift blip
   * mid-braking, or the re-application after an upshift lift. See
   * selectThrottlePoints.
   */
  throttlePointsM: Float32Array;
  /** Ascending metres where the gear first changes to a new value. */
  gearChangeM: Float32Array;
  /** The gear entered at gearChangeM[i]. Parallel array. */
  gearChangeValues: Int8Array;
}

/**
 * One lap's per-sample channels as extracted from an .ibt file. Parallel
 * arrays, all the same length — the raw material the renderer turns into a
 * LapTraceRecord (mirroring the Garage 61 CSV path). `pct` is normalised [0,1).
 */
export interface IbtLapSamples {
  pct: Float32Array;
  /** Seconds since the lap's first sample. */
  timeSec: Float32Array;
  /** 0..1 */
  throttle: Float32Array;
  /** 0..1 */
  brake: Float32Array;
  /** metres per second */
  speed: Float32Array;
  /** raw iRacing gear */
  gear: Float32Array;
  /** 0 | 1 */
  absActive: Float32Array;
}

/**
 * Result of parsing an .ibt: the session identity (from the file's own YAML, so
 * the lap keys to the right track/car) plus the single fastest valid lap. The
 * complete session is never returned — only this one lap.
 */
export interface IbtImportResult {
  fileName: string;
  lapNumber: number;
  lapTimeSec: number;
  trackId: number;
  trackConfigName: string;
  carPath: string;
  trackLengthM: number;
  trackDisplayName?: string;
  driverName?: string;
  carScreenName?: string;
  samples: IbtLapSamples;
}

/**
 * The current session's track/car and whether a personal best is stored for
 * it — resolved in the main process (the only place that knows the live
 * session), so the Settings window can label and gate its reset control
 * without a session subscription of its own. Null when nothing is being driven.
 */
export interface LapTraceBestInfo {
  trackName: string;
  carName: string;
  hasBest: boolean;
}

/**
 * Ids used by Garage 61's lap-search URL. These are Garage 61's own ids, not
 * iRacing's; the main process translates between the two, since neither id
 * space means anything to the other.
 */
export interface Garage61SearchInfo {
  trackId: number;
  carId: number;
}

export interface LapTraceBridge {
  getLapTrace: (
    trackId: number,
    carPath: string,
    kind: LapTraceSource
  ) => Promise<LapTraceRecord | null>;

  saveLapTrace: (
    trackId: number,
    carPath: string,
    kind: LapTraceSource,
    record: LapTraceRecord
  ) => Promise<void>;

  clearLapTrace: (
    trackId: number,
    carPath: string,
    kind: LapTraceSource
  ) => Promise<void>;

  /**
   * Open a native file picker for a saved iRacing .ibt telemetry file, then in
   * the main process stream-scan it for its fastest valid lap and return just
   * that lap's samples plus the file's own session identity. Null if the user
   * cancels. Parsing happens in main — the file is binary and can be gigabytes,
   * so it must never cross the IPC boundary or reach the renderer whole. The
   * renderer turns the returned samples into a LapTraceRecord (ibtLapImport),
   * mirroring the Garage 61 CSV path.
   */
  pickAndParseIbtLap: () => Promise<IbtImportResult | null>;

  /**
   * Fetch a lap from the Garage 61 API. Lives in main rather than the renderer
   * because the renderer CSP restricts connect-src. Not implemented yet —
   * rejects.
   */
  fetchLapTraceFromGarage61: (
    trackId: number,
    carPath: string,
    lapId: string
  ) => Promise<LapTraceRecord>;

  /**
   * Open a native file picker for a Garage 61 CSV export; null if cancelled.
   * Parsing happens in the renderer (parseGarage61Csv) — main only does file
   * I/O, since the CSV domain logic lives under src/frontend/domain and is
   * not importable from src/app.
   */
  pickGarage61Csv: () => Promise<{ fileName: string; csvText: string } | null>;

  /**
   * Tell every window to reload its currently-selected reference lap. The
   * widget and the Settings panel run in separate windows with separate stores,
   * so a lap imported/cleared in Settings is invisible to the overlay until it
   * re-reads from disk. Fire this after an import or clear so the overlay picks
   * up the change without being hidden and shown again.
   */
  notifyReferenceUpdated: () => void;

  /** Subscribe (overlay side) to notifyReferenceUpdated. Returns unsubscribe. */
  onReferenceUpdated: (callback: () => void) => () => void;

  /**
   * Ask every window to clear the stored personal best for the track and car
   * currently being driven and reset its promotion threshold. Resolved in the
   * overlay store, which knows the live track/car; a no-op when nothing is
   * being driven.
   */
  requestClearBestLap: () => void;

  /** Subscribe (overlay side) to requestClearBestLap. Returns unsubscribe. */
  onClearBestLap: (callback: () => void) => () => void;

  /**
   * The track/car currently being driven and whether a best lap is stored for
   * it, or null when no session is active. Lets Settings label and enable its
   * "reset best lap" control (Settings has no live session of its own).
   */
  getCurrentBestLapInfo: () => Promise<LapTraceBestInfo | null>;

  /** Current, or most recently driven, session identity for Garage 61 search. */
  getGarage61SearchInfo: () => Promise<Garage61SearchInfo | null>;
}
