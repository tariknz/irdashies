/**
 * Microbenchmark for the Radar geometry path.
 *
 * `radar.snapshot` publishes at 25 Hz and every changed snapshot re-runs
 * `computeRadarBlips`, so anything allocated per call is allocated 25 times a
 * second for as long as the widget is on screen. This measures that cost
 * directly: duration and bytes allocated per call, against a field of real
 * cars driving a real track.
 *
 * It measures the geometry itself — `computeRadarBlips` and the overlap side
 * assignment it calls — not the React hook around it. The hook adds one memo
 * recompute and no geometry of its own, and pulling React into the measurement
 * would add renderer noise to a number about arithmetic.
 *
 * Run it with `npm run perf:radar-geometry`.
 *
 * Allocation is read as the heap delta across a batch, which is only the bytes
 * allocated if no collection ran inside it. So the script watches for
 * collections and throws away any batch that saw one, and reports how many
 * batches it had to throw away. `--max-semi-space-size` in the npm script
 * keeps the young generation large enough that this is usually not a fight.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { performance, PerformanceObserver } from 'node:perf_hooks';
import tracks from '../../src/frontend/assets/data/tracks.json';
import {
  computeRadarBlips,
  emptyTargetState,
  MAP_SAMPLE_M,
  type RadarBlipResult,
  type RadarTargetState,
} from '../../src/frontend/components/Radar/radarBlips';
import {
  NO_OVERLAP,
  type RadarOverlap,
} from '../../src/frontend/components/Radar/overlapSides';
import type { TrackDrawing } from '../../src/frontend/domain/trackGeometry';

const ROOT = path.resolve(import.meta.dirname, '../..');
const FIXTURE = path.join(
  ROOT,
  'test-data/fixtures/multiclass-road-america.json'
);

interface Fixture {
  meta?: { hz?: number };
  weekend: { TrackID: string; TrackLength: number | string };
  driverInfo: { DriverCarIdx: number };
  drivers: { CarIdx: number }[];
  frames: { CarIdxLapDistPct: number[] }[];
}

const TICK_RATE_HZ = 25;
const TICK_MS = 1000 / TICK_RATE_HZ;
/** Driving to run before measuring, so the JIT has compiled the path. */
const WARMUP_FRAMES = 2000;
/** Calls in one measured batch; sized to fit a batch inside the young gen. */
const BATCH_FRAMES = 1000;
/** Clean batches to keep per density; the fastest and smallest of them wins. */
const KEEP_BATCHES = 5;
/** Give up rather than spin forever if the collector will not leave it alone. */
const MAX_DISCARDED_BATCHES = 40;

const RADAR_RANGE_M = 15;
const VEHICLE_WIDTH_M = 1.9;
const VEHICLE_LENGTH_M = 4.5;
/** No widget configuration numbers a car in this benchmark. */
const EMPTY_CAR_NUMBERS: ReadonlyMap<number, string> = new Map();

const numberFlag = (args: string[], name: string, fallback: number) => {
  const index = args.indexOf(name);
  const value = index === -1 ? undefined : Number(args[index + 1]);
  return value !== undefined && Number.isFinite(value) ? value : fallback;
};

const readFixture = (): Fixture => {
  if (!existsSync(FIXTURE)) {
    throw new Error(`missing telemetry fixture: ${FIXTURE}`);
  }
  return JSON.parse(readFileSync(FIXTURE, 'utf8')) as Fixture;
};

const trackDrawings = tracks as unknown as Record<
  string,
  TrackDrawing | undefined
>;

/**
 * The capture is anonymised, so its track length is written out as "6.4135 km"
 * rather than the metres the live session carries. Feed the radar the number
 * it would actually be given: read as a bare float the lap is 6.4 m long,
 * which puts the whole field in range and shortens the lap a thousandfold.
 */
const trackLengthMetres = (value: number | string): number => {
  if (typeof value === 'number') return value;
  const numeric = Number.parseFloat(value);
  return /\bkm\b/i.test(value) ? numeric * 1000 : numeric;
};

interface Field {
  positions: number[];
  onPitRoad: boolean[];
  playerCarIdx: number;
  trackLengthM: number;
  /** Advances every car by one tick. */
  step: () => void;
  cars: number;
}

/**
 * Places `carsInRange` cars inside the radar's range around the player and the
 * rest of the field elsewhere on the lap, then advances the whole field at the
 * published tick rate. Positions are written into one array, the way
 * `RadarProcessor` refills its own arrays in place.
 */
const buildField = (fixture: Fixture, carsInRange: number): Field => {
  // The SDK car array is a fixed 64 slots wide, with -1 for a slot no car
  // occupies, and the radar loops the whole array. So the field has to be that
  // wide too, with -1 in the empty slots, or the layout is not the one the
  // widget sees.
  const first = fixture.frames[0].CarIdxLapDistPct;
  const fieldSize = first.length;
  const trackLengthM = trackLengthMetres(fixture.weekend.TrackLength);
  const playerCarIdx = fixture.driverInfo.DriverCarIdx;
  const cars = fixture.drivers
    .map((driver) => driver.CarIdx)
    .filter((carIdx) => carIdx < fieldSize);
  // The live channel carries a plain array, refilled in place by
  // `RadarProcessor`, so the benchmark drives one rather than a typed array.
  const positions = new Array<number>(fieldSize).fill(-1);
  const onPitRoad = new Array<boolean>(fieldSize).fill(false);
  const speedMps = new Float64Array(fieldSize);

  // The capture runs at a known rate, so the lap fraction each car covers
  // divided by the elapsed seconds is its average speed. Replaying that speed
  // for the cars outside the pack keeps the field's spacing the way the
  // recording left it, instead of inventing one.
  const captured = fixture.frames[fixture.frames.length - 1].CarIdxLapDistPct;
  const elapsedS = fixture.frames.length / (fixture.meta?.hz ?? 1);
  for (const carIdx of cars) {
    speedMps[carIdx] =
      ((captured[carIdx] - first[carIdx]) * trackLengthM) / elapsedS;
  }

  // A full grid spread evenly over the lap leaves a 15 m radar looking at
  // almost nothing, so the field is seeded spread out and the requested number
  // of cars is then packed into the range around the player. That is the
  // bunched, safety-car and race-start traffic the radar has to stay smooth
  // through, and it is the case that allocates per blip.
  cars.forEach((carIdx, rank) => {
    positions[carIdx] = rank / cars.length;
  });
  const packed = Math.min(carsInRange, cars.length - 1);
  const laneM = RADAR_RANGE_M / Math.max(1, packed / 2);
  let index = 0;
  for (const carIdx of cars) {
    if (index >= packed) break;
    if (carIdx === playerCarIdx) continue;
    // Alternate ahead of and behind the player, stepping outward, so the blips
    // spread across the disc rather than stacking on one ring.
    const alongM = (Math.floor(index / 2) + 1) * laneM;
    const ahead = index % 2 === 0;
    positions[carIdx] =
      (positions[playerCarIdx] + (ahead ? alongM : -alongM) / trackLengthM) % 1;
    // Cars in the pack hold station with the player, so the density the radar
    // sees is the density that was asked for.
    speedMps[carIdx] = speedMps[playerCarIdx];
    index += 1;
  }

  return {
    positions,
    onPitRoad,
    playerCarIdx,
    trackLengthM,
    cars: cars.length,
    step: () => {
      for (const carIdx of cars) {
        const laps = (speedMps[carIdx] * TICK_MS) / 1000 / trackLengthM;
        positions[carIdx] = (((positions[carIdx] + laps) % 1) + 1) % 1;
      }
    },
  };
};

/**
 * The sim's own overlap verdict, cycling through the states a car running
 * abreast actually produces: nothing reported, one car, then a car each side.
 */
const overlapForFrame = (frame: number): RadarOverlap => {
  switch (frame % 4) {
    case 1:
      return { left: 1, right: 0 };
    case 2:
      return { left: 0, right: 1 };
    case 3:
      return { left: 1, right: 1 };
    default:
      return NO_OVERLAP;
  }
};

interface Measurement {
  carsInRange: number;
  blips: number;
  nanosecondsPerCall: number;
  bytesPerCall: number;
  blipsPerSecond: number;
}

/**
 * Builds the loop that replays one field at the published tick rate. The field
 * and its following-map buffer are built once, so the only thing that varies
 * between batches is the work being measured.
 */
const runDensity = (
  carsInRange: number,
  drawing: TrackDrawing,
  fixture: Fixture
) => {
  const field = buildField(fixture, carsInRange);
  // Sized the way the widget sizes it: the map window is three radar ranges
  // wide, sampled every metre, and each sample stores two coordinates.
  const followingMapBuffer = new Float64Array(
    RADAR_RANGE_M * 3 * MAP_SAMPLE_M * 2 + 2
  );
  let buffers: [RadarTargetState, RadarTargetState] = [
    emptyTargetState(field.positions.length),
    emptyTargetState(field.positions.length),
  ];
  let blipCount = 0;
  let frames = 0;

  /**
   * `retained` holds every result produced inside a measured batch. Nothing
   * the batch allocates can then be collected while the batch runs, so the
   * heap delta across it is the bytes allocated — exactly, rather than
   * whatever survived the collector's timing.
   */
  const frame = (retained?: RadarBlipResult[]) => {
    field.step();
    const result = computeRadarBlips({
      carIdxLapDistPct: field.positions,
      carIdxOnPitRoad: field.onPitRoad,
      playerCarIdx: field.playerCarIdx,
      trackDrawing: drawing,
      trackLengthM: field.trackLengthM,
      radarRange: RADAR_RANGE_M,
      hideInPit: true,
      overlap: overlapForFrame(frames),
      vehicleWidth: VEHICLE_WIDTH_M,
      vehicleLength: VEHICLE_LENGTH_M,
      fadeBandM: 3,
      carNumbers: EMPTY_CAR_NUMBERS,
      paceCarIdx: null,
      previousTargets: buffers[0],
      nextTargets: buffers[1],
      followingMapBuffer,
    });
    buffers = [buffers[1], buffers[0]];
    blipCount += result.blips.length;
    frames += 1;
    retained?.push(result);
  };

  return { frame, blips: () => blipCount / frames, field };
};

/** Yields long enough for a performance observer entry to be delivered. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

const measure = async (carsInRange: number): Promise<Measurement> => {
  const fixture = readFixture();
  const drawing = trackDrawings[fixture.weekend.TrackID];
  if (!drawing) {
    throw new Error(`no track drawing for track ${fixture.weekend.TrackID}`);
  }
  const forceGc = (globalThis as { gc?: () => void }).gc;
  if (!forceGc) {
    throw new Error(
      'run with --expose-gc: allocation cannot be measured without it'
    );
  }

  const run = runDensity(carsInRange, drawing, fixture);
  for (let index = 0; index < WARMUP_FRAMES; index += 1) run.frame();

  // Each batch keeps every result it produced, so the collector has nothing to
  // free and the heap delta is the bytes allocated rather than the bytes that
  // happened to survive. Retention alone is not enough: a mark-compact still
  // compacts and can shrink the heap, which lowers `heapUsed` without freeing
  // anything the batch allocated. So a batch that saw a collection is thrown
  // away as well, and the entries are matched by timestamp — the observer
  // delivers them late, so counting them would charge a batch for the forced
  // collection that preceded it.
  const collected: PerformanceEntry[] = [];
  const observer = new PerformanceObserver((list) => {
    collected.push(...list.getEntries());
  });
  observer.observe({ entryTypes: ['gc'] });

  let bestNanoseconds = Number.POSITIVE_INFINITY;
  let bestBytes = Number.POSITIVE_INFINITY;
  let kept = 0;
  let discarded = 0;
  while (kept < KEEP_BATCHES && discarded < MAX_DISCARDED_BATCHES) {
    const retained: RadarBlipResult[] = [];
    forceGc();
    const heapBefore = process.memoryUsage().heapUsed;
    const startedAt = performance.now();
    for (let index = 0; index < BATCH_FRAMES; index += 1) {
      run.frame(retained);
    }
    const elapsedMs = performance.now() - startedAt;
    const heapAfter = process.memoryUsage().heapUsed;
    await settle();

    if (retained.length !== BATCH_FRAMES) {
      throw new Error('the benchmark dropped a frame it meant to measure');
    }
    const collectedInside = collected.some(
      (entry) =>
        entry.startTime >= startedAt && entry.startTime <= startedAt + elapsedMs
    );
    collected.length = 0;
    if (collectedInside) {
      discarded += 1;
      continue;
    }
    kept += 1;
    bestNanoseconds = Math.min(
      bestNanoseconds,
      (elapsedMs * 1e6) / BATCH_FRAMES
    );
    bestBytes = Math.min(
      bestBytes,
      Math.max(0, heapAfter - heapBefore) / BATCH_FRAMES
    );
    retained.length = 0;
  }
  observer.disconnect();

  if (kept === 0) {
    throw new Error(
      `no batch of ${BATCH_FRAMES} calls ran without a collection; ` +
        'lower BATCH_FRAMES or raise --min-semi-space-size'
    );
  }

  const meanBlips = run.blips();
  return {
    carsInRange,
    blips: Math.round(meanBlips),
    nanosecondsPerCall: bestNanoseconds,
    bytesPerCall: bestBytes,
    // What the widget has to place each second, at the rate the channel
    // actually publishes. A derived timing figure would only add noise.
    blipsPerSecond: meanBlips * TICK_RATE_HZ,
  };
};

const format = (value: number, digits = 1) =>
  value.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });

const size = (bytes: number) =>
  bytes < 1024 ? `${format(bytes, 0)} B` : `${format(bytes / 1024, 2)} KiB`;

const DENSITY_SWEEP = [0, 5, 10, 15, 20, 25, 30];

/**
 * Measures one density in a process of its own. Measuring several in sequence
 * in one process does not work: the heap each density leaves behind shifts when
 * the next one compacts, and the figure for the densest field came out below
 * the figure for a sparser one, which cannot be true. A fresh process per
 * density is what makes the numbers comparable.
 */
const measureInChildProcess = (carsInRange: number): Measurement => {
  const output = execFileSync(
    process.execPath,
    [
      ...process.execArgv,
      import.meta.filename,
      '--cars-in-range',
      String(carsInRange),
      '--json',
    ],
    { encoding: 'utf8' }
  );
  const measurement = (JSON.parse(output) as Measurement[])[0];
  if (!measurement) {
    throw new Error(`the ${carsInRange}-car run reported no measurement`);
  }
  return measurement;
};

const main = async () => {
  const args = process.argv.slice(2);
  const single = args.indexOf('--cars-in-range') !== -1;

  const results: Measurement[] = [];
  if (single) {
    results.push(await measure(numberFlag(args, '--cars-in-range', 15)));
  } else {
    for (const carsInRange of DENSITY_SWEEP) {
      results.push(measureInChildProcess(carsInRange));
    }
  }

  if (args.includes('--json')) {
    process.stdout.write(`${JSON.stringify(results, null, 2)}\n`);
    return;
  }

  process.stdout.write(
    `Radar geometry: ${TICK_RATE_HZ} Hz, ${RADAR_RANGE_M} m range, ` +
      'road america, 58 cars\n\n'
  );
  process.stdout.write(
    `${'cars in range'.padStart(13)}  ${'blips'.padStart(5)}  ` +
      `${'per call'.padStart(9)}  ${'allocated'.padStart(10)}  ` +
      `${'blips/s'.padStart(9)}\n`
  );
  for (const result of results) {
    process.stdout.write(
      `${String(result.carsInRange).padStart(13)}  ` +
        `${String(result.blips).padStart(5)}  ` +
        `${`${format(result.nanosecondsPerCall, 0)} ns`.padStart(9)}  ` +
        `${size(result.bytesPerCall).padStart(10)}  ` +
        `${format(result.blipsPerSecond, 0).padStart(9)}\n`
    );
  }
  process.stdout.write(
    `\nbest of ${KEEP_BATCHES} batches of ${BATCH_FRAMES} calls, after ` +
      `${WARMUP_FRAMES} warmup calls; every result retained for the ` +
      'duration of its batch, so no collection can free it\n'
  );
};

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : error}\n`);
  process.exitCode = 1;
});
