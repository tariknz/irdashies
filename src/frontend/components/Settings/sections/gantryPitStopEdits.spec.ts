import { describe, expect, it } from 'vitest';
import {
  CLIO_PIT_PROFILE,
  sanitizeGantryPitStops,
  type DashboardLayout,
} from '@irdashies/types';
import {
  exportPitProfiles,
  importPitProfiles,
  newPitProfile,
  readGantryPitStops,
  withGantryPitStops,
} from './gantryPitStopEdits';

const dashboard = (pitStops?: unknown): DashboardLayout =>
  ({
    widgets: [
      { id: 'gantry', enabled: true, layout: {}, config: { pitStops } },
      { id: 'standings', enabled: true, layout: {}, config: {} },
    ],
  }) as unknown as DashboardLayout;

describe('gantry pit stop edits', () => {
  it('falls back to the Clio profile when nothing is saved', () => {
    expect(readGantryPitStops(dashboard()).profiles).toEqual([
      CLIO_PIT_PROFILE,
    ]);
  });

  it('saves into the Gantry only', () => {
    const next = withGantryPitStops(dashboard(), {
      profiles: [newPitProfile('gt4car', 'GT4')],
    });
    expect(readGantryPitStops(next).profiles.map((p) => p.carPath)).toEqual([
      'gt4car',
    ]);
    expect(next.widgets[1].config).toEqual({});
  });

  it('round-trips an export, replacing the same car', () => {
    const edited = { ...CLIO_PIT_PROFILE, driverChangeSeconds: 30 };
    const result = importPitProfiles(
      [CLIO_PIT_PROFILE, newPitProfile('gt4car', 'GT4')],
      exportPitProfiles([edited])
    );
    expect(result?.imported).toBe(1);
    expect(result?.profiles.map((p) => p.carPath)).toEqual([
      'gt4car',
      'renaultcliocup',
    ]);
    expect(result?.profiles[1].driverChangeSeconds).toBe(30);
  });

  it('rejects a file that is not a pit timings export', () => {
    expect(importPitProfiles([], '{"profiles":[]}')).toBeNull();
    expect(importPitProfiles([], 'not json')).toBeNull();
  });

  it('clamps and de-duplicates saved profiles', () => {
    const { profiles } = sanitizeGantryPitStops({
      profiles: [
        { ...CLIO_PIT_PROFILE, fuelRate: -5, tyres: { all: 999 } },
        CLIO_PIT_PROFILE,
        { name: 'no car path' },
      ],
    });
    expect(profiles).toHaveLength(1);
    expect(profiles[0].fuelRate).toBe(0.1);
    expect(profiles[0].tyres).toEqual({
      front: 0,
      rear: 0,
      left: 0,
      right: 0,
      all: 120,
    });
  });
});
