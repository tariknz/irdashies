import { afterEach, describe, expect, it } from 'vitest';
import type { ReferenceLap } from '@irdashies/types';
import { useReferenceLapStore } from '@irdashies/context';
import capturedTelemetry from '../../../../test-data/1752616787256/telemetry.json';
import {
  augmentStandingsWithGap,
  augmentStandingsWithInterval,
  type Standings,
} from './createStandings';

const originalReferenceState = useReferenceLapStore.getState();
afterEach(() => useReferenceLapStore.setState(originalReferenceState, true));

const referenceLap: ReferenceLap = {
  startTime: 0,
  finishTime: 100,
  interval: 0.01,
  pointsCount: 100,
  lastTrackedPct: 1,
  isCleanLap: true,
  times: Float32Array.from({ length: 100 }, (_, i) => i),
  pointPos: Float32Array.from({ length: 100 }, (_, i) => i / 100),
  tangents: new Float32Array(100).fill(100),
};

function field() {
  const standings: Standings[] = Array.from({ length: 11 }, (_, carIdx) => ({
    carIdx,
    position: carIdx + 1,
    classPosition: carIdx + 1,
    delta: carIdx === 10 ? 127 : (carIdx * 30) / 9,
    lap: carIdx === 10 ? 9 : 10,
    isPlayer: carIdx === 9,
    onTrack: true,
    onPitRoad: false,
    currentSessionType: 'Race',
    driver: {
      name: `Driver ${carIdx}`,
      carNum: `${carIdx}`,
      license: 'A',
      rating: 1000,
    },
    carClass: {
      id: 1,
      color: 0,
      name: 'GT3',
      relativeSpeed: 1,
      estLapTime: 100,
    },
    fastestTime: 100,
    hasFastestTime: false,
    lastTime: 100,
    tireCompound: 0,
    dnf: false,
    repair: false,
    penalty: false,
    slowdown: false,
    relativePct: 0,
  }));
  return {
    standings,
    laps: standings.map((driver) => driver.lap ?? 0),
    pcts: standings.map((_, i) => (i === 10 ? 0.53 : 0.8 - i / 30)),
    pits: standings.map(() => false),
  };
}

type Field = ReturnType<typeof field>;
function calculate(
  data: Field,
  showLaps = false,
  estimates = data.pcts.map((pct) => pct * 100)
) {
  const grouped: [string, Standings[]][] = [['1', data.standings]];
  const gaps = augmentStandingsWithGap(
    grouped,
    data.laps,
    data.pcts,
    data.pits,
    estimates,
    true,
    'Race'
  );
  return augmentStandingsWithInterval(
    gaps,
    data.laps,
    data.pcts,
    showLaps,
    data.pits
  )[0][1];
}

describe.each(['reference', 'distance'] as const)(
  'live race intervals using %s timing',
  (timing) => {
    const setup = () => {
      useReferenceLapStore.setState({
        getReferenceLap: () =>
          timing === 'reference'
            ? referenceLap
            : { ...referenceLap, finishTime: -1 },
      });
      return field();
    };
    const run = (data: Field, showLaps = false) => calculate(data, showLaps);

    it.each([false, true])(
      'keeps the nearly lapped P11 97 seconds behind P10 (lap display %s)',
      (showLaps) => {
        const data = setup();
        expect(run(data, showLaps)[10].interval).toBeCloseTo(97, 3);
        data.pcts[0] = 0.52;
        data.laps[0] = 11;
        expect(run(data, showLaps)[10].interval).toBeCloseTo(97, 3);
      }
    );

    it.each([1, 2])(
      'includes %i whole laps in seconds, or displays the lap count',
      (lapsBehind) => {
        const data = setup();
        data.laps[9] = 9 + lapsBehind;
        data.pcts[9] = 0.54;
        expect(run(data)[10].interval).toBeCloseTo(lapsBehind * 100 + 1, 3);
        expect(run(data, true)[10].interval).toEqual({
          value: undefined,
          laps: -lapsBehind,
        });
      }
    );

    it('preserves ordinary same-lap intervals and leaves the leader blank', () => {
      const data = setup();
      data.laps[10] = 10;
      data.pcts[10] = 0.47;
      const result = run(data);
      expect(result[0].interval).toBeUndefined();
      expect(result[10].interval).toBeCloseTo(3, 3);
    });

    it('does not count crossing start/finish alone as a lap down', () => {
      const data = setup();
      data.laps[9] = 10;
      data.pcts[9] = 0.01;
      data.pcts[10] = 0.98;
      expect(run(data, true)[10].interval).toBeCloseTo(3, 3);
    });

    it('retains whole laps when both cars have the same track percentage', () => {
      const data = setup();
      data.pcts[10] = data.pcts[9];
      expect(run(data)[10].interval).toBeCloseTo(100, 3);
      expect(run(data, true)[10].interval).toEqual({
        value: undefined,
        laps: -1,
      });
    });

    it('hides intervals when either car is off track', () => {
      const data = setup();
      data.standings[9].onTrack = false;
      expect(run(data)[10].interval).toBeUndefined();
      data.standings[9].onTrack = true;
      data.standings[10].onTrack = false;
      expect(run(data, true)[10].interval).toBeUndefined();
    });

    it.each([-1, NaN, undefined])(
      'hides intervals with an invalid track position (%s)',
      (pct) => {
        const data = setup();
        data.pcts[10] = pct as number;
        expect(run(data)[10].interval).toBeUndefined();
      }
    );

    it('hides an interval when progress temporarily disagrees with race order', () => {
      const data = setup();
      data.laps[10] = 10;
      expect(run(data)[10].interval).toBeUndefined();
    });
  }
);

it.each([false, true])(
  'keeps closely spaced cars close with inverted estimated times (lap display %s)',
  (showLaps) => {
    useReferenceLapStore.setState({
      getReferenceLap: () => ({ ...referenceLap, finishTime: -1 }),
    });
    const data = field();
    data.laps[9] = capturedTelemetry.CarIdxLap.value[24];
    data.laps[10] = capturedTelemetry.CarIdxLap.value[20];
    data.pcts[9] = capturedTelemetry.CarIdxLapDistPct.value[24];
    data.pcts[10] = capturedTelemetry.CarIdxLapDistPct.value[20];
    data.standings[9].carClass.estLapTime = 90.4585;
    data.standings[10].carClass.estLapTime = 89.0997;
    const estimates = data.pcts.map((pct) => pct * 100);
    estimates[9] = capturedTelemetry.CarIdxEstTime.value[24];
    estimates[10] = capturedTelemetry.CarIdxEstTime.value[20];
    expect(calculate(data, showLaps, estimates)[10].interval).toBeCloseTo(
      0.00098,
      6
    );
  }
);

it('uses track progress on pit road even when a reference lap is available', () => {
  useReferenceLapStore.setState({ getReferenceLap: () => referenceLap });
  const data = field();
  data.pits[10] = true;
  data.standings[10].carClass.estLapTime = 80;
  const estimates = data.pcts.map((pct) => pct * 100);
  estimates[10] = 60;
  expect(calculate(data, false, estimates)[10].interval).toBeCloseTo(77.6, 3);
});

it('uses the measured segment duration and full lap duration from the reference', () => {
  useReferenceLapStore.setState({
    getReferenceLap: () => ({
      ...referenceLap,
      startTime: 500,
      finishTime: 620,
      times: Float32Array.from({ length: 100 }, (_, i) => 120 * (i / 100) ** 2),
      tangents: Float32Array.from({ length: 100 }, (_, i) => 240 * (i / 100)),
    }),
  });
  const data = field();
  data.pcts[9] = 0.5;
  data.pcts[10] = 0.25;
  expect(calculate(data)[10].interval).toBeCloseTo(142.5, 3);
});

it('can show a whole-lap difference without usable timing data', () => {
  useReferenceLapStore.setState({
    getReferenceLap: () => ({ ...referenceLap, finishTime: -1 }),
  });
  const data = field();
  data.pcts[9] = 0.54;
  data.standings[10].carClass.estLapTime = 0;
  expect(calculate(data)[10].interval).toBeUndefined();
  expect(calculate(data, true)[10].interval).toEqual({
    value: undefined,
    laps: -1,
  });
});
