import { describe, expect, it, vi } from 'vitest';
import type { LmuTrackMap } from '@irdashies/types';
import type { LmuRawTelemetry } from './native';
import type { MapRegistrationFit } from './mapRegistration';
import { deriveLmuRelativePositions } from './proximity';
import { normalizeLmuTrackMapWithTransform } from './trackMap';
import { fitFromMapTransform } from './worldTrack';
import {
  bundleBinsFor,
  bundledTrackWidthFromStored,
  LmuDrawnLine,
  LmuTrackWidth,
  LmuTrackWidthProfile,
  lmuOffTrackFlags,
  parseStoredTrackWidth,
  ROAD_EDGES_HEADER,
  storedTrackWidthFromBundle,
  TRACK_WIDTH_STORE_VERSION,
  type StoredTrackWidth,
  type TrackWidthBundle,
  type TrackWidthFrame,
} from './trackWidth';

interface CentrePoint {
  x: number;
  y: number;
  dx: number;
  dy: number;
}

const ellipse = (radiusX: number, radiusY: number) => {
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
  const at = (pct: number): CentrePoint => {
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

const centre = ellipse(600, 300);
const LAP = centre.length;
const CAR_COUNT = 24;
const wrap = (value: number) => ((value % 1) + 1) % 1;

const racingOffset = (pct: number) => 3 * Math.sin(Math.PI * 2 * 3 * pct);
const halfLeft = (pct: number) => 6 + 2 * Math.sin(Math.PI * 2 * pct);
const halfRight = (pct: number) => 7 - 1.5 * Math.cos(Math.PI * 4 * pct);

const leftOf = (point: CentrePoint) => ({ x: point.dy, y: -point.dx });

const groundAt = (pct: number, lateral: number) => {
  const point = centre.at(pct);
  const left = leftOf(point);
  return { x: point.x + left.x * lateral, y: point.y + left.y * lateral };
};

const drawnLine = (): { map: LmuTrackMap; fit: MapRegistrationFit } => {
  const recorded = Array.from({ length: 2000 }, (_, index) => {
    const pct = index / 2000;
    return { ...groundAt(pct, racingOffset(pct)), distance: pct * LAP };
  });
  const { map, transform } = normalizeLmuTrackMapWithTransform(recorded, LAP);
  return { map, fit: fitFromMapTransform(transform) };
};

const { map, fit } = drawnLine();

interface FieldOptions {
  lmuSign?: 1 | -1;
  signedEdge?: boolean;
  lateral?: (carIdx: number, pct: number, time: number) => number;
  pathLateral?: (carIdx: number, time: number) => number;
}

const spreadLateral = (carIdx: number, pct: number, time: number) =>
  racingOffset(pct) + 5 * Math.sin(carIdx * 1.7 + pct * 40 + time * 0.3);

const fieldAt = (
  time: number,
  options: FieldOptions = {}
): Omit<TrackWidthFrame, 'map' | 'fit' | 'cacheable'> => {
  const sign = options.lmuSign ?? 1;
  const lateralOf = options.lateral ?? spreadLateral;
  const posX: number[] = [];
  const posZ: number[] = [];
  const pcts: number[] = [];
  const pathLateral: number[] = [];
  const trackEdge: number[] = [];
  for (let carIdx = 0; carIdx < CAR_COUNT; carIdx += 1) {
    const pct = wrap(carIdx / CAR_COUNT + (time * 50) / LAP);
    const lateral = lateralOf(carIdx, pct, time);
    const ground = groundAt(pct, lateral);
    posX.push(ground.x);
    posZ.push(-ground.y);
    pcts.push(pct);
    pathLateral.push(
      options.pathLateral ? options.pathLateral(carIdx, time) : sign * lateral
    );
    const half = lateral >= 0 ? halfLeft(pct) : halfRight(pct);
    const side = lateral >= 0 ? 1 : -1;
    trackEdge.push(options.signedEdge ? sign * side * half : half);
  }
  return {
    time,
    scoringTime: time,
    lapDistM: LAP,
    posX,
    posZ,
    available: posX.map(() => 1),
    pcts,
    inPits: posX.map(() => 0),
    speeds: posX.map(() => 50),
    pathLateral,
    trackEdge,
  };
};

const learnedProfile = (options: FieldOptions = {}, seconds = 180) => {
  const profile = new LmuTrackWidthProfile();
  profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
  for (let time = 0; time < seconds; time += 0.2) {
    profile.update(fieldAt(time, options));
  }
  return profile;
};

interface EdgeWindowSource {
  fillWindow: (playerPct: number, out: number[]) => boolean;
}

const learnedFrom = (width: LmuTrackWidth): EdgeWindowSource => ({
  fillWindow: (playerPct, out) => width.fillRoadEdges(playerPct, out),
});

const windowOf = (profile: EdgeWindowSource, playerPct: number) => {
  const out: number[] = [];
  const filled = profile.fillWindow(playerPct, out);
  const count = out[2];
  const at = (slot: number) => ({
    pct: wrap(out[0] + slot * out[1]),
    left: out[ROAD_EDGES_HEADER + slot],
    right: out[ROAD_EDGES_HEADER + count + slot],
  });
  return { filled, out, count, at };
};

const expectEdgesNearTruth = (profile: EdgeWindowSource, pct: number) => {
  const { filled, count, at } = windowOf(profile, pct);
  expect(filled).toBe(true);
  let checked = 0;
  for (let slot = 0; slot < count; slot += 10) {
    const entry = at(slot);
    expect(
      Math.abs(entry.left - (-racingOffset(entry.pct) + halfLeft(entry.pct)))
    ).toBeLessThan(0.5);
    expect(
      Math.abs(entry.right - (-racingOffset(entry.pct) - halfRight(entry.pct)))
    ).toBeLessThan(0.5);
    checked += 1;
  }
  expect(checked).toBeGreaterThan(10);
};

describe('LmuDrawnLine', () => {
  it('measures positive to the left of travel, as the radar draws it', () => {
    const line = new LmuDrawnLine(map.active.trackPathPoints, fit);
    const pct = 0.3;
    const at = groundAt(pct, racingOffset(pct));
    const ahead = groundAt(pct + 0.001, racingOffset(pct + 0.001));
    const behind = groundAt(pct - 0.001, racingOffset(pct - 0.001));
    const tx = ahead.x - behind.x;
    const ty = ahead.y - behind.y;
    const norm = Math.hypot(tx, ty);
    const car = {
      x: at.x + (ty / norm) * 5,
      y: at.y - (tx / norm) * 5,
    };

    expect(line.signedOffset(pct, car.x, car.y)).toBeCloseTo(5, 1);

    const yaw = Math.atan2(tx, ty);
    const relative = deriveLmuRelativePositions({
      playerHasVehicle: true,
      playerVehicleIdx: 0,
      vehTelemetryAvailable: new Uint8Array([1, 1]),
      vehPosX: new Float64Array([at.x, car.x]),
      vehPosZ: new Float64Array([-at.y, -car.y]),
      vehOriX: new Float64Array([Math.sin(yaw), 0]),
      vehOriZ: new Float64Array([Math.cos(yaw), 1]),
    } as LmuRawTelemetry);
    expect(relative?.lateral[1]).toBeCloseTo(-5, 1);
    expect(relative?.longitudinal[1]).toBeCloseTo(0, 1);
  });
});

describe('LmuTrackWidthProfile', () => {
  it('learns both edges with LMU positive to the left', () => {
    const profile = learnedProfile({ lmuSign: 1 });

    expect(profile.status).toBe('ready');
    expect(profile.sign).toBe(1);
    expect(profile.coverage()).toBeGreaterThan(0.9);
    expect(profile.signCheck?.slope).toBeCloseTo(1, 1);
    expect(profile.signCheck?.correlation).toBeGreaterThan(0.95);
    expect(profile.signCheck?.residualM).toBeLessThan(0.3);
    expectEdgesNearTruth(profile, 0.2);
    expectEdgesNearTruth(profile, 0.65);
  });

  it('learns both edges with LMU positive to the right and a signed edge', () => {
    const profile = learnedProfile({ lmuSign: -1, signedEdge: true });

    expect(profile.sign).toBe(-1);
    expect(profile.signCheck?.slope).toBeCloseTo(-1, 1);
    expectEdgesNearTruth(profile, 0.4);
    expectEdgesNearTruth(profile, 0.9);
  });

  it('mirrors the edge it has around the centre when only one side is seen', () => {
    const profile = learnedProfile({
      lateral: (carIdx, pct, time) =>
        1 + 4 * Math.abs(Math.sin(carIdx * 1.7 + pct * 40 + time * 0.3)),
    });
    const { filled, count, at } = windowOf(profile, 0.5);

    expect(filled).toBe(true);
    expect(profile.coverage()).toBe(0);
    for (let slot = 0; slot < count; slot += 15) {
      const entry = at(slot);
      const centreOffset = -racingOffset(entry.pct);
      expect(
        Math.abs(entry.left - (centreOffset + halfLeft(entry.pct)))
      ).toBeLessThan(0.5);
      expect(
        Math.abs(entry.right - (centreOffset - halfLeft(entry.pct)))
      ).toBeLessThan(0.5);
    }
  });

  it('refuses the profile when the lateral does not follow the cars', () => {
    const profile = learnedProfile(
      {
        pathLateral: (carIdx, time) =>
          8 * Math.sin(carIdx * 12.9898 + time * 78.233),
      },
      90
    );

    expect(profile.status).toBe('refused');
    expect(profile.sign).toBeNull();
    expect(profile.fillWindow(0.5, [])).toBe(false);
  });

  it('bins each car by the scoring lap fraction when it is given', () => {
    const profile = new LmuTrackWidthProfile();
    profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
    for (let time = 0; time < 180; time += 0.2) {
      const frame = fieldAt(time);
      profile.update({
        ...frame,
        pcts: frame.pcts.map((pct) => wrap((pct as number) + 0.01)),
        scoringPcts: frame.pcts as number[],
      });
    }

    expect(profile.sign).toBe(1);
    expectEdgesNearTruth(profile, 0.5);
  });

  it('gives nothing before the sign is known', () => {
    const profile = learnedProfile({}, 0.5);

    expect(profile.status).toBe('collecting');
    expect(profile.fillWindow(0.5, [])).toBe(false);
  });

  it('samples once per scoring update', () => {
    const profile = new LmuTrackWidthProfile();
    profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
    profile.update(fieldAt(0));
    const first = profile.samples;
    profile.update({ ...fieldAt(0.3), scoringTime: 0 });

    expect(first).toBeGreaterThan(CAR_COUNT / 2);
    expect(profile.samples).toBe(first);
  });

  it('sends 180 m either side and wraps across the start/finish line', () => {
    const profile = learnedProfile();
    const { filled, out, count, at } = windowOf(profile, 0.0005);

    expect(filled).toBe(true);
    expect(count).toBe(181);
    expect(out).toHaveLength(ROAD_EDGES_HEADER + count * 2);
    expect(out[1]).toBeCloseTo(1 / profile.binCount, 9);
    expect(at(0).pct).toBeGreaterThan(0.9);
    expect(at(count - 1).pct).toBeLessThan(0.1);
    expect(at(90).pct).toBeCloseTo(0.5 / profile.binCount, 6);
    for (const slot of [0, 90, count - 1]) {
      const entry = at(slot);
      expect(
        Math.abs(entry.left - (-racingOffset(entry.pct) + halfLeft(entry.pct)))
      ).toBeLessThan(0.5);
    }
  });

  it('round-trips through the stored form', () => {
    const profile = learnedProfile();
    const stored = parseStoredTrackWidth(
      JSON.parse(JSON.stringify(profile.export()))
    );
    expect(stored).not.toBeNull();
    if (!stored) return;

    const seeded = new LmuTrackWidthProfile();
    seeded.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
    expect(seeded.seed(stored)).toBe(true);
    expect(seeded.status).toBe('ready');

    const original = windowOf(profile, 0.33);
    const restored = windowOf(seeded, 0.33);
    for (let slot = 0; slot < original.count; slot += 7) {
      expect(
        Math.abs(original.at(slot).left - restored.at(slot).left)
      ).toBeLessThanOrEqual(0.15);
      expect(
        Math.abs(original.at(slot).right - restored.at(slot).right)
      ).toBeLessThanOrEqual(0.15);
    }
  });

  describe('filling gaps', () => {
    const seededWithGaps = () => {
      const profile = new LmuTrackWidthProfile();
      profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
      const bins = profile.binCount;
      const filled = (value: number) => new Array<number>(bins).fill(value);
      const stored: StoredTrackWidth = {
        version: TRACK_WIDTH_STORE_VERSION,
        bins,
        lapDistM: LAP,
        sign: 1,
        centre: filled(0),
        left: Array.from({ length: bins }, (_, bin) => (bin < 110 ? 40 : 60)),
        right: Array.from({ length: bins }, (_, bin) =>
          bin >= 450 && bin < 550 ? 50 : 60
        ),
        centreCount: filled(5),
        leftCount: filled(5),
        rightCount: filled(5),
      };
      const clear = (from: number, to: number) => {
        for (let bin = from; bin < to; bin += 1) {
          stored.centreCount[bin] = 0;
          stored.leftCount[bin] = 0;
          stored.rightCount[bin] = 0;
        }
      };
      clear(100, 120);
      clear(300, 400);
      stored.rightCount[500] = 0;
      profile.seed(stored);
      return profile;
    };

    const slotOf = (
      profile: LmuTrackWidthProfile,
      playerBin: number,
      bin: number
    ) => {
      const playerPct = (playerBin + 0.5) / profile.binCount;
      const window = windowOf(profile, playerPct);
      return window.at(90 + bin - playerBin);
    };

    it('bridges a short gap with an edge between its neighbours', () => {
      const profile = seededWithGaps();
      for (let bin = 100; bin < 120; bin += 1) {
        const entry = slotOf(profile, 110, bin);
        expect(entry.left).toBeGreaterThanOrEqual(4 - 0.05);
        expect(entry.left).toBeLessThanOrEqual(6 + 0.05);
        expect(Math.abs(entry.right + 6)).toBeLessThanOrEqual(1);
      }
    });

    it('holds the nearest edge within 50 m and leaves the rest unknown', () => {
      const profile = seededWithGaps();

      expect(slotOf(profile, 350, 310).left).toBeCloseTo(6, 1);
      expect(slotOf(profile, 350, 350).left).toBeNaN();
      expect(slotOf(profile, 350, 350).right).toBeNaN();
    });

    it('takes a missing edge from the same side nearby', () => {
      const profile = seededWithGaps();
      const entry = slotOf(profile, 500, 500);

      expect(entry.left).toBeCloseTo(6, 0);
      expect(entry.right).toBeCloseTo(-5, 0);
      expect(entry.left - entry.right).toBeCloseTo(11, 1);
    });
  });
});

describe('LmuDrawnLine projection', () => {
  const line = new LmuDrawnLine(map.active.trackPathPoints, fit);

  it('refuses a car whose lap fraction is far from where it is', () => {
    const pct = 0.3;
    const far = groundAt(pct + 100 / LAP, racingOffset(pct + 100 / LAP));

    expect(line.signedOffset(pct, far.x, far.y)).toBeNaN();
  });

  it('measures across the line when the lap fraction is a little off', () => {
    const pct = 0.3;
    const near = pct + 8 / LAP;
    const point = centre.at(near);
    const left = leftOf(point);
    const lateral = racingOffset(near) + 4;
    const car = {
      x: point.x + left.x * lateral,
      y: point.y + left.y * lateral,
    };

    expect(line.signedOffset(pct, car.x, car.y)).toBeCloseTo(4, 0);
  });
});

interface SyntheticTrack {
  map: LmuTrackMap;
  fit: MapRegistrationFit;
  lap: number;
  at: (pct: number, lateral: number) => { x: number; y: number };
}

const syntheticTrack = (radiusX: number, radiusY: number): SyntheticTrack => {
  const track = ellipse(radiusX, radiusY);
  const at = (pct: number, lateral: number) => {
    const point = track.at(pct);
    const left = leftOf(point);
    return { x: point.x + left.x * lateral, y: point.y + left.y * lateral };
  };
  const recorded = Array.from({ length: 4000 }, (_, index) => ({
    ...at(index / 4000, 0),
    distance: (index / 4000) * track.length,
  }));
  const normalized = normalizeLmuTrackMapWithTransform(recorded, track.length);
  return {
    map: normalized.map,
    fit: fitFromMapTransform(normalized.transform),
    lap: track.length,
    at,
  };
};

const noise = (seed: number) => {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
};

interface SyntheticCar {
  lateral: number;
  half: number;
  scoring?: { x: number; y: number };
  telemetry?: { x: number; y: number };
}

const driveSynthetic = (
  track: SyntheticTrack,
  seconds: number,
  carAt: (carIdx: number, pct: number, time: number) => SyntheticCar,
  options: { useScoring?: boolean; profile?: LmuTrackWidthProfile } = {}
) => {
  const profile = options.profile ?? new LmuTrackWidthProfile();
  if (!options.profile) {
    profile.reset(
      new LmuDrawnLine(track.map.active.trackPathPoints, track.fit),
      track.lap
    );
  }
  const useScoring = options.useScoring ?? true;
  for (let time = 0; time < seconds; time += 0.2) {
    const scoringX: number[] = [];
    const scoringZ: number[] = [];
    const posX: number[] = [];
    const posZ: number[] = [];
    const pcts: number[] = [];
    const lateral: number[] = [];
    const edge: number[] = [];
    for (let carIdx = 0; carIdx < CAR_COUNT; carIdx += 1) {
      const pct = wrap(carIdx / CAR_COUNT + (time * 50) / track.lap + 1e-6);
      const car = carAt(carIdx, pct, time);
      const scoring = car.scoring ?? track.at(pct, car.lateral);
      const telemetry = car.telemetry ?? scoring;
      scoringX.push(scoring.x);
      scoringZ.push(-scoring.y);
      posX.push(telemetry.x);
      posZ.push(-telemetry.y);
      pcts.push(pct);
      lateral.push(car.lateral);
      edge.push(car.half);
    }
    profile.update({
      time,
      scoringTime: time,
      lapDistM: track.lap,
      posX,
      posZ,
      scoringPosX: useScoring ? scoringX : undefined,
      scoringPosZ: useScoring ? scoringZ : undefined,
      playerIdx: 0,
      available: posX.map(() => 1),
      pcts: [],
      scoringPcts: pcts,
      inPits: posX.map(() => 0),
      speeds: posX.map(() => 50),
      pathLateral: lateral,
      trackEdge: edge,
    });
  }
  return profile;
};

const edgesAround = (profile: LmuTrackWidthProfile, pct: number) => {
  const { filled, count, at } = windowOf(profile, pct);
  expect(filled).toBe(true);
  return Array.from({ length: count }, (_, slot) => at(slot));
};

const secondDifferences = (values: number[]) =>
  values
    .slice(1, -1)
    .map((value, index) =>
      Math.abs(values[index] - 2 * value + values[index + 2])
    );

describe('smoothed road edges', () => {
  it('keeps a lopsided straight road straight with mostly one-sided samples', () => {
    const track = syntheticTrack(1500, 1500);
    const LEFT = 4;
    const RIGHT = 8;
    const profile = driveSynthetic(track, 600, (carIdx, pct, time) => {
      const bothSides = pct < 0.3;
      const spread = Math.abs(Math.sin(carIdx * 1.7 + pct * 400 + time * 0.3));
      const lateral = bothSides
        ? (carIdx % 2 === 0 ? 1 : -1) * (0.8 + 2.5 * spread)
        : 0.8 + 2.5 * spread;
      const wobble = noise(carIdx * 1000 + time * 5) * 1.7;
      return {
        lateral,
        half: lateral >= 0 ? LEFT : RIGHT,
        scoring: track.at(pct, lateral + wobble),
      };
    });

    for (const pct of [0.15, 0.55, 0.8]) {
      const edges = edgesAround(profile, pct);
      for (const entry of edges) {
        expect(Math.abs(entry.left - LEFT)).toBeLessThan(0.3);
        expect(Math.abs(entry.right + RIGHT)).toBeLessThan(0.3);
      }
      for (const side of ['left', 'right'] as const) {
        const rough = secondDifferences(edges.map((entry) => entry[side]));
        expect(Math.max(...rough)).toBeLessThanOrEqual(0.2 + 1e-9);
        expect(
          rough.reduce((sum, d) => sum + d, 0) / rough.length
        ).toBeLessThan(0.05);
      }
    }
  });

  const cornerCar =
    (track: SyntheticTrack, skew: boolean) =>
    (carIdx: number, pct: number, time: number): SyntheticCar => {
      const lineAt = (at: number) => 3 * Math.sin(Math.PI * 2 * at);
      const personal = 2 * Math.sin(carIdx * 1.7 + time * 0.3);
      const lateral = lineAt(pct) + personal;
      const ahead = pct + 10 / track.lap;
      return {
        lateral,
        half: lateral >= 0 ? 6 : 7,
        telemetry: skew
          ? track.at(ahead, lineAt(ahead) + personal)
          : track.at(pct, lateral),
      };
    };

  it('follows a 50 m corner through the scoring position', () => {
    const track = syntheticTrack(50, 50);
    const profile = driveSynthetic(track, 300, cornerCar(track, true));

    for (const pct of [0.1, 0.35, 0.6, 0.85]) {
      for (const entry of edgesAround(profile, pct)) {
        expect(Math.abs(entry.left - 6)).toBeLessThan(0.3);
        expect(Math.abs(entry.right + 7)).toBeLessThan(0.3);
      }
    }
  });

  it('drifts in the same corner when the position is newer than the lateral', () => {
    const track = syntheticTrack(50, 50);
    const profile = driveSynthetic(track, 300, cornerCar(track, true), {
      useScoring: false,
    });

    const worst = Math.max(
      ...[0.1, 0.35, 0.6, 0.85].flatMap((pct) =>
        edgesAround(profile, pct).map((entry) => Math.abs(entry.left - 6))
      )
    );
    expect(worst).toBeGreaterThan(0.3);
  });

  it('mirrors a side never driven with the lopsidedness measured elsewhere', () => {
    const track = syntheticTrack(1500, 1500);
    const profile = driveSynthetic(track, 600, (carIdx, pct, time) => {
      const spread = Math.abs(Math.sin(carIdx * 1.7 + pct * 400 + time * 0.3));
      const lateral =
        pct < 0.5
          ? (carIdx % 2 === 0 ? 1 : -1) * (0.8 + 2.5 * spread)
          : 0.8 + 2.5 * spread;
      return { lateral, half: lateral >= 0 ? 4 : 8 };
    });

    for (const entry of edgesAround(profile, 0.8)) {
      expect(Math.abs(entry.left - 4)).toBeLessThan(0.3);
      expect(Math.abs(entry.right + 8)).toBeLessThan(0.3);
    }
  });

  it('copies the side it has when no stretch has both', () => {
    const track = syntheticTrack(1500, 1500);
    const profile = driveSynthetic(track, 600, (carIdx, pct, time) => {
      const spread = Math.abs(Math.sin(carIdx * 1.7 + pct * 400 + time * 0.3));
      return { lateral: 0.8 + 2.5 * spread, half: 5 };
    });

    for (const entry of edgesAround(profile, 0.4)) {
      expect(Math.abs(entry.left - 5)).toBeLessThan(0.3);
      expect(Math.abs(entry.right + 5)).toBeLessThan(0.3);
    }
  });

  it('drops outliers once the profile has settled', () => {
    const profile = learnedProfile();
    const before = edgesAround(profile, 0.4);
    for (let time = 180; time < 240; time += 0.2) {
      const frame = fieldAt(time);
      const pathLateral = [...(frame.pathLateral as number[])];
      for (const carIdx of [3, 9, 15]) pathLateral[carIdx] += 5;
      profile.update({ ...frame, pathLateral });
    }
    const after = edgesAround(profile, 0.4);

    expect(profile.diagnostics().rejected).toBeGreaterThan(0);
    for (let slot = 0; slot < before.length; slot += 1) {
      expect(Math.abs(after[slot].left - before[slot].left)).toBeLessThan(0.2);
      expect(Math.abs(after[slot].right - before[slot].right)).toBeLessThan(
        0.2
      );
    }
  });

  it('skips cars whose lap fraction is clamped at the line', () => {
    const profile = new LmuTrackWidthProfile();
    profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
    const frame = fieldAt(0);
    profile.update({ ...frame, scoringPcts: frame.pcts.map(() => 0) });

    expect(profile.samples).toBe(0);
  });

  it('counts samples from the player and other drivers by side', () => {
    const profile = new LmuTrackWidthProfile();
    profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
    for (let time = 0; time < 60; time += 0.2) {
      const frame = fieldAt(time);
      const trackEdge = [...(frame.trackEdge as number[])];
      trackEdge[5] = 0;
      profile.update({ ...frame, trackEdge, playerIdx: 0 });
    }
    const diagnostics = profile.diagnostics();

    expect(diagnostics.playerLeft + diagnostics.playerRight).toBeGreaterThan(0);
    expect(diagnostics.othersLeft).toBeGreaterThan(diagnostics.playerLeft);
    expect(diagnostics.othersRight).toBeGreaterThan(diagnostics.playerRight);
    expect(diagnostics.otherDriversSeen).toBe(CAR_COUNT - 1);
    expect(diagnostics.otherDriversWithEdge).toBe(CAR_COUNT - 2);
  });

  describe('between two readings of a car', () => {
    const oneCarAt = (pct: number, lateral: number, time: number) => {
      const ground = groundAt(pct, lateral);
      return {
        time,
        scoringTime: time,
        lapDistM: LAP,
        posX: [ground.x],
        posZ: [-ground.y],
        available: [1],
        pcts: [pct],
        inPits: [0],
        speeds: [50],
        pathLateral: [lateral],
        trackEdge: [lateral >= 0 ? halfLeft(pct) : halfRight(pct)],
      };
    };
    const drive = (
      profile: LmuTrackWidthProfile,
      laps: { lateral: (step: number) => number }[],
      stepS = 0.2
    ) => {
      let time = 0;
      let step = 0;
      for (const lap of laps) {
        const end = time + LAP / 50;
        for (; time < end; time += stepS, step += 1) {
          const pct = wrap((time * 50) / LAP + 0.001);
          profile.update(oneCarAt(pct, lap.lateral(step), time));
        }
      }
    };
    const fresh = () => {
      const profile = new LmuTrackWidthProfile();
      profile.reset(new LmuDrawnLine(map.active.trackPathPoints, fit), LAP);
      return profile;
    };

    it('fills the stretches between readings of a car that stays on its side', () => {
      const profile = fresh();
      drive(profile, [{ lateral: () => 4 }, { lateral: () => -4 }]);

      expect(profile.coverage()).toBeGreaterThan(0.95);
      expect(profile.diagnostics().interpolated).toBeGreaterThan(1500);
    });

    it('fills nothing when the car changes side between readings', () => {
      const profile = fresh();
      drive(profile, [{ lateral: (step) => (step % 2 ? 4 : -4) }]);

      expect(profile.diagnostics().interpolated).toBe(0);
    });

    it('fills nothing across more than 20 m', () => {
      const profile = fresh();
      drive(profile, [{ lateral: () => 4 }, { lateral: () => -4 }], 0.5);

      expect(profile.diagnostics().interpolated).toBe(0);
      expect(profile.coverage()).toBeLessThan(0.2);
    });

    it('fills nothing across a reading it skipped', () => {
      const profile = fresh();
      let time = 0;
      for (let step = 0; step < 50; step += 1, time += 0.2) {
        const pct = wrap((time * 50) / LAP + 0.001);
        const frame = oneCarAt(pct, 4, time);
        profile.update(step % 2 ? { ...frame, valid: [0] } : frame);
      }

      expect(profile.diagnostics().interpolated).toBe(0);
    });
  });

  it('refuses a cached profile from before the scoring position was used', () => {
    const stored = learnedProfile().export();
    expect(stored).not.toBeNull();

    expect(parseStoredTrackWidth({ ...stored, version: undefined })).toBeNull();
    expect(parseStoredTrackWidth({ ...stored, version: 1 })).toBeNull();
    expect(parseStoredTrackWidth(stored)).not.toBeNull();
  });

  it('refuses a cached profile with a negative sample count', () => {
    const stored = learnedProfile().export();
    if (!stored) throw new Error('profile did not learn');
    const negative = (counts: number[]) => counts.map((n, i) => (i ? n : -3));

    expect(
      parseStoredTrackWidth({
        ...stored,
        centreCount: negative(stored.centreCount),
      })
    ).toBeNull();
    expect(
      parseStoredTrackWidth({
        ...stored,
        leftCount: negative(stored.leftCount),
      })
    ).toBeNull();
    expect(
      parseStoredTrackWidth({
        ...stored,
        rightCount: negative(stored.rightCount),
      })
    ).toBeNull();
    expect(
      parseStoredTrackWidth({ ...stored, centre: negative(stored.centre) })
    ).not.toBeNull();
  });
});

describe('lmuOffTrackFlags', () => {
  it('flags a car more than a metre past the edge on its side', () => {
    const flags = lmuOffTrackFlags(
      [2, -7.5, 8.2, -6.4, 9, Number.NaN, 9],
      [6, -6, 7, 6, 5, 5, 5],
      [0, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 0, 1],
      []
    );

    expect(flags).toEqual([0, 1, 1, 0, 0, 0, 0]);
  });

  it('gives nothing without the fields', () => {
    expect(lmuOffTrackFlags(undefined, undefined, [], [], [1, 1])).toEqual([]);
  });
});

describe('LmuTrackWidth', () => {
  const createStorage = (stored?: unknown) => {
    const saves: StoredTrackWidth[] = [];
    return {
      saves,
      loadTrackWidth: vi.fn(() => stored),
      saveTrackWidth: vi.fn((_name: string, width: StoredTrackWidth) => {
        saves.push(width);
        return true;
      }),
    };
  };
  const createLog = () => ({ info: vi.fn(), warn: vi.fn() });

  const drive = (
    width: LmuTrackWidth,
    seconds: number,
    cacheable: boolean,
    line = { map, fit },
    from = 0
  ) => {
    for (let time = from; time < from + seconds; time += 0.2) {
      width.update({ ...fieldAt(time), ...line, cacheable });
    }
  };

  it('logs the detected sign once and never saves a profile it cannot cache', () => {
    const storage = createStorage();
    const log = createLog();
    const width = new LmuTrackWidth(storage, log);
    width.setTrack('Test Oval');
    drive(width, 180, false);

    expect(width.sign).toBe(1);
    expect(width.fillRoadEdges(0.5, [])).toBe(true);
    const signLines = log.info.mock.calls.filter(([line]) =>
      String(line).includes('LMU lateral sign +1')
    );
    expect(signLines).toHaveLength(1);
    expect(storage.loadTrackWidth).not.toHaveBeenCalled();
    expect(storage.saveTrackWidth).not.toHaveBeenCalled();
  });

  it('saves a cacheable profile once it has settled and logs the coverage', () => {
    const storage = createStorage();
    const log = createLog();
    const width = new LmuTrackWidth(storage, log);
    width.setTrack('Test Oval');
    drive(width, 180, true);

    expect(storage.saves.length).toBeGreaterThan(0);
    expect(storage.saves.length).toBeLessThanOrEqual(3);
    expect(storage.saveTrackWidth.mock.calls[0][0]).toBe('Test Oval');
    expect(
      log.info.mock.calls.some(([line]) =>
        /Saved track width for Test Oval: \d+% of the lap/.test(String(line))
      )
    ).toBe(true);
  });

  it('flushes what it learned when the track changes', () => {
    const storage = createStorage();
    const width = new LmuTrackWidth(storage, createLog());
    width.setTrack('Test Oval');
    drive(width, 30, true);
    expect(storage.saves).toHaveLength(0);

    width.setTrack('Another Track');
    expect(storage.saves).toHaveLength(1);
  });

  it('starts from the cached profile on the first frame', () => {
    const source = createStorage();
    const learned = new LmuTrackWidth(source, createLog());
    learned.setTrack('Test Oval');
    drive(learned, 180, true);
    learned.flush();
    const stored = JSON.parse(JSON.stringify(source.saves.at(-1))) as unknown;

    const log = createLog();
    const width = new LmuTrackWidth(createStorage(stored), log);
    width.setTrack('Test Oval');
    width.update({ ...fieldAt(0), map, fit, cacheable: true });

    expect(width.status).toBe('ready');
    expect(width.fillRoadEdges(0.5, [])).toBe(true);
    expect(
      log.info.mock.calls.some(([line]) =>
        String(line).includes('loaded from the cache')
      )
    ).toBe(true);
  });

  it('starts over when the drawn line changes', () => {
    const width = new LmuTrackWidth(createStorage(), createLog());
    width.setTrack('Test Oval');
    drive(width, 180, false);
    expect(width.status).toBe('ready');

    width.update({
      ...fieldAt(181),
      map,
      fit: { ...fit },
      cacheable: false,
    });
    expect(width.status).toBe('collecting');
    expect(width.fillRoadEdges(0.5, [])).toBe(false);
  });

  it('saves again on flush when the store turned the last save away', () => {
    const storage = createStorage();
    storage.saveTrackWidth.mockReturnValueOnce(false);
    const width = new LmuTrackWidth(storage, createLog());
    width.setTrack('Test Oval');
    for (
      let time = 0;
      time < 180 && storage.saveTrackWidth.mock.calls.length === 0;
      time += 0.2
    ) {
      width.update({ ...fieldAt(time), map, fit, cacheable: true });
    }
    expect(storage.saveTrackWidth).toHaveBeenCalledTimes(1);

    width.flush();
    expect(storage.saveTrackWidth).toHaveBeenCalledTimes(2);
  });

  it('saves nothing learned on one drawn line against the next one', () => {
    const storage = createStorage();
    const width = new LmuTrackWidth(storage, createLog());
    width.setTrack('Test Oval');
    drive(width, 30, true);
    expect(storage.saves).toHaveLength(0);

    width.update({ ...fieldAt(31), map, fit: { ...fit }, cacheable: true });
    width.flush();
    expect(storage.saves).toHaveLength(0);
  });

  describe('from the bundle', () => {
    const line = new LmuDrawnLine(map.active.trackPathPoints, fit);
    const learned = learnedProfile().export();
    if (!learned) throw new Error('profile did not learn');

    const bundleShiftedBy = (
      shiftM: number
    ): TrackWidthBundle & {
      trackWidth: ReturnType<typeof vi.fn>;
    } => {
      const shifted: StoredTrackWidth = {
        ...learned,
        centre: learned.centre.map((value) => value + shiftM * 10),
      };
      const width = bundledTrackWidthFromStored(
        shifted,
        line,
        bundleBinsFor(LAP)
      );
      return {
        trackWidth: vi.fn((trackName: string) =>
          trackName === 'Test Oval'
            ? {
                width,
                samples: 1234,
                smoothedCoverage: 0.9,
                irdashiesVersion: '3.0.0',
              }
            : null
        ),
      };
    };

    it('starts from the bundle when nothing is cached, on a line it cannot cache', () => {
      const log = createLog();
      const width = new LmuTrackWidth(createStorage(), log, bundleShiftedBy(0));
      width.setTrack('Test Oval');
      width.update({ ...fieldAt(0), map, fit, cacheable: false });

      expect(width.status).toBe('ready');
      expect(width.seededFromBundle).toBe(true);
      expectEdgesNearTruth(learnedFrom(width), 0.4);
      expect(log.info).toHaveBeenCalledWith(
        '[lmuTrackWidth] Track width for Test Oval from the bundle: 90% with both edges, 1234 samples, made with irdashies 3.0.0'
      );
    });

    const cachedProfile = () => {
      const source = createStorage();
      const learner = new LmuTrackWidth(source, createLog());
      learner.setTrack('Test Oval');
      drive(learner, 180, true);
      learner.flush();
      return JSON.parse(JSON.stringify(source.saves.at(-1))) as unknown;
    };

    const bundleOnly = (bundle: TrackWidthBundle) => {
      const entry = bundle.trackWidth('Test Oval', LAP);
      const stored = entry
        ? storedTrackWidthFromBundle(entry.width, line, LAP)
        : null;
      if (!stored) throw new Error('bundle did not convert');
      const profile = new LmuTrackWidthProfile();
      profile.reset(line, LAP);
      profile.seed(stored);
      return profile;
    };

    it('prefers the bundle over the cached profile', () => {
      const storage = createStorage(cachedProfile());
      const log = createLog();
      const width = new LmuTrackWidth(storage, log, bundleShiftedBy(0));
      width.setTrack('Test Oval');
      width.update({ ...fieldAt(0), map, fit, cacheable: true });

      expect(width.seededFromBundle).toBe(true);
      expect(storage.loadTrackWidth).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining('Track width for Test Oval from the bundle')
      );
    });

    it('stops learning once live samples confirm the bundle, and saves nothing', () => {
      const storage = createStorage();
      const log = createLog();
      const bundle = bundleShiftedBy(1.2);
      const width = new LmuTrackWidth(storage, log, bundle);
      width.setTrack('Test Oval');
      drive(width, 20, true);

      expect(width.learning).toBe(false);
      expect(log.info).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[lmuTrackWidth\] Bundled track width for Test Oval confirmed: live edges within 1\.\d m \(median of 200 samples\); learning off$/
        )
      );

      drive(width, 900, true, { map, fit }, 20);
      width.flush();
      width.setTrack('Another Track');
      expect(storage.saveTrackWidth).not.toHaveBeenCalled();
    });

    it('keeps the bundled edges unchanged after it stops learning', () => {
      const bundle = bundleShiftedBy(1.2);
      const width = new LmuTrackWidth(createStorage(), createLog(), bundle);
      width.setTrack('Test Oval');
      drive(width, 900, true);

      const expected = bundleOnly(bundle);
      for (const pct of [0.1, 0.4, 0.8]) {
        expect(windowOf(learnedFrom(width), pct).out).toEqual(
          windowOf(expected, pct).out
        );
      }
    });

    it('learns and saves as before once it drops the bundle', () => {
      const storage = createStorage();
      const width = new LmuTrackWidth(storage, createLog(), bundleShiftedBy(3));
      width.setTrack('Test Oval');
      drive(width, 180, true);
      width.flush();

      expect(width.learning).toBe(true);
      expect(storage.saves.length).toBeGreaterThan(0);
      expectEdgesNearTruth(learnedFrom(width), 0.4);
    });

    it('learns where the bundle has nothing', () => {
      const storage = createStorage();
      const bundle: TrackWidthBundle = { trackWidth: () => null };
      const width = new LmuTrackWidth(storage, createLog(), bundle);
      width.setTrack('Test Oval');
      drive(width, 180, true);

      expect(width.learning).toBe(true);
      expect(storage.saves.length).toBeGreaterThan(0);
    });

    it('prefers the cached profile over the bundle when told to learn bundled tracks', () => {
      const stored = cachedProfile();
      const bundle = bundleShiftedBy(0);
      const log = createLog();
      const width = new LmuTrackWidth(createStorage(stored), log, bundle, true);
      width.setTrack('Test Oval');
      width.update({ ...fieldAt(0), map, fit, cacheable: true });

      expect(width.seededFromBundle).toBe(false);
      expect(bundle.trackWidth).not.toHaveBeenCalled();
      expect(
        log.info.mock.calls.some(([entry]) =>
          String(entry).includes('loaded from the cache')
        )
      ).toBe(true);
    });

    it('drops a bundle 3 m off once live samples disagree, and learns live', () => {
      const log = createLog();
      const width = new LmuTrackWidth(createStorage(), log, bundleShiftedBy(3));
      width.setTrack('Test Oval');
      drive(width, 20, false);

      expect(width.seededFromBundle).toBe(false);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[lmuTrackWidth\] Bundled track width for Test Oval dropped: live edges are 3\.\d m from it \(median of 100 samples\); learning live only$/
        )
      );
      drive(width, 180, false, { map, fit }, 20);
      expectEdgesNearTruth(learnedFrom(width), 0.4);
    });

    it('keeps a bundle within 0.5 m of the live edges', () => {
      const log = createLog();
      const width = new LmuTrackWidth(
        createStorage(),
        log,
        bundleShiftedBy(0.4)
      );
      width.setTrack('Test Oval');
      drive(width, 20, false);

      expect(log.warn).not.toHaveBeenCalled();
      expect(log.info).toHaveBeenCalledWith(
        expect.stringContaining(
          'Bundled track width for Test Oval confirmed: live edges within 0.'
        )
      );
    });

    it('lets live data take over a bundle it kept when told to learn bundled tracks', () => {
      const storage = createStorage();
      const width = new LmuTrackWidth(
        storage,
        createLog(),
        bundleShiftedBy(1.2),
        true
      );
      width.setTrack('Test Oval');
      drive(width, 900, true);

      expect(width.learning).toBe(true);
      expectEdgesNearTruth(learnedFrom(width), 0.4);
      width.flush();
      expect(storage.saves.length).toBeGreaterThan(0);
    });

    const bundleFrom = (stored: StoredTrackWidth): TrackWidthBundle => {
      const width = bundledTrackWidthFromStored(
        stored,
        line,
        bundleBinsFor(LAP)
      );
      return {
        trackWidth: (trackName: string) =>
          trackName === 'Test Oval'
            ? {
                width,
                samples: 1234,
                smoothedCoverage: 0.9,
                irdashiesVersion: '3.0.0',
              }
            : null,
      };
    };

    const mostlyLeft = (carIdx: number, pct: number, time: number) =>
      racingOffset(pct) +
      (carIdx % 10 < 7 ? 3 : -3) +
      Math.sin(carIdx * 1.7 + pct * 40 + time * 0.3);

    it('drops a bundle when one edge is off, even with fewer samples on that side', () => {
      const log = createLog();
      const width = new LmuTrackWidth(
        createStorage(),
        log,
        bundleFrom({
          ...learned,
          right: learned.right.map((value) => value + 40),
        })
      );
      width.setTrack('Test Oval');
      for (let time = 0; time < 40; time += 0.2) {
        width.update({
          ...fieldAt(time, { lateral: mostlyLeft }),
          map,
          fit,
          cacheable: false,
        });
      }

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Bundled track width for Test Oval dropped')
      );
    });

    it('drops a disagreeing bundle even when every car stays on one side of the line', () => {
      const log = createLog();
      const width = new LmuTrackWidth(createStorage(), log, bundleShiftedBy(3));
      width.setTrack('Test Oval');
      const leftOnly = (carIdx: number, pct: number, time: number) =>
        2 + Math.sin(carIdx * 1.7 + pct * 40 + time * 0.3);
      for (let time = 0; time < 40; time += 0.2) {
        width.update({
          ...fieldAt(time, { lateral: leftOnly }),
          map,
          fit,
          cacheable: false,
        });
      }

      expect(width.seededFromBundle).toBe(false);
      expect(log.warn).toHaveBeenCalledWith(
        expect.stringContaining('Bundled track width for Test Oval dropped')
      );
    });

    it('learns the lateral sign afresh after dropping a bundle with the wrong one', () => {
      const width = new LmuTrackWidth(
        createStorage(),
        createLog(),
        bundleFrom({ ...learned, sign: learned.sign === 1 ? -1 : 1 })
      );
      width.setTrack('Test Oval');
      drive(width, 20, false);
      expect(width.seededFromBundle).toBe(false);

      drive(width, 180, false, { map, fit }, 20);
      expect(width.sign).toBe(1);
      expectEdgesNearTruth(learnedFrom(width), 0.4);
    });

    it('drops a stale cached width when told to learn bundled tracks', () => {
      const stale = {
        ...learned,
        centre: learned.centre.map((value) => value + 30),
      };
      const log = createLog();
      const width = new LmuTrackWidth(
        createStorage(stale),
        log,
        bundleShiftedBy(0),
        true
      );
      width.setTrack('Test Oval');
      drive(width, 20, true);

      expect(log.warn).toHaveBeenCalledWith(
        expect.stringMatching(
          /^\[lmuTrackWidth\] Cached track width for Test Oval dropped: live edges are 3\.\d m from it/
        )
      );
      drive(width, 180, true, { map, fit }, 20);
      expectEdgesNearTruth(learnedFrom(width), 0.4);
    });
  });
});
