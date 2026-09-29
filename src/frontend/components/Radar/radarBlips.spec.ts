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
import { gridColumnLateralM } from './gridLayout';

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

  it('fans out overlapping rivals when live telemetry has no lateral lanes', () => {
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([pctOfArc(280), pctOfArc(290), pctOfArc(290.5)]),
    });

    const [first, second] = result.blips;
    expect(first.visualFanOut).toBe(true);
    expect(second.visualFanOut).toBe(true);
    expect(first.drawLateralM).toBeLessThan(second.drawLateralM);
    expect(second.drawLateralM - first.drawLateralM).toBeGreaterThanOrEqual(
      baseInput.vehicleWidth
    );
    expect(first.alongM).toBeCloseTo(10, 6);
    expect(second.alongM).toBeCloseTo(10.5, 6);
  });

  it('never overrides a side the sim has reported', () => {
    // The fan-out is a guess about cars the telemetry says nothing about. The
    // sim reporting a car on the player's left is an answer, not a gap, and the
    // two cars here sit close enough to be grouped: the one with a verdict has
    // to stay where the verdict put it.
    const result = computeRadarBlips({
      ...baseInput,
      overlap: { left: 1, right: 0 },
      ...positionsOf([pctOfArc(280), pctOfArc(288.5), pctOfArc(288.8)]),
    });

    const placed = result.blips.find((blip) => blip.side !== null);
    if (!placed) throw new Error('expected the sim to place a car');
    expect(placed.visualFanOut).toBeUndefined();
    // Still on the side the verdict named, and out at a lane's width rather
    // than somewhere a group's centre happened to fall.
    expect(placed.drawLateralM).toBeLessThan(0);
    expect(Math.abs(placed.drawLateralM)).toBeGreaterThanOrEqual(
      baseInput.vehicleWidth
    );
  });

  it('does not let a queue of cars fan the whole pack across the road', () => {
    // Six cars nose to tail on a straight, two metres apart: the ordinary shape
    // of a pack bunched behind a slower car. Grouping them by each pair's own
    // distance chained all six into one group, which was then spread from its
    // middle — the car two metres in front of the player went a car width to
    // one side and the tail of the queue drifted five and a half metres
    // across. A driver reading that sees a pack side by side, not in line.
    const result = computeRadarBlips({
      ...baseInput,
      ...positionsOf([
        pctOfArc(280),
        pctOfArc(282),
        pctOfArc(284),
        pctOfArc(286),
        pctOfArc(288),
        pctOfArc(290),
        pctOfArc(292),
      ]),
    });

    // The road has these cars on one line, so the fan-out is the only thing
    // that can move them, and a group is spread from its own centre: no car
    // can travel further than half a lane spacing.
    const laneSpacing = baseInput.vehicleWidth * 1.1;
    for (const blip of result.blips) {
      expect(Math.abs(blip.drawLateralM - blip.lateralM)).toBeLessThanOrEqual(
        laneSpacing / 2 + 1e-9
      );
    }
  });

  describe('the standing grid', () => {
    const GRID = { columns: 2, columnLateralM: 2.5 };
    /** Half the lane pitch either side of the middle of a two-abreast road. */
    const HALF_LANE = GRID.columnLateralM / 2;

    /**
     * Six cars parked on the grid, two to a row, eight metres between rows. The
     * player is in the first row and is not drawn, which leaves two full rows
     * beyond. `CarIdxPaceRow` counts from the front of the field, so the player
     * is in row 0 and the two rows beyond are rows 1 and 2.
     */
    const parked = (arcM: number) =>
      computeRadarBlips({
        ...baseInput,
        gridLayout: GRID,
        // The base 15 m range reaches barely one row of a real grid, so the
        // range is opened to take in the whole field.
        radarRange: 40,
        ...positionsOf([
          pctOfArc(arcM),
          pctOfArc(arcM + 3),
          pctOfArc(arcM + 8),
          pctOfArc(arcM + 11),
          pctOfArc(arcM + 16),
          pctOfArc(arcM + 19),
        ]),
        carIdxPaceRow: [0, 0, 1, 1, 2, 2],
        carIdxPaceLine: [0, 1, 0, 1, 0, 1],
      });

    it('draws two cars sharing a row to opposite sides, not one line', () => {
      // This is the reported bug: on the grid every car projected onto the
      // centreline at almost the same point, so the field drew as a single
      // file even though the cars stand two abreast.
      const result = parked(300);

      const drawn = result.blips.map((blip) => blip.drawLateralM);
      // The player is the first car and is not drawn, so five blips remain.
      expect(drawn).toHaveLength(5);
      // The two rows beyond the player's own row each reach both columns.
      expect(drawn).toContain(HALF_LANE);
      expect(drawn).toContain(-HALF_LANE);
      // Pace-line numbering places the partner in the column opposite the
      // player; a missing overlap verdict must not leave either car centred.
      expect(drawn[0]).toBe(HALF_LANE);
      expect(drawn.filter((offset) => offset === 0)).toHaveLength(0);
    });

    it('stands a grid partner one lane away, not two', () => {
      // The lane constant is the gap between columns, so two cars in a row are
      // one lane apart. Reading it as each column's offset from the centreline
      // put the player two lanes from the car parked beside him.
      const result = parked(300);
      const partner = result.blips.find((blip) => blip.carIdx === 1);
      if (!partner) throw new Error('expected the player row partner');

      const playerColumnM = gridColumnLateralM(0, GRID);
      if (playerColumnM === null) throw new Error('grid has no left column');
      expect(Math.abs(partner.drawLateralM - playerColumnM)).toBeCloseTo(
        GRID.columnLateralM,
        6
      );
    });

    it('levels cars within each sim-reported grid row', () => {
      const result = parked(300);
      const alongByCar = new Map(
        result.blips.map((blip) => [blip.carIdx, blip.alongM])
      );

      expect(alongByCar.get(1)).toBe(0);
      expect(alongByCar.get(2)).toBeCloseTo(9.5, 6);
      expect(alongByCar.get(3)).toBeCloseTo(9.5, 6);
      expect(alongByCar.get(4)).toBeCloseTo(17.5, 6);
      expect(alongByCar.get(5)).toBeCloseTo(17.5, 6);
    });

    it('survives the overlap offset that used to overwrite it', () => {
      // The grid is applied after the overlap verdict for a reason: the
      // overlap's offset also lands on drawLateralM, and placing the grid
      // first left every parked car back on the centreline. This is the
      // regression that put the field back in a single file.
      const result = computeRadarBlips({
        ...baseInput,
        gridLayout: GRID,
        overlap: { left: 1, right: 0 },
        ...positionsOf([
          pctOfArc(300),
          pctOfArc(300.05),
          pctOfArc(308),
          pctOfArc(308.05),
        ]),
        carIdxPaceRow: [0, 0, 1, 1],
        carIdxPaceLine: [0, 1, 0, 1],
      });

      const byCar = new Map(
        result.blips.map((b) => [b.carIdx, b.drawLateralM])
      );
      // The overlap covers only the player, so these two are a grid row. Line
      // 0 is the left column, so car 2 is drawn to the left and car 3 to the
      // right, whatever the overlap verdict did to them on the way in.
      expect(byCar.get(2)).toBe(-HALF_LANE);
      expect(byCar.get(3)).toBe(HALF_LANE);
    });

    it('projects local grid offsets into both radar axes on a bend', () => {
      const result = parked(390);
      const bent = result.blips.find((blip) => blip.carIdx === 3);
      if (!bent || bent.gridLaneOffsetM === undefined) {
        throw new Error('expected a grid car beyond the fixture corner');
      }

      const localColumnM = HALF_LANE;
      expect(Math.abs(bent.relYaw)).toBeGreaterThan(0.1);
      expect(bent.gridLaneOffsetM).toBeCloseTo(
        localColumnM * Math.cos(bent.relYaw),
        6
      );
      expect(bent.drawLateralM).toBeCloseTo(
        bent.lateralM + localColumnM * Math.cos(bent.relYaw),
        6
      );
      expect(bent.alongM).toBeCloseTo(
        9.5 - localColumnM * Math.sin(bent.relYaw),
        6
      );
    });

    it('leaves the measured lateral untouched by grid placement', () => {
      // The lane offset is display geometry; `lateralM` remains the road
      // projection used by interpolation and the following-map calculations.
      const result = parked(300);

      for (const blip of result.blips) {
        expect(blip.lateralM).toBeCloseTo(0, 6);
      }
    });

    it('keeps separated cars on the projection when the grid is unknown', () => {
      // No grid metadata means no statement about the actual columns. Cars
      // that do not project into the same patch retain their measured offset.
      const result = computeRadarBlips({
        ...baseInput,
        gridLayout: null,
        ...positionsOf([
          pctOfArc(300),
          pctOfArc(310),
          pctOfArc(320),
          pctOfArc(330),
        ]),
      });

      for (const blip of result.blips) {
        expect(blip.drawLateralM).toBeCloseTo(blip.lateralM, 6);
      }
    });

    it('keeps a row it cannot account for on the projection', () => {
      // One car eight metres out with no partner is not a row, so there is
      // nothing to say about which column it was in.
      const result = computeRadarBlips({
        ...baseInput,
        gridLayout: GRID,
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
