import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type {
  PitServiceRule,
  PitServiceSample,
  PitStopModelFile,
  PitTransitSample,
} from '@irdashies/types';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';
import { reportStorageResult, storageErrorCode } from './storageStatus';

export const MAX_SAMPLES_PER_KEY = 12;
export const MAX_KEYS = 1000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export interface PitStopModelPersistence {
  /** The current data. Empty until the file has loaded. */
  read(): PitStopModelFile;
  addTransit(key: string, sample: PitTransitSample): void;
  addService(key: string, sample: PitServiceSample): void;
}

export const emptyPitStopModel = (): PitStopModelFile => ({
  version: 1,
  transit: {},
  service: {},
  overrides: {},
  order: [],
});

const isObject = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);
const isNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);
const isPct = (value: unknown) => isNumber(value) && value >= 0 && value <= 1;

const hasContext = (value: Record<string, unknown>) =>
  isNumber(value.at) &&
  typeof value.build === 'string' &&
  isNumber(value.seriesId) &&
  isNumber(value.trackId) &&
  isNumber(value.carId) &&
  isNumber(value.carClassId) &&
  typeof value.ruleSet === 'string';

export const isTransitSample = (value: unknown): value is PitTransitSample =>
  isObject(value) &&
  hasContext(value) &&
  (value.source === 'player' || value.source === 'opponent') &&
  isNumber(value.pitSpeedLimitKph) &&
  isPct(value.entryPct) &&
  isPct(value.exitPct) &&
  isNumber(value.windowSeconds) &&
  isNumber(value.stationarySeconds) &&
  (value.referenceSeconds === null || isNumber(value.referenceSeconds)) &&
  isPct(value.windowStartPct) &&
  isPct(value.windowEndPct);

export const isServiceSample = (value: unknown): value is PitServiceSample =>
  isObject(value) &&
  hasContext(value) &&
  isNumber(value.serviceSeconds) &&
  (value.stationarySeconds === undefined ||
    isNumber(value.stationarySeconds)) &&
  isNumber(value.fuelAddedLitres) &&
  (value.fuelSeconds === null || isNumber(value.fuelSeconds)) &&
  isNumber(value.tankLitres) &&
  isNumber(value.tankPct) &&
  isNumber(value.tyresChanged) &&
  isNumber(value.repairSeconds) &&
  typeof value.fastRepair === 'boolean' &&
  typeof value.tearOff === 'boolean';

const isOverride = (value: unknown): value is Partial<PitServiceRule> => {
  if (!isObject(value)) return false;
  const allowed = new Set([
    'fuelLitresPerSecond',
    'fourTyreSeconds',
    'sequencing',
    'overheadSeconds',
  ]);
  if (Object.keys(value).some((key) => !allowed.has(key))) return false;
  return (
    (value.fuelLitresPerSecond === undefined ||
      (isNumber(value.fuelLitresPerSecond) && value.fuelLitresPerSecond > 0)) &&
    (value.fourTyreSeconds === undefined ||
      (isNumber(value.fourTyreSeconds) && value.fourTyreSeconds >= 0)) &&
    (value.overheadSeconds === undefined ||
      (isNumber(value.overheadSeconds) && value.overheadSeconds >= 0)) &&
    (value.sequencing === undefined ||
      value.sequencing === 'fuelThenTyres' ||
      value.sequencing === 'simultaneous')
  );
};

const orderKey = (kind: 'transit' | 'service', key: string) => `${kind}|${key}`;

export interface ParseResult {
  data: PitStopModelFile;
  /** False when the file holds something we must not overwrite. */
  writable: boolean;
  droppedSamples: number;
}

/**
 * Invalid samples are dropped, since the app wrote them. Invalid overrides
 * were typed by a person, so they make the file read-only instead of being
 * lost on the next save.
 */
export const parsePitStopModel = (raw: unknown): ParseResult => {
  const data = emptyPitStopModel();
  if (!isObject(raw) || raw.version !== 1) {
    return { data, writable: false, droppedSamples: 0 };
  }
  let droppedSamples = 0;
  let writable = true;

  const readSamples = <T>(
    source: unknown,
    guard: (value: unknown) => value is T,
    target: Record<string, T[]>
  ) => {
    if (!isObject(source)) return;
    for (const [key, samples] of Object.entries(source)) {
      if (!Array.isArray(samples)) {
        droppedSamples++;
        continue;
      }
      const valid = samples.filter(guard).slice(-MAX_SAMPLES_PER_KEY);
      droppedSamples += samples.length - valid.length;
      if (valid.length > 0) target[key] = valid;
    }
  };
  readSamples(raw.transit, isTransitSample, data.transit);
  readSamples(raw.service, isServiceSample, data.service);

  if (raw.overrides !== undefined) {
    if (!isObject(raw.overrides)) writable = false;
    else {
      for (const [key, override] of Object.entries(raw.overrides)) {
        if (isOverride(override)) data.overrides[key] = override;
        else writable = false;
      }
    }
  }

  const known = new Set([
    ...Object.keys(data.transit).map((key) => orderKey('transit', key)),
    ...Object.keys(data.service).map((key) => orderKey('service', key)),
  ]);
  const order = Array.isArray(raw.order)
    ? raw.order.filter(
        (key): key is string => typeof key === 'string' && known.has(key)
      )
    : [];
  const ordered = new Set(order);
  for (const key of known) if (!ordered.has(key)) order.unshift(key);
  data.order = order;
  prune(data);

  return { data, writable, droppedSamples };
};

const prune = (data: PitStopModelFile) => {
  if (data.order.length <= MAX_KEYS) return;
  data.order = data.order.slice(-MAX_KEYS);
  const kept = new Set(data.order);
  const keep = <T>(kind: string, entries: Record<string, T>) =>
    Object.fromEntries(
      Object.entries(entries).filter(([key]) =>
        kept.has(orderKey(kind as 'transit' | 'service', key))
      )
    );
  data.transit = keep('transit', data.transit);
  data.service = keep('service', data.service);
};

export class PitStopModelStore implements PitStopModelPersistence {
  private data = emptyPitStopModel();
  private writable = false;
  private loading: Promise<void> | null = null;
  private readonly writer: ReturnType<typeof createDebouncedAtomicWriter>;

  constructor(private readonly filePath: string) {
    this.writer = createDebouncedAtomicWriter({
      filePath,
      serialize: () => JSON.stringify(this.data, null, 2),
      onSuccess: () => reportStorageResult('pitStopModel'),
      onError: (error) => {
        logger.error(
          'Failed to write pitStopModel.json:',
          storageErrorCode(error)
        );
        reportStorageResult('pitStopModel', error);
      },
    });
  }

  load(): Promise<void> {
    this.loading ??= this.readFile();
    return this.loading;
  }

  private async readFile(): Promise<void> {
    try {
      const stat = await fsp.stat(this.filePath);
      if (stat.size > MAX_FILE_BYTES) {
        logger.warn('pitStopModel.json is too large; learning is paused');
        return;
      }
      const parsed = parsePitStopModel(
        JSON.parse(await fsp.readFile(this.filePath, 'utf8'))
      );
      this.data = parsed.data;
      this.writable = parsed.writable;
      if (!parsed.writable)
        logger.warn(
          'pitStopModel.json has invalid overrides or version; learning is paused until it is fixed'
        );
      if (parsed.droppedSamples > 0)
        logger.warn(
          `pitStopModel.json: dropped ${parsed.droppedSamples} invalid samples`
        );
    } catch (error) {
      if (storageErrorCode(error) === 'ENOENT') {
        this.writable = true;
        return;
      }
      logger.warn(
        'Failed to read pitStopModel.json; learning is paused:',
        error instanceof SyntaxError ? 'Invalid JSON' : storageErrorCode(error)
      );
    }
  }

  read(): PitStopModelFile {
    return this.data;
  }

  addTransit(key: string, sample: PitTransitSample): void {
    this.add('transit', key, sample, this.data.transit);
  }

  addService(key: string, sample: PitServiceSample): void {
    this.add('service', key, sample, this.data.service);
  }

  private add<T>(
    kind: 'transit' | 'service',
    key: string,
    sample: T,
    target: Record<string, T[]>
  ) {
    if (!this.writable) return;
    const samples = [...(target[key] ?? []), sample].slice(
      -MAX_SAMPLES_PER_KEY
    );
    target[key] = samples;
    const marker = orderKey(kind, key);
    this.data.order = [...this.data.order.filter((k) => k !== marker), marker];
    prune(this.data);
    this.writer.schedule();
  }

  flush(): Promise<void> {
    return this.writer.flush();
  }
}

let store: PitStopModelStore | null = null;

export const getPitStopModelStore = (): PitStopModelStore => {
  store ??= new PitStopModelStore(
    path.join(app.getPath('userData'), 'pitStopModel.json')
  );
  return store;
};

export const loadPitStopModel = () => getPitStopModelStore().load();
export const flushPitStopModelOnShutdown = () =>
  store ? store.flush() : Promise.resolve();
