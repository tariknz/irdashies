import { beforeEach, describe, expect, it } from 'vitest';
import type { SectorTimingSnapshot } from '@irdashies/types';
import { computeSectorColor, useSectorTimingStore } from './SectorTimingStore';

const result = (time: number, unclean: boolean) => ({
  currentLapSectorTimes: [time],
  previousLapSectorTimes: [time],
  currentLapSectorUnclean: [unclean],
  previousLapSectorUnclean: [unclean],
  sessionBestSectorTimes: [time],
  previousSessionBestSectorTimes: [null],
});

const snapshot = {
  sectors: [{ SectorNum: 0, SectorStartPct: 0 }],
  currentSectorIdx: 0,
  sectorEntryTime: 10,
  sectorEntryValid: true,
  inclusive: result(12, true),
  clean: result(13, false),
  sessionNum: 1,
  version: 1,
} satisfies SectorTimingSnapshot;

beforeEach(() => {
  useSectorTimingStore.setState({ trackIncidentSectors: true });
  useSectorTimingStore.getState().reset();
});

describe('computeSectorColor', () => {
  it('applies racing timing thresholds', () => {
    expect(computeSectorColor(25, null)).toBe('default');
    expect(computeSectorColor(25, 25)).toBe('purple');
    expect(computeSectorColor(25.1, 25)).toBe('green');
    expect(computeSectorColor(25.2, 25)).toBe('yellow');
    expect(computeSectorColor(25.3, 25)).toBe('red');
  });
});

describe('SectorTimingStore.applySnapshot', () => {
  it('selects the incident-inclusive view by default', () => {
    useSectorTimingStore.getState().applySnapshot(snapshot);
    expect(useSectorTimingStore.getState().currentLapSectorTimes).toEqual([12]);
    expect(useSectorTimingStore.getState().currentLapSectorUnclean).toEqual([
      true,
    ]);
  });

  it('selects the clean-only view when incident sectors are disabled', () => {
    useSectorTimingStore.getState().setTrackIncidentSectors(false);
    useSectorTimingStore.getState().applySnapshot(snapshot);
    expect(useSectorTimingStore.getState().currentLapSectorTimes).toEqual([13]);
    expect(useSectorTimingStore.getState().currentLapSectorUnclean).toEqual([
      false,
    ]);
  });

  it('recomputes colors when thresholds change', () => {
    useSectorTimingStore.getState().applySnapshot({
      ...snapshot,
      inclusive: {
        ...snapshot.inclusive,
        currentLapSectorTimes: [25.2],
        previousLapSectorTimes: [25.2],
        sessionBestSectorTimes: [25],
      },
    });
    expect(useSectorTimingStore.getState().sectorColors).toEqual(['yellow']);
    useSectorTimingStore.getState().setThresholds(0.001, 0.005);
    expect(useSectorTimingStore.getState().sectorColors).toEqual(['red']);
  });
});
