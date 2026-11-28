import {
  LmuDrawnLine,
  TRACK_WIDTH_BIN_M,
  TRACK_WIDTH_STORE_VERSION,
  type StoredTrackWidth,
} from './trackWidth';
import {
  buildWorldTrackMap,
  worldTrackFrom,
  type GroundPoint,
  type LmuWorldTrack,
} from './worldTrack';

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
  const at = (pct: number, lateral: number): GroundPoint => {
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
      x: xs[low] + dx * amount + (lateral * dy) / norm,
      y: ys[low] + dy * amount - (lateral * dx) / norm,
    };
  };
  return { length, at };
};

export const fixtureRoad = ellipse(600, 300);
export const FIXTURE_LAP_M = fixtureRoad.length;
export const fixtureHalfLeft = (pct: number) =>
  6 + 2 * Math.sin(Math.PI * 2 * pct);
export const fixtureHalfRight = (pct: number) =>
  7 - 1.5 * Math.cos(Math.PI * 4 * pct);
const racingOffset = (pct: number) => 3 * Math.sin(Math.PI * 2 * 3 * pct);

export function fixtureRacingLine(
  transform: (point: GroundPoint) => GroundPoint = (point) => point
): LmuWorldTrack {
  const count = Math.round(FIXTURE_LAP_M / 5);
  const racing = Array.from({ length: count }, (_, index) => {
    const pct = index / count;
    return transform(fixtureRoad.at(pct, racingOffset(pct)));
  });
  const track = worldTrackFrom(racing, []);
  if (!track) throw new Error('racing line does not build');
  return track;
}

export function fixtureDrawnLine(
  track: LmuWorldTrack,
  offsetM = 0,
  lapDistM = FIXTURE_LAP_M
): LmuDrawnLine {
  const { map, fit } = buildWorldTrackMap(track, offsetM, lapDistM);
  return new LmuDrawnLine(map.active.trackPathPoints, fit);
}

export interface FixtureWidthOptions {
  centreCount?: (bin: number, pct: number) => number;
  leftCount?: (bin: number, pct: number) => number;
  rightCount?: (bin: number, pct: number) => number;
  lapDistM?: number;
}

export function fixtureStoredWidth(
  line: LmuDrawnLine,
  options: FixtureWidthOptions = {}
): StoredTrackWidth {
  const lapDistM = options.lapDistM ?? FIXTURE_LAP_M;
  const bins = Math.max(2, Math.round(lapDistM / TRACK_WIDTH_BIN_M));
  const stored: StoredTrackWidth = {
    version: TRACK_WIDTH_STORE_VERSION,
    bins,
    lapDistM,
    sign: 1,
    centre: [],
    left: [],
    right: [],
    centreCount: [],
    leftCount: [],
    rightCount: [],
  };
  for (let bin = 0; bin < bins; bin += 1) {
    const pct = (bin + 0.5) / bins;
    const centre = fixtureRoad.at(pct, 0);
    const centreCount = options.centreCount?.(bin, pct) ?? 30;
    const leftCount = options.leftCount?.(bin, pct) ?? 30;
    const rightCount = options.rightCount?.(bin, pct) ?? 30;
    stored.centre.push(
      centreCount > 0
        ? Math.round(line.signedOffset(pct, centre.x, centre.y) * 10)
        : 0
    );
    stored.left.push(leftCount > 0 ? Math.round(fixtureHalfLeft(pct) * 10) : 0);
    stored.right.push(
      rightCount > 0 ? Math.round(fixtureHalfRight(pct) * 10) : 0
    );
    stored.centreCount.push(centreCount);
    stored.leftCount.push(leftCount);
    stored.rightCount.push(rightCount);
  }
  return stored;
}

export function fixtureCacheEntry(
  track: LmuWorldTrack,
  width: StoredTrackWidth,
  offsetM = 0,
  lapDistM = FIXTURE_LAP_M
): Record<string, unknown> {
  return {
    racing: track.racing.flatMap((point) => [
      Math.round(point.x * 100) / 100,
      Math.round(point.y * 100) / 100,
    ]),
    pitLane: [],
    offsetM,
    lapDistM,
    savedAt: 1,
    width,
  };
}
