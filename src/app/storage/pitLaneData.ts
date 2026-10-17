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
    const data = await this.loading;
    const write = this.writing
      .catch(() => undefined)
      .then(async () => {
        const temporaryPath = `${this.filePath}.tmp`;
        await fsp.writeFile(
          temporaryPath,
          JSON.stringify(Object.fromEntries(data), null, 2)
        );
        await fsp.rename(temporaryPath, this.filePath);
      });
    this.writing = write;
    await write;
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
