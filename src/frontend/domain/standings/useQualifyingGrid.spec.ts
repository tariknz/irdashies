import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  normalizeQualifyingResults,
  qualifyingGridSlots,
} from './useQualifyingGrid';
import type { SessionQualifyPosition, SessionResults } from '@irdashies/types';

vi.mock('@irdashies/context', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@irdashies/context')>();
  return {
    ...actual,
    useStandingsSnapshot: vi.fn(),
    useSessionQualifyingResults: vi.fn(),
    useSessionQualifyPositions: vi.fn(),
  };
});

const {
  useStandingsSnapshot,
  useSessionQualifyingResults,
  useSessionQualifyPositions,
} = await import('@irdashies/context');
const { useQualifyingGrid, useQualifyingResults } =
  await import('./useQualifyingGrid');

const qualifyResult = (
  carIdx: number,
  classPosition: number,
  overrides: Partial<SessionResults> = {}
): SessionResults => ({
  Position: classPosition + 1,
  ClassPosition: classPosition,
  CarIdx: carIdx,
  Lap: 1,
  Time: 90,
  FastestLap: 1,
  FastestTime: 90,
  LastTime: 90,
  LapsLed: 0,
  LapsComplete: 1,
  JokerLapsComplete: 0,
  LapsDriven: 1,
  Incidents: 0,
  ReasonOutId: 0,
  ReasonOutStr: 'Running',
  ...overrides,
});

const qualifyPosition = (
  carIdx: number,
  classPosition: number
): SessionQualifyPosition => ({
  Position: classPosition + 1,
  ClassPosition: classPosition,
  CarIdx: carIdx,
  FastestLap: 1,
  FastestTime: 90,
});

describe('normalizeQualifyingResults', () => {
  it('uses the qualifying results as-is when present', () => {
    const raw = [qualifyResult(0, 0), qualifyResult(1, 1)];

    expect(normalizeQualifyingResults(raw, undefined)).toBe(raw);
  });

  it('falls back to QualifyPositions for a heat race, mapping shapes across', () => {
    const positions = [qualifyPosition(4, 2)];

    const result = normalizeQualifyingResults([], positions);

    expect(result).toEqual([
      {
        Position: 4,
        ClassPosition: 2,
        CarIdx: 4,
        Lap: 1,
        Time: 90,
        FastestLap: 1,
        FastestTime: 90,
        LastTime: -1,
        LapsLed: 0,
        LapsComplete: 0,
        JokerLapsComplete: 0,
        LapsDriven: 0,
        Incidents: 0,
        ReasonOutId: 0,
        ReasonOutStr: 'Running',
      },
    ]);
  });

  it('falls back when raw results is undefined, not just empty', () => {
    const positions = [qualifyPosition(0, 0)];

    expect(normalizeQualifyingResults(undefined, positions)).toEqual([
      expect.objectContaining({ CarIdx: 0, ClassPosition: 0 }),
    ]);
  });

  it('returns undefined when there is no qualifying data at all', () => {
    expect(normalizeQualifyingResults(undefined, undefined)).toBeUndefined();
    expect(normalizeQualifyingResults([], undefined)).toBeUndefined();
  });
});

describe('qualifyingGridSlots', () => {
  it('assigns ClassPosition + 1 for every driver with a result', () => {
    const results = [
      qualifyResult(10, 0),
      qualifyResult(11, 1),
      qualifyResult(12, 2),
    ];

    const slots = qualifyingGridSlots(results, [10, 11, 12]);

    expect(slots.get(10)).toBe(1);
    expect(slots.get(11)).toBe(2);
    expect(slots.get(12)).toBe(3);
  });

  it('places cars missing from qualifying data past the qualified field, by carIdx', () => {
    const results = [qualifyResult(5, 0), qualifyResult(9, 1)];

    const slots = qualifyingGridSlots(results, [5, 9, 7, 3]);

    expect(slots.get(5)).toBe(1);
    expect(slots.get(9)).toBe(2);
    // Highest qualified slot is 2, so unqualified cars start at 3 + carIdx.
    expect(slots.get(3)).toBe(6);
    expect(slots.get(7)).toBe(10);
  });

  it('keeps every slot unchanged when another car leaves the roster', () => {
    const results = [qualifyResult(5, 0)];
    const full = qualifyingGridSlots(results, [5, 3, 9, 14]);

    // Car 9 retires and drops out of the standings list.
    const reduced = qualifyingGridSlots(results, [5, 3, 14]);

    for (const carIdx of [5, 3, 14]) {
      expect(reduced.get(carIdx)).toBe(full.get(carIdx));
    }
  });

  it('keeps unqualified slots unchanged when the whole roster shrinks', () => {
    const full = qualifyingGridSlots(undefined, [2, 5, 9, 14]);
    const reduced = qualifyingGridSlots(undefined, [2, 9, 14]);

    // The bug this guards: ranking unqualified cars against the current
    // roster shifted 9 and 14 down a slot when 5 disappeared, restyling
    // their lines mid-race.
    expect(reduced.get(9)).toBe(full.get(9));
    expect(reduced.get(14)).toBe(full.get(14));
  });

  it('assigns distinct slots from carIdx alone when there is no qualifying data whatsoever', () => {
    const slots = qualifyingGridSlots(undefined, [40, 2, 17]);

    expect(slots.get(2)).toBe(3);
    expect(slots.get(17)).toBe(18);
    expect(slots.get(40)).toBe(41);
    expect(new Set(slots.values()).size).toBe(3);
  });

  it('handles partial data: some cars in results, some entirely absent', () => {
    const results = [qualifyResult(1, 4)]; // ClassPosition 4 -> slot 5

    const slots = qualifyingGridSlots(results, [1, 2, 3]);

    expect(slots.get(1)).toBe(5);
    // Unqualified cars sit past the highest known slot, at 6 + carIdx.
    expect(slots.get(2)).toBe(8);
    expect(slots.get(3)).toBe(9);
  });

  it.each([
    ['NaN', Number.NaN],
    ['negative', -1],
    ['null', null as unknown as number],
  ])('treats a %s ClassPosition as no result', (_label, classPosition) => {
    const results = [qualifyResult(1, 0, { ClassPosition: classPosition })];

    const slots = qualifyingGridSlots(results, [1]);

    // Falls through to the unqualified branch (0 + 1 + carIdx), rather than
    // indexing the palette negatively or inheriting the pole sitter's slot.
    expect(slots.get(1)).toBe(2);
  });

  it('is deterministic across repeated calls with the same inputs', () => {
    const results = [qualifyResult(3, 1)];
    const carIdxs = [3, 8, 1];

    const first = qualifyingGridSlots(results, carIdxs);
    const second = qualifyingGridSlots(results, carIdxs);

    expect([...first.entries()]).toEqual([...second.entries()]);
  });
});

describe('useQualifyingResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStandingsSnapshot).mockReturnValue({
      sessionNum: 0,
    } as ReturnType<typeof useStandingsSnapshot>);
  });

  it('stays referentially stable across re-renders when inputs are unchanged', () => {
    const raw = [qualifyResult(0, 0)];
    vi.mocked(useSessionQualifyingResults).mockReturnValue(raw);
    vi.mocked(useSessionQualifyPositions).mockReturnValue(undefined);

    const { result, rerender } = renderHook(() => useQualifyingResults());
    const first = result.current;
    rerender();

    expect(result.current).toBe(first);
  });

  it('rebuilds when the heat-race fallback source changes', () => {
    vi.mocked(useSessionQualifyingResults).mockReturnValue(undefined);
    vi.mocked(useSessionQualifyPositions).mockReturnValue([
      qualifyPosition(0, 0),
    ]);

    const { result, rerender } = renderHook(() => useQualifyingResults());
    const first = result.current;

    vi.mocked(useSessionQualifyPositions).mockReturnValue([
      qualifyPosition(0, 0),
      qualifyPosition(1, 1),
    ]);
    rerender();

    expect(result.current).not.toBe(first);
    expect(result.current).toHaveLength(2);
  });
});

describe('useQualifyingGrid', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useStandingsSnapshot).mockReturnValue({
      sessionNum: 0,
    } as ReturnType<typeof useStandingsSnapshot>);
    vi.mocked(useSessionQualifyingResults).mockReturnValue([
      qualifyResult(2, 0),
      qualifyResult(5, 1),
    ]);
    vi.mocked(useSessionQualifyPositions).mockReturnValue(undefined);
  });

  it('stays referentially stable when the same carIdx list is passed as a new array', () => {
    const { result, rerender } = renderHook(
      ({ carIdxs }) => useQualifyingGrid(carIdxs),
      { initialProps: { carIdxs: [2, 5] } }
    );
    const first = result.current;

    // A fresh array with the same content, as a caller like LapGraphView does.
    rerender({ carIdxs: [2, 5] });

    expect(result.current).toBe(first);
  });

  it('recomputes when the carIdx set actually changes', () => {
    const { result, rerender } = renderHook(
      ({ carIdxs }) => useQualifyingGrid(carIdxs),
      { initialProps: { carIdxs: [2, 5] } }
    );

    rerender({ carIdxs: [2, 5, 9] });

    // Qualified slots top out at 2, so car 9 lands at 3 + 9.
    expect(result.current.get(9)).toBe(12);
  });
});
