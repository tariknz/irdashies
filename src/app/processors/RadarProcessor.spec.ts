import { describe, expect, it } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import recordedSession from '../../../test-data/1747384033336/session.json';
import recordedFrame from '../../../test-data/1747384033336/telemetry.json';
import sparseRecordedFrame from '../../../test-data/1770713920383/telemetry.json';
import { RadarProcessor } from './RadarProcessor';

const frame = (
  positions: number[],
  {
    camCarIdx = 0,
    speed = 0,
    onPitRoad = [false, false],
    paceRow = [-1, -1],
    paceLine = [-1, -1],
    isOnTrack = true,
    sessionNum = 1,
    sessionState = 0,
  }: {
    camCarIdx?: number;
    speed?: number;
    onPitRoad?: boolean[];
    paceRow?: number[];
    paceLine?: number[];
    isOnTrack?: boolean;
    sessionNum?: number;
    sessionState?: number;
  } = {}
) =>
  ({
    CamCarIdx: { value: [camCarIdx] },
    Speed: { value: [speed] },
    CarIdxLapDistPct: { value: positions },
    CarIdxOnPitRoad: { value: onPitRoad },
    CarIdxPaceRow: { value: paceRow },
    CarIdxPaceLine: { value: paceLine },
    SessionState: { value: [sessionState] },
    IsOnTrack: { value: [isOnTrack] },
    SessionNum: { value: [sessionNum] },
  }) as unknown as Telemetry;

describe('RadarProcessor', () => {
  it('publishes recorded telemetry through the complete lifecycle', () => {
    const processor = new RadarProcessor();
    processor.init(recordedSession as unknown as Session);
    processor.onFrame(recordedFrame as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: recordedFrame.CamCarIdx.value[0],
      carIdxLapDistPct: recordedFrame.CarIdxLapDistPct.value,
      carIdxOnPitRoad: recordedFrame.CarIdxOnPitRoad.value,
      isOnTrack: true,
      version: 1,
    });
  });

  it('tolerates a recorded frame that omits variables', () => {
    // Captures only hold the variables a recording asked for, and drivers the
    // sim has not placed report -1; neither may crash a frame read.
    const processor = new RadarProcessor();
    processor.onFrame(sparseRecordedFrame as unknown as Telemetry);

    expect(processor.snapshot().carIdxLapDistPct).toEqual(
      sparseRecordedFrame.CarIdxLapDistPct.value
    );
  });

  it('tolerates a frame carrying none of the variables it reads', () => {
    const processor = new RadarProcessor();
    processor.onFrame({} as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      focusCarIdx: null,
      carIdxLapDistPct: [],
      carIdxOnPitRoad: [],
      version: 0,
    });
  });

  it('publishes focus car and full-precision positions', () => {
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.123456789, 0.123987654], { camCarIdx: 1 }));

    expect(processor.snapshot()).toEqual({
      focusCarIdx: 1,
      carIdxLapDistPct: [0.123456789, 0.123987654],
      carIdxOnPitRoad: [false, false],
      carIdxPaceRow: [-1, -1],
      carIdxPaceLine: [-1, -1],
      sessionState: 0,
      carSpeed: 0,
      isOnTrack: true,
      version: 1,
    });
  });
  it('uses the supported player Speed variable', () => {
    const processor = new RadarProcessor();
    processor.onFrame({
      ...frame([0.1, 0.2], { speed: 42 }),
      CarSpeed: { value: [0] },
    } as unknown as Telemetry);

    expect(processor.snapshot().carSpeed).toBe(42);
  });

  it('bumps the version only when a published field changes', () => {
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.1, 0.2]));
    expect(processor.snapshot().version).toBe(1);

    processor.onFrame(frame([0.1, 0.2]));
    expect(processor.snapshot().version).toBe(1);

    processor.onFrame(frame([0.1, 0.203]));
    expect(processor.snapshot().version).toBe(2);

    processor.onFrame(frame([0.1, 0.203], { camCarIdx: 1 }));
    expect(processor.snapshot().version).toBe(3);
  });

  it('tracks pit-road changes per car', () => {
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.1, 0.2]));
    processor.onFrame(frame([0.1, 0.2], { onPitRoad: [false, true] }));

    expect(processor.snapshot()).toMatchObject({
      carIdxOnPitRoad: [false, true],
      version: 2,
    });
  });

  it('reports cars with no valid position as -1 rather than dropping them', () => {
    const processor = new RadarProcessor();
    processor.onFrame({
      CamCarIdx: { value: [0] },
      CarIdxLapDistPct: { value: [-1, 0.42] },
      CarIdxOnPitRoad: { value: [false, false] },
      IsOnTrack: { value: [true] },
      SessionNum: { value: [1] },
    } as unknown as Telemetry);

    // Index alignment is the contract: CarIdx 1 stays at index 1.
    expect(processor.snapshot().carIdxLapDistPct).toEqual([-1, 0.42]);
  });

  it('keeps the last focus car while the camera index is invalid', () => {
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.1, 0.2], { camCarIdx: 3 }));
    processor.onFrame(frame([0.1, 0.2], { camCarIdx: -1 }));

    expect(processor.snapshot().focusCarIdx).toBe(3);
  });

  it('clears per-car state at lifecycle boundaries', () => {
    const processor = new RadarProcessor();
    processor.init({} as Session);
    processor.onFrame(
      frame([0.5, 0.6], {
        camCarIdx: 2,
        paceRow: [1, 1],
        paceLine: [0, 1],
      })
    );
    processor.onLifecycle({ type: 'disconnect' });

    expect(processor.snapshot()).toEqual({
      focusCarIdx: null,
      carIdxLapDistPct: [],
      carIdxOnPitRoad: [],
      carIdxPaceRow: [],
      carIdxPaceLine: [],
      sessionState: 0,
      carSpeed: 0,
      isOnTrack: false,
      version: 2,
    });
  });

  it('carries the sim grid through, so the radar can place a standing field', () => {
    // The grid is the only statement of which column a parked car is in. The
    // numbers are copied rather than derived, so they must survive the trip
    // from the frame to the renderer byte for byte.
    const processor = new RadarProcessor();
    processor.onFrame(
      frame([0.5, 0.6, 0.7], {
        camCarIdx: 0,
        paceRow: [-1, 3, 3],
        paceLine: [-1, 0, 1],
      })
    );

    expect(processor.snapshot()).toMatchObject({
      carIdxPaceRow: [-1, 3, 3],
      carIdxPaceLine: [-1, 0, 1],
    });
  });

  it('leaves state intact on session enter', () => {
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.5, 0.6]));
    processor.onLifecycle({ type: 'enter', replay: false });

    expect(processor.snapshot()).toMatchObject({
      carIdxLapDistPct: [0.5, 0.6],
      version: 1,
    });
  });

  it('exposes a player speed that alone cannot classify the grid', () => {
    // Speed is a float, so 0.4 is exactly representable. The grid test in
    // useRadar is `carSpeed < 0.5`, and a 60 Hz rounding step in any encoder
    // on the way to the renderer could put a genuinely stationary car above it
    // — which clears every overlap side and rim signal, so no alongside car is
    // placed and nothing is drawn in the disc's dead centre. Asserting the
    // processor hands the reading over untouched keeps that decision, and the
    // one place that can fix it, in view.
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.5, 0.6], { speed: 0.4 }));

    expect(processor.snapshot().carSpeed).toBe(0.4);
  });

  it('publishes the session state', () => {
    // The radar reads the session state to decide whether the cars are still
    // parked, and it is not on the channel without the processor copying it.
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.5, 0.5], { sessionState: 3 }));

    expect(processor.snapshot()).toMatchObject({
      sessionState: 3,
    });
  });

  it('reports no session state before the first frame carries it', () => {
    // A frame without the variable leaves the field at Invalid, which is what
    // keeps the radar from reconstructing a grid it knows nothing about.
    const processor = new RadarProcessor();
    processor.onFrame({
      CamCarIdx: { value: [0] },
    } as unknown as Telemetry);

    expect(processor.snapshot()).toMatchObject({
      sessionState: 0,
    });
  });

  it('clears the session state at a lifecycle boundary', () => {
    // Car indices are re-used between sessions, so state left behind would
    // belong to other cars entirely.
    const processor = new RadarProcessor();
    processor.onFrame(frame([0.5, 0.5], { sessionState: 3 }));
    processor.onLifecycle({ type: 'sessionNumChange' });

    expect(processor.snapshot()).toMatchObject({
      sessionState: 0,
    });
  });
});
