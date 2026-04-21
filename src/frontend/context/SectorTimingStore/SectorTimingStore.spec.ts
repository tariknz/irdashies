import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSectorTimingStore,
  getSectorIdx,
  computeSectorColor,
  interpolateCrossingTime,
} from './SectorTimingStore';

// ---------------------------------------------------------------------------
// Helper: reset the store state before each test
// ---------------------------------------------------------------------------

beforeEach(() => {
  useSectorTimingStore.getState().reset();
});

const MOCK_SECTORS = [
  { SectorNum: 0, SectorStartPct: 0 },
  { SectorNum: 1, SectorStartPct: 0.184456 },
  { SectorNum: 2, SectorStartPct: 0.337214 },
  { SectorNum: 3, SectorStartPct: 0.504637 },
  { SectorNum: 4, SectorStartPct: 0.734279 },
  { SectorNum: 5, SectorStartPct: 0.829332 },
];

// ---------------------------------------------------------------------------
// getSectorIdx
// ---------------------------------------------------------------------------

describe('getSectorIdx', () => {
  it('returns 0 when sectors is empty', () => {
    expect(getSectorIdx(0.5, [])).toBe(0);
  });

  it('returns 0 for pct at the start', () => {
    expect(getSectorIdx(0, MOCK_SECTORS)).toBe(0);
  });

  it('returns correct sector for a mid-sector pct', () => {
    expect(getSectorIdx(0.25, MOCK_SECTORS)).toBe(1); // between 0.184 and 0.337
    expect(getSectorIdx(0.6, MOCK_SECTORS)).toBe(3); // between 0.504 and 0.734
  });

  it('returns last sector for pct near end of track', () => {
    expect(getSectorIdx(0.9, MOCK_SECTORS)).toBe(5);
  });

  it('returns 0 for pct just before first sector boundary', () => {
    expect(getSectorIdx(0.001, MOCK_SECTORS)).toBe(0);
  });

  it('returns 1 exactly at the second sector start', () => {
    expect(getSectorIdx(0.184456, MOCK_SECTORS)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// computeSectorColor
// ---------------------------------------------------------------------------

describe('computeSectorColor', () => {
  it('returns default when no session best exists', () => {
    expect(computeSectorColor(25, null)).toBe('default');
  });

  it('returns purple when time equals session best', () => {
    expect(computeSectorColor(25, 25)).toBe('purple');
  });

  it('returns purple when time beats session best', () => {
    expect(computeSectorColor(24.9, 25)).toBe('purple');
  });

  it('returns green when within 0.5% of session best', () => {
    // 0.5% of 25s = 0.125s → 25.124 is within range
    expect(computeSectorColor(25.124, 25)).toBe('green');
  });

  it('returns yellow when between 0.5% and 1% of session best', () => {
    // 0.5% of 25s = 0.125s, 1% of 25s = 0.25s
    expect(computeSectorColor(25.2, 25)).toBe('yellow');
  });

  it('returns red when more than 1% slower than session best', () => {
    // 1% of 25s = 0.25s → 25.26 is over threshold
    expect(computeSectorColor(25.26, 25)).toBe('red');
    expect(computeSectorColor(30, 25)).toBe('red');
  });
});

// ---------------------------------------------------------------------------
// interpolateCrossingTime
// ---------------------------------------------------------------------------

describe('interpolateCrossingTime', () => {
  it('returns currTime when lapDistPct equals boundary exactly', () => {
    expect(interpolateCrossingTime(0.5, 0.4, 100, 0.5, 110)).toBeCloseTo(110);
  });

  it('interpolates correctly when boundary is between prev and curr', () => {
    // boundary midway → half of 10s gap = 5s from prevTime
    expect(interpolateCrossingTime(0.5, 0.4, 100, 0.6, 110)).toBeCloseTo(105);
  });

  it('interpolates near the start of the gap', () => {
    // boundary 10% through → 1s from prevTime
    expect(interpolateCrossingTime(0.41, 0.4, 100, 0.6, 120)).toBeCloseTo(101);
  });

  it('returns currTime when dPct is zero (degenerate guard)', () => {
    expect(interpolateCrossingTime(0.5, 0.5, 100, 0.5, 110)).toBeCloseTo(110);
  });

  it('handles S/F wrap-around with currPct + 1.0 convention', () => {
    // prevPct=0.9 at t=50, currPct+1=1.0 at t=65 → boundary=1.0 → fraction=1
    expect(interpolateCrossingTime(1.0, 0.9, 50, 0.0 + 1.0, 65)).toBeCloseTo(
      65
    );

    // prevPct=0.8 at t=100, currPct+1=1.05 at t=125 → boundary=1.0
    // fraction = (1.0-0.8)/(1.05-0.8) = 0.2/0.25 = 0.8
    expect(interpolateCrossingTime(1.0, 0.8, 100, 0.05 + 1.0, 125)).toBeCloseTo(
      120
    );
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — setSectors
// ---------------------------------------------------------------------------

describe('SectorTimingStore.setSectors', () => {
  it('initializes colors array with default for each sector', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    const { sectorColors, sectors } = useSectorTimingStore.getState();
    expect(sectors).toHaveLength(6);
    expect(sectorColors).toHaveLength(6);
    expect(sectorColors.every((c) => c === 'default')).toBe(true);
  });

  it('sorts sectors by SectorStartPct', () => {
    const unsorted = [
      { SectorNum: 2, SectorStartPct: 0.5 },
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.25 },
    ];
    useSectorTimingStore.getState().setSectors(unsorted);
    const { sectors } = useSectorTimingStore.getState();
    expect(sectors[0].SectorStartPct).toBe(0);
    expect(sectors[1].SectorStartPct).toBe(0.25);
    expect(sectors[2].SectorStartPct).toBe(0.5);
  });

  it('sets sectorEntryValid to false', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    expect(useSectorTimingStore.getState().sectorEntryValid).toBe(false);
  });

  it('does not reset timing when called again with identical sector data', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);

    // Complete a sector so we have real timing data
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary

    const beforeColors = useSectorTimingStore.getState().sectorColors.slice();
    const beforeBests = useSectorTimingStore
      .getState()
      .sessionBestSectorTimes.slice();

    // Simulate session data re-broadcast with the same sectors (new array reference)
    useSectorTimingStore.getState().setSectors([...MOCK_SECTORS]);

    const afterColors = useSectorTimingStore.getState().sectorColors;
    const afterBests = useSectorTimingStore.getState().sessionBestSectorTimes;

    expect(afterColors[0]).toBe(beforeColors[0]); // 'purple' preserved
    expect(afterBests[0]).toBeCloseTo(beforeBests[0] as number);
  });

  it('resets timing when sectors actually change (track change)', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary

    expect(useSectorTimingStore.getState().sectorColors[0]).toBe('purple');

    // Different sectors (different track)
    const differentSectors = [
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.5 },
    ];
    useSectorTimingStore.getState().setSectors(differentSectors);

    expect(useSectorTimingStore.getState().sectorColors).toHaveLength(2);
    expect(
      useSectorTimingStore.getState().sectorColors.every((c) => c === 'default')
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — tick / sector crossing
// ---------------------------------------------------------------------------

describe('SectorTimingStore.tick', () => {
  beforeEach(() => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
  });

  it('does nothing when not on track', () => {
    const store = useSectorTimingStore.getState();
    store.tick(0.1, 100, false);
    expect(store.lastLapDistPct).toBe(-1);
  });

  it('initializes position on first tick', () => {
    useSectorTimingStore.getState().tick(0.1, 100, true);
    const { lastLapDistPct, currentSectorIdx } =
      useSectorTimingStore.getState();
    expect(lastLapDistPct).toBeCloseTo(0.1);
    expect(currentSectorIdx).toBe(0);
  });

  it('does not record the first sector entered (unknown entry point)', () => {
    const store = useSectorTimingStore.getState();
    // First tick: position recorded, sectorEntryValid = false
    store.tick(0.01, 100, true);
    store.tick(0.184456, 110, true); // exactly at sector 1 boundary; sectorEntryValid=false → not recorded

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[0]).toBeNull();
    expect(state.sectorColors[0]).toBe('default');
    // Position tracking still updates: now in sector 1 with valid entry
    expect(state.currentSectorIdx).toBe(1);
    expect(state.sectorEntryValid).toBe(true);
  });

  it('records the second sector after joining mid-track', () => {
    const store = useSectorTimingStore.getState();
    // Join at start of sector 0, cross sector 1 (not recorded — unknown entry),
    // then cross sector 2 (recorded — entered sector 1 via normal crossing)
    store.tick(0.01, 100, true); // first tick
    store.tick(0.184456, 110, true); // exactly at sector 1 boundary; not recorded, sectorEntryValid=true
    store.tick(0.337214, 125, true); // exactly at sector 2 boundary; recorded (15s)

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[1]).toBeCloseTo(15);
    expect(state.sectorColors[1]).toBe('purple');
    expect(state.currentSectorIdx).toBe(2);
  });

  it('starts tracking after crossing the S/F line', () => {
    const store = useSectorTimingStore.getState();
    // Start in last sector (sector 5, pct >= 0.829332)
    store.tick(0.9, 50, true);
    // Cross S/F line exactly: wrap-around → sectorEntryValid = true
    store.tick(0.0, 60, true);

    const afterSF = useSectorTimingStore.getState();
    expect(afterSF.sectorEntryValid).toBe(true);
    expect(afterSF.currentSectorIdx).toBe(0);

    // Cross into sector 1 exactly — sectorEntryValid, so timing is recorded
    useSectorTimingStore.getState().tick(0.184456, 70, true);

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[0]).toBeCloseTo(10);
    expect(state.currentSectorIdx).toBe(1);
  });

  it('records the last sector time when crossing S/F', () => {
    const store = useSectorTimingStore.getState();
    useSectorTimingStore.getState().resetLap();
    store.tick(0.85, 50, true); // first tick: in sector 5
    // Drive through sector 5 and cross S/F exactly
    store.tick(0.0, 65, true); // wrap-around: records sector 5 (15s)

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[5]).toBeCloseTo(15);
    expect(state.sectorEntryValid).toBe(true);
    expect(state.currentSectorIdx).toBe(0);
  });

  it('keeps previous lap colors at S/F crossing — sectors update as completed on new lap (RaceLab-style)', () => {
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary → purple
    useSectorTimingStore.getState().tick(0.337214, 120, true); // exactly at sector 2 boundary → purple

    expect(useSectorTimingStore.getState().sectorColors[0]).toBe('purple');
    expect(useSectorTimingStore.getState().sectorColors[1]).toBe('purple');

    // Drive through remaining sectors exactly at boundaries, then cross S/F.
    useSectorTimingStore.getState().tick(0.504637, 150, true); // sector 3 boundary
    useSectorTimingStore.getState().tick(0.734279, 170, true); // sector 4 boundary
    useSectorTimingStore.getState().tick(0.829332, 190, true); // sector 5 boundary
    useSectorTimingStore.getState().tick(0.0, 210, true); // S/F exactly

    const colors = useSectorTimingStore.getState().sectorColors;
    expect(colors[0]).toBe('purple'); // carried over from last lap
    expect(colors[1]).toBe('purple'); // carried over from last lap
    expect(colors[5]).toBe('purple'); // just completed at S/F
    expect(
      useSectorTimingStore.getState().sessionBestSectorTimes[0]
    ).not.toBeNull();
  });

  it('records a sector crossing and assigns a color', () => {
    const store = useSectorTimingStore.getState();
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.184456, 110, true); // exactly at sector 1 boundary

    const updated = useSectorTimingStore.getState();
    expect(updated.currentSectorIdx).toBe(1);
    expect(updated.sectorColors[0]).toBe('purple');
    expect(updated.sessionBestSectorTimes[0]).toBeCloseTo(10);
  });

  it('turns purple when beating the previous session best', () => {
    const store = useSectorTimingStore.getState();
    // Lap 1: complete sector 0 in 10s
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.184456, 110, true); // exactly at sector 1 boundary

    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 200, true);
    // Lap 2: sector 0 in 9s — beats session best → purple
    useSectorTimingStore.getState().tick(0.184456, 209, true); // exactly at sector 1 boundary

    const updated = useSectorTimingStore.getState();
    expect(updated.sectorColors[0]).toBe('purple');
    expect(updated.sessionBestSectorTimes[0]).toBeCloseTo(9);
  });

  it('turns red when more than 1% slower than session best', () => {
    const store = useSectorTimingStore.getState();
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.184456, 110, true); // exactly at sector 1 boundary

    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 200, true);
    // Lap 2: sector 0 in 10.15s (1.5% slower — above 1% threshold)
    useSectorTimingStore.getState().tick(0.184456, 210.15, true); // exactly at sector 1 boundary

    const updated = useSectorTimingStore.getState();
    expect(updated.sectorColors[0]).toBe('red');
  });

  it('turns yellow when between 0.5% and 1% slower than session best', () => {
    const store = useSectorTimingStore.getState();
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.184456, 110, true); // exactly at sector 1 boundary

    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 200, true);
    // Lap 2: sector 0 in 10.08s (0.8% slower)
    useSectorTimingStore.getState().tick(0.184456, 210.08, true); // exactly at sector 1 boundary

    const updated = useSectorTimingStore.getState();
    expect(updated.sectorColors[0]).toBe('yellow');
  });

  it('detects backward movement as a teleport and updates position', () => {
    const store = useSectorTimingStore.getState();
    store.tick(0.5, 100, true); // first tick: sector 2
    store.tick(0.1, 101, true); // backward → teleport detected
    const state = useSectorTimingStore.getState();
    // Position updated to where the player actually is
    expect(state.currentSectorIdx).toBe(0); // getSectorIdx(0.1) = 0
    expect(state.sectorEntryValid).toBe(false);
  });

  it('sets sectorEntryValid to false on backward movement', () => {
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.5, 100, true);
    useSectorTimingStore.getState().tick(0.1, 101, true); // backward jump
    expect(useSectorTimingStore.getState().sectorEntryValid).toBe(false);
  });

  it('does not record sector time on backward movement', () => {
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true); // sector 0
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary → purple
    useSectorTimingStore.getState().tick(0.1, 111, true); // backward into sector 0
    // sector 1 entry was valid — reset doesn't corrupt that
    expect(
      useSectorTimingStore.getState().sessionBestSectorTimes[0]
    ).toBeCloseTo(10);
  });

  it('detects large forward jumps as teleports and updates position', () => {
    const store = useSectorTimingStore.getState();
    store.tick(0.01, 100, true);
    // Jump of 0.8 — above MAX_FORWARD_JUMP (0.1)
    store.tick(0.81, 101, true);
    const { currentSectorIdx, sectorEntryValid } =
      useSectorTimingStore.getState();
    // Position updated to where the player actually is
    // getSectorIdx(0.81) = 4 (sector 5 starts at 0.829332, so 0.81 is still in sector 4)
    expect(currentSectorIdx).toBe(4);
    expect(sectorEntryValid).toBe(false);
  });

  it('sets sectorEntryValid to false on large forward jump', () => {
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.81, 101, true); // large jump
    expect(useSectorTimingStore.getState().sectorEntryValid).toBe(false);
  });

  it('does not treat a mid-track backward jump as a S/F crossing', () => {
    const store = useSectorTimingStore.getState();
    store.tick(0.6, 100, true);
    store.tick(0.05, 101, true);
    const state = useSectorTimingStore.getState();
    // Treated as teleport, not a wrap-around
    expect(state.sectorEntryValid).toBe(false);
    expect(state.currentSectorIdx).toBe(0); // updated to sector of 0.05
  });

  it('does NOT reset sectorEntryValid on slow forward movement (25 Hz real-session fix)', () => {
    useSectorTimingStore.getState().resetLap(); // sectorEntryValid = true
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.0103, 100.04, true); // +0.0003
    useSectorTimingStore.getState().tick(0.0106, 100.08, true); // +0.0003
    useSectorTimingStore.getState().tick(0.0109, 100.12, true); // +0.0003
    expect(useSectorTimingStore.getState().sectorEntryValid).toBe(true);
  });

  it('records sector times at 25 Hz update rate after S/F crossing', () => {
    const store = useSectorTimingStore.getState();
    store.tick(0.9, 50, true);
    // Use 0.01 (not 0.0) so the while-loop's first 0.0003 step doesn't produce
    // a speed spike vs. a 0.0 baseline that would trigger teleport detection.
    store.tick(0.01, 60, true); // wrap-around → sectorEntryValid = true
    expect(useSectorTimingStore.getState().sectorEntryValid).toBe(true);

    let t = 60;
    let pct = 0.01;
    while (pct < 0.19) {
      pct += 0.0003;
      t += 0.04;
      useSectorTimingStore.getState().tick(pct, t, true);
    }

    const state = useSectorTimingStore.getState();
    expect(state.sectorEntryValid).toBe(true);
    expect(state.sessionBestSectorTimes[0]).not.toBeNull();
    expect(state.currentSectorIdx).toBe(1);
  });

  it('updates previousLapSectorTimes immediately when each sector is completed', () => {
    useSectorTimingStore.getState().setSectors([
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.4 },
      { SectorNum: 2, SectorStartPct: 0.7 },
    ]);
    useSectorTimingStore.getState().resetLap();

    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.4, 110, true); // exactly at sector 1 boundary: completes sector 0 (10s)

    // previousLapSectorTimes updated immediately — no need to wait for S/F
    expect(
      useSectorTimingStore.getState().previousLapSectorTimes[0]
    ).toBeCloseTo(10);
    expect(
      useSectorTimingStore.getState().previousLapSectorTimes[1]
    ).toBeNull();

    useSectorTimingStore.getState().tick(0.7, 125, true); // exactly at sector 2 boundary: completes sector 1 (15s)

    expect(
      useSectorTimingStore.getState().previousLapSectorTimes[1]
    ).toBeCloseTo(15);
  });

  it('preserves previousLapSectorTimes across S/F crossing', () => {
    useSectorTimingStore.getState().setSectors([
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.4 },
      { SectorNum: 2, SectorStartPct: 0.7 },
    ]);
    useSectorTimingStore.getState().resetLap();

    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.4, 110, true); // exactly at sector 1 boundary: sector 0 = 10s
    useSectorTimingStore.getState().tick(0.7, 125, true); // exactly at sector 2 boundary: sector 1 = 15s
    useSectorTimingStore.getState().tick(0.0, 145, true); // S/F exactly: sector 2 = 20s

    const state = useSectorTimingStore.getState();
    // currentLapSectorTimes reset for new lap
    expect(state.currentLapSectorTimes[0]).toBeNull();
    expect(state.currentLapSectorTimes[1]).toBeNull();
    expect(state.currentLapSectorTimes[2]).toBeNull();
    // previousLapSectorTimes holds most recent valid times
    expect(state.previousLapSectorTimes[0]).toBeCloseTo(10);
    expect(state.previousLapSectorTimes[1]).toBeCloseTo(15);
    expect(state.previousLapSectorTimes[2]).toBeCloseTo(20);
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — reset
// ---------------------------------------------------------------------------

describe('SectorTimingStore.reset', () => {
  it('clears all timing data but keeps sectors', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary

    useSectorTimingStore.getState().reset();
    const {
      sectors,
      sectorColors,
      sessionBestSectorTimes,
      lastLapDistPct,
      sectorEntryValid,
    } = useSectorTimingStore.getState();

    expect(sectors).toHaveLength(6);
    expect(sectorColors.every((c) => c === 'default')).toBe(true);
    expect(sessionBestSectorTimes.every((t) => t === null)).toBe(true);
    expect(lastLapDistPct).toBe(-1);
    expect(sectorEntryValid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — invalidateLap (off-track / active reset)
// ---------------------------------------------------------------------------

// 3-sector track used for active-reset tests
const THREE_SECTORS = [
  { SectorNum: 0, SectorStartPct: 0 },
  { SectorNum: 1, SectorStartPct: 0.33 },
  { SectorNum: 2, SectorStartPct: 0.67 },
];

describe('SectorTimingStore.invalidateLap', () => {
  it('sets sectorEntryValid to false and resets position tracking', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);

    useSectorTimingStore.getState().invalidateLap();
    const state = useSectorTimingStore.getState();
    expect(state.sectorEntryValid).toBe(false);
    expect(state.lastLapDistPct).toBe(-1);
  });

  it('does not touch currentLapSectorTimes or previousLapSectorTimes', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary; records 10s

    useSectorTimingStore.getState().invalidateLap();

    const state = useSectorTimingStore.getState();
    // Good sector 0 time is preserved
    expect(state.currentLapSectorTimes[0]).toBeCloseTo(10);
    expect(state.previousLapSectorTimes[0]).toBeCloseTo(10);
  });

  it('requires normal crossing to resume recording after invalidation', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary; records 10s

    useSectorTimingStore.getState().invalidateLap();

    // Rejoin mid-track: first crossing after invalidate is not recorded
    useSectorTimingStore.getState().tick(0.4, 200, true); // first tick
    useSectorTimingStore.getState().tick(0.6, 210, true); // crossing — NOT recorded

    const state = useSectorTimingStore.getState();
    // sector 2 should not have been recorded (sectorEntryValid was false)
    expect(state.sessionBestSectorTimes[2]).toBeNull();
    // sectorEntryValid is now true (crossing sets it true)
    expect(state.sectorEntryValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — active reset (tick-based teleport detection)
// ---------------------------------------------------------------------------

// Active reset ticks must have a small timeDelta so the speed check triggers.
// Normal driving ticks use large timeDelta (30s for 0.33 of lap = 0.011/s << 0.08).
// Teleport ticks use timeDelta=1s (e.g. 0.46 lap in 1s = 0.46/s >> 0.08).
describe('SectorTimingStore — active reset via tick', () => {
  it('only clears the teleported-into sector, preserves sector 0', () => {
    const store = useSectorTimingStore.getState();
    store.setSectors(THREE_SECTORS);
    store.resetLap();

    // Drive sector 0 (large timeDelta → speed 0.33/30 = 0.011/s < 0.08 → not teleport)
    store.tick(0.01, 100, true);
    store.tick(0.33, 130, true); // exactly at sector 1 boundary: records 30s.

    // Active reset from sector 1 (0.33) to sector 2 final (0.80).
    // delta=0.47, timeDelta=1s → speed=0.47 >> 0.08 → teleport detected.
    store.tick(0.8, 131, true);

    const state = useSectorTimingStore.getState();
    // Sector 0 was completed before the reset — preserved
    expect(state.currentLapSectorTimes[0]).toBeCloseTo(30);
    expect(state.previousLapSectorTimes[0]).toBeCloseTo(30);
    // Sector 1 never completed (teleported before leaving it) — null
    expect(state.currentLapSectorTimes[1]).toBeNull();
    // Sector 2 cleared by teleport
    expect(state.currentLapSectorTimes[2]).toBeNull();
    expect(state.sectorEntryValid).toBe(false);
    expect(state.currentSectorIdx).toBe(2);
  });

  it('does not record the teleported-into sector when crossing out of it', () => {
    const store = useSectorTimingStore.getState();
    store.setSectors(THREE_SECTORS);
    store.resetLap();

    // Drive sector 0 (30s)
    store.tick(0.01, 100, true);
    store.tick(0.33, 130, true); // exactly at sector 1 boundary: sector 0 complete.

    // Teleport from sector 1 (0.33) to sector 2 (0.80): speed=0.47/s >> 0.08
    store.tick(0.8, 131, true); // sectorEntryValid = false

    // Drive through rest of sector 2 — should NOT record sector 2
    store.tick(0.05, 145, true); // S/F: sectorEntryValid=false → no record

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[2]).toBeNull(); // never recorded
    expect(state.sectorEntryValid).toBe(true); // S/F sets valid for sector 0
    expect(state.currentSectorIdx).toBe(0);
  });

  it('preserves previousLapSectorTimes across two consecutive active resets', () => {
    const store = useSectorTimingStore.getState();
    store.setSectors(THREE_SECTORS);
    store.resetLap();

    // Drive sector 0 and 1 (large timeDelta → not teleport)
    store.tick(0.01, 100, true);
    store.tick(0.33, 130, true); // exactly at sector 1 boundary: sector 0 = 30s
    store.tick(0.67, 155, true); // exactly at sector 2 boundary: sector 1 = 25s

    // First active reset: from sector 2 entry (0.67) forward is too small.
    // Simulate being in sector 1 before the S/F and then reset to sector 2:
    // Actually, at this point player just crossed into sector 2. Drive a small
    // amount then teleport to simulate reset from within sector 2 to final area.
    // Use a fresh lap crossing to set up: cross S/F normally from a good lap,
    // then simulate the sector 1→final teleport on the next lap.
    store.tick(0.0, 200, true); // S/F exactly (sector 2 recorded if valid)

    // Now on new lap. previousLapSectorTimes[2] should be set.
    // Simulate active reset: player at 0.0 (sector 0) jumps to 0.80 (sector 2).
    // delta=0.80, timeDelta=1s → speed=0.80 >> 0.08 → teleport.
    store.tick(0.8, 201, true);

    expect(
      useSectorTimingStore.getState().previousLapSectorTimes[0]
    ).toBeCloseTo(30);
    expect(
      useSectorTimingStore.getState().previousLapSectorTimes[1]
    ).toBeCloseTo(25);
    expect(useSectorTimingStore.getState().sectorEntryValid).toBe(false);

    // Second active reset: still at 0.80, drive to S/F, then reset again.
    store.tick(0.05, 215, true); // S/F: sector 2 not recorded (sectorEntryValid=false)
    store.tick(0.8, 216, true); // second teleport: delta=0.75, timeDelta=1s → teleport

    store.tick(0.05, 230, true); // S/F: not recorded

    const state = useSectorTimingStore.getState();
    // previousLapSectorTimes preserved across both resets
    expect(state.previousLapSectorTimes[0]).toBeCloseTo(30);
    expect(state.previousLapSectorTimes[1]).toBeCloseTo(25);
  });

  it('correctly times sectors driven normally after an active reset', () => {
    const store = useSectorTimingStore.getState();
    store.setSectors(THREE_SECTORS);
    store.resetLap();

    // Drive sector 0 (30s), then teleport to sector 2
    store.tick(0.01, 100, true);
    store.tick(0.33, 130, true); // exactly at sector 1 boundary: sector 0 = 30s.
    store.tick(0.8, 131, true); // teleport: speed=0.47/s >> 0.08

    // Drive through sector 2 and cross S/F exactly (sector 2 not recorded)
    store.tick(0.0, 145, true); // S/F exactly: sectorEntryValid=true for sector 0

    // Drive sector 0 on the new lap (25s)
    store.tick(0.33, 170, true); // exactly at sector 1 boundary: sector 0 = 25s (145→170)
    store.tick(0.67, 190, true); // exactly at sector 2 boundary: sector 1 = 20s

    const state = useSectorTimingStore.getState();
    expect(state.currentLapSectorTimes[0]).toBeCloseTo(25);
    expect(state.sessionBestSectorTimes[0]).toBeCloseTo(25); // 25 < 30
    expect(state.currentLapSectorTimes[1]).toBeCloseTo(20);
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — reset clears session bests
// ---------------------------------------------------------------------------

describe('SectorTimingStore.reset clears session bests', () => {
  it('clears session bests and sector colors on full reset', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);

    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.184456, 110, true); // exactly at sector 1 boundary

    expect(useSectorTimingStore.getState().sectorColors[0]).toBe('purple');
    expect(
      useSectorTimingStore.getState().sessionBestSectorTimes[0]
    ).toBeCloseTo(10);

    useSectorTimingStore.getState().reset();

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes.every((t) => t === null)).toBe(true);
    expect(state.sectorColors.every((c) => c === 'default')).toBe(true);
  });
});
