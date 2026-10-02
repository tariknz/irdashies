import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { CarLeftRight, TrackLocation } from '@irdashies/types';
import {
  parseTrackLength,
  RADAR_MAX_RANGE_M,
  RadarProcessor,
} from './RadarProcessor';

const TRACK_LENGTH = 4000;

const session = (
  drivers: {
    CarIdx: number;
    CarIsPaceCar?: number;
    IsSpectator?: number;
  }[] = []
) =>
  ({
    WeekendInfo: { TrackLength: '4.00 km' },
    DriverInfo: { Drivers: drivers },
  }) as unknown as Session;

interface FrameOptions {
  time: number;
  pcts: number[];
  camCarIdx?: number;
  playerCarIdx?: number;
  onPitRoad?: boolean[];
  surfaces?: number[];
  isOnTrack?: boolean;
  carLeftRight?: number;
}

const frame = ({
  time,
  pcts,
  camCarIdx = 0,
  playerCarIdx = 0,
  onPitRoad = pcts.map(() => false),
  surfaces = pcts.map(() => TrackLocation.OnTrack),
  isOnTrack = true,
  carLeftRight = CarLeftRight.Clear,
}: FrameOptions) =>
  ({
    SessionTime: { value: [time] },
    CarIdxLapDistPct: { value: pcts },
    CamCarIdx: { value: [camCarIdx] },
    PlayerCarIdx: { value: [playerCarIdx] },
    CarIdxOnPitRoad: { value: onPitRoad },
    CarIdxTrackSurface: { value: surfaces },
    IsOnTrack: { value: [isOnTrack] },
    CarLeftRight: { value: [carLeftRight] },
  }) as unknown as Telemetry;

/** Lap fraction for a distance in metres on the test track. */
const m = (metres: number) => metres / TRACK_LENGTH;

const createProcessor = (drivers?: Parameters<typeof session>[0]) => {
  const processor = new RadarProcessor();
  processor.init(session(drivers));
  return processor;
};

describe('parseTrackLength', () => {
  it('reads kilometres, miles and bare metres', () => {
    expect(parseTrackLength('5.51 km')).toBeCloseTo(5510);
    expect(parseTrackLength('2.50 mi')).toBeCloseTo(4023.36);
    expect(parseTrackLength('800')).toBe(800);
  });

  it('returns 0 for missing or malformed input', () => {
    expect(parseTrackLength(undefined)).toBe(0);
    expect(parseTrackLength('fast km')).toBe(0);
  });
});

describe('RadarProcessor', () => {
  it('measures rivals in metres along the track, nearest first', () => {
    const processor = createProcessor();
    processor.onFrame(frame({ time: 1, pcts: [0.5, 0.5 + m(30), 0.5 - m(8)] }));

    const { cars, focusCarIdx, trackLength } = processor.snapshot();
    expect(focusCarIdx).toBe(0);
    expect(trackLength).toBe(TRACK_LENGTH);
    expect(cars.map((car) => car.carIdx)).toEqual([2, 1]);
    expect(cars[0].dist).toBeCloseTo(-8);
    expect(cars[1].dist).toBeCloseTo(30);
    expect(cars.every((car) => car.lane === 0)).toBe(true);
  });

  it('measures across the start/finish line by the short way', () => {
    const processor = createProcessor();
    processor.onFrame(frame({ time: 1, pcts: [0.999, m(6), 1 - m(10)] }));

    const dists = processor.snapshot().cars.map((car) => car.dist);
    expect(dists[0]).toBeCloseTo(-10 + 0.001 * TRACK_LENGTH);
    expect(dists[1]).toBeCloseTo(6 + 0.001 * TRACK_LENGTH);
  });

  it('drops cars beyond range, out of the world, and the pace car', () => {
    const processor = createProcessor([{ CarIdx: 3, CarIsPaceCar: 1 }]);
    processor.onFrame(
      frame({
        time: 1,
        pcts: [0.5, 0.5 + m(RADAR_MAX_RANGE_M + 1), 0.5 + m(5), 0.5 + m(2)],
        surfaces: [
          TrackLocation.OnTrack,
          TrackLocation.OnTrack,
          TrackLocation.NotInWorld,
          TrackLocation.OnTrack,
        ],
      })
    );

    expect(processor.snapshot().cars).toEqual([]);
  });

  it('centres on the camera car when spectating', () => {
    const processor = createProcessor();
    processor.onFrame(
      frame({ time: 1, pcts: [0.1, 0.5, 0.5 + m(4)], camCarIdx: 1 })
    );

    const snapshot = processor.snapshot();
    expect(snapshot.focusCarIdx).toBe(1);
    expect(snapshot.cars.map((car) => car.carIdx)).toEqual([2]);
  });

  it('derives speeds from progress so the renderer can extrapolate', () => {
    const processor = createProcessor();
    // Focus at 50 m/s, rival 10 m behind at 55 m/s, 60 frames a second.
    for (let tick = 0; tick <= 60; tick += 1) {
      const time = tick / 60;
      processor.onFrame(
        frame({
          time,
          pcts: [0.5 + m(50 * time), 0.5 + m(-10 + 55 * time)],
        })
      );
    }

    const snapshot = processor.snapshot();
    expect(snapshot.playerSpeed).toBeCloseTo(50, 1);
    expect(snapshot.cars[0].closingSpeed).toBeCloseTo(5, 1);
  });

  it('ignores a teleport instead of reporting a huge speed', () => {
    const processor = createProcessor();
    processor.onFrame(frame({ time: 0, pcts: [0.5, 0.5 - m(5)] }));
    processor.onFrame(frame({ time: 1 / 60, pcts: [0.5, 0.5 + m(5)] }));

    expect(processor.snapshot().cars[0].closingSpeed).toBe(0);
  });

  it('reports pit road and off-track state per car', () => {
    const processor = createProcessor();
    processor.onFrame(
      frame({
        time: 1,
        pcts: [0.5, 0.5 + m(3), 0.5 + m(6)],
        onPitRoad: [true, true, false],
        surfaces: [
          TrackLocation.ApproachingPits,
          TrackLocation.InPitStall,
          TrackLocation.OffTrack,
        ],
      })
    );

    const { cars, focusOnPitRoad } = processor.snapshot();
    expect(focusOnPitRoad).toBe(true);
    expect(cars).toMatchObject([
      { carIdx: 1, onPitRoad: true, offTrack: false },
      { carIdx: 2, onPitRoad: false, offTrack: true },
    ]);
  });

  it('does not republish an unchanged empty radar', () => {
    const processor = createProcessor();
    processor.onFrame(frame({ time: 1, pcts: [0.5, 0.9] }));
    const version = processor.snapshot().version;

    processor.onFrame(frame({ time: 1, pcts: [0.5, 0.9] }));
    expect(processor.snapshot().version).toBe(version);

    processor.onFrame(frame({ time: 1.1, pcts: [0.51, 0.9] }));
    expect(processor.snapshot().version).toBe(version + 1);
  });

  it('publishes nothing before a session gives the track length', () => {
    const processor = new RadarProcessor();
    processor.onFrame(frame({ time: 1, pcts: [0.5, 0.5 + m(5)] }));

    expect(processor.snapshot().cars).toEqual([]);
  });

  it('puts a car the spotter calls alongside in its lane', () => {
    const processor = createProcessor();
    for (let tick = 0; tick <= 60; tick += 1) {
      processor.onFrame(
        frame({
          time: tick / 60,
          pcts: [0.5, 0.5 - m(1), 0.5 + m(40)],
          carLeftRight: CarLeftRight.CarLeft,
        })
      );
    }

    expect(processor.snapshot().cars).toMatchObject([
      { carIdx: 1, lane: -1, laneSource: 'spotter' },
      { carIdx: 2, lane: 0, laneSource: 'none' },
    ]);
  });

  it('does not apply the spotter while watching another car', () => {
    const processor = createProcessor();
    for (let tick = 0; tick <= 60; tick += 1) {
      processor.onFrame(
        frame({
          time: tick / 60,
          pcts: [0.1, 0.5, 0.5 - m(1)],
          camCarIdx: 1,
          carLeftRight: CarLeftRight.CarLeft,
        })
      );
    }

    expect(processor.snapshot().cars).toMatchObject([
      { carIdx: 2, lane: 0, laneSource: 'none' },
    ]);
  });

  it('clears everything on disconnect and session change', () => {
    const processor = createProcessor();
    processor.onFrame(frame({ time: 1, pcts: [0.5, 0.5 + m(5)] }));
    const version = processor.snapshot().version;

    processor.onLifecycle({ type: 'sessionNumChange' });

    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: null,
      cars: [],
      version: version + 1,
    });
  });
});
