import {
  LMU_PENALTY_CODE,
  type LmuPenaltyKind,
  lmuPenaltyCode,
} from '@irdashies/types';
import { lmuDriverKey } from './driverKey';
import { LMU_WS_TOPIC } from './constants';

/**
 * One car's outstanding penalties, broken out by kind.
 *
 * Counts for the two that are served on track, seconds for the one that is
 * added at a stop -- which is the distinction the sim itself draws and the
 * reason a single "penalty" flag cannot say what a driver has to do about it.
 */
export interface LmuLivePenalty {
  readonly driveThrough: number;
  readonly stopGo: number;
  readonly timeSeconds: number;
}

export interface LmuLiveStandingsFrame {
  /** The topic the frame announced, when it announced one. */
  readonly topic?: string;
  /**
   * Every car the frame described, keyed by `lmuDriverKey`.
   *
   * A car with nothing outstanding is present with zeroes rather than absent:
   * the frame is the whole grid, so its silence about a car is how it says the
   * penalty has been served, and a consumer needs to be able to tell that
   * apart from the frame not mentioning the car at all.
   */
  readonly entries: ReadonlyMap<string, LmuLivePenalty>;
}

const NAME_KEYS = ['drivername', 'name', 'driver'];
const POSITION_KEYS = ['position', 'place', 'raceposition'];
const PENALTY_KEYS = ['penalties', 'penalty'];
const DRIVE_THROUGH_KEYS = ['dt', 'drivethrough', 'drivethru'];
const STOP_GO_KEYS = ['sg', 'stopgo', 'stopandgo'];
const TIME_KEYS = ['time', 'timepenalty', 'penaltytime', 'timeseconds'];

/**
 * Bounds on the walk below, so a surprise payload costs a bounded scan.
 *
 * The frame is the sim's own UI feed and its shape is not ours to rely on, so
 * this searches rather than indexes. Searching an unbounded structure on a
 * socket someone else fills is how a parser becomes a denial of service.
 */
const MAX_DEPTH = 8;
const MAX_NODES = 20_000;

/** A finite number, from a number or the numeric string JSON sometimes carries. */
const numeric = (value: unknown): number => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/**
 * The value under the first of `names` the object carries, ignoring case.
 *
 * Iterates `names` rather than the object's keys, so the lists above are read
 * as priority orders. An entry carrying both `driverName` and `name` resolves
 * the same way every time instead of however the sim happened to serialise it.
 */
const pick = (
  node: Record<string, unknown>,
  names: readonly string[]
): unknown => {
  const keys = Object.keys(node);
  for (const name of names) {
    const key = keys.find((candidate) => candidate.toLowerCase() === name);
    if (key !== undefined) return node[key];
  }
  return undefined;
};

const has = (
  node: Record<string, unknown>,
  names: readonly string[]
): boolean =>
  Object.keys(node).some((key) => names.includes(key.toLowerCase()));

const readPenalty = (value: unknown): LmuLivePenalty => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    // A bare count, which is what `/rest/watch/standings` gives and what an
    // older build may put here. Knowing a car has one tells us nothing about
    // which, so this reports no kind rather than guessing at the likeliest.
    return { driveThrough: 0, stopGo: 0, timeSeconds: 0 };
  }
  const node = value as Record<string, unknown>;
  return {
    driveThrough: numeric(pick(node, DRIVE_THROUGH_KEYS)),
    stopGo: numeric(pick(node, STOP_GO_KEYS)),
    timeSeconds: numeric(pick(node, TIME_KEYS)),
  };
};

/**
 * Reads a `LiveStandings` frame, or returns undefined.
 *
 * Never throws, the same contract every parser in rest/tasks.ts follows and for
 * the same reason: LMU's payloads change between builds, and a surprise there
 * must cost one missing badge rather than a dead socket.
 *
 * Deliberately a search rather than a fixed key path. The shape here is known
 * from doX's data contract -- what it asks LMU for -- and not from a published
 * schema, so the field that matters is found wherever it sits and under
 * whichever of its spellings, rather than assumed to be at `body.entries[]`.
 */
export const parseLmuLiveStandings = (
  text: string
): LmuLiveStandingsFrame | undefined => {
  let payload: unknown;
  try {
    payload = JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
  if (payload === null || typeof payload !== 'object') return undefined;

  const root = payload as Record<string, unknown>;
  // `topic` alone. `messageType` is the frame's kind -- "SUB", "PUB" -- and
  // reading it as the topic rejected every real frame as being about
  // something else.
  const rawTopic = pick(root, ['topic']);
  const topic = typeof rawTopic === 'string' ? rawTopic : undefined;

  const entries = new Map<string, LmuLivePenalty>();
  let budget = MAX_NODES;

  const walk = (node: unknown, depth: number): void => {
    if (budget <= 0 || depth > MAX_DEPTH) return;
    if (node === null || typeof node !== 'object') return;
    budget -= 1;

    if (Array.isArray(node)) {
      for (const item of node) walk(item, depth + 1);
      return;
    }

    const record = node as Record<string, unknown>;
    const name = pick(record, NAME_KEYS);
    // An entry is an object that names a driver and places them -- either in
    // the order or against a penalty field. The name alone is not enough: a
    // frame's own metadata ("name": "LiveStandings") would read as a car.
    if (
      typeof name === 'string' &&
      (has(record, PENALTY_KEYS) || has(record, POSITION_KEYS))
    ) {
      const key = lmuDriverKey(name);
      if (key) entries.set(key, readPenalty(pick(record, PENALTY_KEYS)));
    }

    for (const key of Object.keys(record)) walk(record[key], depth + 1);
  };

  walk(payload, 0);

  return { topic, entries };
};

/**
 * Whether a frame is one whose entries describe the grid.
 *
 * A socket carrying several topics will push frames that are not this one, and
 * replacing the cache from a frame about something else would wipe the grid.
 * A frame that names no topic at all is accepted: the subscribe asked for this
 * topic and nothing else, so an unlabelled frame is the answer to it.
 */
export const isLmuLiveStandingsFrame = (
  frame: LmuLiveStandingsFrame
): boolean =>
  frame.entries.size > 0 &&
  (frame.topic === undefined ||
    frame.topic.toLowerCase() === LMU_WS_TOPIC.toLowerCase());

/**
 * Which penalty a car is serving, or undefined for a clean car.
 *
 * Ordered as the sim serves them: a drive-through and a stop-go are served on
 * track and block the rest, while a time penalty is added at a stop. The same
 * order doX's row formatter uses, which is the only prior art on this.
 */
export const lmuLivePenaltyKind = (
  penalty: LmuLivePenalty | undefined
): LmuPenaltyKind | undefined => {
  if (!penalty) return undefined;
  if (penalty.driveThrough > 0) return 'DT';
  if (penalty.stopGo > 0) return 'SG';
  if (penalty.timeSeconds > 0) return 'TIME';
  return undefined;
};

/**
 * Pre-built telemetry cells: the kind each car is serving, and the seconds a
 * time penalty will add.
 *
 * Cells rather than bare arrays, and built here rather than in the frame
 * mapper, for the reason rest/state.ts gives: the telemetry loop runs every
 * 8 ms and a channel it rebuilds per frame allocates per frame. These change
 * only when the feed or the grid does -- a handful of times a session -- so
 * the loop assigns a reference and copies nothing.
 *
 * The invariant that makes that safe is the same one: a cell is **replaced**
 * when its value changes and never mutated in place, so a frame already handed
 * to a processor stays internally consistent. The `readonly` is what makes an
 * in-place write a type error.
 */
export interface LmuLiveCell {
  readonly value: readonly number[];
}

export interface LmuLivePenaltyChannels {
  /** An LMU_PENALTY_CODE per car. */
  readonly kind: LmuLiveCell;
  /**
   * Seconds a time penalty adds, per car. 0 for a clean car and for the two
   * kinds that are served on track rather than paid in time.
   */
  readonly penaltySeconds: LmuLiveCell;
}

const EMPTY: LmuLivePenaltyChannels = {
  kind: { value: [] },
  penaltySeconds: { value: [] },
};

/**
 * Both channels for the grid, indexed by CarIdx.
 *
 * Indexed by the driver's slot id, because that is what CarIdx is for LMU
 * (`mID`, see lmu_node.cc) and what every other per-car channel is indexed by.
 * Cars the feed did not mention are left at `none` rather than at a sentinel:
 * absence of a penalty is the overwhelmingly common case and reads the same as
 * no reading to everything downstream.
 *
 * Empty when there is nothing to say, so the channels stay absent rather than
 * publishing a grid of zeroes that a consumer would read as "known clean".
 */
export const lmuLivePenaltyChannels = (
  roster: readonly { readonly id: number; readonly name: string }[],
  entries: ReadonlyMap<string, LmuLivePenalty> | undefined
): LmuLivePenaltyChannels => {
  if (!entries || entries.size === 0) return EMPTY;

  let highest = -1;
  for (const driver of roster) {
    if (driver.id > highest) highest = driver.id;
  }
  if (highest < 0) return EMPTY;

  const kind = new Array<number>(highest + 1).fill(LMU_PENALTY_CODE.none);
  const penaltySeconds = new Array<number>(highest + 1).fill(0);
  for (const driver of roster) {
    if (driver.id < 0) continue;
    const penalty = entries.get(lmuDriverKey(driver.name));
    const resolved = lmuLivePenaltyKind(penalty);
    kind[driver.id] = lmuPenaltyCode(resolved);
    // Only where a time penalty is what is outstanding. A stop-go's own
    // stationary seconds arrive in the same field, and reporting them here
    // would put "+30" on a badge whose driver has to stop regardless.
    penaltySeconds[driver.id] =
      resolved === 'TIME' && penalty ? penalty.timeSeconds : 0;
  }
  return { kind: { value: kind }, penaltySeconds: { value: penaltySeconds } };
};
