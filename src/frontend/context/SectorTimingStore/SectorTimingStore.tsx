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
 *   S/F line), the time delta is recorded and compared against session/all-time
 *   bests to produce a color.
 *
 * Lap start protection:
 *   Sector times are only recorded after the player crosses the S/F line
 *   legitimately (lapStarted = true). A teleport, active reset, or off-track
 *   event sets lapStarted = false, requiring the player to complete a full
 *   S/F crossing before timing resumes.
 *
 * Color scheme (standard racing timing colours):
 *   purple  — all-time personal best for this sector
 *   green   — session best (not all-time)
 *   yellow  — within YELLOW_THRESHOLD seconds of session best
 *   red     — more than YELLOW_THRESHOLD slower than session best
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

  /**
   * True only after the player crosses the S/F line from the last sector into
   * sector 0. When false, tick() updates position tracking but does not record
   * sector times. This prevents partial-lap data from an active reset or
   * rejoining mid-track from polluting the timing results.
   */
  lapStarted: boolean;

  // Per-sector timing results (null = not yet completed)
  sessionBestSectorTimes: (number | null)[];
  allTimeBestSectorTimes: (number | null)[];

  // Colors to display for each sector (index = sector number)
  sectorColors: SectorColor[];

  // Called each telemetry tick with the player's current position and time
  tick: (lapDistPct: number, sessionTime: number, isOnTrack: boolean) => void;

  // Reset all timing data (e.g. on new session or track change)
  reset: () => void;
  // Reset current-lap state, keep session/all-time bests. Sets lapStarted=true
  // so the next sector crossing will be recorded (use for clean lap resets).
  resetLap: () => void;
  // Mark lap as invalid — requires S/F crossing before timing resumes.
  // Call when the player goes off-track or rejoins mid-track.
  invalidateLap: () => void;
  // Clear all-time best sector times and reset sector colors to default.
  clearAllTimeBests: () => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Sector time comparison — "yellow" if within this many seconds of session best.
 * Beyond this threshold the sector is "red".
 */
const YELLOW_THRESHOLD_SECONDS = 0.5;

/**
 * Minimum LapDistPct movement required between ticks to be considered
 * moving forward (guards against telemetry noise near 0.0).
 */
const MIN_PROGRESS = 0.0005;

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
 * Assign a performance color based on sector time vs. session/all-time bests.
 */
export function computeSectorColor(
  time: number,
  sessionBest: number | null,
  allTimeBest: number | null
): SectorColor {
  if (allTimeBest !== null && time <= allTimeBest) return 'purple';
  if (sessionBest !== null && time <= sessionBest) return 'green';
  if (sessionBest !== null && time - sessionBest <= YELLOW_THRESHOLD_SECONDS)
    return 'yellow';
  if (sessionBest !== null) return 'red';
  return 'default';
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
  allTimeBestSectorTimes: [],
  sectorColors: [],
  currentLapSectorTimes: [],

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
      allTimeBestSectorTimes: sorted.map(() => null),
      currentLapSectorTimes: sorted.map(() => null),
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
      const newAllTimeBests = [...state.allTimeBestSectorTimes];
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
        if (
          newAllTimeBests[completedIdx] === null ||
          sectorTime < (newAllTimeBests[completedIdx] as number)
        )
          newAllTimeBests[completedIdx] = sectorTime;

        newColors[completedIdx] = computeSectorColor(
          sectorTime,
          newSessionBests[completedIdx],
          newAllTimeBests[completedIdx]
        );
      }

      set({
        lapStarted: true,
        currentSectorIdx: 0,
        sectorEntryTime: sessionTime,
        lastLapDistPct: lapDistPct,
        sessionBestSectorTimes: newSessionBests,
        allTimeBestSectorTimes: newAllTimeBests,
        sectorColors: newColors,
        currentLapSectorTimes: sectors.map(() => null),
      });
      return;
    }

    // Ignore backwards movement (pits, replays) and suspiciously large jumps.
    // These indicate a teleport or active reset — invalidate the current lap.
    if (delta < MIN_PROGRESS || delta > MAX_FORWARD_JUMP) {
      set({ lapStarted: false, lastLapDistPct: lapDistPct });
      return;
    }

    set({ lastLapDistPct: lapDistPct });

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
    const newAllTimeBests = [...state.allTimeBestSectorTimes];

    // Update bests before computing color so the first completion
    // is correctly identified as a new personal best (purple).
    if (
      newSessionBests[completedIdx] === null ||
      sectorTime < (newSessionBests[completedIdx] as number)
    ) {
      newSessionBests[completedIdx] = sectorTime;
    }
    if (
      newAllTimeBests[completedIdx] === null ||
      sectorTime < (newAllTimeBests[completedIdx] as number)
    ) {
      newAllTimeBests[completedIdx] = sectorTime;
    }

    const color = computeSectorColor(
      sectorTime,
      newSessionBests[completedIdx],
      newAllTimeBests[completedIdx]
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
      allTimeBestSectorTimes: newAllTimeBests,
      sectorColors: newColors,
      currentLapSectorTimes: newCurrentLapTimes,
    });
  },

  reset: () =>
    set((state) => ({
      currentSectorIdx: 0,
      sectorEntryTime: 0,
      lastLapDistPct: -1,
      lapStarted: false,
      sessionBestSectorTimes: state.sectors.map(() => null),
      allTimeBestSectorTimes: state.sectors.map(() => null),
      sectorColors: state.sectors.map(() => 'default' as SectorColor),
      currentLapSectorTimes: state.sectors.map(() => null),
    })),

  resetLap: () =>
    set((state) => ({
      currentSectorIdx: 0,
      sectorEntryTime: 0,
      lastLapDistPct: -1,
      lapStarted: true,
      sectorColors: state.sectors.map(() => 'default' as SectorColor),
      currentLapSectorTimes: state.sectors.map(() => null),
    })),

  invalidateLap: () =>
    set({
      lapStarted: false,
      lastLapDistPct: -1,
    }),

  clearAllTimeBests: () =>
    set((state) => ({
      allTimeBestSectorTimes: state.sectors.map(() => null),
      sectorColors: state.sectors.map(() => 'default' as SectorColor),
    })),
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
      sessionBestSectorTimes: s.sessionBestSectorTimes,
      currentSectorIdx: s.currentSectorIdx,
    }),
    shallow
  );
