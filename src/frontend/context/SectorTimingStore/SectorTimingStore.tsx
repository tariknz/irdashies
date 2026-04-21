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
 * Per-sector validity:
 *   Each sector crossing is individually validated. A sector's time is only
 *   recorded if the player entered it via normal forward progression
 *   (sectorEntryValid = true). A teleport, active reset, or off-track event
 *   sets sectorEntryValid = false — only the sector the player lands in is
 *   affected. Sectors already completed on the current lap keep their times.
 *
 *   The S/F crossing always starts sector 0 with a valid entry, so timing
 *   resumes naturally from there without requiring a full lap to complete first.
 *
 * previousLapSectorTimes:
 *   Updated immediately when each sector is validly completed (not just at
 *   S/F). This preserves the best available reference time for each sector
 *   independently of resets or incomplete laps.
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
  lastSessionTime: number;

  // Actual sector times for the current lap (null = not yet completed this lap)
  currentLapSectorTimes: (number | null)[];

  // Most recent valid time for each sector. Updated immediately whenever a
  // sector is validly completed (not just at S/F). Used as a display fallback
  // for sectors not yet reached on the current lap.
  previousLapSectorTimes: (number | null)[];

  /**
   * True when the current sector was entered via a normal forward crossing
   * (sector boundary or S/F line). False after a teleport, active reset, or
   * off-track event. Only the sector the player lands in is affected — sectors
   * already completed on the current lap retain their recorded times.
   */
  sectorEntryValid: boolean;

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
  // Reset current-lap state, keep session bests. Sets sectorEntryValid=true
  // so the next sector crossing will be recorded (use for clean test setup).
  resetLap: () => void;
  // Mark current sector as invalid — next crossing must be entered normally.
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
 * Absolute maximum forward LapDistPct jump in a single tick. Jumps above
 * this are unconditionally treated as teleports (half-lap-or-more jumps).
 */
const MAX_FORWARD_JUMP = 0.5;

/**
 * Maximum plausible LapDistPct change per second for any real racing scenario.
 * 0.08 pct/s covers ~400 km/h on a 3 km track with generous margin.
 *
 * Used alongside per-tick time delta to catch active resets that produce a
 * smaller positional jump (e.g. sector 1 → sector 3 on a 3-sector track gives
 * delta ~0.45 in ~1 second = 0.45 pct/s >> 0.08). Only applied when
 * consecutive ticks are within MAX_SPEED_CHECK_WINDOW seconds of each other;
 * larger gaps (pause, reconnect) fall back to position-only detection.
 */
const MAX_LAP_PCT_PER_SECOND = 0.08;
const MAX_SPEED_CHECK_WINDOW = 5; // seconds

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
 * Linearly interpolates the session time at which lapDistPct crossed boundary.
 * Uses the two surrounding ticks (prevPct/prevTime → currPct/currTime).
 * Falls back to currTime if the position delta is zero (shouldn't happen in practice).
 *
 * For S/F wrap-around crossings, pass currPct = lapDistPct + 1.0 so the
 * interpolation direction is correct across the 0/1 boundary.
 */
export function interpolateCrossingTime(
  boundary: number,
  prevPct: number,
  prevTime: number,
  currPct: number,
  currTime: number
): number {
  const dPct = currPct - prevPct;
  if (dPct === 0) return currTime;
  const fraction = (boundary - prevPct) / dPct;
  return prevTime + fraction * (currTime - prevTime);
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
  lastSessionTime: -1,
  sectorEntryValid: false,
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
      lastSessionTime: -1,
      sectorEntryValid: false,
    });
  },

  tick: (lapDistPct: number, sessionTime: number, isOnTrack: boolean) => {
    const state = get();
    const {
      sectors,
      currentSectorIdx,
      sectorEntryTime,
      lastLapDistPct,
      lastSessionTime,
      sectorEntryValid,
      greenThreshold,
      yellowThreshold,
    } = state;

    if (sectors.length === 0 || !isOnTrack) return;

    // First tick — just record position, leave sectorEntryValid = false since
    // we don't know if the player just joined mid-sector or started cleanly.
    if (lastLapDistPct < 0) {
      const idx = getSectorIdx(lapDistPct, sectors);
      set({
        currentSectorIdx: idx,
        sectorEntryTime: sessionTime,
        lastLapDistPct: lapDistPct,
        lastSessionTime: sessionTime,
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
      const newColors = [...state.sectorColors];
      const newPreviousTimes = [...state.previousLapSectorTimes];

      // Interpolate the exact moment the S/F line was crossed.
      // currPct + 1.0 normalises the wrap-around so the direction is correct.
      const crossingTime = interpolateCrossingTime(
        1.0,
        lastLapDistPct,
        lastSessionTime,
        lapDistPct + 1.0,
        sessionTime
      );

      if (sectorEntryValid) {
        // Record and color the last sector at the S/F crossing.
        const sectorTime = crossingTime - sectorEntryTime;
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
        // Update previousLapSectorTimes immediately for the completed sector.
        newPreviousTimes[completedIdx] = sectorTime;
      }

      set({
        sectorEntryValid: true, // S/F crossing is always a valid entry to sector 0
        currentSectorIdx: 0,
        sectorEntryTime: crossingTime,
        lastLapDistPct: lapDistPct,
        lastSessionTime: sessionTime,
        sessionBestSectorTimes: newSessionBests,
        sectorColors: newColors,
        previousLapSectorTimes: newPreviousTimes,
        currentLapSectorTimes: sectors.map(() => null),
      });
      return;
    }

    // Detect teleport/active reset for forward movement:
    //   1. Absolute: position delta > MAX_FORWARD_JUMP (half a lap or more)
    //   2. Speed-based: delta / timeDelta > MAX_LAP_PCT_PER_SECOND
    //      Catches smaller active resets (e.g. sector 1 → sector 3 final, ~0.45
    //      lap in 1 second). Skipped when ticks are far apart (pause/reconnect)
    //      to avoid false positives on legitimate large time gaps.
    const tickDuration =
      lastSessionTime >= 0 ? sessionTime - lastSessionTime : Infinity;
    const isTeleport =
      delta < 0 ||
      delta > MAX_FORWARD_JUMP ||
      (delta > 0 &&
        tickDuration > 0 &&
        tickDuration < MAX_SPEED_CHECK_WINDOW &&
        delta / tickDuration > MAX_LAP_PCT_PER_SECOND);

    if (isTeleport) {
      const newSectorIdx = getSectorIdx(lapDistPct, sectors);
      const newCurrentLapTimes = [...state.currentLapSectorTimes];
      // Clear only the sector we teleported into so stale data isn't shown
      // for a sector the player is about to re-drive from an unknown entry.
      newCurrentLapTimes[newSectorIdx] = null;
      set({
        sectorEntryValid: false,
        lastLapDistPct: lapDistPct,
        lastSessionTime: sessionTime,
        currentSectorIdx: newSectorIdx,
        sectorEntryTime: sessionTime,
        currentLapSectorTimes: newCurrentLapTimes,
      });
      return;
    }

    set({ lastLapDistPct: lapDistPct, lastSessionTime: sessionTime });

    // Skip sector-crossing detection when the car is effectively stationary.
    // This is a noise guard only — it must NOT invalidate sectorEntryValid.
    if (delta < MIN_PROGRESS) return;

    const newSectorIdx = getSectorIdx(lapDistPct, sectors);
    if (newSectorIdx === currentSectorIdx) return;

    // Crossed into a new sector via normal forward progression.
    const newCurrentLapTimes = [...state.currentLapSectorTimes];
    const newPreviousTimes = [...state.previousLapSectorTimes];
    const newSessionBests = [...state.sessionBestSectorTimes];
    const newColors = [...state.sectorColors];

    // Interpolate the exact moment the sector boundary was crossed.
    const boundary = sectors[newSectorIdx].SectorStartPct;
    const crossingTime = interpolateCrossingTime(
      boundary,
      lastLapDistPct,
      lastSessionTime,
      lapDistPct,
      sessionTime
    );

    if (sectorEntryValid) {
      const sectorTime = crossingTime - sectorEntryTime;
      const completedIdx = currentSectorIdx;

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

      newColors[completedIdx] = color;
      newCurrentLapTimes[completedIdx] = sectorTime;
      // Update previousLapSectorTimes immediately so the reference is always
      // current regardless of resets or incomplete laps.
      newPreviousTimes[completedIdx] = sectorTime;
    }

    set({
      sectorEntryValid: true, // entered new sector via normal crossing
      currentSectorIdx: newSectorIdx,
      sectorEntryTime: crossingTime,
      lastSessionTime: sessionTime,
      sessionBestSectorTimes: newSessionBests,
      sectorColors: newColors,
      currentLapSectorTimes: newCurrentLapTimes,
      previousLapSectorTimes: newPreviousTimes,
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
      lastSessionTime: -1,
      sectorEntryValid: false,
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
      lastSessionTime: -1,
      sectorEntryValid: true,
      sectorColors: state.sectors.map(() => 'default' as SectorColor),
      currentLapSectorTimes: state.sectors.map(() => null),
      previousLapSectorTimes: state.sectors.map(() => null),
    })),

  invalidateLap: () =>
    set({
      sectorEntryValid: false,
      lastLapDistPct: -1,
      lastSessionTime: -1,
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
