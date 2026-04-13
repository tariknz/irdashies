import { describe, it, expect, beforeEach } from 'vitest';
import {
  useSectorTimingStore,
  getSectorIdx,
  computeSectorColor,
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

  it('sets lapStarted to false', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    expect(useSectorTimingStore.getState().lapStarted).toBe(false);
  });

  it('does not reset timing when called again with identical sector data', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);

    // Complete a sector so we have real timing data
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.19, 110, true);

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
    useSectorTimingStore.getState().tick(0.19, 110, true);

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

  it('does not record sector times before crossing the S/F line', () => {
    const store = useSectorTimingStore.getState();
    // Start mid-track without a prior S/F crossing — lapStarted is false
    store.tick(0.01, 100, true);
    store.tick(0.19, 110, true); // sector 0→1 crossing, but lapStarted=false

    const state = useSectorTimingStore.getState();
    expect(state.lapStarted).toBe(false);
    expect(state.sessionBestSectorTimes[0]).toBeNull();
    expect(state.sectorColors[0]).toBe('default');
    // Position is still tracked even without lapStarted
    expect(state.currentSectorIdx).toBe(1);
  });

  it('starts tracking after crossing the S/F line', () => {
    const store = useSectorTimingStore.getState();
    // Start in last sector (sector 5, pct >= 0.829332)
    store.tick(0.9, 50, true);
    // Cross S/F line: lastLapDistPct=0.9 (in sector 5), lapDistPct=0.01 (in sector 0)
    store.tick(0.01, 60, true); // wrap-around → lapStarted = true

    const afterSF = useSectorTimingStore.getState();
    expect(afterSF.lapStarted).toBe(true);
    expect(afterSF.currentSectorIdx).toBe(0);

    // Cross into sector 1 — now lapStarted, so timing is recorded
    useSectorTimingStore.getState().tick(0.19, 70, true);

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[0]).toBeCloseTo(10);
    expect(state.currentSectorIdx).toBe(1);
  });

  it('records the last sector time when crossing S/F', () => {
    const store = useSectorTimingStore.getState();
    // Start a valid lap via resetLap so lapStarted = true
    useSectorTimingStore.getState().resetLap();
    store.tick(0.85, 50, true); // first tick: in sector 5
    // Drive through sector 5 and cross S/F
    store.tick(0.01, 65, true); // wrap-around: records sector 5 (15s)

    const state = useSectorTimingStore.getState();
    expect(state.sessionBestSectorTimes[5]).toBeCloseTo(15);
    expect(state.lapStarted).toBe(true);
    expect(state.currentSectorIdx).toBe(0);
  });

  it('keeps previous lap colors at S/F crossing — sectors update as completed on new lap (RaceLab-style)', () => {
    // Complete sectors 0 and 1, then drive to the last sector and cross S/F.
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.19, 110, true); // sector 0 → purple
    useSectorTimingStore.getState().tick(0.35, 120, true); // sector 1 → purple

    expect(useSectorTimingStore.getState().sectorColors[0]).toBe('purple');
    expect(useSectorTimingStore.getState().sectorColors[1]).toBe('purple');

    // Drive incrementally through remaining sectors (each step < MAX_FORWARD_JUMP=0.5)
    // so lapStarted stays true, then cross S/F.
    useSectorTimingStore.getState().tick(0.55, 150, true); // crosses into sector 3
    useSectorTimingStore.getState().tick(0.75, 170, true); // crosses into sector 4
    useSectorTimingStore.getState().tick(0.85, 190, true); // crosses into sector 5
    useSectorTimingStore.getState().tick(0.01, 210, true); // wrap-around → sector 5 gets its color

    // Sectors completed last lap (0, 1) should still show their colors from
    // last lap rather than going blank — they'll update as the player crosses
    // them on the new lap.
    const colors = useSectorTimingStore.getState().sectorColors;
    expect(colors[0]).toBe('purple'); // carried over from last lap
    expect(colors[1]).toBe('purple'); // carried over from last lap
    // The last sector (5) just got colored at S/F
    expect(colors[5]).toBe('purple');
    // Timing bests are preserved for comparison
    expect(
      useSectorTimingStore.getState().sessionBestSectorTimes[0]
    ).not.toBeNull();
  });

  it('records a sector crossing and assigns a color', () => {
    const store = useSectorTimingStore.getState();
    // Establish lapStarted via resetLap before any crossing
    useSectorTimingStore.getState().resetLap();
    // Start in sector 0
    store.tick(0.01, 100, true);
    // Cross into sector 1 (starts at 0.184456)
    store.tick(0.19, 110, true);

    const updated = useSectorTimingStore.getState();
    expect(updated.currentSectorIdx).toBe(1);
    // First completion — it IS the session best, so color should be 'purple'
    expect(updated.sectorColors[0]).toBe('purple');
    // Session best should now be set for sector 0
    expect(updated.sessionBestSectorTimes[0]).toBeCloseTo(10);
  });

  it('turns purple when beating the previous session best', () => {
    const store = useSectorTimingStore.getState();
    // Lap 1: complete sector 0 in 10s — sets session best to 10s
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.19, 110, true); // purple (first completion = new session best)

    // Reset lap (keeps session bests)
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 200, true);
    // Lap 2: sector 0 in 9s — beats session best → purple
    useSectorTimingStore.getState().tick(0.19, 209, true);

    const updated = useSectorTimingStore.getState();
    expect(updated.sectorColors[0]).toBe('purple');
    expect(updated.sessionBestSectorTimes[0]).toBeCloseTo(9);
  });

  it('turns red when more than 1% slower than session best', () => {
    const store = useSectorTimingStore.getState();
    // Lap 1: sector 0 in 10s
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.19, 110, true);

    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 200, true);
    // Lap 2: sector 0 in 10.15s (1.5% slower — above 1% threshold)
    useSectorTimingStore.getState().tick(0.19, 210.15, true);

    const updated = useSectorTimingStore.getState();
    expect(updated.sectorColors[0]).toBe('red');
  });

  it('turns yellow when between 0.5% and 1% slower than session best', () => {
    const store = useSectorTimingStore.getState();
    // Lap 1: sector 0 in 10s
    useSectorTimingStore.getState().resetLap();
    store.tick(0.01, 100, true);
    store.tick(0.19, 110, true);

    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 200, true);
    // Lap 2: sector 0 in 10.08s (0.8% slower — between 0.5% and 1%)
    useSectorTimingStore.getState().tick(0.19, 210.08, true);

    const updated = useSectorTimingStore.getState();
    expect(updated.sectorColors[0]).toBe('yellow');
  });

  it('ignores backward movement (teleport/reset guard)', () => {
    const store = useSectorTimingStore.getState();
    // 0.5 is in sector 2 (0.337214) — sector 3 starts at 0.504637
    store.tick(0.5, 100, true);
    // Move backwards — should be ignored (not a S/F wrap-around)
    store.tick(0.1, 101, true);
    const { currentSectorIdx } = useSectorTimingStore.getState();
    expect(currentSectorIdx).toBe(2); // still in sector 2
  });

  it('sets lapStarted to false on backward movement', () => {
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.5, 100, true);
    useSectorTimingStore.getState().tick(0.1, 101, true); // backward jump
    expect(useSectorTimingStore.getState().lapStarted).toBe(false);
  });

  it('ignores suspiciously large forward jumps', () => {
    const store = useSectorTimingStore.getState();
    store.tick(0.01, 100, true);
    // Jump of 0.8 — above MAX_FORWARD_JUMP
    store.tick(0.81, 101, true);
    // Should not cross sectors based on a teleport
    const { currentSectorIdx } = useSectorTimingStore.getState();
    expect(currentSectorIdx).toBe(0);
  });

  it('sets lapStarted to false on large forward jump', () => {
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.81, 101, true); // large jump
    expect(useSectorTimingStore.getState().lapStarted).toBe(false);
  });

  it('does not treat a mid-track backward jump as a S/F crossing', () => {
    const store = useSectorTimingStore.getState();
    // Start in sector 3 (not last sector) — not a S/F wrap-around
    store.tick(0.6, 100, true);
    // Jump backwards past sector 0 boundary
    store.tick(0.05, 101, true);
    const state = useSectorTimingStore.getState();
    // Should be treated as backwards movement, not a wrap-around
    expect(state.lapStarted).toBe(false);
    // currentSectorIdx unchanged from first tick
    expect(state.currentSectorIdx).toBe(3);
  });

  it('does NOT reset lapStarted on slow forward movement (25 Hz real-session fix)', () => {
    // At ~25 Hz on a typical road course, per-tick LapDistPct delta is ~0.0003,
    // which is below the old MIN_PROGRESS (0.0005). The fix ensures slow forward
    // movement never invalidates an in-progress lap.
    useSectorTimingStore.getState().resetLap(); // lapStarted = true
    useSectorTimingStore.getState().tick(0.01, 100, true); // first tick, sector 0
    // Simulate several 25 Hz ticks with very small (but positive) deltas
    useSectorTimingStore.getState().tick(0.0103, 100.04, true); // +0.0003
    useSectorTimingStore.getState().tick(0.0106, 100.08, true); // +0.0003
    useSectorTimingStore.getState().tick(0.0109, 100.12, true); // +0.0003
    expect(useSectorTimingStore.getState().lapStarted).toBe(true);
  });

  it('records sector times at 25 Hz update rate after S/F crossing', () => {
    // Simulate a real session: wrap-around sets lapStarted=true, then small-delta
    // ticks should still allow sector crossings to be detected and recorded.
    const store = useSectorTimingStore.getState();
    // Start in last sector (sector 5, pct >= 0.829332)
    store.tick(0.9, 50, true);
    // Cross S/F line (wrap-around) → lapStarted = true
    store.tick(0.01, 60, true);
    expect(useSectorTimingStore.getState().lapStarted).toBe(true);

    // Simulate 25 Hz ticks with small deltas (real-world road course speed)
    // Advance slowly through sector 0 until sector 1 boundary (0.184456)
    const state0 = useSectorTimingStore.getState();
    let t = 60;
    let pct = 0.01;
    while (pct < 0.19) {
      pct += 0.0003; // ~25 Hz at typical road course speed
      t += 0.04;
      useSectorTimingStore.getState().tick(pct, t, true);
    }

    const state = useSectorTimingStore.getState();
    // lapStarted must still be true — slow movement should not invalidate it
    expect(state.lapStarted).toBe(true);
    // Sector 0 must have been recorded when crossing into sector 1
    expect(state.sessionBestSectorTimes[0]).not.toBeNull();
    expect(state.currentSectorIdx).toBe(1);
    void state0; // suppress unused variable warning
  });

  it('preserves previous lap sector times at S/F crossing so sectors not yet reached show last-lap values', () => {
    // Complete a lap with known sector times, then cross S/F and verify
    // that previousLapSectorTimes holds the completed-lap values while
    // currentLapSectorTimes is reset to null.
    useSectorTimingStore.getState().setSectors([
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 0.4 },
      { SectorNum: 2, SectorStartPct: 0.7 },
    ]);
    useSectorTimingStore.getState().resetLap();

    // Sector 0: 0.01 → 0.45 at t=100→110 (10s)
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.45, 110, true); // completes sector 0

    // Sector 1: 0.45 → 0.75 at t=110→125 (15s)
    useSectorTimingStore.getState().tick(0.75, 125, true); // completes sector 1

    // Sector 2 (last): cross S/F at t=145 (20s for sector 2)
    useSectorTimingStore.getState().tick(0.05, 145, true); // wrap-around

    const state = useSectorTimingStore.getState();
    // Current lap starts fresh
    expect(state.currentLapSectorTimes[0]).toBeNull();
    expect(state.currentLapSectorTimes[1]).toBeNull();
    expect(state.currentLapSectorTimes[2]).toBeNull();
    // Previous lap times are preserved
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
    useSectorTimingStore.getState().tick(0.19, 110, true);

    useSectorTimingStore.getState().reset();
    const {
      sectors,
      sectorColors,
      sessionBestSectorTimes,
      lastLapDistPct,
      lapStarted,
    } = useSectorTimingStore.getState();

    expect(sectors).toHaveLength(6);
    expect(sectorColors.every((c) => c === 'default')).toBe(true);
    expect(sessionBestSectorTimes.every((t) => t === null)).toBe(true);
    expect(lastLapDistPct).toBe(-1);
    expect(lapStarted).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — invalidateLap
// ---------------------------------------------------------------------------

describe('SectorTimingStore.invalidateLap', () => {
  it('sets lapStarted to false and resets position tracking', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap(); // lapStarted = true
    useSectorTimingStore.getState().tick(0.01, 100, true);

    useSectorTimingStore.getState().invalidateLap();
    const state = useSectorTimingStore.getState();
    expect(state.lapStarted).toBe(false);
    expect(state.lastLapDistPct).toBe(-1);
  });

  it('requires S/F crossing to resume recording after invalidation', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.19, 110, true); // records 10s

    // Player goes off-track
    useSectorTimingStore.getState().invalidateLap();

    // Rejoin mid-track and cross sectors — should NOT record
    useSectorTimingStore.getState().tick(0.4, 200, true); // first tick after invalidate
    useSectorTimingStore.getState().tick(0.6, 210, true); // sector crossing, lapStarted=false

    const state = useSectorTimingStore.getState();
    // sector 2 should not have been recorded
    expect(state.sessionBestSectorTimes[2]).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// SectorTimingStore — reset clears session bests
// ---------------------------------------------------------------------------

describe('SectorTimingStore.reset clears session bests', () => {
  it('clears session bests and sector colors on full reset', () => {
    useSectorTimingStore.getState().setSectors(MOCK_SECTORS);

    // Complete a sector to set a session best
    useSectorTimingStore.getState().resetLap();
    useSectorTimingStore.getState().tick(0.01, 100, true);
    useSectorTimingStore.getState().tick(0.19, 110, true);

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
