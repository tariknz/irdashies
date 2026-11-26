import type { LmuTrackMap } from '@irdashies/types';
import { JsonFileStore, type JsonFileStoreLogger } from './jsonFileStore';
import {
  MAP_REGISTRATION_SAMPLE_INTERVAL_S,
  type MapRegistrationFit,
} from './mapRegistration';
import {
  normalizeLmuTrackMapWithTransform,
  type LmuMapTransform,
} from './trackMap';

const RACING_LINE_TYPE = 0;
const PIT_LANE_TYPE = 1;
const MIN_RACING_POINTS = 100;
const MAX_CLOSING_GAP_STEPS = 3;
const PIT_LANE_BREAK_M = 25;
const PIT_LANE_BREAK_STEPS = 5;
const MIN_LAP_RATIO = 0.95;
const MAX_LAP_RATIO = 1.05;
const SEARCH_WINDOW_SEGMENTS = 40;
const FULL_SEARCH_DISTANCE_M = 25;
const MAX_CARS = 128;
const MAX_SAMPLES = 600;
const MIN_SAMPLES = 40;
const MIN_SAMPLE_TICKS = 10;
const REJECT_AFTER_SAMPLES = 1200;
const MAX_MEDIAN_DISTANCE_M = 6;
const MAX_SPREAD_M = 10;
const MIN_SAMPLE_SPEED_MS = 5;
const SAME_TRACK_TOLERANCE_M = 1;
const MAX_STORED_TRACKS = 64;
export const WORLD_TRACK_RETRY_S = 30;
export const WORLD_TRACK_MAX_ATTEMPTS = 5;

export interface GroundPoint {
  readonly x: number;
  readonly y: number;
}

export interface LmuWorldTrack {
  readonly racing: readonly GroundPoint[];
  readonly pitLane: readonly GroundPoint[];
  readonly lengthM: number;
}

export function longestPitLaneRun(
  points: readonly GroundPoint[]
): readonly GroundPoint[] {
  const steps: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    steps.push(
      Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y
      )
    );
  }
  if (steps.length === 0) return points;
  const sorted = [...steps].sort((a, b) => a - b);
  const breakM = Math.max(
    PIT_LANE_BREAK_M,
    sorted[Math.floor(sorted.length / 2)] * PIT_LANE_BREAK_STEPS
  );
  let bestStart = 0;
  let bestEnd = points.length;
  let start = 0;
  let longest = 0;
  for (let index = 1; index <= points.length; index += 1) {
    const broken = index === points.length || !(steps[index - 1] <= breakM);
    if (!broken) continue;
    if (index - start > longest) {
      longest = index - start;
      bestStart = start;
      bestEnd = index;
    }
    start = index;
  }
  return bestStart === 0 && bestEnd === points.length
    ? points
    : points.slice(bestStart, bestEnd);
}

export function worldTrackFrom(
  racing: readonly GroundPoint[],
  rawPitLane: readonly GroundPoint[]
): LmuWorldTrack | undefined {
  const pitLane = longestPitLaneRun(rawPitLane);
  if (racing.length < MIN_RACING_POINTS) return undefined;
  const steps: number[] = [];
  let lengthM = 0;
  for (let index = 0; index < racing.length; index += 1) {
    const next = racing[(index + 1) % racing.length];
    const step = Math.hypot(next.x - racing[index].x, next.y - racing[index].y);
    if (!Number.isFinite(step)) return undefined;
    steps.push(step);
    lengthM += step;
  }
  const closingGap = steps[steps.length - 1];
  const sorted = steps.slice(0, -1).sort((a, b) => a - b);
  const medianStep = sorted[Math.floor(sorted.length / 2)];
  if (!(lengthM > 0) || !(medianStep > 0)) return undefined;
  if (closingGap > medianStep * MAX_CLOSING_GAP_STEPS) return undefined;
  return { racing, pitLane, lengthM };
}

export function parseLmuWorldTrack(
  payload: unknown
): LmuWorldTrack | undefined {
  if (!Array.isArray(payload)) return undefined;
  const racing: GroundPoint[] = [];
  const pitLane: GroundPoint[] = [];
  for (const entry of payload) {
    if (entry === null || typeof entry !== 'object') continue;
    const { type, x, z } = entry as Record<string, unknown>;
    if (typeof x !== 'number' || typeof z !== 'number') continue;
    if (!Number.isFinite(x) || !Number.isFinite(z)) continue;
    if (type === RACING_LINE_TYPE) racing.push({ x, y: -z });
    else if (type === PIT_LANE_TYPE) pitLane.push({ x, y: -z });
  }
  return worldTrackFrom(racing, pitLane);
}

export function worldTrackFitsLap(
  track: LmuWorldTrack | undefined,
  lapDistM: number
): boolean {
  if (!track || !(lapDistM > 0)) return false;
  const ratio = track.lengthM / lapDistM;
  return ratio >= MIN_LAP_RATIO && ratio <= MAX_LAP_RATIO;
}

const wrap = (value: number, length: number): number =>
  ((value % length) + length) % length;

export interface LineHit {
  distance: number;
  along: number;
  segment: number;
}

export class LmuWorldLine {
  readonly count: number;
  readonly lengthM: number;
  readonly cumulative: Float64Array;
  private readonly xs: Float64Array;
  private readonly ys: Float64Array;

  constructor(points: readonly GroundPoint[]) {
    this.count = points.length;
    this.xs = Float64Array.from(points, (point) => point.x);
    this.ys = Float64Array.from(points, (point) => point.y);
    this.cumulative = new Float64Array(this.count + 1);
    for (let index = 0; index < this.count; index += 1) {
      const next = (index + 1) % this.count;
      this.cumulative[index + 1] =
        this.cumulative[index] +
        Math.hypot(
          this.xs[next] - this.xs[index],
          this.ys[next] - this.ys[index]
        );
    }
    this.lengthM = this.cumulative[this.count];
  }

  project(x: number, y: number, hint: number, out: LineHit): LineHit {
    out.distance = Number.POSITIVE_INFINITY;
    if (hint >= 0 && hint < this.count) {
      this.scan(
        x,
        y,
        hint - SEARCH_WINDOW_SEGMENTS,
        SEARCH_WINDOW_SEGMENTS * 2 + 1,
        out
      );
      if (out.distance <= FULL_SEARCH_DISTANCE_M) return out;
    }
    this.scan(x, y, 0, this.count, out);
    return out;
  }

  private scan(
    x: number,
    y: number,
    from: number,
    span: number,
    out: LineHit
  ): void {
    let best = out.distance * out.distance;
    for (let offset = 0; offset < span; offset += 1) {
      const index = wrap(from + offset, this.count);
      const next = (index + 1) % this.count;
      const dx = this.xs[next] - this.xs[index];
      const dy = this.ys[next] - this.ys[index];
      const lengthSq = dx * dx + dy * dy;
      let amount = 0;
      if (lengthSq > 0) {
        amount =
          ((x - this.xs[index]) * dx + (y - this.ys[index]) * dy) / lengthSq;
        amount = Math.min(1, Math.max(0, amount));
      }
      const px = this.xs[index] + amount * dx - x;
      const py = this.ys[index] + amount * dy - y;
      const distanceSq = px * px + py * py;
      if (distanceSq < best) {
        best = distanceSq;
        out.segment = index;
        out.along = this.cumulative[index] + amount * Math.sqrt(lengthSq);
      }
    }
    out.distance = Math.sqrt(best);
  }
}

export function fitFromMapTransform(
  transform: LmuMapTransform
): MapRegistrationFit {
  const { scale, minX, minY, offsetX, offsetY } = transform;
  return {
    ar: 0,
    ai: 1 / scale,
    tx: offsetY / scale - minY,
    ty: minX - offsetX / scale,
    mirrored: false,
    rmsM: 0,
    metresPerUnit: 1 / scale,
    samples: 0,
  };
}

export interface WorldTrackMap {
  map: LmuTrackMap;
  fit: MapRegistrationFit;
}

export function buildWorldTrackMap(
  track: LmuWorldTrack,
  offsetM: number,
  lapDistM: number
): WorldTrackMap {
  const line = new LmuWorldLine(track.racing);
  const lineToLap = lapDistM / line.lengthM;
  const recorded = track.racing.map((point, index) => ({
    x: point.x,
    y: point.y,
    distance: wrap(line.cumulative[index] - offsetM, line.lengthM) * lineToLap,
  }));
  let start = 0;
  for (let index = 1; index < recorded.length; index += 1) {
    if (recorded[index].distance < recorded[start].distance) start = index;
  }
  const ordered = [...recorded.slice(start), ...recorded.slice(0, start)];
  const { map, transform } = normalizeLmuTrackMapWithTransform(
    ordered,
    lapDistM
  );
  return { map, fit: fitFromMapTransform(transform) };
}

export type WorldTrackAlignmentStatus = 'collecting' | 'accepted' | 'rejected';

export interface WorldTrackAlignmentInput {
  time: number;
  lapDistM: number;
  posX: ArrayLike<number>;
  posZ: ArrayLike<number>;
  available: ArrayLike<number>;
  pcts: readonly unknown[];
  inPits?: ArrayLike<number>;
  speeds?: ArrayLike<number>;
  valid?: ArrayLike<number>;
}

export interface WorldTrackAlignmentResult {
  offsetM: number;
  lapDistM: number;
  medianDistanceM: number;
  spreadM: number;
  samples: number;
}

const medianOf = (values: Float64Array, count: number): number => {
  const sorted = values.slice(0, count).sort();
  return sorted[Math.floor(count / 2)];
};

export class LmuWorldTrackAlignment {
  private line: LmuWorldLine | null = null;
  private readonly offsets = new Float64Array(MAX_SAMPLES);
  private readonly distances = new Float64Array(MAX_SAMPLES);
  private readonly scratch = new Float64Array(MAX_SAMPLES);
  private readonly hints = new Int32Array(MAX_CARS).fill(-1);
  private readonly hit: LineHit = { distance: 0, along: 0, segment: -1 };
  private count = 0;
  private next = 0;
  private taken = 0;
  private ticks = 0;
  private lastSampleTime = Number.NEGATIVE_INFINITY;
  private currentStatus: WorldTrackAlignmentStatus = 'collecting';
  private currentResult: WorldTrackAlignmentResult | null = null;
  private lastEvaluation: WorldTrackAlignmentResult | null = null;

  get status(): WorldTrackAlignmentStatus {
    return this.currentStatus;
  }

  get result(): WorldTrackAlignmentResult | null {
    return this.currentResult;
  }

  get lastAttempt(): WorldTrackAlignmentResult | null {
    return this.lastEvaluation;
  }

  get samples(): number {
    return this.taken;
  }

  reset(track: LmuWorldTrack | null): void {
    this.line = track ? new LmuWorldLine(track.racing) : null;
    this.hints.fill(-1);
    this.count = 0;
    this.next = 0;
    this.taken = 0;
    this.ticks = 0;
    this.lastSampleTime = Number.NEGATIVE_INFINITY;
    this.currentStatus = 'collecting';
    this.currentResult = null;
    this.lastEvaluation = null;
  }

  update(input: WorldTrackAlignmentInput): WorldTrackAlignmentResult | null {
    if (!this.line || this.currentStatus !== 'collecting') {
      return this.currentResult;
    }
    if (!(input.lapDistM > 0)) return null;
    if (input.time < this.lastSampleTime) {
      this.lastSampleTime = Number.NEGATIVE_INFINITY;
    }
    if (input.time - this.lastSampleTime < MAP_REGISTRATION_SAMPLE_INTERVAL_S) {
      return null;
    }
    this.lastSampleTime = input.time;
    if (this.sample(input, this.line) > 0) this.ticks += 1;
    if (this.count >= MIN_SAMPLES && this.ticks >= MIN_SAMPLE_TICKS) {
      this.evaluate(input.lapDistM, this.line.lengthM);
    }
    return this.currentResult;
  }

  private sample(input: WorldTrackAlignmentInput, line: LmuWorldLine): number {
    const cars = Math.min(input.available.length, input.pcts.length, MAX_CARS);
    let added = 0;
    for (let carIdx = 0; carIdx < cars; carIdx += 1) {
      if (input.available[carIdx] !== 1) continue;
      if (input.valid !== undefined && input.valid[carIdx] !== 1) continue;
      if (input.inPits?.[carIdx] === 1) continue;
      if (
        input.speeds !== undefined &&
        !(input.speeds[carIdx] >= MIN_SAMPLE_SPEED_MS)
      ) {
        continue;
      }
      const pct = input.pcts[carIdx];
      if (typeof pct !== 'number' || !(pct > 0) || !(pct < 1)) continue;
      const x = input.posX[carIdx];
      const y = -input.posZ[carIdx];
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

      const hit = line.project(x, y, this.hints[carIdx], this.hit);
      this.hints[carIdx] = hit.segment;
      this.offsets[this.next] = wrap(
        hit.along - pct * line.lengthM,
        line.lengthM
      );
      this.distances[this.next] = hit.distance;
      this.next = (this.next + 1) % MAX_SAMPLES;
      this.count = Math.min(this.count + 1, MAX_SAMPLES);
      this.taken += 1;
      added += 1;
    }
    return added;
  }

  private evaluate(lapDistM: number, lengthM: number): void {
    const { count } = this;
    const medianDistanceM = medianOf(this.distances, count);

    let sumCos = 0;
    let sumSin = 0;
    for (let index = 0; index < count; index += 1) {
      const angle = (this.offsets[index] / lengthM) * Math.PI * 2;
      sumCos += Math.cos(angle);
      sumSin += Math.sin(angle);
    }
    const reference = wrap(
      (Math.atan2(sumSin, sumCos) / (Math.PI * 2)) * lengthM,
      lengthM
    );
    for (let index = 0; index < count; index += 1) {
      this.scratch[index] =
        wrap(this.offsets[index] - reference + lengthM / 2, lengthM) -
        lengthM / 2;
    }
    const medianDelta = medianOf(this.scratch, count);
    for (let index = 0; index < count; index += 1) {
      this.scratch[index] = Math.abs(this.scratch[index] - medianDelta);
    }
    const spreadM = medianOf(this.scratch, count);

    const attempt: WorldTrackAlignmentResult = {
      offsetM: wrap(reference + medianDelta, lengthM),
      lapDistM,
      medianDistanceM,
      spreadM,
      samples: this.taken,
    };
    this.lastEvaluation = attempt;

    if (medianDistanceM > MAX_MEDIAN_DISTANCE_M) {
      this.currentStatus = 'rejected';
    } else if (spreadM <= MAX_SPREAD_M) {
      this.currentResult = attempt;
      this.currentStatus = 'accepted';
    } else if (this.taken >= REJECT_AFTER_SAMPLES) {
      this.currentStatus = 'rejected';
    }
  }
}

export interface StoredWorldTrack {
  track: LmuWorldTrack;
  offsetM: number;
  lapDistM: number;
}

interface StoredWorldTrackEntry {
  racing: number[];
  pitLane: number[];
  offsetM: number;
  lapDistM: number;
  savedAt: number;
}

const flatten = (points: readonly GroundPoint[]): number[] =>
  points.flatMap((point) => [
    Math.round(point.x * 100) / 100,
    Math.round(point.y * 100) / 100,
  ]);

const unflatten = (values: unknown): GroundPoint[] | null => {
  if (!Array.isArray(values) || values.length % 2 !== 0) return null;
  const points: GroundPoint[] = [];
  for (let index = 0; index < values.length; index += 2) {
    const x: unknown = values[index];
    const y: unknown = values[index + 1];
    if (typeof x !== 'number' || typeof y !== 'number') return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push({ x, y });
  }
  return points;
};

export class LmuWorldTrackStorage {
  private readonly store: JsonFileStore;

  constructor(filePath: string, log?: JsonFileStoreLogger) {
    this.store = new JsonFileStore(filePath, log);
  }

  restore(): Promise<void> {
    return this.store.restore();
  }

  flush(): Promise<void> {
    return this.store.flush();
  }

  close(): Promise<void> {
    return this.store.close();
  }

  load(trackName: string): StoredWorldTrack | null {
    const entry = this.store.get(trackName) as
      Partial<StoredWorldTrackEntry> | undefined;
    if (!entry || typeof entry !== 'object') return null;
    const racing = unflatten(entry.racing);
    const pitLane = unflatten(entry.pitLane ?? []);
    const { offsetM, lapDistM } = entry;
    if (!racing || !pitLane) return null;
    if (typeof offsetM !== 'number' || !Number.isFinite(offsetM)) return null;
    if (typeof lapDistM !== 'number' || !(lapDistM > 0)) return null;
    const track = worldTrackFrom(racing, pitLane);
    if (!track || !worldTrackFitsLap(track, lapDistM)) return null;
    return { track, offsetM, lapDistM };
  }

  save(
    trackName: string,
    track: LmuWorldTrack,
    offsetM: number,
    lapDistM: number
  ): void {
    const entry: StoredWorldTrackEntry = {
      racing: flatten(track.racing),
      pitLane: flatten(track.pitLane),
      offsetM: Math.round(offsetM * 100) / 100,
      lapDistM,
      savedAt: Date.now(),
    };
    const others = this.store.entries().filter(([name]) => name !== trackName);
    const kept = [[trackName, entry] as [string, unknown], ...others]
      .sort(
        ([, a], [, b]) =>
          ((b as Partial<StoredWorldTrackEntry>)?.savedAt ?? 0) -
          ((a as Partial<StoredWorldTrackEntry>)?.savedAt ?? 0)
      )
      .slice(0, MAX_STORED_TRACKS);
    this.store.replaceAll(Object.fromEntries(kept));
  }
}

const sameTrack = (a: LmuWorldTrack, b: LmuWorldTrack): boolean =>
  a.racing.length === b.racing.length &&
  Math.abs(a.lengthM - b.lengthM) <= SAME_TRACK_TOLERANCE_M &&
  Math.hypot(a.racing[0].x - b.racing[0].x, a.racing[0].y - b.racing[0].y) <=
    SAME_TRACK_TOLERANCE_M;

export interface WorldTrackLogger {
  info: (message: string) => void;
  warn: (message: string) => void;
}

export interface WorldTrackFrame extends WorldTrackAlignmentInput {
  restTrack: LmuWorldTrack | undefined;
}

export type WorldTrackSourceKind = 'live' | 'cache';

export class LmuWorldTrackSource {
  private trackName = '';
  private active: (WorldTrackMap & { source: WorldTrackSourceKind }) | null =
    null;
  private cached: StoredWorldTrack | null = null;
  private lastRestTrack: LmuWorldTrack | undefined;
  private candidate: LmuWorldTrack | null = null;
  private settled = false;
  private rejections = 0;
  private retryAt = Number.POSITIVE_INFINITY;
  private readonly alignment = new LmuWorldTrackAlignment();

  constructor(
    private readonly storage: LmuWorldTrackStorage,
    private readonly log: WorldTrackLogger,
    private readonly describeSkipped: () => string = () => ''
  ) {}

  get map(): LmuTrackMap | null {
    return this.active?.map ?? null;
  }

  get fit(): MapRegistrationFit | null {
    return this.active?.fit ?? null;
  }

  get source(): WorldTrackSourceKind | null {
    return this.active?.source ?? null;
  }

  get wantsLiveTrack(): boolean {
    return !this.settled && this.candidate === null;
  }

  setTrack(trackName: string): void {
    this.trackName = trackName;
    this.active = null;
    this.lastRestTrack = undefined;
    this.candidate = null;
    this.settled = false;
    this.rejections = 0;
    this.retryAt = Number.POSITIVE_INFINITY;
    this.alignment.reset(null);
    this.cached = trackName ? this.storage.load(trackName) : null;
    if (this.cached) {
      const { track, offsetM, lapDistM } = this.cached;
      this.active = {
        ...buildWorldTrackMap(track, offsetM, lapDistM),
        source: 'cache',
      };
    }
  }

  restart(): void {
    if (this.active?.source === 'live') return;
    if (this.rejections === 0 && this.candidate === null) return;
    this.lastRestTrack = undefined;
    this.candidate = null;
    this.settled = false;
    this.rejections = 0;
    this.retryAt = Number.POSITIVE_INFINITY;
    this.alignment.reset(null);
  }

  update(frame: WorldTrackFrame): boolean {
    const { restTrack } = frame;
    if (
      !this.settled &&
      this.candidate === null &&
      restTrack &&
      restTrack !== this.lastRestTrack &&
      frame.lapDistM > 0
    ) {
      this.lastRestTrack = restTrack;
      this.consider(restTrack, frame.lapDistM);
    }
    if (!this.candidate) return false;

    if (this.retryAt !== Number.POSITIVE_INFINITY) {
      if (frame.time < this.retryAt) return false;
      this.retryAt = Number.POSITIVE_INFINITY;
      this.alignment.reset(this.candidate);
    }
    this.alignment.update(frame);
    if (this.alignment.status === 'accepted' && this.alignment.result) {
      const { offsetM, lapDistM, medianDistanceM, samples } =
        this.alignment.result;
      const track = this.candidate;
      this.candidate = null;
      this.settled = true;
      this.active = {
        ...buildWorldTrackMap(track, offsetM, lapDistM),
        source: 'live',
      };
      this.log.info(
        `[lmuWorldTrack] World track for ${this.trackName}: start offset ${offsetM.toFixed(0)} m, scale ${(lapDistM / track.lengthM).toFixed(4)}, field ${medianDistanceM.toFixed(1)} m from the line, ${samples} samples`
      );
      try {
        this.storage.save(this.trackName, track, offsetM, lapDistM);
      } catch (error) {
        this.log.warn(
          `[lmuWorldTrack] Failed to save the world track for ${this.trackName}: ${String(error)}`
        );
      }
      return true;
    }
    if (this.alignment.status === 'rejected') {
      const attempt = this.alignment.lastAttempt;
      this.rejections += 1;
      const skipped = this.describeSkipped();
      const detail = `${attempt ? `field ${attempt.medianDistanceM.toFixed(1)} m from the line, offset spread ${attempt.spreadM.toFixed(1)} m, ${attempt.samples} samples` : 'no samples'}${skipped ? `; ${skipped}` : ''}`;
      const message = `[lmuWorldTrack] World track for ${this.trackName} does not match world positions (attempt ${this.rejections} of ${WORLD_TRACK_MAX_ATTEMPTS}): ${detail}`;
      if (this.rejections < WORLD_TRACK_MAX_ATTEMPTS) {
        this.retryAt = frame.time + WORLD_TRACK_RETRY_S;
        this.log.info(`${message}; trying again in ${WORLD_TRACK_RETRY_S} s`);
      } else {
        this.candidate = null;
        this.settled = true;
        this.log.warn(
          `${message}; ${this.active ? `keeping the cached world track` : 'using the fallback map'}`
        );
      }
    }
    return false;
  }

  private consider(restTrack: LmuWorldTrack, lapDistM: number): void {
    if (!worldTrackFitsLap(restTrack, lapDistM)) {
      this.settled = true;
      this.log.warn(
        `[lmuWorldTrack] World track for ${this.trackName} is ${restTrack.lengthM.toFixed(0)} m against a ${lapDistM.toFixed(0)} m lap; not used`
      );
      return;
    }
    if (this.cached && sameTrack(this.cached.track, restTrack)) {
      this.settled = true;
      this.log.info(
        `[lmuWorldTrack] World track for ${this.trackName} matches the cached one`
      );
      return;
    }
    this.candidate = restTrack;
    this.alignment.reset(restTrack);
  }
}
