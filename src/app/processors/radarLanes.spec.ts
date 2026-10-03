import { describe, expect, it } from 'vitest';
import { CarLeftRight } from '@irdashies/types';
import {
  MEMORY_HOLD_S,
  RadarLaneTracker,
  type LaneFormation,
  type LaneInput,
  type LaneOutput,
} from './radarLanes';

/** Runs long enough at 60 Hz for drawn lanes to settle on their targets. */
const settle = (
  tracker: RadarLaneTracker,
  start: number,
  cars: readonly LaneInput[],
  spotter: number | null,
  seconds = 1,
  formation: LaneFormation | null = null
): { time: number; lanes: Map<number, LaneOutput> } => {
  let lanes = new Map<number, LaneOutput>();
  let time = start;
  for (let tick = 0; tick <= seconds * 60; tick += 1) {
    time = start + tick / 60;
    lanes = tracker.update(time, cars, spotter, formation);
  }
  return { time, lanes };
};

const laneOf = (lanes: Map<number, LaneOutput>, carIdx: number) =>
  lanes.get(carIdx)?.lane;

describe('RadarLaneTracker', () => {
  it('leaves rivals in our lane while the spotter is clear', () => {
    const tracker = new RadarLaneTracker();
    const { lanes } = settle(
      tracker,
      0,
      [{ carIdx: 1, dist: -12 }],
      CarLeftRight.Clear
    );

    expect(lanes.get(1)).toEqual({ lane: 0, source: 'none' });
  });

  it('puts the overlapping car on the side the spotter calls', () => {
    const tracker = new RadarLaneTracker();
    const { lanes } = settle(
      tracker,
      0,
      [
        { carIdx: 1, dist: -2 },
        { carIdx: 2, dist: 25 },
      ],
      CarLeftRight.CarLeft
    );

    expect(lanes.get(1)).toEqual({ lane: -1, source: 'spotter' });
    expect(lanes.get(2)).toEqual({ lane: 0, source: 'none' });
  });

  it('slides into a lane instead of jumping', () => {
    const tracker = new RadarLaneTracker();
    tracker.update(0, [{ carIdx: 1, dist: -2 }], CarLeftRight.Clear);
    const first = tracker.update(
      1 / 60,
      [{ carIdx: 1, dist: -2 }],
      CarLeftRight.CarRight
    );

    const lane = laneOf(first, 1) ?? 0;
    expect(lane).toBeGreaterThan(0);
    expect(lane).toBeLessThan(0.2);
  });

  it('places three wide: one each side', () => {
    const tracker = new RadarLaneTracker();
    const { lanes } = settle(
      tracker,
      0,
      [
        { carIdx: 1, dist: 1 },
        { carIdx: 2, dist: -1.5 },
      ],
      CarLeftRight.CarLeftRight
    );

    expect(
      [laneOf(lanes, 1), laneOf(lanes, 2)].sort((a = 0, b = 0) => a - b)
    ).toEqual([-1, 1]);
  });

  it('keeps a known side when the spotter says both sides', () => {
    const tracker = new RadarLaneTracker();
    const cars = [{ carIdx: 1, dist: -3 }];
    let { time } = settle(tracker, 0, cars, CarLeftRight.CarRight);

    // A second car arrives on the other side; car 1 must stay right.
    ({ time } = settle(
      tracker,
      time,
      [...cars, { carIdx: 2, dist: -1 }],
      CarLeftRight.CarLeftRight
    ));
    const { lanes } = settle(
      tracker,
      time,
      [...cars, { carIdx: 2, dist: -1 }],
      CarLeftRight.CarLeftRight
    );

    expect(laneOf(lanes, 1)).toBe(1);
    expect(laneOf(lanes, 2)).toBe(-1);
  });

  it('stacks two cars on one side into lanes one and two', () => {
    const tracker = new RadarLaneTracker();
    const { lanes } = settle(
      tracker,
      0,
      [
        { carIdx: 1, dist: 0.5 },
        { carIdx: 2, dist: -3 },
      ],
      CarLeftRight.Cars2Left
    );

    expect(
      [laneOf(lanes, 1), laneOf(lanes, 2)].sort((a = 0, b = 0) => a - b)
    ).toEqual([-2, -1]);
  });

  it('remembers the side after a pass, then drifts back to the centre', () => {
    const tracker = new RadarLaneTracker();
    let { time } = settle(
      tracker,
      0,
      [{ carIdx: 1, dist: 2 }],
      CarLeftRight.CarLeft
    );

    // Car 1 pulls ahead and the spotter goes clear.
    const ahead = [{ carIdx: 1, dist: 12 }];
    let lanes: Map<number, LaneOutput>;
    ({ time, lanes } = settle(
      tracker,
      time,
      ahead,
      CarLeftRight.Clear,
      MEMORY_HOLD_S - 0.5
    ));
    expect(lanes.get(1)).toEqual({ lane: -1, source: 'memory' });

    ({ lanes } = settle(tracker, time, ahead, CarLeftRight.Clear, 1.5));
    expect(lanes.get(1)).toEqual({ lane: 0, source: 'none' });
  });

  it('spreads two rivals level with each other behind us', () => {
    const tracker = new RadarLaneTracker();
    const { lanes } = settle(
      tracker,
      0,
      [
        { carIdx: 4, dist: -15 },
        { carIdx: 7, dist: -16.5 },
        { carIdx: 9, dist: -30 },
      ],
      CarLeftRight.Clear
    );

    expect(lanes.get(4)).toEqual({ lane: -0.5, source: 'pair' });
    expect(lanes.get(7)).toEqual({ lane: 0.5, source: 'pair' });
    expect(lanes.get(9)).toEqual({ lane: 0, source: 'none' });
  });

  it('anchors a pair on a car whose side it remembers', () => {
    const tracker = new RadarLaneTracker();
    const { time } = settle(
      tracker,
      0,
      [{ carIdx: 4, dist: -2 }],
      CarLeftRight.CarRight
    );

    // Car 4 drops back level with car 7, which it has never been beside us.
    const { lanes } = settle(
      tracker,
      time,
      [
        { carIdx: 4, dist: -10 },
        { carIdx: 7, dist: -11 },
      ],
      CarLeftRight.Clear,
      1
    );

    expect(laneOf(lanes, 4)).toBe(1);
    expect(laneOf(lanes, 7)).toBe(0);
  });

  it('corrects a pair once the spotter sees one of them', () => {
    const tracker = new RadarLaneTracker();
    const behind = [
      { carIdx: 4, dist: -15 },
      { carIdx: 7, dist: -15.5 },
    ];
    const { time } = settle(tracker, 0, behind, CarLeftRight.Clear);

    // The pair arrives; car 4, guessed left, is called on the right.
    const alongside = [
      { carIdx: 4, dist: -2 },
      { carIdx: 7, dist: -2.5 },
    ];
    const { lanes } = settle(
      tracker,
      time,
      alongside,
      CarLeftRight.CarLeftRight
    );

    expect(laneOf(lanes, 4)).not.toBe(laneOf(lanes, 7));
    expect(lanes.get(4)?.source).toBe('spotter');
  });

  it('ignores the spotter when it does not describe the focus car', () => {
    const tracker = new RadarLaneTracker();
    const { lanes } = settle(tracker, 0, [{ carIdx: 1, dist: -1 }], null);

    expect(lanes.get(1)).toEqual({ lane: 0, source: 'none' });
  });

  it('forgets everything when time runs backwards (replay rewind)', () => {
    const tracker = new RadarLaneTracker();
    settle(tracker, 10, [{ carIdx: 1, dist: -1 }], CarLeftRight.CarLeft);

    const lanes = tracker.update(
      5,
      [{ carIdx: 1, dist: 20 }],
      CarLeftRight.Clear
    );
    expect(lanes.get(1)).toEqual({ lane: 0, source: 'none' });
  });

  describe('in formation', () => {
    const formation = (
      slots: [number, number][],
      kind: 'grid' | 'pace' = 'pace'
    ) => ({
      kind,
      slots: new Map(slots),
    });

    it('takes lanes from the formation, pole side left by default', () => {
      const tracker = new RadarLaneTracker();
      const { lanes } = settle(
        tracker,
        0,
        [
          { carIdx: 1, dist: 8 },
          { carIdx: 2, dist: 4 },
          { carIdx: 3, dist: -8 },
        ],
        CarLeftRight.Clear,
        1,
        formation([
          [1, 0],
          [2, -1],
          [3, 0],
        ])
      );

      // We are in the outside column; the car one column towards the pole
      // is on our left, and the formation beats the pair guess for 1 and 2.
      expect(lanes.get(1)).toEqual({ lane: 0, source: 'pace' });
      expect(lanes.get(2)).toEqual({ lane: -1, source: 'pace' });
      expect(lanes.get(3)).toEqual({ lane: 0, source: 'pace' });
    });

    it('mirrors for a pole on the right', () => {
      const tracker = new RadarLaneTracker();
      tracker.setPoleSide('right');
      const { lanes } = settle(
        tracker,
        0,
        [{ carIdx: 2, dist: 4 }],
        CarLeftRight.Clear,
        1,
        formation([[2, -1]], 'grid')
      );

      expect(lanes.get(2)).toEqual({ lane: 1, source: 'grid' });
    });

    it('flips the pole side only when the spotter keeps disagreeing', () => {
      const tracker = new RadarLaneTracker();
      const cars = [{ carIdx: 2, dist: 1 }];
      const slots = formation([[2, 1]]);
      // Formation says right (pole left, car one column out); spotter says left.
      let lanes = tracker.update(0, cars, CarLeftRight.CarLeft, slots);
      expect(lanes.get(2)?.source).toBe('pace');
      for (let tick = 1; tick < 10; tick += 1) {
        lanes = tracker.update(tick / 60, cars, CarLeftRight.CarLeft, slots);
      }
      expect(lanes.get(2)?.lane).toBeGreaterThan(0);

      ({ lanes } = settle(
        tracker,
        10 / 60,
        cars,
        CarLeftRight.CarLeft,
        1,
        slots
      ));
      expect(lanes.get(2)).toEqual({ lane: -1, source: 'pace' });
    });

    it('keeps formation lanes for a while after the green', () => {
      const tracker = new RadarLaneTracker();
      const cars = [{ carIdx: 2, dist: 12 }];
      const { time } = settle(
        tracker,
        0,
        cars,
        CarLeftRight.Clear,
        1,
        formation([[2, 1]], 'grid')
      );
      const { lanes } = settle(tracker, time, cars, CarLeftRight.Clear, 1);

      expect(lanes.get(2)).toEqual({ lane: 1, source: 'memory' });
    });

    it('learns the pole side just after the green, from the last formation', () => {
      // Okayama: pace line 0 runs on the right, the grid text says nothing.
      const tracker = new RadarLaneTracker();
      const slots = formation([[9, -1]]);
      // Pacing: the spotter stays silent, so the default (pole left) holds.
      let { time, lanes } = settle(
        tracker,
        0,
        [{ carIdx: 9, dist: 0.5 }],
        CarLeftRight.Clear,
        1,
        slots
      );
      expect(lanes.get(9)).toEqual({ lane: -1, source: 'pace' });

      // Green: still two abreast, and now the spotter calls car 9 right.
      ({ time, lanes } = settle(
        tracker,
        time,
        [{ carIdx: 9, dist: 1 }],
        CarLeftRight.CarRight,
        1
      ));
      expect(laneOf(lanes, 9)).toBe(1);
      expect(tracker.takeLearntPoleSides()).toEqual([
        { kind: 'pace', side: 'right' },
      ]);
      expect(tracker.takeLearntPoleSides()).toEqual([]);

      // The next start, even after a camera switch, uses the learnt side.
      tracker.reset();
      ({ lanes } = settle(
        tracker,
        time,
        [{ carIdx: 9, dist: 0.5 }],
        CarLeftRight.Clear,
        1,
        slots
      ));
      expect(lanes.get(9)).toEqual({ lane: 1, source: 'pace' });
    });

    it('reports a confirmed pole side once', () => {
      const tracker = new RadarLaneTracker();
      settle(
        tracker,
        0,
        [{ carIdx: 9, dist: 1 }],
        CarLeftRight.CarLeft,
        2,
        formation([[9, -1]], 'grid')
      );
      expect(tracker.takeLearntPoleSides()).toEqual([
        { kind: 'grid', side: 'left' },
      ]);
    });

    it('stops learning long after the formation ended', () => {
      const tracker = new RadarLaneTracker();
      const { time } = settle(
        tracker,
        0,
        [{ carIdx: 9, dist: 30 }],
        CarLeftRight.Clear,
        1,
        formation([[9, -1]])
      );
      settle(
        tracker,
        time + 20,
        [{ carIdx: 9, dist: 1 }],
        CarLeftRight.CarRight,
        1
      );
      expect(tracker.takeLearntPoleSides()).toEqual([]);
    });

    it('lets the spotter place a car that is not in formation', () => {
      const tracker = new RadarLaneTracker();
      const { lanes } = settle(
        tracker,
        0,
        [
          { carIdx: 2, dist: 1 },
          { carIdx: 5, dist: -2 },
        ],
        CarLeftRight.CarLeftRight,
        1,
        formation([[2, 1]])
      );

      // Car 2 fills the right from the formation; car 5 must be the left one.
      expect(lanes.get(2)).toEqual({ lane: 1, source: 'pace' });
      expect(lanes.get(5)).toEqual({ lane: -1, source: 'spotter' });
    });
  });
});
