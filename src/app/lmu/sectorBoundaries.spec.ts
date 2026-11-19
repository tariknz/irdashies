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

describe('LmuSectorBoundaryLearner', () => {
  it('learns both boundaries from one clean lap and reports the change once', () => {
    const instance = learner();
    const changed = drive(instance, 0.05, 0.95, LINES, 0);

    expect(changed.filter(Boolean)).toHaveLength(1);
    const [s2, s3] = instance.boundaries() ?? [];
    expect(s2).toBeCloseTo(0.389, 3);
    expect(s3).toBeCloseTo(0.791, 3);
  });

  it('publishes nothing until both boundaries are known', () => {
    const instance = learner();
    drive(instance, 0.05, 0.6, LINES, 0);

    expect(instance.boundaries()).toBeNull();
  });

  it('keeps a track learned earlier in the run and forgets it for a new track', () => {
    const instance = learner('Laguna Seca');
    drive(instance, 0.05, 0.95, LINES, 0);
    const laguna = instance.boundaries();

    instance.reset('Spa-Francorchamps');
    expect(instance.boundaries()).toBeNull();

    instance.reset('Laguna Seca');
    expect(instance.boundaries()).toBe(laguna);
  });

  it('does not move published boundaries on later laps', () => {
    const instance = learner();
    drive(instance, 0.05, 0.95, LINES, 0);
    const first = instance.boundaries();

    const changed = drive(
      instance,
      0.05,
      0.95,
      [
        { at: 0.4, sector: 1 },
        { at: 0.8, sector: 2 },
      ],
      0
    );

    expect(changed.some(Boolean)).toBe(false);
    expect(instance.boundaries()).toBe(first);
  });

  it('ignores sector changes in the pit lane', () => {
    const instance = learner();
    drive(instance, 0.05, 0.95, LINES, 0, PIT);

    expect(instance.boundaries()).toBeNull();
  });

  it('ignores a sector change that arrives with a jump in lap position', () => {
    const instance = learner();
    drive(instance, 0.05, 0.3, [], 0);
    instance.update(1, 0.6);
    drive(instance, 0.6, 0.95, [{ at: 0.791, sector: 2 }], 1);

    expect(instance.boundaries()).toBeNull();
  });

  it('waits for steady motion after a reset before trusting a change', () => {
    const instance = learner();
    drive(instance, 0.05, 0.3, [], 0);
    instance.update(0, 0.385);
    instance.update(1, 0.3855);
    drive(instance, 0.386, 0.95, [{ at: 0.791, sector: 2 }], 1);

    expect(instance.boundaries()).toBeNull();
  });

  it('ignores a change while the lap position is frozen at the line', () => {
    const instance = learner();
    for (let frame = 0; frame < 20; frame += 1) instance.update(0, 0);
    instance.update(1, 0);
    drive(instance, 0.4, 0.95, [{ at: 0.791, sector: 2 }], 1);

    expect(instance.boundaries()).toBeNull();
  });

  it('drops a pair whose order is implausible and learns the next clean one', () => {
    const instance = learner();
    drive(instance, 0.6, 0.95, [{ at: 0.791, sector: 2 }], 1);
    drive(
      instance,
      0.05,
      0.95,
      [
        { at: 0.785, sector: 1 },
        { at: 0.9, sector: 2 },
      ],
      0
    );

    const [s2, s3] = instance.boundaries() ?? [];
    expect(s2).toBeCloseTo(0.785, 3);
    expect(s3).toBeCloseTo(0.9, 3);
  });

  it('forgets the sector it was tracking when the sector reading goes away', () => {
    const instance = learner();
    drive(instance, 0.05, 0.388, [], 0);
    instance.update(undefined, 0.3885);
    drive(instance, 0.389, 0.95, LINES, 1);

    expect(instance.boundaries()).toBeNull();
  });
});
