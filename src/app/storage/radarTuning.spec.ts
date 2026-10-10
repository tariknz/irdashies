import { describe, it, expect, vi } from 'vitest';
import { DEFAULT_RADAR_TUNING, type DashboardLayout } from '@irdashies/types';

vi.mock('./dashboards', () => ({
  getCurrentProfileId: vi.fn(),
  getDashboard: vi.fn(),
}));

import { tuningOf } from './radarTuning';

const withTuning = (tuning: unknown) =>
  ({
    widgets: [{ id: 'radar', config: { tuning } }],
  }) as unknown as DashboardLayout;

describe('tuningOf', () => {
  it('takes valid saved values', () => {
    expect(
      tuningOf(withTuning({ laneRate: 2, poleFlipFrames: 10 }))
    ).toMatchObject({ laneRate: 2, poleFlipFrames: 10 });
  });

  it('falls back to defaults for values that would break the processor', () => {
    const tuning = tuningOf(
      withTuning({
        speedSmoothing: 5,
        laneRate: Number.NaN,
        overlapSearchM: -1,
        poleFlipFrames: '30',
      })
    );
    expect(tuning.speedSmoothing).toBe(DEFAULT_RADAR_TUNING.speedSmoothing);
    expect(tuning.laneRate).toBe(DEFAULT_RADAR_TUNING.laneRate);
    expect(tuning.overlapSearchM).toBe(DEFAULT_RADAR_TUNING.overlapSearchM);
    expect(tuning.poleFlipFrames).toBe(DEFAULT_RADAR_TUNING.poleFlipFrames);
  });

  it('survives a null tuning', () => {
    expect(tuningOf(withTuning(null))).toMatchObject(DEFAULT_RADAR_TUNING);
  });
});
