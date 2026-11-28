import { describe, expect, it } from 'vitest';
import { LmuSectorBoundaryLearner } from './sectorBoundaries';

const PIT = 0x80000000 | 0;
const STEP = 0.0005;

const learner = (trackName = 'WeatherTech Raceway Laguna Seca') => {
  const instance = new LmuSectorBoundaryLearner();
  instance.reset(trackName);
  return instance;
};

const drive = (
  instance: LmuSectorBoundaryLearner,
  from: number,
  to: number,
  boundaries: { at: number; sector: number }[],
  startSector: number,
  pitBit = 0
): boolean[] => {
  const changed: boolean[] = [];
  for (let pct = from; pct <= to + 1e-9; pct += STEP) {
    let sector = startSector;
    for (const boundary of boundaries) {
      if (pct >= boundary.at) sector = boundary.sector;
    }
    changed.push(instance.update(sector | pitBit, pct));
  }
  return changed;
};

const LINES = [
  { at: 0.389, sector: 1 },
  { at: 0.791, sector: 2 },
];

const lap = (
  instance: LmuSectorBoundaryLearner,
  lines: { at: number; sector: number }[] = LINES,
  pitBit = 0
) => drive(instance, 0.05, 0.95, lines, 0, pitBit);

describe('LmuSectorBoundaryLearner', () => {
  it('learns both boundaries once two laps agree and reports the change once', () => {
    const instance = learner();
    const changed = [...lap(instance), ...lap(instance)];

    expect(changed.filter(Boolean)).toHaveLength(1);
    const [s2, s3] = instance.boundaries() ?? [];
    expect(s2).toBeCloseTo(0.389, 3);
    expect(s3).toBeCloseTo(0.791, 3);
  });

  it('publishes nothing from a single lap', () => {
    const instance = learner();
    const changed = lap(instance);

    expect(changed.some(Boolean)).toBe(false);
    expect(instance.boundaries()).toBeNull();
  });

  it('publishes nothing until both boundaries are confirmed', () => {
    const instance = learner();
    lap(instance);
    drive(instance, 0.05, 0.6, LINES, 0);

    expect(instance.boundaries()).toBeNull();
  });

  it('does not publish a boundary from a single outlier crossing', () => {
    const instance = learner();
    lap(instance, [
      { at: 0.45, sector: 1 },
      { at: 0.791, sector: 2 },
    ]);
    lap(instance);
    expect(instance.boundaries()).toBeNull();

    lap(instance);
    const [s2, s3] = instance.boundaries() ?? [];
    expect(s2).toBeCloseTo(0.389, 3);
    expect(s3).toBeCloseTo(0.791, 3);
  });

  it('keeps a track learned earlier in the run and forgets it for a new track', () => {
    const instance = learner('Laguna Seca');
    lap(instance);
    lap(instance);
    const laguna = instance.boundaries();
    expect(laguna).not.toBeNull();

    instance.reset('Spa-Francorchamps');
    expect(instance.boundaries()).toBeNull();

    instance.reset('Laguna Seca');
    expect(instance.boundaries()).toBe(laguna);
  });

  it('keeps published boundaries through a single outlier lap', () => {
    const instance = learner();
    lap(instance);
    lap(instance);
    const first = instance.boundaries();

    const changed = [
      ...lap(instance, [
        { at: 0.45, sector: 1 },
        { at: 0.85, sector: 2 },
      ]),
      ...lap(instance),
      ...lap(instance),
    ];

    expect(changed.some(Boolean)).toBe(false);
    expect(instance.boundaries()).toBe(first);
  });

  it('keeps published boundaries when later laps agree with them', () => {
    const instance = learner();
    lap(instance);
    lap(instance);
    const first = instance.boundaries();

    const nearby = [
      { at: 0.3895, sector: 1 },
      { at: 0.7915, sector: 2 },
    ];
    const changed = [...lap(instance, nearby), ...lap(instance, nearby)];

    expect(changed.some(Boolean)).toBe(false);
    expect(instance.boundaries()).toBe(first);
  });

  it('replaces published boundaries once two later laps agree on new ones', () => {
    const instance = learner('Laguna Seca');
    lap(instance);
    lap(instance);

    const moved = [
      { at: 0.4, sector: 1 },
      { at: 0.8, sector: 2 },
    ];

    expect(lap(instance, moved).some(Boolean)).toBe(false);
    expect(lap(instance, moved).some(Boolean)).toBe(true);
    const replaced = instance.boundaries();
    const [s2, s3] = replaced ?? [];
    expect(s2).toBeCloseTo(0.4, 3);
    expect(s3).toBeCloseTo(0.8, 3);

    instance.reset('Laguna Seca');
    expect(instance.boundaries()).toBe(replaced);
  });

  it('ignores sector changes in the pit lane', () => {
    const instance = learner();
    lap(instance, LINES, PIT);
    lap(instance, LINES, PIT);

    expect(instance.boundaries()).toBeNull();
  });

  it('ignores a sector change that arrives with a jump in lap position', () => {
    const instance = learner();
    lap(instance);
    drive(instance, 0.05, 0.3, [], 0);
    instance.update(1, 0.389);
    drive(instance, 0.3895, 0.95, [{ at: 0.791, sector: 2 }], 1);

    expect(instance.boundaries()).toBeNull();
  });

  it('waits for steady motion after a reset before trusting a change', () => {
    const instance = learner();
    lap(instance);
    drive(instance, 0.05, 0.3, [], 0);
    instance.update(0, 0.388);
    instance.update(1, 0.3885);
    drive(instance, 0.389, 0.95, [{ at: 0.791, sector: 2 }], 1);

    expect(instance.boundaries()).toBeNull();
  });

  it('ignores a change while the lap position is frozen at the line', () => {
    const instance = learner();
    for (let lapIndex = 0; lapIndex < 2; lapIndex += 1) {
      for (let frame = 0; frame < 20; frame += 1) instance.update(0, 0);
      instance.update(1, 0);
      drive(instance, 0.4, 0.95, [{ at: 0.791, sector: 2 }], 1);
    }

    expect(instance.boundaries()).toBeNull();
  });

  it('never publishes a pair whose order is implausible and learns the next clean one', () => {
    const instance = learner();
    drive(instance, 0.6, 0.95, [{ at: 0.791, sector: 2 }], 1);
    drive(instance, 0.6, 0.95, [{ at: 0.791, sector: 2 }], 1);
    const clean = [
      { at: 0.785, sector: 1 },
      { at: 0.9, sector: 2 },
    ];
    const changed = [...lap(instance, clean), ...lap(instance, clean)];

    expect(changed.filter(Boolean)).toHaveLength(1);
    const [s2, s3] = instance.boundaries() ?? [];
    expect(s2).toBeCloseTo(0.785, 3);
    expect(s3).toBeCloseTo(0.9, 3);
  });

  it('forgets the sector it was tracking when the sector reading goes away', () => {
    const instance = learner();
    lap(instance);
    drive(instance, 0.05, 0.388, [], 0);
    instance.update(undefined, 0.3885);
    drive(instance, 0.389, 0.95, LINES, 1);

    expect(instance.boundaries()).toBeNull();
  });

  it('starts from the bundled boundaries of a track it has not learned', () => {
    const bundled = (trackName: string) =>
      trackName === 'WeatherTech Raceway Laguna Seca' ? [0.3904, 0.7925] : null;
    const instance = new LmuSectorBoundaryLearner(bundled);
    instance.reset('WeatherTech Raceway Laguna Seca');
    expect(instance.boundaries()).toEqual([0.3904, 0.7925]);

    instance.reset('Fuji Speedway');
    expect(instance.boundaries()).toBeNull();
  });

  it('learns a bundled track whose live lap the bundle does not fit', () => {
    const bundled = (trackName: string, lapDistM?: number) =>
      trackName === 'Circuit de Barcelona' && lapDistM === 4655
        ? [0.3, 0.6]
        : null;
    const instance = new LmuSectorBoundaryLearner(bundled);

    instance.reset('Circuit de Barcelona', 4655);
    expect(instance.learning).toBe(false);
    expect(instance.boundaries()).toEqual([0.3, 0.6]);

    instance.reset('Circuit de Barcelona', 5000);
    expect(instance.learning).toBe(true);
    expect(instance.boundaries()).toBeNull();
  });

  it('stays on the bundled boundaries of a bundled track and learns nothing', () => {
    const bundled = (trackName: string) =>
      trackName === 'WeatherTech Raceway Laguna Seca' ? [0.3, 0.6] : null;
    const instance = new LmuSectorBoundaryLearner(bundled);
    instance.reset('WeatherTech Raceway Laguna Seca');
    const changed = [...lap(instance), ...lap(instance), ...lap(instance)];

    expect(instance.learning).toBe(false);
    expect(changed.some(Boolean)).toBe(false);
    expect(instance.boundaries()).toEqual([0.3, 0.6]);

    instance.reset('Fuji Speedway');
    expect(instance.learning).toBe(true);
    expect([...lap(instance), ...lap(instance)].filter(Boolean)).toHaveLength(
      1
    );
  });

  it('replaces the bundled boundaries with ones it learns when told to learn bundled tracks', () => {
    const instance = new LmuSectorBoundaryLearner(() => [0.3, 0.6], true);
    instance.reset('WeatherTech Raceway Laguna Seca');
    const changed = [...lap(instance), ...lap(instance)];

    expect(changed.filter(Boolean)).toHaveLength(1);
    expect(instance.boundaries()?.[0]).toBeCloseTo(0.389, 3);

    instance.reset('Fuji Speedway');
    instance.reset('WeatherTech Raceway Laguna Seca');
    expect(instance.boundaries()?.[0]).toBeCloseTo(0.389, 3);
  });

  it('does not report bundled boundaries it confirms as a change', () => {
    const instance = new LmuSectorBoundaryLearner(() => [0.389, 0.791], true);
    instance.reset('WeatherTech Raceway Laguna Seca');
    const changed = [...lap(instance), ...lap(instance)];

    expect(changed.some(Boolean)).toBe(false);
  });
});
