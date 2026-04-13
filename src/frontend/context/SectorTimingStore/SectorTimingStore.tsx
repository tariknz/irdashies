/**
 * SectorTimingStore — tracks player sector crossings and computes per-sector
 * performance colors for display on the track minimap.
 *
 * Data source:
 *   - Sector boundaries: session.SplitTimeInfo.Sectors (SectorStartPct 0–1)
 *   - Player position: LapDistPct telemetry (0–1)
 *   - Timing: SessionTime telemetry
 *
 * Crossing detection:
 *   Compares current LapDistPct against sorted sector boundaries. When the
 *   player moves from one sector's range into the next (including the wrap at
 *   S/F line), the time delta is recorded and compared against the session best
 *   to produce a color.
 *
 * Lap start protection:
 *   Sector times are only recorded after the player crosses the S/F line
 *   legitimately (lapStarted = true). A teleport, active reset, or off-track
 *   event sets lapStarted = false, requiring the player to complete a full
 *   S/F crossing before timing resumes.
 *
 * Color scheme (standard racing timing colours):
 *   purple  — session best for this sector
 *   green   — within 0.5% of session best
 *   yellow  — 0.5–1% slower than session best
 *   red     — more than 1% slower than session best
 *   default — no comparison data yet
 */

import { create, useStore } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import type { Sector } from '@irdashies/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SectorColor = 'purple' | 'green' | 'yellow' | 'red' | 'default';

interface SectorTimingState {
  // Sector boundaries from SplitTimeInfo
  sectors: Sector[];
  setSectors: (sectors: Sector[]) => void;

  // Current tracking state
  currentSectorIdx: number;
  sectorEntryTime: number;
  lastLapDistPct: number;

  // Actual sector times for the current lap (null = not yet completed this lap)
  currentLapSectorTimes: (number | null)[];

  // Sector times from the previous completed lap — used as fallback display
  // values for sectors not yet reached on the current lap (avoids showing '--'
  // for all sectors immediately after crossing the S/F line).
  previousLapSectorTimes: (number | null)[];

  /**
   * True only after the player crosses the S/F line from the last sector into
   * sector 0. When false, tick() updates position tracking but does not record
   * sector times. This prevents partial-lap data from an active reset or
   * rejoining mid-track from polluting the timing results.
   */
  lapStarted: boolean;

  // Per-sector timing results (null = not yet completed)
  sessionBestSectorTimes: (number | null)[];

  // Colors to display for each sector (index = sector number)
  sectorColors: SectorColor[];

  // Active color thresholds (fractions of session best, e.g. 0.005 = 0.5%)
  greenThreshold: number;
  yellowThreshold: number;

  // Called each telemetry tick with the player's current position and time
  tick: (lapDistPct: number, sessionTime: number, isOnTrack: boolean) => void;

  // Update color thresholds and recompute existing sector colors immediately.
  setThresholds: (green: number, yellow: number) => void;

  // Reset all timing data (e.g. on new session or track change)
  reset: () => void;
  // Reset current-lap state, keep session bests. Sets lapStarted=true
  // so the next sector crossing will be recorded (use for clean lap resets).
  resetLap: () => void;
  // Mark lap as invalid — requires S/F crossing before timing resumes.
  // Call when the player goes off-track or rejoins mid-track.
  invalidateLap: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Default sector color thresholds (as fractions of session best). */
export const DEFAULT_GREEN_THRESHOLD = 0.005; // 0.5%
export const DEFAULT_YELLOW_THRESHOLD = 0.01; // 1.0%

/**
 * Minimum LapDistPct movement required per tick to trigger a sector-crossing
 * check. Below this threshold the car is considered effectively stationary and
 * sector crossing checks are skipped (noise guard).
 *
 * Must be small enough to work at the real SDK update rate (~25 Hz).
 * At 25 Hz on a typical 5 km road course (~120 km/h average):
 *   per-tick delta ≈ 1 / (150 s × 25 Hz) ≈ 0.000267
 * Setting this to 0.000050 skips only cars moving slower than ~18 km/h on a
 * 5 km track, which is effectively stationary in any racing context.
 */
const MIN_PROGRESS = 0.00005;

/**
 * Maximum forward jump in LapDistPct in a single tick. Jumps larger than
 * this are treated as a teleport/reset (e.g. rejoining track).
 */
const MAX_FORWARD_JUMP = 0.5;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Compute which sector index the player is in given their LapDistPct.
 * Sectors are sorted by SectorStartPct ascending. The last sector wraps
 * back to 0.0 (i.e. the player is in sector N-1 until they hit sector 0's
 * start again on the next lap).
 */
export function getSectorIdx(lapDistPct: number, sectors: Sector[]): number {
  if (sectors.length === 0) return 0;
  let idx = 0;
  for (let i = 0; i < sectors.length; i++) {
    if (lapDistPct >= sectors[i].SectorStartPct) {
      idx = i;
    }
  }
  return idx;
}

/**
 * Assign a performance color based on sector time vs. session best.
 *   purple — equals or beats session best
 *   green  — within greenThreshold (default 0.5%) of session best
 *   yellow — within yellowThreshold (default 1%) of session best
 *   red    — more than yellowThreshold slower than session best
 */
export function computeSectorColor(
  time: number,
  sessionBest: number | null,
  greenThreshold = DEFAULT_GREEN_THRESHOLD,
  yellowThreshold = DEFAULT_YELLOW_THRESHOLD
): SectorColor {
  if (sessionBest === null) return 'default';
  if (time <= sessionBest) return 'purple';
  const ratio = (time - sessionBest) / sessionBest;
  if (ratio <= greenThreshold) return 'green';
  if (ratio <= yellowThreshold) return 'yellow';
  return 'red';
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useSectorTimingStore = create<SectorTimingState>((set, get) => ({
  sectors: [],
  currentSectorIdx: 0,
  sectorEntryTime: 0,
  lastLapDistPct: -1,
  lapStarted: false,
  sessionBestSectorTimes: [],
  sectorColors: [],
  currentLapSectorTimes: [],
  previousLapSectorTimes: [],
  greenThreshold: DEFAULT_GREEN_THRESHOLD,
  yellowThreshold: DEFAULT_YELLOW_THRESHOLD,

  setSectors: (sectors: Sector[]) => {
    const sorted = [...sectors].sort(
      (a, b) => a.SectorStartPct - b.SectorStartPct
    );
    const current = get().sectors;
    // Session data is re-broadcast periodically with identical sector info.
    // Only reset timing when sector boundaries actually change (e.g. track change).
    if (
      current.length === sorted.length &&
      current.every((s, i) => s.SectorStartPct === sorted[i].SectorStartPct)
    ) {
      return;
    }
    set({
      sectors: sorted,
      sectorColors: sorted.map(() => 'default' as SectorColor),
      sessionBestSectorTimes: sorted.map(() => null),
      currentLapSectorTimes: sorted.map(() => null),
      previousLapSectorTimes: sorted.map(() => null),
      currentSectorIdx: 0,
      sectorEntryTime: 0,
      lastLapDistPct: -1,
      lapStarted: false,
    });
  },

  tick: (lapDistPct: number, sessionTime: number, isOnTrack: boolean) => {
    const state = get();
    const {
      sectors,
      currentSectorIdx,
      sectorEntryTime,
      lastLapDistPct,
      lapStarted,
      greenThreshold,
      yellowThreshold,
    } = state;

    if (sectors.length === 0 || !isOnTrack) return;

    // First tick — just record position
    if (lastLapDistPct < 0) {
      const idx = getSectorIdx(lapDistPct, sectors);
      set({
        currentSectorIdx: idx,
        sectorEntryTime: sessionTime,
        lastLapDistPct: lapDistPct,
      });
      return;
    }

    const delta = lapDistPct - lastLapDistPct;

    // Detect a S/F wrap-around: player was in the last sector and is now
    // in sector 0 with a negative delta (crossed the finish line naturally).
    const lastSectorStart = sectors[sectors.length - 1]?.SectorStartPct ?? 0;
    const firstSectorEnd = sectors[1]?.SectorStartPct ?? 1;
    const isWrapAround =
      delta < 0 &&
      lastLapDistPct >= lastSectorStart &&
      lapDistPct < firstSectorEnd;

    if (isWrapAround) {
      const newSessionBests = [...state.sessionBestSectorTimes];
      // Keep previous lap's colors — they update sector-by-sector as each
      // sector is completed on the new lap. This means: sectors already crossed
      // on the new lap show current performance; sectors not yet reached show
      // the last lap's color as a reference (matching RaceLab behavior).
      const newColors = [...state.sectorColors];

      if (lapStarted) {
        // Record and color the last sector at the S/F crossing.
        const sectorTime = sessionTime - sectorEntryTime;
        const completedIdx = currentSectorIdx;

        if (
          newSessionBests[completedIdx] === null ||
          sectorTime < (newSessionBests[completedIdx] as number)
        )
          newSessionBests[completedIdx] = sectorTime;

        newColors[completedIdx] = computeSectorColor(
          sectorTime,
          newSessionBests[completedIdx],
          greenThreshold,
          yellowThreshold
        );
      }

      // Capture the completed lap's sector times before resetting, so sectors
      // not yet reached on the new lap can still display the previous values.
      const completedLapTimes = [...state.currentLapSectorTimes];
      if (lapStarted) {
        completedLapTimes[currentSectorIdx] = sessionTime - sectorEntryTime;
      }

      set({
        lapStarted: true,
        currentSectorIdx: 0,
        sectorEntryTime: sessionTime,
        lastLapDistPct: lapDistPct,
        sessionBestSectorTimes: newSessionBests,
        sectorColors: newColors,
        previousLapSectorTimes: completedLapTimes,
        currentLapSectorTimes: sectors.map(() => null),
      });
      return;
    }

    // Backwards movement (pit road, game resets, replay scrubbing) or a
    // suspiciously large forward jump (teleport) — invalidate the current lap.
    // S/F wrap-around was already handled above, so any remaining negative
    // delta is a genuine backwards move, not a lap crossing.
    if (delta < 0 || delta > MAX_FORWARD_JUMP) {
      set({ lapStarted: false, lastLapDistPct: lapDistPct });
      return;
    }

    set({ lastLapDistPct: lapDistPct });

    // Skip sector-crossing detection when the car is effectively stationary.
    // This is a noise guard only — it must NOT invalidate lapStarted, otherwise
    // every tick at the real SDK rate (~25 Hz, where normal road-course deltas
    // are ~0.0002-0.0004) would reset lap tracking and make timing impossible.
    if (delta < MIN_PROGRESS) return;

    const newSectorIdx = getSectorIdx(lapDistPct, sectors);
    if (newSectorIdx === currentSectorIdx) return;

    // Crossed into a new sector — only record timing if lap is started
    if (!lapStarted) {
      set({ currentSectorIdx: newSectorIdx, sectorEntryTime: sessionTime });
      return;
    }

    const sectorTime = sessionTime - sectorEntryTime;
    const completedIdx = currentSectorIdx;

    const newSessionBests = [...state.sessionBestSectorTimes];

    // Update session best before computing color so the first completion
    // is correctly identified as a new session best (purple).
    if (
      newSessionBests[completedIdx] === null ||
      sectorTime < (newSessionBests[completedIdx] as number)
    ) {
      newSessionBests[completedIdx] = sectorTime;
    }

    const color = computeSectorColor(
      sectorTime,
      newSessionBests[completedIdx],
      greenThreshold,
      yellowThreshold
    );

    // Update colors — completed sector gets its color, others keep theirs
    const newColors = [...state.sectorColors];
    newColors[completedIdx] = color;

    // Record actual sector time for the current lap
    const newCurrentLapTimes = [...state.currentLapSectorTimes];
    newCurrentLapTimes[completedIdx] = sectorTime;

    set({
      currentSectorIdx: newSectorIdx,
      sectorEntryTime: sessionTime,
      sessionBestSectorTimes: newSessionBests,
      sectorColors: newColors,
      currentLapSectorTimes: newCurrentLapTimes,
    });
  },

  setThresholds: (green: number, yellow: number) => {
    const state = get();
    if (state.greenThreshold === green && state.yellowThreshold === yellow)
      return;
    // Recompute existing sector colors with the new thresholds so the display
    // updates immediately without waiting for the next sector crossing.
    const newColors = state.sectorColors.map((existing, i) => {
      const time =
        state.currentLapSectorTimes[i] ?? state.previousLapSectorTimes[i];
      const sessionBest = state.sessionBestSectorTimes[i];
      if (time == null) return existing;
      return computeSectorColor(time, sessionBest, green, yellow);
    });
    set({
      greenThreshold: green,
      yellowThreshold: yellow,
      sectorColors: newColors,
    });
  },

  reset: () =>
    set((state) => ({
      currentSectorIdx: 0,
      sectorEntryTime: 0,
      lastLapDistPct: -1,
      lapStarted: false,
      sessionBestSectorTimes: state.sectors.map(() => null),
      sectorColors: state.sectors.map(() => 'default' as SectorColor),
      currentLapSectorTimes: state.sectors.map(() => null),
      previousLapSectorTimes: state.sectors.map(() => null),
    })),

  resetLap: () =>
    set((state) => ({
      currentSectorIdx: 0,
      sectorEntryTime: 0,
      lastLapDistPct: -1,
      lapStarted: true,
      sectorColors: state.sectors.map(() => 'default' as SectorColor),
      currentLapSectorTimes: state.sectors.map(() => null),
      previousLapSectorTimes: state.sectors.map(() => null),
    })),

  invalidateLap: () =>
    set({
      lapStarted: false,
      lastLapDistPct: -1,
    }),
}));

// ---------------------------------------------------------------------------
// Selectors
// ---------------------------------------------------------------------------

export const useSectorColors = () =>
  useStore(useSectorTimingStore, (s) => s.sectorColors);

export const useSectorDeltas = () =>
  useStoreWithEqualityFn(
    useSectorTimingStore,
    (s) => ({
      sectors: s.sectors,
      sectorColors: s.sectorColors,
      currentLapSectorTimes: s.currentLapSectorTimes,
      previousLapSectorTimes: s.previousLapSectorTimes,
      sessionBestSectorTimes: s.sessionBestSectorTimes,
      currentSectorIdx: s.currentSectorIdx,
    }),
    shallow
  );
