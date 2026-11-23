import { describe, expect, it } from 'vitest';
import type { LmuTrackMap } from '@irdashies/types';
import type { LmuRawTelemetry } from './native';
import {
  LmuMapRegistration,
  MAP_REGISTRATION_MAX_ATTEMPTS,
  MAP_REGISTRATION_RETRY_S,
  mapPointAt,
  radarMapFrame,
  type MapRegistrationInput,
} from './mapRegistration';
import { deriveLmuRelativePositions } from './proximity';
import { normalizeLmuTrackMap } from './trackMap';

interface GroundTrack {
  length: number;
  at: (pct: number) => { x: number; y: number; dx: number; dy: number };
}

const ellipseTrack = (radiusX: number, radiusY: number): GroundTrack => {
  const steps = 4000;
  const xs: number[] = [];
  const ys: number[] = [];
  const distances: number[] = [0];
  for (let index = 0; index <= steps; index += 1) {
    const angle = (index / steps) * Math.PI * 2;
    xs.push(radiusX * Math.cos(angle));
    ys.push(radiusY * Math.sin(angle));
    if (index > 0) {
      distances.push(
        distances[index - 1] +
          Math.hypot(xs[index] - xs[index - 1], ys[index] - ys[index - 1])
      );
    }
  }
  const length = distances[steps];
  const at = (pct: number) => {
    const target = (((pct % 1) + 1) % 1) * length;
    let low = 0;
    let high = steps;
    while (high - low > 1) {
      const mid = (low + high) >> 1;
      if (distances[mid] <= target) low = mid;
      else high = mid;
    }
    const span = distances[high] - distances[low];
    const amount = span > 0 ? (target - distances[low]) / span : 0;
    const dx = xs[high] - xs[low];
    const dy = ys[high] - ys[low];
    const norm = Math.hypot(dx, dy) || 1;
    return {
      x: xs[low] + dx * amount,
      y: ys[low] + dy * amount,
      dx: dx / norm,
      dy: dy / norm,
    };
  };
  return { length, at };
};

const mapOf = (track: GroundTrack): LmuTrackMap =>
  normalizeLmuTrackMap(
    Array.from({ length: 2000 }, (_, index) => {
      const point = track.at(index / 2000);
      return {
        x: point.x,
        y: point.y,
        distance: (index / 2000) * track.length,
      };
    }),
    track.length
  );

const CAR_COUNT = 24;

const fieldAt = (
  track: GroundTrack,
  map: LmuTrackMap | null,
  time: number,
  options: { bunched?: boolean; inPits?: number[]; slow?: number[] } = {}
): MapRegistrationInput => {
  const posX: number[] = [];
  const posZ: number[] = [];
  const pcts: number[] = [];
  for (let carIdx = 0; carIdx < CAR_COUNT; carIdx += 1) {
    const pct = options.bunched
      ? 0.3
      : (((carIdx / CAR_COUNT + (time * 50) / track.length) % 1) + 1) % 1;
    const point = track.at(pct);
    const offset = 4 * Math.sin(carIdx * 1.7 + time);
    posX.push(point.x - point.dy * offset);
    posZ.push(-(point.y + point.dx * offset));
    pcts.push(pct);
  }
  return {
    map,
    time,
    trackLengthM: track.length,
    posX,
    posZ,
    available: posX.map(() => 1),
    pcts,
    inPits: posX.map((_, carIdx) => (options.inPits?.includes(carIdx) ? 1 : 0)),
    speeds: posX.map((_, carIdx) => (options.slow?.includes(carIdx) ? 1 : 50)),
  };
};

const runUntilSettled = (
  registration: LmuMapRegistration,
  track: GroundTrack,
  map: LmuTrackMap,
  options?: Parameters<typeof fieldAt>[3]
) => {
  for (let time = 0; time < 120; time += 0.05) {
    registration.update(fieldAt(track, map, time, options));
    if (registration.status !== 'collecting') break;
  }
};

describe('LmuMapRegistration', () => {
  const track = ellipseTrack(600, 300);
  const map = mapOf(track);

  it('fits the map to world positions from the field', () => {
    const registration = new LmuMapRegistration();
    runUntilSettled(registration, track, map);

    expect(registration.status).toBe('accepted');
    expect(registration.fit?.mirrored).toBe(false);
    expect(registration.fit?.rmsM).toBeLessThan(4);
  });

  it('fits a map whose handedness is flipped', () => {
    const mirroredMap: LmuTrackMap = {
      ...map,
      active: {
        ...map.active,
        trackPathPoints: map.active.trackPathPoints.map((point) => ({
          x: 1920 - point.x,
          y: point.y,
        })),
      },
    };
    const registration = new LmuMapRegistration();
    runUntilSettled(registration, track, mirroredMap);

    expect(registration.status).toBe('accepted');
    expect(registration.fit?.mirrored).toBe(true);
  });

  it('rejects a map of a different layout', () => {
    const registration = new LmuMapRegistration();
    runUntilSettled(registration, track, mapOf(ellipseTrack(400, 400)));

    expect(registration.status).toBe('rejected');
    expect(registration.fit).toBeNull();
    expect(registration.lastAttempt?.rmsM).toBeGreaterThan(8);
  });

  it('waits until the field has covered enough of the lap', () => {
    const registration = new LmuMapRegistration();
    for (let time = 0; time < 30; time += 0.1) {
      registration.update(fieldAt(track, map, time, { bunched: true }));
    }

    expect(registration.samples).toBeGreaterThan(300);
    expect(registration.status).toBe('collecting');
  });

  it('samples at 10 Hz however often it is called', () => {
    const registration = new LmuMapRegistration();
    registration.update(fieldAt(track, map, 0.01));
    registration.update(fieldAt(track, map, 0.06));
    expect(registration.samples).toBe(CAR_COUNT);

    registration.update(fieldAt(track, map, 0.11));
    expect(registration.samples).toBe(CAR_COUNT * 2);
  });

  it('leaves out cars at the start of the lap and cars the gate refuses', () => {
    const registration = new LmuMapRegistration();
    const frame = fieldAt(track, map, 0.01);
    const pcts = frame.pcts.map((pct, carIdx) => (carIdx < 4 ? 0 : pct));
    const valid = frame.pcts.map((_, carIdx) => (carIdx === 5 ? 0 : 1));
    registration.update({ ...frame, pcts, valid });

    expect(registration.samples).toBe(CAR_COUNT - 5);
  });

  it('registers through a race start with cars behind the line', () => {
    const registration = new LmuMapRegistration();
    for (let time = 0.01; time < 120; time += 0.05) {
      const frame = fieldAt(track, map, time);
      if (time < 20) {
        const pcts = frame.pcts.map((pct, carIdx) => (carIdx % 2 ? 0 : pct));
        registration.update({ ...frame, pcts });
      } else {
        registration.update(frame);
      }
      if (registration.status !== 'collecting') break;
    }

    expect(registration.status).toBe('accepted');
    expect(registration.fit?.rmsM).toBeLessThan(4);
  });

  it('keeps the fit when a fifth of the samples are far off', () => {
    const registration = new LmuMapRegistration();
    for (let time = 0.01; time < 120; time += 0.05) {
      const frame = fieldAt(track, map, time);
      const posX = Array.from(frame.posX, (x, carIdx) =>
        carIdx % 5 === 0 ? x + 300 : x
      );
      registration.update({ ...frame, posX });
      if (registration.status !== 'collecting') break;
    }

    expect(registration.status).toBe('accepted');
    expect(registration.fit?.rmsM).toBeLessThan(4);
    expect(registration.fit?.inlierShare).toBeGreaterThan(0.75);
  });

  it('tries again after a rejection, a limited number of times', () => {
    const registration = new LmuMapRegistration();
    const wrongMap = mapOf(ellipseTrack(400, 400));
    let time = 0.01;
    const runFor = (seconds: number) => {
      const end = time + seconds;
      for (; time < end; time += 0.05) {
        registration.update(fieldAt(track, wrongMap, time));
      }
    };

    runFor(20);
    expect(registration.status).toBe('rejected');
    expect(registration.attempt).toBe(1);
    expect(registration.finallyRejected).toBe(false);

    runFor(MAP_REGISTRATION_RETRY_S);
    expect(registration.status).toBe('collecting');
    expect(registration.attempt).toBe(2);

    runFor(MAP_REGISTRATION_MAX_ATTEMPTS * (MAP_REGISTRATION_RETRY_S + 60));
    expect(registration.attempt).toBe(MAP_REGISTRATION_MAX_ATTEMPTS);
    expect(registration.finallyRejected).toBe(true);
  });

  it('starts over on a session restart unless already registered', () => {
    const registration = new LmuMapRegistration();
    const wrongMap = mapOf(ellipseTrack(400, 400));
    for (let time = 0.01; time < 20; time += 0.05) {
      registration.update(fieldAt(track, wrongMap, time));
    }
    const wrong = registration.status;
    registration.restart();
    expect(wrong).toBe('rejected');
    expect(registration.status).toBe('collecting');
    expect(registration.attempt).toBe(1);

    const good = new LmuMapRegistration();
    runUntilSettled(good, track, map);
    good.restart();
    expect(good.status).toBe('accepted');
  });

  it('leaves out cars in the pits and cars barely moving', () => {
    const registration = new LmuMapRegistration();
    registration.update(fieldAt(track, map, 0, { inPits: [0, 1], slow: [2] }));

    expect(registration.samples).toBe(CAR_COUNT - 3);
  });

  it('starts over when the map changes', () => {
    const registration = new LmuMapRegistration();
    runUntilSettled(registration, track, map);
    registration.update(fieldAt(track, mapOf(ellipseTrack(610, 300)), 200));

    expect(registration.status).toBe('collecting');
    expect(registration.fit).toBeNull();
  });

  it('does nothing without a map', () => {
    const registration = new LmuMapRegistration();
    expect(registration.update(fieldAt(track, null, 0))).toBeNull();
    expect(registration.samples).toBe(0);
  });
});

describe('radarMapFrame', () => {
  const track = ellipseTrack(600, 300);
  const map = mapOf(track);
  const registration = new LmuMapRegistration();
  runUntilSettled(registration, track, map);
  const fit = registration.fit;

  const relativeTo = (
    player: { x: number; y: number },
    yaw: number,
    car: { x: number; y: number }
  ) =>
    deriveLmuRelativePositions({
      playerHasVehicle: true,
      playerVehicleIdx: 0,
      vehTelemetryAvailable: new Uint8Array([1, 1]),
      vehPosX: new Float64Array([player.x, car.x]),
      vehPosZ: new Float64Array([-player.y, -car.y]),
      vehOriX: new Float64Array([Math.sin(yaw), 0]),
      vehOriZ: new Float64Array([Math.cos(yaw), 1]),
    } as LmuRawTelemetry);

  const throughFrame = (frame: number[], pct: number) => {
    const point = mapPointAt(map.active.trackPathPoints, pct, { x: 0, y: 0 });
    const relX = point.x - frame[0];
    const relY = point.y - frame[1];
    return {
      right: frame[2] * relX + frame[3] * relY,
      ahead: frame[4] * relX + frame[5] * relY,
    };
  };

  it('puts the road where a car on the road is placed, with us off track', () => {
    expect(fit).not.toBeNull();
    if (!fit) return;
    const playerPct = 0.15;
    const onLine = track.at(playerPct);
    const player = {
      x: onLine.x + onLine.dy * 12,
      y: onLine.y - onLine.dx * 12,
    };
    const yaw = Math.atan2(onLine.dx, onLine.dy) + 0.1;
    const frame = radarMapFrame(fit, player.x, -player.y, yaw);
    expect(frame).not.toBeNull();
    if (!frame) return;

    for (const pct of [playerPct, playerPct + 0.01, playerPct - 0.008]) {
      const expected = relativeTo(player, yaw, track.at(pct));
      const road = throughFrame(frame, pct);
      expect(road.right).toBeCloseTo(expected?.lateral[1] ?? NaN, 0);
      expect(road.ahead).toBeCloseTo(expected?.longitudinal[1] ?? NaN, 0);
    }
    expect(Math.abs(throughFrame(frame, playerPct).right)).toBeGreaterThan(10);
  });

  it('gives nothing for a position or heading that is not finite', () => {
    if (!fit) return;
    expect(radarMapFrame(fit, Number.NaN, 0, 0)).toBeNull();
    expect(radarMapFrame(fit, 0, 0, Number.NaN)).toBeNull();
  });
});
