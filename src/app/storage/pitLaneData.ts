import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { PitLaneTrackData } from '@irdashies/types';
import logger from '../logger';

const safeReadError = (error: unknown): unknown =>
  error instanceof SyntaxError
    ? 'Invalid JSON'
    : error && typeof error === 'object' && 'code' in error
      ? error.code
      : 'Invalid data';

const isPct = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1);

/** Shared cache prevents concurrent read/modify/write calls losing other tracks. */
export class PitLaneDataStore {
  private loading?: Promise<Map<string, PitLaneTrackData>>;
  private timer?: ReturnType<typeof setTimeout>;
  private writing: Promise<void> = Promise.resolve();
  private dirty = false;

  constructor(private readonly filePath: string) {}

  private load(): Promise<Map<string, PitLaneTrackData>> {
    this.loading ??= (async () => {
      const data = new Map<string, PitLaneTrackData>();
      try {
        const parsed: unknown = JSON.parse(
          await fsp.readFile(this.filePath, 'utf8')
        );
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new TypeError('Invalid pit lane data');
        }
        for (const [key, value] of Object.entries(parsed)) {
          if (
            value &&
            typeof value === 'object' &&
            isPct(value.pitEntryPct) &&
            isPct(value.pitExitPct)
          ) {
            data.set(key, {
              pitEntryPct: value.pitEntryPct,
              pitExitPct: value.pitExitPct,
            });
          }
        }
      } catch (error) {
        logger.warn(
          'Failed to read pitLaneData.json; using empty data',
          safeReadError(error)
        );
      }
      return data;
    })();
    return this.loading;
  }

  async get(trackId: string): Promise<PitLaneTrackData | null> {
    return (await this.load()).get(trackId) ?? null;
  }

  async update(
    trackId: string,
    update: Partial<PitLaneTrackData>
  ): Promise<void> {
    const data = await this.load();
    // Generous bound for the track catalogue; never evict existing calibration.
    if (!data.has(trackId) && data.size >= 10000)
      throw new Error('Pit lane calibration storage is full');
    data.set(trackId, {
      ...(data.get(trackId) ?? { pitEntryPct: null, pitExitPct: null }),
      ...update,
    });
    this.dirty = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = undefined;
      void this.flush().catch((error) =>
        logger.error('Failed to write pitLaneData.json', safeReadError(error))
      );
    }, 250);
  }

  async clear(trackId: string): Promise<void> {
    const data = await this.load();
    const existing = data.get(trackId);
    data.delete(trackId);
    this.dirty = true;
    try {
      // Queue behind old writes; a reset only completes once disk is cleared.
      await this.flush();
    } catch (error) {
      if (existing) data.set(trackId, existing);
      throw error;
    }
  }

  async flush(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    if (!this.loading) return;
    if (!this.dirty) {
      await this.writing;
      return;
    }
    this.dirty = false;
    const loading = this.loading;
    const write = this.writing
      .catch(() => undefined)
      .then(async () => {
        const data = await loading;
        const temporaryPath = `${this.filePath}.tmp`;
        await fsp.writeFile(
          temporaryPath,
          JSON.stringify(Object.fromEntries(data), null, 2)
        );
        await fsp.rename(temporaryPath, this.filePath);
      });
    this.writing = write;
    try {
      await write;
    } catch (error) {
      this.dirty = true;
      throw error;
    }
  }

  /** Create only if missing; opening an existing file must preserve saved edits. */
  async prepareFile(): Promise<string> {
    await this.flush();
    try {
      await fsp.access(this.filePath);
    } catch (error) {
      if (
        !error ||
        typeof error !== 'object' ||
        !('code' in error) ||
        error.code !== 'ENOENT'
      )
        throw error;
      await fsp.writeFile(this.filePath, '{}\n', { flag: 'wx' });
    }
    return this.filePath;
  }

  /** Reload is deliberately strict: invalid external edits never replace good data. */
  async reload(): Promise<
    readonly { trackId: string; data: PitLaneTrackData | null }[]
  > {
    if (this.timer) clearTimeout(this.timer);
    this.timer = undefined;
    // External edits take precedence over a debounced save. An already-started
    // atomic write must finish before we read; no queued old save follows it.
    await this.writing.catch(() => undefined);
    this.writing = Promise.resolve();
    this.dirty = false;
    const previous = await this.load();
    const parsed: unknown = JSON.parse(
      await fsp.readFile(this.filePath, 'utf8')
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Calibration must be a JSON object keyed by track ID.');
    const entries = Object.entries(parsed);
    if (entries.length > 10000)
      throw new Error('Too many tracks in calibration file.');
    const next = new Map<string, PitLaneTrackData>();
    for (const [trackId, value] of entries) {
      if (
        !/^[1-9]\d{0,9}$/.test(trackId) ||
        !value ||
        typeof value !== 'object' ||
        Array.isArray(value) ||
        Object.keys(value).length !== 2 ||
        !Object.hasOwn(value, 'pitEntryPct') ||
        !Object.hasOwn(value, 'pitExitPct') ||
        !isPct(value.pitEntryPct) ||
        !isPct(value.pitExitPct)
      ) {
        throw new Error(
          'Each track must contain only pitEntryPct and pitExitPct, with numbers from 0 to 1 or null.'
        );
      }
      next.set(trackId, {
        pitEntryPct: value.pitEntryPct,
        pitExitPct: value.pitExitPct,
      });
    }
    const changes: { trackId: string; data: PitLaneTrackData | null }[] = [];
    for (const trackId of new Set([...previous.keys(), ...next.keys()])) {
      const before = previous.get(trackId);
      const after = next.get(trackId);
      if (
        before?.pitEntryPct !== after?.pitEntryPct ||
        before?.pitExitPct !== after?.pitExitPct
      ) {
        changes.push({ trackId, data: after ?? null });
      }
    }
    this.loading = Promise.resolve(next);
    return changes;
  }
}

const store = new PitLaneDataStore(
  path.join(app.getPath('userData'), 'pitLaneData.json')
);
export const getPitLaneDataForTrack = (trackId: string) => store.get(trackId);
export const updatePitLaneDataForTrack = (
  trackId: string,
  data: Partial<PitLaneTrackData>
) => store.update(trackId, data);
export const clearPitLaneDataForTrack = (trackId: string) =>
  store.clear(trackId);
export const flushPitLaneDataOnShutdown = () => store.flush();
export const preparePitLaneDataFile = () => store.prepareFile();
export const reloadPitLaneDataFile = () => store.reload();
