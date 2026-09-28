import { afterEach, describe, expect, it, vi } from 'vitest';
import * as geometry from '@irdashies/domain/trackGeometry';
import type { TrackDrawing } from '@irdashies/domain/trackGeometry';
import {
  blipLabel,
  computeRadarBlips,
  emptyTargetState,
  type RadarBlip,
  type RadarBlipInput,
  type RadarTargetState,
} from './radarBlips';
import {
  NO_OVERLAP,
  type OverlapSide,
  type RadarOverlap,
} from './overlapSides';

/**
 * Spacing between the fixture's path points, in canvas units. The bundled
 * drawings run 2.5 to 3.2 m between points, and the projection reads the road
 * through a filter sized from that spacing — a coarser fixture would be rounded
 * far more heavily than any real track, and the expected offsets below would
 * have to be loosened to match the rounding rather than the geometry. The
 * rectangle is 400x200 with a total length of 1200, so one unit is one metre.
 */
const EDGE_STEP = 2.5;
const RECT_WIDTH = 400;
const RECT_HEIGHT = 200;
const TRACK_LENGTH_M = 1200;

const rectanglePath = () => {
  const points: { x: number; y: number }[] = [];
  for (let x = 0; x <= RECT_WIDTH; x += EDGE_STEP) points.push({ x, y: 0 });
  for (let y = EDGE_STEP; y <= RECT_HEIGHT; y += EDGE_STEP)
    points.push({ x: RECT_WIDTH, y });
  for (let x = RECT_WIDTH - EDGE_STEP; x >= 0; x -= EDGE_STEP)
    points.push({ x, y: RECT_HEIGHT });
  for (let y = RECT_HEIGHT - EDGE_STEP; y >= 0; y -= EDGE_STEP)
    points.push({ x: 0, y });
  return points;
};

const trackDrawing = (
  direction: 'clockwise' | 'anticlockwise' = 'anticlockwise'
): TrackDrawing => ({
  active: {
    inside: '',
    outside: '',
    trackPathPoints: rectanglePath(),
    totalLength: 1200,
  },
  startFinish: {
    point: { length: 0 },
    direction,
  },
});

const pctOfArc = (arcMetres: number) => arcMetres / TRACK_LENGTH_M;

const positionsOf = (
  positions: number[],
  onPitRoad: boolean[] = positions.map(() => false)
) => ({
  carIdxLapDistPct: positions,
  carIdxOnPitRoad: onPitRoad,
});

const baseInput: Omit<RadarBlipInput, 'carIdxLapDistPct' | 'carIdxOnPitRoad'> =
  {
    playerCarIdx: 0,
    trackDrawing: trackDrawing(),
    trackLengthM: TRACK_LENGTH_M,
    radarRange: 15,
    hideInPit: false,
    overlap: NO_OVERLAP,
    vehicleWidth: 2,
    vehicleLength: 4.5,
    carNumbers: new Map([
      [1, '24'],
      [2, '7'],
    ]),
    paceCarIdx: null,
    gridLayout: null,
    carIdxPosition: [],
    previousTargets: emptyTargetState(8),
    nextTargets: emptyTargetState(8),
    followingMapBuffer: new Float64Array(2048),
  };

const targetBuffers = (): [RadarTargetState, RadarTargetState] => [
  emptyTargetState(8),
  emptyTargetState(8),
];

/** A previous frame's state holding the given sides. */
const heldSides = (sides: Record<number, OverlapSide>): RadarTargetState => {
  const state = emptyTargetState(8);
  for (const [carIdx, side] of Object.entries(sides)) {
    state.side[Number(carIdx)] = side;
  }
  return state;
};

describe('computeRadarBlips', () => {
  // The filter test spies on the geometry module, and nothing restores mocks
  // between tests here, so the spy would answer to every later test in the file.
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('measures a car ahead on the same straight as along-track metres', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(300), pctOfArc(312)]),
    });

    expect(result.hasGeometry).toBe(true);
    expect(result.playerOnRoad).toBe(true);
    expect(result.blips).toHaveLength(1);
    expect(result.blips[0].carIdx).toBe(1);
    expect(result.blips[0].alongM).toBeCloseTo(12, 6);
    expect(result.blips[0].lateralM).toBeCloseTo(0, 6);
    expect(result.blips[0].gapM).toBeCloseTo(12, 6);
    expect(result.blips[0].relYaw).toBeCloseTo(0, 6);
  });

  it('keeps a car standing exactly on the range edge', () => {
    // The gate is `> radarRange`, so a car at exactly the range is still on the
    // disc. Nothing else in these fixtures sits on the edge, so a `<` for `>`
    // here would drop a car that is still on the widget.
    //
    // The offsets are chosen so the gate sees an exact 18.75: 1/64 of a lap is a
    // binary fraction, so the delta and its product by 1200 both land on the
    // bound without rounding either side of it. 18.75 m at 0.5 + 2**-6 gives a
    // comfortable margin from the rounding on 15, which does not.
    const onEdge = 1 / 64;
    const result = computeRadarBlips({
      ...baseInput,
      radarRange: 18.75,
      ...positionsOf([pctOfArc(600), 0.5 + onEdge, 0.5 + onEdge * 1.01]),
    });

    expect(result.blips).toHaveLength(1);
    expect(result.blips[0].carIdx).toBe(1);
    expect(result.blips[0].alongM).toBeCloseTo(18.75, 6);
  });

  it('reads the road through the filter, not the drawing raw points', () => {
    // A dead-straight road sampled the way the bundled drawings are: whole
    // units only, stepping a unit sideways every other point. Both cars are on
    // points of the same phase, so their offset cancels on the raw polyline —
    // the car ahead reads a lateral offset of exactly zero. The filter is what
    // makes the two points of the alternation agree, and it is the only thing
    // between this call and the drawing's raw zigzag, which put up to half a
    // metre of wander on a blip holding a steady gap.
    //
    // The function is mocked rather than fed a raw path because this one cannot
    // be given a raw path: it always filters what it is handed, so the only way
    // to see whether the filter ran is to watch it being asked.
    const noisy = () => {
      const points: { x: number; y: number }[] = [];
      for (let x = 0, index = 0; x <= 1000; x += 2, index += 1) {
        points.push({ x, y: index % 2 ? 1 : -1 });
      }
      return points;
    };
    const canvasTotal = 1000;
    const path = noisy();
    const drawing: TrackDrawing = {
      active: {
        inside: '',
        outside: '',
        trackPathPoints: path,
        totalLength: canvasTotal,
      },
      startFinish: { point: { length: 0 }, direction: 'anticlockwise' },
    };
    const filter = vi.spyOn(geometry, 'filteredTrackPathPoints');

    computeRadarBlips({
      ...baseInput,
      trackDrawing: drawing,
      trackLengthM: canvasTotal,
      radarRange: 40,
      carIdxLapDistPct: [0.4, 0.42],
      carIdxOnPitRoad: [false, false],
    });

    expect(filter).toHaveBeenCalledWith(path, canvasTotal);
    // The drawing's own points are what went in. A caller that filtered
    // something else, or filtered against a length that was not this drawing's,
    // would answer to a road that is not the one on screen.
    expect(filter.mock.calls[0]?.[0]).toBe(path);
  });

  it('bounds an invalid persisted radar range before sampling', () => {
    const result = computeRadarBlips({
      ...baseInput,
      radarRange: Number.POSITIVE_INFINITY,
      ...positionsOf([pctOfArc(300), pctOfArc(312)]),
    });

    expect(result.blips).toHaveLength(0);
    expect(result.followingMapPointCount).toBe(1);
  });

  it('signs cars behind the player as negative along-track metres', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(300), pctOfArc(288)]),
    });

    expect(result.blips[0].alongM).toBeCloseTo(-12, 6);
    expect(result.blips[0].gapM).toBeCloseTo(12, 6);
  });

  it('wraps a car across the start/finish line to a small gap', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(1196), pctOfArc(6)]),
    });

    expect(result.blips[0].alongM).toBeCloseTo(10, 6);
  });

  it('bends blips off the axis by road curvature, and turns them with it', () => {
    // Player 100 m before the corner heading +x; the rival is 40 m into the
    // 90-degree right-hand turn that follows, so it reads right and rotated.
    // These stay exact: at `EDGE_STEP` the filter's rounding is a fraction of a
    // unit, well inside the precision asserted here.
    const result = computeRadarBlips({
      ...baseInput,
      radarRange: 200,
      ...positionsOf([pctOfArc(300), pctOfArc(440)]),
    });

    expect(result.blips[0].alongM).toBeCloseTo(140, 6);
    expect(result.blips[0].lateralM).toBeCloseTo(40, 6);
    expect(result.blips[0].relYaw).toBeCloseTo(Math.PI / 2, 6);
  });

  it('glides a blip round a curve instead of stepping its heading and offset', () => {
    // A circle, so the only thing that can make a step is the geometry lookup.
    // Both cars move — the player is what the offset is projected against, and
    // its heading is quantised by the path spacing just as the rival's is.
    // Written as the drawings are, a closed walk whose last point repeats the
    // first, with about three metres between points like a real track.
    const points = 200;
    const radius = 100;
    const circumference = 2 * Math.PI * radius;
    const ring = Array.from({ length: points }, (_, i) => {
      const angle = (2 * Math.PI * i) / points;
      return { x: Math.sin(angle) * radius, y: -Math.cos(angle) * radius };
    });
    const circle = [...ring, ring[0]];
    const drawing: TrackDrawing = {
      active: {
        inside: '',
        outside: '',
        trackPathPoints: circle,
        totalLength: circumference,
      },
      startFinish: { point: { length: 0 }, direction: 'anticlockwise' },
    };
    const gapM = 12;
    const stepM = 0.9; // what a 25 Hz snapshot covers at about 80 km/h

    let buffers = targetBuffers();
    let previousRelYaw: number | null = null;
    let previousLateral: number | null = null;
    let worstYaw = 0;
    let worstLateral = 0;
    for (let step = 0; step < 2000; step += 1) {
      const playerArc = 900 + step * stepM;
      const result = computeRadarBlips({
        ...baseInput,
        trackDrawing: drawing,
        trackLengthM: circumference,
        radarRange: 40,
        previousTargets: buffers[0],
        nextTargets: buffers[1],
        carIdxLapDistPct: [
          playerArc / circumference,
          (playerArc + gapM) / circumference,
        ],
        carIdxOnPitRoad: [false, false],
      });
      buffers = [buffers[1], buffers[0]];
      const blip = result.blips[0];
      if (!blip) throw new Error('the rival left the radar');
      if (previousRelYaw !== null) {
        worstYaw = Math.max(
          worstYaw,
          Math.abs(
            Math.atan2(
              Math.sin(blip.relYaw - previousRelYaw),
              Math.cos(blip.relYaw - previousRelYaw)
            )
          )
        );
      }
      if (previousLateral !== null) {
        worstLateral = Math.max(
          worstLateral,
          Math.abs(blip.lateralM - previousLateral)
        );
      }
      previousRelYaw = blip.relYaw;
      previousLateral = blip.lateralM;
    }

    // A path point here is a 1.8-degree step of the road. Following the road
    // moves the heading by about half a degree per snapshot; snapping to the
    // nearest point moves it by the whole 1.8 degrees, and swings the offset
    // the same way, which is what a driver sees as a car twitching sideways.
    expect(worstYaw).toBeLessThan(0.006);
    expect(worstLateral).toBeLessThan(0.05);
  });

  it('mirrors the lateral sign on a clockwise track', () => {
    // A clockwise track runs the path index order backwards, so lap fraction
    // 0.25 is the point 300 m *before* the finish, and the rival 340 m ahead
    // of it on the road sits at index arc 560.
    const result = computeRadarBlips({
      ...baseInput,
      trackDrawing: trackDrawing('clockwise'),
      radarRange: 400,
      ...positionsOf([300 / TRACK_LENGTH_M, (1200 - 560) / TRACK_LENGTH_M]),
    });

    expect(result.blips[0].alongM).toBeCloseTo(340, 6);
    expect(result.blips[0].lateralM).toBeLessThan(0);
    expect(result.blips[0].relYaw).toBeCloseTo(-Math.PI / 2, 6);
  });

  it('drops cars beyond the radar range', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(300), pctOfArc(316)]),
    });

    expect(result.blips).toHaveLength(0);
  });

  it('carries the car number for the label', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(300), pctOfArc(304)], [false, true]),
    });

    expect(result.blips[0].carNumber).toBe('24');
    expect(result.blips[0].side).toBeNull();
  });

  it('reports no number for a car the session has none for', () => {
    const result = computeRadarBlips({
      ...baseInput,
      carNumbers: new Map(),
      ...positionsOf([pctOfArc(300), pctOfArc(304)]),
    });

    expect(result.blips[0].carNumber).toBeNull();
  });

  it('hides cars on pit road only when asked to', () => {
    const withPitCar = positionsOf(
      [pctOfArc(300), pctOfArc(304)],
      [false, true]
    );

    expect(
      computeRadarBlips({ ...baseInput, ...withPitCar }).blips
    ).toHaveLength(1);
    expect(
      computeRadarBlips({ ...baseInput, ...withPitCar, hideInPit: true }).blips
    ).toHaveLength(0);
  });

  it('ignores cars the sim has not placed yet', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(300), -1]),
    });

    expect(result.blips).toHaveLength(0);
  });

  it('reports missing centreline geometry instead of guessing placements', () => {
    const result = computeRadarBlips({
      ...baseInput,
      trackDrawing: undefined,
      ...positionsOf([pctOfArc(300), pctOfArc(302)]),
    });

    expect(result).toMatchObject({ hasGeometry: false, blips: [] });
  });

  it('samples the road at the contract spacing across the full map window', () => {
    const radarRange = 16;
    const followingMapBuffer = new Float64Array(128);
    const result = computeRadarBlips({
      ...baseInput,
      radarRange,
      followingMapBuffer,
      ...positionsOf([pctOfArc(300)]),
    });

    expect(result.followingMapPointCount).toBe(49);
    expect(followingMapBuffer[0]).toBe(-24);
    expect(followingMapBuffer[(result.followingMapPointCount - 1) * 2]).toBe(
      24
    );
    for (let i = 1; i < result.followingMapPointCount; i += 1) {
      expect(followingMapBuffer[i * 2] - followingMapBuffer[(i - 1) * 2]).toBe(
        1
      );
    }
  });

  it('curves the road lateral offset and keeps it constant on a straight', () => {
    // A 100 m range gives a 300 m window: 301 samples at one metre, so the
    // buffer has to hold 602 floats or the tail writes go nowhere.
    const curvedBuffer = new Float64Array(602);
    const curved = computeRadarBlips({
      ...baseInput,
      radarRange: 100,
      followingMapBuffer: curvedBuffer,
      ...positionsOf([pctOfArc(300)]),
    });

    expect(curved.followingMapPointCount).toBe(301);
    expect(curvedBuffer[1]).toBeCloseTo(0, 6);
    expect(
      curvedBuffer[(curved.followingMapPointCount - 1) * 2 + 1]
    ).toBeCloseTo(50, 6);

    const straightBuffer = new Float64Array(128);
    const straight = computeRadarBlips({
      ...baseInput,
      radarRange: 8,
      followingMapBuffer: straightBuffer,
      ...positionsOf([pctOfArc(200)]),
    });
    for (let i = 0; i < straight.followingMapPointCount; i += 1) {
      expect(straightBuffer[i * 2 + 1]).toBeCloseTo(0, 6);
    }
  });

  it('leaves the map buffer untouched when there is no geometry', () => {
    const followingMapBuffer = Float64Array.from([7, 11, 13]);
    const result = computeRadarBlips({
      ...baseInput,
      trackDrawing: undefined,
      followingMapBuffer,
      ...positionsOf([pctOfArc(300)]),
    });

    expect(result.followingMapPointCount).toBe(0);
    expect(Array.from(followingMapBuffer)).toEqual([7, 11, 13]);
  });

  it('writes deterministic road pairs in place for repeated calls', () => {
    const followingMapBuffer = new Float64Array(512);
    const first = computeRadarBlips({
      ...baseInput,
      followingMapBuffer,
      ...positionsOf([pctOfArc(300)]),
    });
    const firstValues = Array.from(
      followingMapBuffer.subarray(0, first.followingMapPointCount * 2)
    );
    const second = computeRadarBlips({
      ...baseInput,
      followingMapBuffer,
      ...positionsOf([pctOfArc(300)]),
    });

    expect(second.followingMapPointCount).toBe(first.followingMapPointCount);
    expect(
      Array.from(
        followingMapBuffer.subarray(0, second.followingMapPointCount * 2)
      )
    ).toEqual(firstValues);
  });

  it('reports an unusable player position without emitting blips', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([-1, pctOfArc(302)]),
    });

    expect(result).toMatchObject({ hasGeometry: true, playerOnRoad: false });
    expect(result.blips).toHaveLength(0);
  });

  it('draws a car the sim reports abreast to the side, not on the player', () => {
    // Without the side verdict this car projects onto the player's own point of
    // the centreline and is drawn on top of them — the "cars pass through me"
    // case. The sim's verdict is the only thing that knows which side it is on.
    const result = computeRadarBlips({
      ...baseInput,
      overlap: { left: 1, right: 0 },
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(300)]),
    });

    expect(result.blips).toHaveLength(1);
    expect(result.blips[0].gapM).toBeCloseTo(0, 6);
    // Level with the player, so the side offset is at full reach.
    expect(result.blips[0].drawLateralM).toBeCloseTo(-2 * 1.1, 6);
    // The road itself reports no offset for an abreast car, and that stays
    // readable: the placed value must not become the measured one.
    expect(result.blips[0].lateralM).toBeCloseTo(0, 6);
    expect(result.blips[0].side).toBe(-1);
  });

  it('holds the offset across the overlap window and fades it in the tail', () => {
    const run = (
      gap: number,
      previousTargets: RadarTargetState = emptyTargetState(8),
      overlap: RadarOverlap = { left: 1, right: 0 }
    ) =>
      computeRadarBlips({
        ...baseInput,
        overlap,
        previousTargets,
        nextTargets: emptyTargetState(8),
        carNumbers: new Map([[1, '24']]),
        ...positionsOf([pctOfArc(300), pctOfArc(300 + gap)]),
      });

    // 4.5 m car: full reach anywhere inside the 9 m window.
    const full = 2 * 1.1;
    expect(run(0.1).blips[0].drawLateralM).toBeCloseTo(-full, 6);
    expect(run(4).blips[0].drawLateralM).toBeCloseTo(-full, 6);

    // A car 11 m back that was never alongside gets no side at all.
    expect(run(11).blips[0].drawLateralM).toBeCloseTo(0, 6);

    // But one that *was* alongside keeps a fading side on the way out.
    const tail = run(11, heldSides({ 1: -1 }), NO_OVERLAP).blips[0]
      .drawLateralM;
    expect(tail).toBeLessThan(0);
    expect(Math.abs(tail)).toBeLessThan(full);
  });

  it('leaves a car outside the abreast window on the road projection', () => {
    const result = computeRadarBlips({
      ...baseInput,
      overlap: { left: 1, right: 0 },
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(310)]),
    });

    expect(result.blips[0].lateralM).toBeCloseTo(0, 6);
    expect(result.blips[0].drawLateralM).toBeCloseTo(0, 6);
    expect(result.blips[0].side).toBeNull();
  });

  describe('the standing grid', () => {
    const GRID = { columns: 2, poleLateralM: -2.5 };

    /**
     * Four cars standing on the grid, two to a row. The lap fractions differ
     * by a few hundredths of a metre, which is as close as the sim reports
     * two cars parked abreast, and the slots pair them into rows.
     */
    const parked = (arcM: number, carIdxPosition: number[]) =>
      computeRadarBlips({
        ...baseInput,
        gridLayout: GRID,
        carIdxPosition,
        ...positionsOf([
          pctOfArc(arcM),
          pctOfArc(arcM + 0.05),
          pctOfArc(arcM + 0.03),
          pctOfArc(arcM - 0.02),
        ]),
      });

    it('draws two cars sharing a row to opposite sides, not one line', () => {
      // This is the reported bug: on the grid every car projected onto the
      // centreline at almost the same point, so the field drew as a single
      // file even though the cars stand two abreast.
      const result = parked(300, [0, 1, 2, 3]);

      const drawn = result.blips.map((blip) => blip.drawLateralM);
      // The player holds slot 0 and is not drawn, so three blips remain.
      expect(drawn).toHaveLength(3);
      // Slot 1 is the pole column, slot 2 the other one, so the two cars the
      // player shares a row with end up on opposite sides of the road.
      expect(drawn).toContain(GRID.poleLateralM);
      expect(drawn).toContain(-GRID.poleLateralM);
      // Two distinct sides, which is what "abreast" looks like.
      expect(new Set(drawn).size).toBe(2);
    });

    it('leaves the measured lateral as the road reports it', () => {
      // drawLateralM is the placed value the widget paints, but lateralM is
      // the measurement the motion interpolator reads. Overwriting it would
      // feed the placed offset back as the next frame's target and walk the
      // car further out on every frame.
      const result = parked(300, [0, 1, 2, 3]);

      for (const blip of result.blips) {
        expect(blip.lateralM).toBeCloseTo(0, 6);
      }
    });

    it('keeps every car on the projection when the grid is unknown', () => {
      // No layout means no statement about the grid, so the radar must draw
      // what it measures rather than invent a column.
      const result = computeRadarBlips({
        ...baseInput,
        gridLayout: null,
        carIdxPosition: [0, 1, 2, 3],
        ...positionsOf([
          pctOfArc(300),
          pctOfArc(300.05),
          pctOfArc(300.03),
          pctOfArc(299.98),
        ]),
      });

      for (const blip of result.blips) {
        expect(blip.drawLateralM).toBeCloseTo(blip.lateralM, 6);
      }
    });

    it('keeps an unranked car on the projection', () => {
      // A car the sim has not placed has no slot, so its column is unknown.
      const result = computeRadarBlips({
        ...baseInput,
        gridLayout: GRID,
        carIdxPosition: [0, 0],
        ...positionsOf([pctOfArc(300), pctOfArc(302)]),
      });

      expect(result.blips[0].drawLateralM).toBeCloseTo(
        result.blips[0].lateralM,
        6
      );
    });
  });

  const rimFor = (
    side: 'left' | 'right',
    gap: number,
    previousTargets: RadarTargetState = emptyTargetState(8)
  ) =>
    computeRadarBlips({
      ...baseInput,
      overlap: side === 'left' ? { left: 1, right: 0 } : { left: 0, right: 1 },
      previousTargets,
      nextTargets: emptyTargetState(8),
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(300 + gap)]),
    }).blips[0];

  it('signals the named rim for a close car on the left', () => {
    expect(rimFor('left', 0).rimSignal).toBe('left');
  });

  it('signals the named rim for a close car on the right', () => {
    expect(rimFor('right', 0).rimSignal).toBe('right');
  });

  it('signals both rims when the sim is silent on a level car', () => {
    const level = computeRadarBlips({
      ...baseInput,
      overlap: NO_OVERLAP,
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(300.2)]),
    }).blips[0];

    expect(level.side).toBeNull();
    expect(level.rimSignal).toBe('both');
    expect(level.lateralM).toBeCloseTo(0, 6);
  });

  it('signals both rims just inside one car length when the sim is silent', () => {
    const blip = computeRadarBlips({
      ...baseInput,
      overlap: NO_OVERLAP,
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(304.49)]),
    }).blips[0];

    expect(blip.gapM).toBeLessThan(4.5);
    expect(blip.side).toBeNull();
    expect(blip.rimSignal).toBe('both');
  });

  it('signals no rim for a car beyond one car length', () => {
    const result = computeRadarBlips({
      ...baseInput,
      overlap: NO_OVERLAP,
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(306)]),
    }).blips[0];

    expect(result.rimSignal).toBeNull();
  });

  it('signals no rim for a named side beyond one car length', () => {
    const blip = rimFor('left', 9, heldSides({ 1: -1 }));

    expect(blip.side).toBe(-1);
    expect(blip.rimSignal).toBeNull();
  });

  it('hands the per-car state back so the next frame can hold it', () => {
    const buffers = targetBuffers();
    const first = computeRadarBlips({
      ...baseInput,
      overlap: { left: 1, right: 0 },
      previousTargets: buffers[0],
      nextTargets: buffers[1],
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(300.2)]),
    });
    expect(first.targets.side[1]).toBe(-1);
    expect(first.targets.alongSign[1]).toBe(1);

    // The verdict drops to clear, but the car is still alongside: it keeps the
    // side it was given rather than snapping back onto the player. The next
    // frame reads what this one wrote, and writes the buffer this one did not.
    const second = computeRadarBlips({
      ...baseInput,
      overlap: NO_OVERLAP,
      previousTargets: first.targets,
      nextTargets: buffers[0],
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(300.3)]),
    });

    expect(second.blips[0].drawLateralM).toBeLessThan(0);
    expect(second.targets.side[1]).toBe(-1);
  });

  it('holds an alongside car on its drawn side through measured jitter', () => {
    // Real recorded gaps in metres for a car abreast of the player: the two
    // independently-updated lap fractions oscillate about the player's and
    // flip the sign frame to frame without the latch.
    const jitter = [0.232, -0.116, 0.174, -0.348, 0.29, -0.406];
    let buffers = targetBuffers();
    const signs: number[] = [];
    for (const gapM of jitter) {
      const result = computeRadarBlips({
        ...baseInput,
        overlap: { left: 1, right: 0 },
        previousTargets: buffers[0],
        nextTargets: buffers[1],
        carNumbers: new Map([[1, '24']]),
        ...positionsOf([pctOfArc(300), pctOfArc(300 + gapM * Math.sign(gapM))]),
      });
      expect(result.blips).toHaveLength(1);
      signs.push(Math.sign(result.blips[0].alongM));
      buffers = [buffers[1], buffers[0]];
    }
    expect(new Set(signs).size).toBe(1);
  });

  it('lets a real pass cross between behind and ahead', () => {
    const pass = [-3, -2.2, -1.4, -0.6, 0.6, 1.4, 2.2, 3];
    let buffers = targetBuffers();
    const signs: number[] = [];
    let crossings = 0;
    for (let i = 0; i < pass.length; i++) {
      const result = computeRadarBlips({
        ...baseInput,
        previousTargets: buffers[0],
        nextTargets: buffers[1],
        carNumbers: new Map([[1, '24']]),
        ...positionsOf([pctOfArc(300), pctOfArc(300 + pass[i])]),
      });
      buffers = [buffers[1], buffers[0]];
      signs.push(Math.sign(result.blips[0].alongM));
      if (i > 0 && signs[i] !== signs[i - 1]) crossings++;
    }
    // The car is carried frame to frame, so the latch holds it on its drawn
    // side while it is inside LONGITUDINAL_LATCH_M — at 0.6 m it is still
    // within the metre of the frame before, and only the 1.4 m frame sweeps
    // through the latch and crosses.
    expect(crossings).toBe(1);
    expect(signs[3]).toBe(-1);
    expect(signs[7]).toBe(1);
    expect(signs).toEqual([-1, -1, -1, -1, -1, 1, 1, 1]);
  });

  it('drops the drawn direction of a car that left the radar', () => {
    // Half a metre is inside LONGITUDINAL_LATCH_M, so a stale direction from
    // when the car was behind would drag it back behind as it comes past. The
    // gap has to be long enough to cycle both alternating buffers: with one
    // buffer's entry never rewritten while the car is away, the sign survives
    // until that buffer is read as the previous frame's state.
    const behindThenAwayThenAhead = [-0.5, -0.5, 100, 100, 0.5];
    let buffers = targetBuffers();
    let last: RadarBlip | undefined;
    for (const gapM of behindThenAwayThenAhead) {
      const result = computeRadarBlips({
        ...baseInput,
        previousTargets: buffers[0],
        nextTargets: buffers[1],
        carNumbers: new Map([[1, '24']]),
        ...positionsOf([pctOfArc(300), pctOfArc(300 + gapM)]),
      });
      buffers = [buffers[1], buffers[0]];
      last = result.blips[0];
    }

    if (!last) throw new Error('the rival never came back');
    expect(last.alongM).toBeCloseTo(0.5, 6);
  });

  it('returns empty state without mutating previous state when nothing is drawn', () => {
    let buffers = targetBuffers();
    interface GapFrame {
      positions: { carIdxLapDistPct: number[]; carIdxOnPitRoad: boolean[] };
      overlap: RadarOverlap;
    }
    const frames: GapFrame[] = [
      {
        positions: positionsOf([pctOfArc(300), pctOfArc(300.2)]),
        overlap: { left: 1, right: 0 },
      },
      {
        // The player is off the road, so there is nothing to draw at all.
        positions: positionsOf([-1, pctOfArc(300.2)]),
        overlap: { left: 1, right: 0 },
      },
      {
        // Back on the road, the rival is inside the retain window, but the
        // committed empty result must not carry the earlier side forward.
        positions: positionsOf([pctOfArc(300), pctOfArc(310)]),
        overlap: NO_OVERLAP,
      },
    ];

    let last: RadarBlip | undefined;
    let previousAtGap: RadarTargetState | null = null;
    let emptyResultAtGap: RadarTargetState | null = null;
    for (const [index, frame] of frames.entries()) {
      const result = computeRadarBlips({
        ...baseInput,
        previousTargets: buffers[0],
        nextTargets: buffers[1],
        carNumbers: new Map([[1, '24']]),
        ...frame.positions,
        overlap: frame.overlap,
      });
      if (index === 1) {
        previousAtGap = {
          side: new Int8Array(buffers[0].side),
          alongSign: new Int8Array(buffers[0].alongSign),
        };
        emptyResultAtGap = {
          side: new Int8Array(result.targets.side),
          alongSign: new Int8Array(result.targets.alongSign),
        };
      }
      buffers = [result.targets, buffers[0]];
      last = result.blips[0];
    }

    if (!last || !previousAtGap || !emptyResultAtGap) {
      throw new Error('the empty frame or the returned rival was missing');
    }
    expect(previousAtGap.side[1]).toBe(-1);
    expect(previousAtGap.alongSign[1]).toBe(1);
    expect(emptyResultAtGap.side[1]).toBe(0);
    expect(emptyResultAtGap.alongSign[1]).toBe(0);
    expect(last.side).toBeNull();
    expect(last.lateralM).toBeCloseTo(0, 6);
  });

  it('keeps the geometric sign for a car entering with no history', () => {
    const result = computeRadarBlips({
      ...baseInput,
      previousTargets: emptyTargetState(8),
      nextTargets: emptyTargetState(8),
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(300 + 0.4)]),
    });

    expect(result.blips[0].alongM).toBeCloseTo(0.4, 6);
    expect(result.targets.alongSign[1]).toBe(1);
  });

  it('flags only the pace car with the pace tag', () => {
    const result = computeRadarBlips({
      ...baseInput,
      paceCarIdx: 1,
      carNumbers: new Map([[1, '24']]),
      ...positionsOf([pctOfArc(300), pctOfArc(304)]),
    });

    expect(result.blips).toHaveLength(1);
    expect(result.blips[0].isPaceCar).toBe(true);
    expect(
      computeRadarBlips({
        ...baseInput,
        paceCarIdx: 7,
        carNumbers: new Map([[1, '24']]),
        ...positionsOf([pctOfArc(300), pctOfArc(304)]),
      }).blips[0].isPaceCar
    ).toBe(false);
  });
  it('labels the pace car with the fixed tag, not its number', () => {
    expect(blipLabel({ carNumber: '0', isPaceCar: true }, true)).toBe('PACE');
    expect(blipLabel({ carNumber: '24', isPaceCar: false }, true)).toBe('24');
    expect(blipLabel({ carNumber: '0', isPaceCar: true }, false)).toBeNull();
    expect(blipLabel({ carNumber: '24', isPaceCar: false }, false)).toBeNull();
  });
});
