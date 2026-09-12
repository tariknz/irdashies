import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { LovelyTrackSection } from '@irdashies/types';
import {
  getChannelSnapshotStore,
  useLapTraceStore,
  useLovelyTrackData,
} from '@irdashies/context';
import { compareCorner } from '../../../domain/lapTrace/cornerComparison';
import {
  assignCornerBrakePoints,
  brakeReleasesFor,
  compareCornerBrakePoint,
} from '../../../domain/lapTrace/cornerBrakePointDelta';
import { selectBrakeCuePoints } from '../../../domain/lapTrace/brakeCuePoints';
import { BRAKE_POINT_LOOKBACK_M } from '../layout';

/**
 * How a corner is named in the panel: by its name ('Acque Minerali A') or by
 * its turn number ('T5A').
 */
export type LastCornerLabelStyle = 'name' | 'number';

/** A kept corner with its display label resolved. */
interface PanelCorner extends LovelyTrackSection {
  label: string;
}

export interface LastCornerEntry {
  sectionId: string;
  /** 'T5A' in number mode, otherwise the corner's name plus any A/B suffix. */
  label: string;
  timeDeltaSec: number;
  apexSpeedDeltaMs: number;
  /**
   * Metres earlier/later the driver braked than the reference for this
   * corner. Independent of timeDeltaSec/apexSpeedDeltaMs: null here — the
   * reference took this corner flat, or the driver's own application was too
   * far off to pair — leaves the rest of the entry intact.
   */
  brakePointDeltaM: number | null;
  /** `Date.now()` at completion, so the panel can retire the hero on a timer. */
  completedAt: number;
}

/**
 * Longest history kept. The panel slices this down to however many entries the
 * driver has configured, so changing that setting neither restarts the channel
 * subscription nor throws away history already collected.
 */
export const MAX_LAST_CORNER_HISTORY = 5;

const EMPTY: LastCornerEntry[] = [];
const NO_BRAKE_POINTS = new Float32Array(0);

/**
 * How far past a corner's end the lap has to reach before a comparison that
 * still fails is treated as never going to succeed. A couple of frames' worth
 * of track at any speed: enough to absorb the float32 rounding of the stored
 * sample distances, short enough that a corner is never held back visibly.
 */
const COVERAGE_SETTLE_M = 5;

/** The base a corner is known by before any A/B suffix. */
const baseLabelOf = (section: LovelyTrackSection): string =>
  section.corner_number ?? section.name;

/** A, B, C … then plain numbers past Z, which no real complex reaches. */
const suffixAt = (index: number): string =>
  index < 26 ? String.fromCharCode(65 + index) : String(index + 1);

/**
 * Split the kept sections into corners.
 *
 * A corner is a run of **consecutive** sections sharing a base label. The
 * track data models some complexes as two abutting halves under one name —
 * Imola's Acque Minerali is 0.540-0.575 and 0.575-0.598 — and they are two
 * corners to drive, so they stay two rows and are told apart by an A/B suffix
 * rather than being merged. Consecutive rather than "every section with this
 * name" so two corners that merely share a name on a long circuit (the
 * Nordschleife has several) are not lettered as though they were one complex.
 */
const groupSections = (
  kept: readonly LovelyTrackSection[]
): LovelyTrackSection[][] => {
  const groups: LovelyTrackSection[][] = [];
  for (const section of kept) {
    const current = groups[groups.length - 1];
    if (current && baseLabelOf(current[0]) === baseLabelOf(section)) {
      current.push(section);
    } else {
      groups.push([section]);
    }
  }
  return groups;
};

/**
 * Label every kept section, and give the halves of a split complex distinct
 * `section_id`s — the id is a row's identity, and it deliberately does not
 * depend on `labelStyle` so history survives that setting being toggled.
 *
 * Turn numbers come from the track data where it has them, and are otherwise
 * counted off the corners themselves. All-or-nothing rather than per corner:
 * mixing a supplied 'T5' with a counted 5 on one circuit would print the same
 * number twice. Note the counted numbers are not iRacing's — the track-data
 * mapper drops marker-only turns (Imola loses T1, T4, T8, T10, T13, T16, T17
 * and T20 that way), so they count *named* corners.
 */
const labelCorners = (
  kept: readonly LovelyTrackSection[],
  labelStyle: LastCornerLabelStyle
): PanelCorner[] => {
  const groups = groupSections(kept);
  const numbered = labelStyle === 'number';
  const useTrackNumbers = groups.every((group) => !!group[0].corner_number);

  return groups.flatMap((group, groupIdx) => {
    const base = numbered
      ? useTrackNumbers
        ? (group[0].corner_number as string)
        : `T${groupIdx + 1}`
      : baseLabelOf(group[0]);

    return group.map((section, idx) => {
      const suffix = group.length > 1 ? suffixAt(idx) : '';
      return {
        ...section,
        section_id: suffix
          ? `${section.section_id}_${suffix.toLowerCase()}`
          : section.section_id,
        label: numbered
          ? `${base}${suffix}`
          : suffix
            ? `${base} ${suffix}`
            : base,
      };
    });
  });
};

/**
 * The corners the driver most recently completed, newest first, each compared
 * against the reference lap the plot is drawing.
 *
 * **Corners are reported off the recorded lap, not off a position crossing.**
 * Each tick asks one question — "does the lap buffer now reach past the next
 * corner's end?" — and compares that corner if so. That is what makes it
 * reliable, and it replaced a crossing state machine that had three separate
 * ways to lose a corner:
 *
 *   - It watched `track-state.snapshot` (25 Hz) but compared against the
 *     buffer filled by `lap-trace.sample` (60 Hz). Both are published from one
 *     sim frame, but track state is registered first and delivers inline, so
 *     roughly 42% of exits were evaluated one frame before the sample they
 *     needed had arrived — `samplesCover` failed and the corner vanished with
 *     no trace.
 *   - Movement under a minimum-progress threshold skipped the crossing checks
 *     while still advancing the anchor, so a car creeping through a slow
 *     corner passed boundaries untested and stranded the machine for the rest
 *     of the lap. The threshold was a lap *fraction*, so on a long track that
 *     "creep" was 90 km/h.
 *   - The store rewinds the buffer at the line off one channel while the
 *     machine detected the wrap off the other, so the two disagreed about
 *     which lap a corner near the line belonged to.
 *
 * Reading coverage instead removes all three by construction: nothing is
 * evaluated until its data demonstrably exists, there are no boundaries to
 * miss at any speed or tick rate, and `ActiveLap.lapSerial` is the single
 * authority on where a lap begins. A tow or teleport leaves a hole wider than
 * `MAX_SAMPLE_GAP_M`, which `samplesCover` already rejects, so only the
 * corners spanning it are skipped rather than the whole history being lost.
 *
 * Position is read through a direct channel subscription rather than a hook
 * (R2.3): this runs at telemetry rate, and a hook would re-render the widget
 * on every frame. All crossing state lives in refs, and setState fires at most
 * once per corner.
 *
 * Why a history rather than just the last corner: the track data splits a
 * physical complex into many adjacent sections, so nearly half of all
 * transitions give the driver under a second before the next corner starts. A
 * single result flashes past unreadably through any sequence.
 */
const NO_LABELS: string[] = [];

/**
 * Every corner on the current track, in lap order, with its display label
 * resolved. Memoised on the bundled track data, so the two hooks below share
 * one pass over it per track rather than each doing their own.
 */
const useTrackCorners = (
  enabled: boolean,
  labelStyle: LastCornerLabelStyle
): PanelCorner[] => {
  const { sections } = useLovelyTrackData();

  return useMemo(() => {
    // Nothing below is worth doing for a panel that is switched off.
    if (!enabled) return [];

    const sorted = sections
      .filter((s) => s.type !== 'straight')
      .sort((a, b) => a.start_pct - b.start_pct);

    // Sections in the bundled track data very occasionally overlap — 7 of 131
    // tracks, always a metre-scale start offset between two halves of one
    // corner (Virginia's T19a/T19b, Barcelona's Seat/T6). Two overlapping
    // ranges would report one stretch of road twice, so keep the first and
    // drop whatever starts before it ends. Comparing against the last section
    // *kept* rather than the last one seen matters if a chain ever overlaps:
    // the one before may itself have been dropped.
    const kept: LovelyTrackSection[] = [];
    for (const section of sorted) {
      const last = kept[kept.length - 1];
      // A kept section that wraps the start/finish line has end < start;
      // nothing later in a start_pct-sorted list can overlap it.
      if (
        !last ||
        last.end_pct < last.start_pct ||
        section.start_pct >= last.end_pct
      ) {
        kept.push(section);
      }
    }
    return labelCorners(kept, labelStyle);
  }, [sections, enabled, labelStyle]);
};

/**
 * Every corner name the current track can produce, whether or not it has been
 * driven yet.
 *
 * The panel sizes its name column from this rather than from the history it
 * happens to hold. Sizing to the history would be narrower on average, but the
 * column would then change width as corners came and went, which beside the
 * trace reads as the plot twitching. Pinning it to the track means one width
 * for the whole session: as narrow as that circuit allows, and fixed.
 */
export const useLastCornerLabels = (
  enabled: boolean,
  labelStyle: LastCornerLabelStyle = 'name'
): string[] => {
  const corners = useTrackCorners(enabled, labelStyle);

  return useMemo(
    () => (corners.length === 0 ? NO_LABELS : corners.map((c) => c.label)),
    [corners]
  );
};

export const useLastCornerComparison = (
  enabled: boolean,
  labelStyle: LastCornerLabelStyle = 'name'
): LastCornerEntry[] => {
  const referenceLap = useLapTraceStore((s) => s.referenceLap);
  const trackLengthM = useLapTraceStore((s) => s.trackLengthM);

  const corners = useTrackCorners(enabled, labelStyle);

  /**
   * The reference lap's brake point for each corner, parallel to `corners`.
   * Built once per reference lap rather than searched per corner exit, which
   * is both cheaper and the whole reason attribution can be exclusive.
   *
   * The points come from the same filter the audible countdown uses, so the
   * two features agree on what a braking zone is: a stabilising dab, or raw
   * pedal noise across the 1% event threshold, is not one.
   */
  const cornerBrakePointsM = useMemo(() => {
    const brakePointsM = referenceLap
      ? selectBrakeCuePoints(referenceLap)
      : NO_BRAKE_POINTS;
    return assignCornerBrakePoints({
      cornerStartPcts: corners.map((c) => c.start_pct),
      cornerEndPcts: corners.map((c) => c.end_pct),
      brakePointsM,
      // Where each of those applications ended, so a brake that runs
      // continuously out of one half of a complex into the next is attributed
      // to the half it started in rather than the one it ended in.
      brakeReleasesM: referenceLap
        ? brakeReleasesFor(
            brakePointsM,
            referenceLap.events.brakeOffM,
            trackLengthM,
            BRAKE_POINT_LOOKBACK_M
          )
        : NO_BRAKE_POINTS,
      trackLengthM,
      maxLeadM: BRAKE_POINT_LOOKBACK_M,
    });
  }, [corners, referenceLap, trackLengthM]);

  const [entries, setEntries] = useState<LastCornerEntry[]>(EMPTY);
  const entriesRef = useRef<LastCornerEntry[]>(EMPTY);
  // Read inside the per-frame callback, so it never restarts the subscription.
  const brakePointsRef = useRef(cornerBrakePointsM);
  brakePointsRef.current = cornerBrakePointsM;
  /** Written by a slow track-state subscription; the sample channel omits it. */
  const replayRef = useRef(false);

  const progress = useRef({
    /** Next corner to report; indexes `corners`. */
    nextIdx: 0,
    /** The lap `nextIdx` belongs to; -1 until pointed at one. */
    lapSerial: -1,
  });

  const publish = useCallback((next: LastCornerEntry[]) => {
    entriesRef.current = next;
    setEntries(next);
  }, []);

  /**
   * The no-op when already empty is load-bearing, not a micro-optimisation: the
   * off-track branch runs on every tick while the car sits in the pits, and an
   * array has no identity shortcut the way the old `null === null` had. Without
   * this guard that branch would re-render the widget at telemetry rate.
   */
  const clearHistory = useCallback(() => {
    if (entriesRef.current.length === 0) return;
    publish(EMPTY);
  }, [publish]);

  /**
   * Unshift one fully-formed entry for a corner just completed. A null result
   * means the comparison was untrustworthy (a sample gap across the corner, a
   * reference lap that does not cover it, an implausible delta) — that corner
   * contributes nothing at all, rather than a blank row.
   */
  const addCompletedCorner = useCallback(
    (
      corner: PanelCorner,
      deltas: {
        timeDeltaSec: number;
        apexSpeedDeltaMs: number;
        brakePointDeltaM: number | null;
      } | null
    ) => {
      if (!deltas) return;
      const entry: LastCornerEntry = {
        sectionId: corner.section_id,
        label: corner.label,
        completedAt: Date.now(),
        ...deltas,
      };
      publish([entry, ...entriesRef.current].slice(0, MAX_LAST_CORNER_HISTORY));
    },
    [publish]
  );

  useEffect(() => {
    if (!enabled || corners.length === 0) return;
    const bridge = window.channelBridge;
    if (!bridge) return;

    const p = progress.current;

    const computeFor = (
      corner: LovelyTrackSection,
      referenceBrakeM: number | null
    ): {
      timeDeltaSec: number;
      apexSpeedDeltaMs: number;
      brakePointDeltaM: number | null;
    } | null => {
      // Read fresh: the active lap's buffer is reset in place at each lap
      // boundary, so a captured reference risks reading a rewound buffer.
      const { trackLengthM, referenceLap, activeLap } =
        useLapTraceStore.getState();
      if (!referenceLap || !activeLap) return null;
      if (trackLengthM <= 0) return null;

      const comparison = compareCorner({
        startPct: corner.start_pct,
        endPct: corner.end_pct,
        trackLengthM,
        driverSamples: activeLap.samples,
        referenceSamples: referenceLap.samples,
      });
      if (!comparison) return null;

      // Every corner driven is listed. A corner the reference took flat has
      // no brake point to compare against, and simply shows no brake delta
      // rather than being dropped.
      const brakePointDeltaM =
        referenceBrakeM === null
          ? null
          : compareCornerBrakePoint({
              referenceBrakeM,
              trackLengthM,
              driverBrakeOnM: activeLap.events.brakeOnM,
              driverBrakeOnCount: activeLap.events.brakeOnCount,
              cornerStartM: corner.start_pct * trackLengthM,
              cornerEndM: corner.end_pct * trackLengthM,
              lookbackM: BRAKE_POINT_LOOKBACK_M,
            });

      return {
        timeDeltaSec: comparison.timeDeltaSec,
        apexSpeedDeltaMs: comparison.apexSpeedDeltaMs,
        brakePointDeltaM,
      };
    };

    const store = getChannelSnapshotStore('lap-trace.sample', bridge);
    // The same channel the recorder writes the buffer from, so a corner can
    // never be evaluated against a buffer that is a frame behind the position
    // that triggered it. Object.is is safe: IPC structured-clones every
    // delivery into a fresh object, so no frame is skipped as unchanged.
    const selection = store.createSelection((s) => s, Object.is, 60);

    const onSample = () => {
      const sample = selection.getSnapshot();
      if (!sample) return;

      // Nothing being driven counts, and whatever is on screen is now stale.
      if (!sample.isOnTrack || sample.onPitRoad || replayRef.current) {
        clearHistory();
        p.lapSerial = -1;
        return;
      }

      const { trackLengthM, activeLap } = useLapTraceStore.getState();
      if (!activeLap || !(trackLengthM > 0)) return;

      const samples = activeLap.samples;
      if (samples.length === 0) return;

      if (activeLap.lapSerial !== p.lapSerial) {
        p.lapSerial = activeLap.lapSerial;
        // Corners already behind the car when this lap's recording began can
        // never be compared, so start at the first one still ahead. History
        // from the previous lap deliberately stays on screen.
        const firstM = samples.distanceM[0];
        const idx = corners.findIndex(
          (c) => c.start_pct * trackLengthM >= firstM
        );
        p.nextIdx = idx === -1 ? corners.length : idx;
      }

      const lastM = samples.distanceM[samples.length - 1];
      while (p.nextIdx < corners.length) {
        const idx = p.nextIdx;
        const corner = corners[idx];
        const endM = corner.end_pct * trackLengthM;
        // Not driven through yet — and because the buffer only ever grows
        // forward within a lap, nothing after it can be either.
        if (endM > lastM) break;

        const deltas = computeFor(corner, brakePointsRef.current[idx]);
        if (deltas) {
          p.nextIdx = idx + 1;
          addCompletedCorner(corner, deltas);
          continue;
        }

        // No trustworthy comparison *yet*. Buffer distances are stored as
        // float32, so at the moment the buffer nominally reaches the corner's
        // end it can still round a hair short of it and fail the coverage
        // check. Leave the corner pending and look again next frame rather
        // than discarding it over a rounding error.
        if (lastM < endM + COVERAGE_SETTLE_M) break;
        // Clearly past it now and still not comparable — a sample gap across
        // the corner, or a reference lap that does not cover it. Give up on
        // this one only; the rest of the lap is unaffected.
        p.nextIdx = idx + 1;
      }
    };

    const unsubscribe = selection.subscribe(onSample);

    // Whether a replay is playing is the one thing the sample channel does not
    // carry. It changes rarely, so it is watched on its own slow selection and
    // parked in a ref rather than re-rendering the widget or gating the
    // per-frame path on a second snapshot read.
    const trackStateStore = getChannelSnapshotStore(
      'track-state.snapshot',
      bridge
    );
    const replaySelection = trackStateStore.createSelection(
      (s) => s.isReplayPlaying,
      Object.is,
      4
    );
    const unsubscribeReplay = replaySelection.subscribe(() => {
      replayRef.current = replaySelection.getSnapshot() ?? false;
    });

    return () => {
      unsubscribe();
      unsubscribeReplay();
      clearHistory();
      p.nextIdx = 0;
      p.lapSerial = -1;
      replayRef.current = false;
    };
  }, [corners, enabled, clearHistory, addCompletedCorner]);

  return entries;
};
