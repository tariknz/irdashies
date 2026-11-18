import { describe, expect, it, vi } from 'vitest';
import {
  LmuSectorBoundaryLearner,
  isPlausibleLmuSectorBoundaries,
  sameLmuSectorBoundaries,
  type LmuSectorBoundaries,
} from './sectorBoundaries';

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

const lines = (s2: number, s3: number) => [
  { at: s2, sector: 1 },
  { at: s3, sector: 2 },
];

const LINES = lines(0.389, 0.791);
const MOVED = lines(0.4, 0.8);
const OTHER = lines(0.42, 0.82);

const lap = (
  instance: LmuSectorBoundaryLearner,
  crossings: { at: number; sector: number }[]
): number => drive(instance, 0.05, 0.95, crossings, 0).filter(Boolean).length;

const expectBoundaries = (
  instance: LmuSectorBoundaryLearner,
  s2: number,
  s3: number
) => {
  const [measuredS2, measuredS3] = instance.boundaries() ?? [];
  expect(measuredS2).toBeCloseTo(s2, 3);
  expect(measuredS3).toBeCloseTo(s3, 3);
};

describe('LmuSectorBoundaryLearner', () => {
  it('learns both boundaries from one clean lap and reports the change once', () => {
    const instance = learner();

    expect(lap(instance, LINES)).toBe(1);
    expectBoundaries(instance, 0.389, 0.791);
  });

  it('publishes nothing until both boundaries are known', () => {
    const instance = learner();
    drive(instance, 0.05, 0.6, LINES, 0);

    expect(instance.boundaries()).toBeNull();
  });

  it('keeps a track learned earlier in the run and forgets it for a new track', () => {
    const instance = learner('Laguna Seca');
    lap(instance, LINES);
    const laguna = instance.boundaries();

    instance.reset('Spa-Francorchamps');
    expect(instance.boundaries()).toBeNull();

    instance.reset('Laguna Seca');
    expect(instance.boundaries()).toBe(laguna);
  });

  it('moves to new lines only once two laps in a row agree on them', () => {
    const instance = learner();
    lap(instance, LINES);
    const first = instance.boundaries();

    expect(lap(instance, MOVED)).toBe(0);
    expect(instance.boundaries()).toBe(first);

    expect(lap(instance, MOVED)).toBe(1);
    expectBoundaries(instance, 0.4, 0.8);
  });

  it('keeps its lines when a lap that disagreed is followed by one that agrees', () => {
    const instance = learner();
    lap(instance, LINES);
    const first = instance.boundaries();

    expect(lap(instance, MOVED)).toBe(0);
    expect(lap(instance, LINES)).toBe(0);
    expect(lap(instance, MOVED)).toBe(0);
    expect(lap(instance, MOVED)).toBe(0);
    expect(instance.boundaries()).toBe(first);
  });

  it('replaces a candidate that the next lap does not confirm', () => {
    const instance = learner();
    lap(instance, LINES);

    expect(lap(instance, MOVED)).toBe(0);
    expect(lap(instance, OTHER)).toBe(0);
    expect(lap(instance, OTHER)).toBe(1);
    expectBoundaries(instance, 0.42, 0.82);
  });

  it('stops measuring once a lap confirms the published lines', () => {
    const instance = learner();
    lap(instance, LINES);
    lap(instance, LINES);
    const confirmed = instance.boundaries();

    expect(lap(instance, MOVED)).toBe(0);
    expect(lap(instance, MOVED)).toBe(0);
    expect(instance.boundaries()).toBe(confirmed);
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
    lap(instance, lines(0.785, 0.9));

    expectBoundaries(instance, 0.785, 0.9);
  });

  it('forgets the sector it was tracking when the sector reading goes away', () => {
    const instance = learner();
    drive(instance, 0.05, 0.388, [], 0);
    instance.update(undefined, 0.3885);
    drive(instance, 0.389, 0.95, LINES, 1);

    expect(instance.boundaries()).toBeNull();
  });
});

describe('LmuSectorBoundaryLearner with known boundaries', () => {
  const KNOWN: LmuSectorBoundaries = [0.4, 0.8];
  const TRACK = '1000123';

  const withSources = (known: LmuSectorBoundaries | null) => {
    const measured =
      vi.fn<(trackKey: string, boundaries: LmuSectorBoundaries) => void>();
    const knownFor = vi.fn((trackKey: string) =>
      trackKey === TRACK ? known : null
    );
    const instance = new LmuSectorBoundaryLearner({
      known: knownFor,
      measured,
    });
    instance.reset(TRACK);
    return { instance, measured, knownFor };
  };

  const expectMeasured = (
    measured: ReturnType<typeof withSources>['measured'],
    s2: number,
    s3: number
  ) => {
    expect(measured).toHaveBeenCalledTimes(1);
    const [trackKey, [measuredS2, measuredS3]] = measured.mock.calls[0];
    expect(trackKey).toBe(TRACK);
    expect(measuredS2).toBeCloseTo(s2, 3);
    expect(measuredS3).toBeCloseTo(s3, 3);
  };

  it('starts on the known boundaries', () => {
    const { instance } = withSources(KNOWN);
    expect(instance.boundaries()).toEqual(KNOWN);
  });

  it('keeps known boundaries that a lap agrees with and hands nothing on', () => {
    const { instance, measured } = withSources(KNOWN);

    expect(lap(instance, MOVED)).toBe(0);
    expect(lap(instance, LINES)).toBe(0);
    expect(lap(instance, LINES)).toBe(0);
    expect(instance.boundaries()).toEqual(KNOWN);
    expect(measured).not.toHaveBeenCalled();
  });

  it('keeps known boundaries through one lap that disagrees', () => {
    const { instance, measured } = withSources(KNOWN);

    expect(lap(instance, LINES)).toBe(0);
    expect(lap(instance, MOVED)).toBe(0);
    expect(instance.boundaries()).toEqual(KNOWN);
    expect(measured).not.toHaveBeenCalled();
  });

  it('replaces known boundaries once two laps agree on other lines, and hands them on', () => {
    const { instance, measured } = withSources(KNOWN);

    expect(lap(instance, LINES)).toBe(0);
    expect(measured).not.toHaveBeenCalled();
    expect(lap(instance, LINES)).toBe(1);
    expectBoundaries(instance, 0.389, 0.791);
    expectMeasured(measured, 0.389, 0.791);

    expect(lap(instance, MOVED)).toBe(0);
    expect(lap(instance, MOVED)).toBe(0);
    expect(measured).toHaveBeenCalledTimes(1);
  });

  it('publishes the first measurement at once when nothing was known, and hands it on once confirmed', () => {
    const { instance, measured } = withSources(null);

    expect(lap(instance, LINES)).toBe(1);
    expectBoundaries(instance, 0.389, 0.791);
    expect(measured).not.toHaveBeenCalled();

    expect(lap(instance, LINES)).toBe(0);
    expectMeasured(measured, 0.389, 0.791);
  });

  it('prefers what it learned earlier in the run over the known boundaries', () => {
    const { instance, measured, knownFor } = withSources(KNOWN);
    lap(instance, LINES);
    lap(instance, LINES);
    knownFor.mockClear();

    instance.reset(TRACK);

    expect(knownFor).not.toHaveBeenCalled();
    expectBoundaries(instance, 0.389, 0.791);
    expect(lap(instance, LINES)).toBe(0);
    expect(measured).toHaveBeenCalledTimes(1);
  });

  it('checks the lines again after a reset', () => {
    const { instance, measured } = withSources(KNOWN);
    lap(instance, MOVED);

    instance.reset(TRACK);

    expect(lap(instance, LINES)).toBe(0);
    expect(lap(instance, LINES)).toBe(1);
    expectMeasured(measured, 0.389, 0.791);
  });

  it('still asks for a confirmation of a measurement carried over a reset', () => {
    const { instance, measured } = withSources(null);
    lap(instance, LINES);

    instance.reset(TRACK);

    expectBoundaries(instance, 0.389, 0.791);
    expect(measured).not.toHaveBeenCalled();
    expect(lap(instance, LINES)).toBe(0);
    expectMeasured(measured, 0.389, 0.791);
  });
});

describe('isPlausibleLmuSectorBoundaries', () => {
  it('accepts an ordered pair inside the lap and refuses anything else', () => {
    expect(isPlausibleLmuSectorBoundaries(0.39, 0.79)).toBe(true);
    expect(isPlausibleLmuSectorBoundaries(0.79, 0.39)).toBe(false);
    expect(isPlausibleLmuSectorBoundaries(0.39, 0.4)).toBe(false);
    expect(isPlausibleLmuSectorBoundaries(0.01, 0.5)).toBe(false);
    expect(isPlausibleLmuSectorBoundaries(0.5, 0.99)).toBe(false);
    expect(isPlausibleLmuSectorBoundaries(Number.NaN, 0.5)).toBe(false);
  });
});

describe('sameLmuSectorBoundaries', () => {
  it('treats lines within a thousandth of a lap as the same', () => {
    expect(sameLmuSectorBoundaries([0.3904, 0.7925], [0.3909, 0.7921])).toBe(
      true
    );
    expect(sameLmuSectorBoundaries([0.3904, 0.7925], [0.3904, 0.8])).toBe(
      false
    );
    expect(sameLmuSectorBoundaries([0.3904, 0.7925], [0.389, 0.7925])).toBe(
      false
    );
  });
});
