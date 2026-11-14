import { describe, expect, it } from 'vitest';
import type { PitStopRecord, Session, Telemetry } from '@irdashies/types';
import { TrackLocation } from '@irdashies/types';
import { DRIVER_SETTLE_SECONDS, PitStopProcessor } from './PitStopProcessor';

const { OnTrack, InPitStall, ApproachingPits, NotInWorld } = TrackLocation;

interface CarState {
  surface: number;
  onPit?: boolean;
  lap?: number;
  position?: number;
  compound?: number;
  repairs?: number;
}

const frame = (
  sessionTime: number,
  cars: CarState[],
  sessionNum = 0
): Telemetry =>
  ({
    SessionTime: { value: [sessionTime] },
    SessionNum: { value: [sessionNum] },
    CarIdxTrackSurface: { value: cars.map((car) => car.surface) },
    CarIdxOnPitRoad: { value: cars.map((car) => car.onPit ?? false) },
    CarIdxLap: { value: cars.map((car) => car.lap ?? 0) },
    CarIdxClassPosition: { value: cars.map((car) => car.position ?? 1) },
    CarIdxTireCompound: { value: cars.map((car) => car.compound ?? 0) },
    CarIdxFastRepairsUsed: { value: cars.map((car) => car.repairs ?? 0) },
  }) as unknown as Telemetry;

const session = (
  drivers: { carIdx: number; userId: number; name: string; pace?: boolean }[],
  subSessionId = 1001
): Session =>
  ({
    WeekendInfo: { SubSessionID: subSessionId },
    DriverInfo: {
      Drivers: drivers.map((driver) => ({
        CarIdx: driver.carIdx,
        UserID: driver.userId,
        UserName: driver.name,
        CarIsPaceCar: driver.pace ? 1 : 0,
        IsSpectator: 0,
      })),
    },
  }) as unknown as Session;

const ROSTER = [
  { carIdx: 0, userId: 11, name: 'Driver A' },
  { carIdx: 1, userId: 21, name: 'Driver B' },
];

const onTrack = (lap = 5): CarState => ({ surface: OnTrack, lap });
const onPitRoad = (lap = 5): CarState => ({
  surface: ApproachingPits,
  onPit: true,
  lap,
});
const inStall = (lap = 5): CarState => ({
  surface: InPitStall,
  onPit: true,
  lap,
});

const stopsOf = (processor: PitStopProcessor): PitStopRecord[] =>
  processor.snapshot().stops;

describe('PitStopProcessor', () => {
  it('publishes on the pit-stops channel as events', () => {
    const processor = new PitStopProcessor();
    expect(processor.channel).toBe('pit-stops.snapshot');
    expect(processor.tickRateHz).toBe('event');
  });

  it('times pit road and the stall for a normal stop', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [{ ...onPitRoad(), position: 3 }, onTrack()]));
    processor.onFrame(frame(110, [inStall(), onTrack()]));
    processor.onFrame(frame(148, [onPitRoad(), onTrack()]));
    processor.onFrame(
      frame(160, [{ surface: OnTrack, lap: 6, position: 5 }, onTrack()])
    );

    expect(stopsOf(processor)).toEqual([
      expect.objectContaining({
        id: 1,
        carIdx: 0,
        kind: 'pit',
        lap: 5,
        entryTime: 101,
        exitTime: 160,
        stallTime: 110,
        stallSeconds: 38,
        stallEnteredAt: null,
        classPositionIn: 3,
        classPositionOut: 5,
        driverNameIn: 'Driver A',
        driverNameOut: 'Driver A',
      }),
    ]);
  });

  it('shows a stop in progress, including the current stall visit', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(110, [inStall(), onTrack()]));
    processor.onFrame(frame(120, [inStall(), onTrack()]));

    const snapshot = processor.snapshot();
    expect(snapshot.sessionTime).toBe(120);
    expect(snapshot.stops[0]).toMatchObject({
      exitTime: null,
      stallEnteredAt: 110,
      stallSeconds: 0,
    });
  });

  it('records a drive-through with no stall time', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(130, [onTrack(6), onTrack()]));

    expect(stopsOf(processor)[0]).toMatchObject({
      stallTime: null,
      stallSeconds: 0,
      exitTime: 130,
    });
  });

  it('ignores a brush with the pit lane line', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(102, [onTrack(), onTrack()]));

    expect(stopsOf(processor)).toEqual([]);
  });

  it('follows a driver swap the roster reports after the car leaves', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(110, [inStall(), onTrack()]));
    processor.onFrame(frame(150, [onTrack(6), onTrack()]));
    processor.init(
      session([{ carIdx: 0, userId: 12, name: 'Driver C' }, ROSTER[1]])
    );

    expect(stopsOf(processor)[0]).toMatchObject({
      driverIdIn: 11,
      driverNameIn: 'Driver A',
      driverIdOut: 12,
      driverNameOut: 'Driver C',
    });
  });

  it('stops following the roster once the stop has settled', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(150, [onTrack(6), onTrack()]));
    processor.onFrame(
      frame(150 + DRIVER_SETTLE_SECONDS + 1, [onTrack(9), onTrack()])
    );
    processor.init(
      session([{ carIdx: 0, userId: 12, name: 'Driver C' }, ROSTER[1]])
    );

    expect(stopsOf(processor)[0].driverIdOut).toBe(11);
  });

  it('records a tow to the stall as a stop', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [{ surface: NotInWorld }, onTrack()]));
    processor.onFrame(frame(105, [inStall(), onTrack()]));
    processor.onFrame(frame(200, [onTrack(6), onTrack()]));

    expect(stopsOf(processor)[0]).toMatchObject({
      kind: 'tow',
      entryTime: 105,
      stallSeconds: 95,
    });
  });

  it('does not count a car first appearing in its stall', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [{ surface: NotInWorld }, onTrack()]));
    processor.onFrame(frame(105, [inStall(0), onTrack()]));
    processor.onFrame(frame(200, [onTrack(1), onTrack()]));

    expect(stopsOf(processor)).toEqual([]);
  });

  it('does not time a stop already under way when recording starts', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [inStall(), onTrack()]));
    processor.onFrame(frame(140, [onTrack(6), onTrack()]));

    expect(stopsOf(processor)).toEqual([]);
  });

  it('counts fast repairs and tyre compound changes', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [{ ...onTrack(), repairs: 1 }, onTrack()]));
    processor.onFrame(frame(101, [{ ...onPitRoad(), repairs: 1 }, onTrack()]));
    processor.onFrame(
      frame(110, [{ ...inStall(), repairs: 2, compound: 1 }, onTrack()])
    );
    processor.onFrame(
      frame(150, [{ ...onTrack(6), repairs: 2, compound: 1 }, onTrack()])
    );

    expect(stopsOf(processor)[0]).toMatchObject({
      fastRepairs: 1,
      compoundIn: 0,
      compoundOut: 1,
    });
  });

  it('skips the pace car', () => {
    const processor = new PitStopProcessor();
    processor.init(
      session([...ROSTER, { carIdx: 2, userId: -1, name: 'Pace', pace: true }])
    );
    processor.onFrame(frame(100, [onTrack(), onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onTrack(), onTrack(), onPitRoad()]));
    processor.onFrame(frame(140, [onTrack(), onTrack(), onTrack()]));

    expect(stopsOf(processor)).toEqual([]);
  });

  it('starts again for a new session', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(140, [onTrack(), onTrack()]));
    processor.onFrame(frame(10, [onTrack(), onTrack()], 1));

    const snapshot = processor.snapshot();
    expect(snapshot.sessionNum).toBe(1);
    expect(snapshot.stops).toEqual([]);
  });

  it('starts again for a new event with the same session number', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(140, [onTrack(), onTrack()]));
    expect(stopsOf(processor)).toHaveLength(1);

    processor.init(session(ROSTER, 2002));
    expect(processor.snapshot()).toMatchObject({
      subSessionId: 2002,
      sessionNum: null,
      stops: [],
    });
    processor.onFrame(frame(10, [onTrack(), onTrack()]));
    expect(processor.snapshot()).toMatchObject({ sessionNum: 0, stops: [] });
  });

  it('keeps stops through a roster update in the same event', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(140, [onTrack(), onTrack()]));
    processor.init(session(ROSTER));
    expect(stopsOf(processor)).toHaveLength(1);
  });

  it('keeps recorded stops after a disconnect', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(100, [onTrack(), onTrack()]));
    processor.onFrame(frame(101, [onPitRoad(), onTrack()]));
    processor.onFrame(frame(110, [inStall(), onTrack()]));
    processor.onLifecycle({ type: 'disconnect' });

    expect(stopsOf(processor)[0]).toMatchObject({
      exitTime: 110,
      stallEnteredAt: null,
    });
  });

  it('restores saved stops ahead of ones recorded since a restart', () => {
    const processor = new PitStopProcessor();
    processor.init(session(ROSTER));
    processor.onFrame(frame(500, [onTrack(), onTrack()]));
    processor.onFrame(frame(501, [onTrack(), onPitRoad()]));

    const saved: PitStopRecord = {
      ...stopsOf(processor)[0],
      id: 7,
      carIdx: 0,
      entryTime: 100,
      exitTime: 150,
    };
    expect(processor.restore([saved])).toBe(true);

    const stops = stopsOf(processor);
    expect(stops.map((stop) => [stop.id, stop.carIdx])).toEqual([
      [7, 0],
      [8, 1],
    ]);
    processor.onFrame(frame(540, [onTrack(), onTrack(6)]));
    expect(stopsOf(processor)[1].exitTime).toBe(540);
  });
});
