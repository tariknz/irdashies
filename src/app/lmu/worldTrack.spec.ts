import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LmuRawTelemetry } from './native';
import { mapPointAt, radarMapFrame } from './mapRegistration';
import { deriveLmuRelativePositions } from './proximity';
import { createLmuRestData } from './rest/state';
import { LMU_REST_TASKS, LMU_TRACKMAP_TASK_ID } from './rest/tasks';
import {
  buildWorldTrackMap,
  LmuWorldLine,
  LmuWorldTrackAlignment,
  LmuWorldTrackSource,
  LmuWorldTrackStorage,
  parseLmuWorldTrack,
  WORLD_TRACK_MAX_ATTEMPTS,
  worldTrackFitsLap,
  worldTrackFrom,
  type GroundPoint,
  type LmuWorldTrack,
  type WorldTrackFrame,
} from './worldTrack';
import {
  ALGARVE_LAP_DISTANCE_M,
  algarveTrackmapFixture,
} from './worldTrackFixture';

const algarve = (): LmuWorldTrack => {
  const track = parseLmuWorldTrack(algarveTrackmapFixture());
  if (!track) throw new Error('fixture does not parse');
  return track;
};

const pointAtArc = (
  track: LmuWorldTrack,
  arc: number
): GroundPoint & { dx: number; dy: number } => {
  const line = new LmuWorldLine(track.racing);
  const target = ((arc % line.lengthM) + line.lengthM) % line.lengthM;
  let index = 0;
  while (line.cumulative[index + 1] < target) index += 1;
  const from = track.racing[index];
  const to = track.racing[(index + 1) % track.racing.length];
  const span = line.cumulative[index + 1] - line.cumulative[index];
  const amount = span > 0 ? (target - line.cumulative[index]) / span : 0;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const norm = Math.hypot(dx, dy) || 1;
  return {
    x: from.x + dx * amount,
    y: from.y + dy * amount,
    dx: dx / norm,
    dy: dy / norm,
  };
};

const CAR_COUNT = 16;
const OFFSET_M = 1334;

const fieldAt = (
  track: LmuWorldTrack,
  lapDistM: number,
  time: number,
  offsetM = OFFSET_M
): WorldTrackFrame => {
  const posX: number[] = [];
  const posZ: number[] = [];
  const pcts: number[] = [];
  for (let carIdx = 0; carIdx < CAR_COUNT; carIdx += 1) {
    const pct = (((carIdx / CAR_COUNT + (time * 50) / lapDistM) % 1) + 1) % 1;
    const point = pointAtArc(track, offsetM + pct * track.lengthM);
    const lateral = 3 * Math.sin(carIdx * 1.7 + time);
    posX.push(point.x - point.dy * lateral);
    posZ.push(-(point.y + point.dx * lateral));
    pcts.push(pct);
  }
  return {
    restTrack: undefined,
    time,
    lapDistM,
    posX,
    posZ,
    available: posX.map(() => 1),
    pcts,
    inPits: posX.map(() => 0),
    speeds: posX.map(() => 50),
  };
};

const mirrored = (track: LmuWorldTrack): LmuWorldTrack =>
  worldTrackFrom(
    track.racing.map((point) => ({ x: -point.x, y: point.y })),
    track.pitLane
  ) as LmuWorldTrack;

describe('parseLmuWorldTrack', () => {
  it('keeps the racing line and the pit lane, on the ground plane', () => {
    const track = algarve();
    const first = algarveTrackmapFixture()[0];

    expect(track.racing).toHaveLength(155);
    expect(track.pitLane).toHaveLength(26);
    expect(track.racing[0]).toEqual({ x: first.x, y: -first.z });
    expect(track.lengthM).toBeGreaterThan(4500);
    expect(track.lengthM).toBeLessThan(4600);
  });

  it('refuses the answer LMU gives from the main menu', () => {
    expect(parseLmuWorldTrack([{ type: 0, x: 0, y: 0, z: 0 }])).toBeUndefined();
    expect(parseLmuWorldTrack({})).toBeUndefined();
    expect(parseLmuWorldTrack(undefined)).toBeUndefined();
  });

  it('refuses the zero-length answer seen while a track loads', () => {
    const empty = Array.from({ length: 616 }, () => ({
      type: 0,
      x: 0,
      y: 0,
      z: 0,
    }));

    expect(parseLmuWorldTrack(empty)).toBeUndefined();
  });

  it('refuses a racing line that does not close', () => {
    const open = algarveTrackmapFixture().filter(
      (point, index) => point.type !== 0 || index < 120
    );

    expect(parseLmuWorldTrack(open)).toBeUndefined();
  });

  it('is what the trackmap task writes for the bridge', () => {
    const task = LMU_REST_TASKS.find((t) => t.id === LMU_TRACKMAP_TASK_ID);
    const data = createLmuRestData();
    const output = task?.outputs[0];
    output?.apply(data, output.parse(algarveTrackmapFixture()));

    expect(task?.path).toBe('/rest/watch/trackmap');
    expect(task?.mode).toBe('burst');
    expect(data.worldTrack?.racing).toHaveLength(155);
    expect(data.revision).toBe(0);
  });
});

describe('worldTrackFitsLap', () => {
  it('accepts the 1% the racing line is short of the lap', () => {
    expect(worldTrackFitsLap(algarve(), ALGARVE_LAP_DISTANCE_M)).toBe(true);
  });

  it('refuses another track length, or none', () => {
    expect(worldTrackFitsLap(algarve(), 3083.3)).toBe(false);
    expect(worldTrackFitsLap(algarve(), 0)).toBe(false);
    expect(worldTrackFitsLap(undefined, ALGARVE_LAP_DISTANCE_M)).toBe(false);
  });
});

const align = (
  alignment: LmuWorldTrackAlignment,
  carsOn: LmuWorldTrack,
  lapDistM: number
) => {
  for (let time = 0; time < 60; time += 0.05) {
    alignment.update(fieldAt(carsOn, lapDistM, time));
    if (alignment.status !== 'collecting') break;
  }
};

describe('LmuWorldTrackAlignment', () => {
  const track = algarve();

  it('finds where the line starts against lap distance', () => {
    const alignment = new LmuWorldTrackAlignment();
    alignment.reset(track);
    align(alignment, track, ALGARVE_LAP_DISTANCE_M);

    expect(alignment.status).toBe('accepted');
    expect(alignment.result?.offsetM).toBeCloseTo(OFFSET_M, -1);
    expect(alignment.result?.medianDistanceM).toBeLessThan(3);
    expect(alignment.result?.lapDistM).toBe(ALGARVE_LAP_DISTANCE_M);
  });

  it('finds a start just before the line, across the wrap', () => {
    const alignment = new LmuWorldTrackAlignment();
    alignment.reset(track);
    for (let time = 0; time < 60; time += 0.05) {
      alignment.update(
        fieldAt(track, ALGARVE_LAP_DISTANCE_M, time, track.lengthM - 3)
      );
      if (alignment.status !== 'collecting') break;
    }
    const offset = alignment.result?.offsetM ?? Number.NaN;
    const error = Math.min(
      Math.abs(offset - (track.lengthM - 3)),
      Math.abs(offset + 3)
    );

    expect(alignment.status).toBe('accepted');
    expect(error).toBeLessThan(5);
  });

  it('refuses a track the cars are not on', () => {
    const alignment = new LmuWorldTrackAlignment();
    alignment.reset(mirrored(track));
    align(alignment, track, ALGARVE_LAP_DISTANCE_M);

    expect(alignment.status).toBe('rejected');
    expect(alignment.lastAttempt?.medianDistanceM).toBeGreaterThan(6);
  });

  it('waits a second of samples however large the field', () => {
    const alignment = new LmuWorldTrackAlignment();
    alignment.reset(track);
    for (let tick = 0; tick < 9; tick += 1) {
      alignment.update(fieldAt(track, ALGARVE_LAP_DISTANCE_M, tick * 0.11));
    }

    expect(alignment.samples).toBeGreaterThan(100);
    expect(alignment.status).toBe('collecting');
  });

  it('samples nothing without a lap length', () => {
    const alignment = new LmuWorldTrackAlignment();
    alignment.reset(track);
    alignment.update({
      ...fieldAt(track, ALGARVE_LAP_DISTANCE_M, 0),
      lapDistM: 0,
    });

    expect(alignment.samples).toBe(0);
  });
});

describe('buildWorldTrackMap', () => {
  const track = algarve();
  const { map, fit } = buildWorldTrackMap(
    track,
    OFFSET_M,
    ALGARVE_LAP_DISTANCE_M
  );
  const toWorld = (point: GroundPoint) => ({
    x: fit.ar * point.x - fit.ai * point.y + fit.tx,
    y: fit.ai * point.x + fit.ar * point.y + fit.ty,
  });

  it('starts the map at the start/finish line', () => {
    const start = toWorld(map.active.trackPathPoints[0]);
    const expected = pointAtArc(track, OFFSET_M);

    expect(start.x).toBeCloseTo(expected.x, 1);
    expect(start.y).toBeCloseTo(expected.y, 1);
  });

  it('maps every map point back onto the world line at its lap fraction', () => {
    const points = map.active.trackPathPoints;
    for (const index of [0, 50, 128, 300, 511]) {
      const pct = index / points.length;
      const world = toWorld(mapPointAt(points, pct, { x: 0, y: 0 }));
      const expected = pointAtArc(track, OFFSET_M + pct * track.lengthM);

      expect(
        Math.hypot(world.x - expected.x, world.y - expected.y)
      ).toBeLessThan(0.05);
    }
  });

  it('puts the road where a car on it is placed, with us off track', () => {
    const lapPct = 0.3;
    const onLine = pointAtArc(track, OFFSET_M + lapPct * track.lengthM);
    const player = {
      x: onLine.x + onLine.dy * 12,
      y: onLine.y - onLine.dx * 12,
    };
    const yaw = Math.atan2(onLine.dx, onLine.dy) + 0.1;
    const frame = radarMapFrame(fit, player.x, -player.y, yaw);
    expect(frame).not.toBeNull();
    if (!frame) return;

    for (const pct of [lapPct, lapPct + 0.005, lapPct - 0.004]) {
      const car = pointAtArc(track, OFFSET_M + pct * track.lengthM);
      const expected = deriveLmuRelativePositions({
        playerHasVehicle: true,
        playerVehicleIdx: 0,
        vehTelemetryAvailable: new Uint8Array([1, 1]),
        vehPosX: new Float64Array([player.x, car.x]),
        vehPosZ: new Float64Array([-player.y, -car.y]),
        vehOriX: new Float64Array([Math.sin(yaw), 0]),
        vehOriZ: new Float64Array([Math.cos(yaw), 1]),
      } as LmuRawTelemetry);
      const point = mapPointAt(map.active.trackPathPoints, pct, { x: 0, y: 0 });
      const relX = point.x - frame[0];
      const relY = point.y - frame[1];

      expect(frame[2] * relX + frame[3] * relY).toBeCloseTo(
        expected?.lateral[1] ?? Number.NaN,
        0
      );
      expect(frame[4] * relX + frame[5] * relY).toBeCloseTo(
        expected?.longitudinal[1] ?? Number.NaN,
        0
      );
    }
  });
});

describe('LmuWorldTrackSource', () => {
  let directory: string;
  let storage: LmuWorldTrackStorage;
  const log = { info: vi.fn(), warn: vi.fn() };
  const track = algarve();

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'lmu-world-track-'));
    storage = new LmuWorldTrackStorage(path.join(directory, 'tracks.json'));
    log.info.mockClear();
    log.warn.mockClear();
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const drive = (
    source: LmuWorldTrackSource,
    restTrack: LmuWorldTrack | undefined,
    lapDistM = ALGARVE_LAP_DISTANCE_M,
    seconds = 30
  ) => {
    let changed = false;
    for (let time = 0; time < seconds; time += 0.05) {
      changed =
        source.update({ ...fieldAt(track, lapDistM, time), restTrack }) ||
        changed;
    }
    return changed;
  };

  it('uses the live track once lined up, and keeps it for next time', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Algarve International Circuit');
    expect(source.map).toBeNull();
    expect(source.wantsLiveTrack).toBe(true);

    expect(drive(source, track)).toBe(true);
    expect(source.source).toBe('live');
    expect(source.map?.active.trackPathPoints).toHaveLength(512);
    expect(source.fit?.rmsM).toBe(0);
    expect(source.wantsLiveTrack).toBe(false);
    expect(log.info).toHaveBeenCalledWith(
      expect.stringMatching(
        /^\[lmuWorldTrack\] World track for Algarve International Circuit: start offset 13\d\d m, scale 1\.01\d\d, field \d\.\d m from the line, \d+ samples$/
      )
    );

    const stored = storage.load('Algarve International Circuit');
    expect(stored?.offsetM).toBeCloseTo(OFFSET_M, -1);
    expect(stored?.track.racing).toHaveLength(155);
  });

  it('starts from the cached track and keeps it when the live one matches', () => {
    const first = new LmuWorldTrackSource(storage, log);
    first.setTrack('Algarve International Circuit');
    drive(first, track);

    const next = new LmuWorldTrackSource(storage, log);
    next.setTrack('Algarve International Circuit');
    expect(next.source).toBe('cache');
    expect(next.map).not.toBeNull();

    expect(drive(next, algarve())).toBe(false);
    expect(next.source).toBe('cache');
    expect(next.wantsLiveTrack).toBe(false);
    expect(log.info).toHaveBeenLastCalledWith(
      '[lmuWorldTrack] World track for Algarve International Circuit matches the cached one'
    );
  });

  it('tries again after a rejection, then falls back', () => {
    const source = new LmuWorldTrackSource(storage, log, () => 'skipped 3');
    source.setTrack('Algarve International Circuit');

    expect(drive(source, mirrored(track), ALGARVE_LAP_DISTANCE_M, 20)).toBe(
      false
    );
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining(`(attempt 1 of ${WORLD_TRACK_MAX_ATTEMPTS})`)
    );
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('skipped 3; trying again in 30 s')
    );
    expect(log.warn).not.toHaveBeenCalled();
    expect(source.wantsLiveTrack).toBe(false);

    expect(drive(source, mirrored(track), ALGARVE_LAP_DISTANCE_M, 200)).toBe(
      false
    );
    expect(source.map).toBeNull();
    expect(source.wantsLiveTrack).toBe(false);
    expect(log.warn).toHaveBeenCalledTimes(1);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining(
        `(attempt ${WORLD_TRACK_MAX_ATTEMPTS} of ${WORLD_TRACK_MAX_ATTEMPTS})`
      )
    );
    expect(storage.load('Algarve International Circuit')).toBeNull();
  });

  it('accepts the live track on a retry once the samples are clean', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Algarve International Circuit');

    for (let time = 0; time < 20; time += 0.05) {
      const frame = fieldAt(track, ALGARVE_LAP_DISTANCE_M, time);
      const posX = Array.from(frame.posX, (x, carIdx) =>
        carIdx % 4 ? x + 300 : x
      );
      source.update({ ...frame, posX, restTrack: track });
    }
    expect(source.map).toBeNull();
    expect(log.info).toHaveBeenCalledWith(
      expect.stringContaining('trying again in 30 s')
    );

    expect(drive(source, track, ALGARVE_LAP_DISTANCE_M, 60)).toBe(true);
    expect(source.source).toBe('live');
  });

  it('skips cars the sample gate marks invalid', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Algarve International Circuit');
    for (let time = 0; time < 30; time += 0.05) {
      const frame = fieldAt(track, ALGARVE_LAP_DISTANCE_M, time);
      const valid = frame.pcts.map((_, carIdx) => (carIdx % 2 ? 0 : 1));
      const posX = Array.from(frame.posX, (x, carIdx) =>
        carIdx % 2 ? x + 300 : x
      );
      source.update({ ...frame, posX, valid, restTrack: track });
    }

    expect(source.source).toBe('live');
  });

  it('looks at the live track again after a session restart', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Algarve International Circuit');
    drive(source, mirrored(track), ALGARVE_LAP_DISTANCE_M, 20);
    expect(source.wantsLiveTrack).toBe(false);

    source.restart();
    expect(source.wantsLiveTrack).toBe(true);
    expect(drive(source, track)).toBe(true);
    expect(source.source).toBe('live');
  });

  it('refuses a live track whose length is not the lap', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Sebring School Circuit');

    expect(drive(source, track, 3083.3)).toBe(false);
    expect(source.map).toBeNull();
    expect(source.wantsLiveTrack).toBe(false);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringContaining('against a 3083 m lap; not used')
    );
  });

  it('waits for the lap length before judging a live track', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Algarve International Circuit');
    source.update({ ...fieldAt(track, 0, 0), restTrack: track });

    expect(source.wantsLiveTrack).toBe(true);
    expect(drive(source, track)).toBe(true);
  });

  it('forgets everything on a new track', () => {
    const source = new LmuWorldTrackSource(storage, log);
    source.setTrack('Algarve International Circuit');
    drive(source, track);
    source.setTrack('Sebring School Circuit');

    expect(source.map).toBeNull();
    expect(source.fit).toBeNull();
    expect(source.wantsLiveTrack).toBe(true);
  });
});

describe('LmuWorldTrackStorage', () => {
  it('reads nothing from a missing or broken file', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'lmu-world-track-')
    );
    const file = path.join(directory, 'tracks.json');
    const storage = new LmuWorldTrackStorage(file);
    expect(storage.load('Algarve International Circuit')).toBeNull();

    fs.writeFileSync(file, '{"Algarve International Circuit":{"racing":[1]}}');
    expect(storage.load('Algarve International Circuit')).toBeNull();
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
