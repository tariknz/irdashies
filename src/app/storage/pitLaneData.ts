import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { PitLaneTrackData } from '@irdashies/types';
import logger from '../logger';

const MAX_CALIBRATION_TRACKS = 10000;

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

const isTrackData = (
  trackId: string,
  value: unknown
): value is PitLaneTrackData => {
  if (
    !/^[1-9]\d{0,9}$/.test(trackId) ||
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value)
  )
    return false;
  const record = value as Record<string, unknown>;
  return (
    Object.keys(record).length === 2 &&
    Object.hasOwn(record, 'pitEntryPct') &&
    Object.hasOwn(record, 'pitExitPct') &&
    isPct(record.pitEntryPct) &&
    isPct(record.pitExitPct)
  );
};

interface LoadedPitLaneData {
  data: Map<string, PitLaneTrackData>;
  writable: boolean;
}

/** Shared cache prevents concurrent read/modify/write calls losing other tracks. */
export class PitLaneDataStore {
  private loading?: Promise<LoadedPitLaneData>;
  private timer?: ReturnType<typeof setTimeout>;
  private writing: Promise<void> = Promise.resolve();
  private dirty = false;
  private editing = false;
  private readonly incompleteReadTracks = new Set<string>();

  constructor(private readonly filePath: string) {}

  private load(): Promise<LoadedPitLaneData> {
    if (this.loading) return this.loading;
    const loading = (async (): Promise<LoadedPitLaneData> => {
      const data = new Map<string, PitLaneTrackData>();
      try {
        const parsed: unknown = JSON.parse(
          await fsp.readFile(this.filePath, 'utf8')
        );
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
          throw new TypeError('Invalid pit lane data');
        }
        const entries = Object.entries(parsed);
        let writable = entries.length <= MAX_CALIBRATION_TRACKS;
        for (const [key, value] of entries) {
          if (isTrackData(key, value)) {
            data.set(key, {
              pitEntryPct: value.pitEntryPct,
              pitExitPct: value.pitExitPct,
            });
          } else writable = false;
        }
        if (!writable)
          logger.warn(
            'Invalid records in pitLaneData.json; keeping calibration read-only'
          );
        return { data, writable };
      } catch (error) {
        if (
          error &&
          typeof error === 'object' &&
          'code' in error &&
          error.code === 'ENOENT'
        )
          return { data, writable: true };
        logger.warn(
          'Failed to read pitLaneData.json; using empty data',
          safeReadError(error)
        );
      }
      return { data, writable: false };
    })();
    this.loading = loading;
    // Failed or partial reads may be displayed, but never become the basis of
    // a write. Retry the real file before any later read or mutation.
    void loading.then((result) => {
      if (!result.writable) {
        // A renderer may have displayed valid entries from this incomplete
        // file. A later repair/reload must invalidate those old revisions too.
        for (const trackId of result.data.keys()) {
          if (this.incompleteReadTracks.size >= MAX_CALIBRATION_TRACKS) break;
          this.incompleteReadTracks.add(trackId);
        }
        if (this.loading === loading) this.loading = undefined;
      }
    });
    return loading;
  }

  async get(trackId: string): Promise<PitLaneTrackData | null> {
    return (await this.load()).data.get(trackId) ?? null;
  }

  async update(
    trackId: string,
    update: Partial<PitLaneTrackData>
  ): Promise<boolean> {
    if (this.editing) return false;
    const { data, writable } = await this.load();
    if (this.editing) return false;
    if (!writable)
      throw new Error(
        'Calibration file could not be read safely. Open or repair it before changing calibration.'
      );
    // Generous bound for the track catalogue; never evict existing calibration.
    if (!data.has(trackId) && data.size >= MAX_CALIBRATION_TRACKS)
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
    return true;
  }

  async clear(trackId: string): Promise<void> {
    if (this.editing)
      throw new Error(
        'Reload the calibration file before resetting while editing.'
      );
    const { data, writable } = await this.load();
    if (this.editing)
      throw new Error(
        'Reload the calibration file before resetting while editing.'
      );
    if (!writable)
      throw new Error(
        'Calibration file could not be read safely. Open or repair it before changing calibration.'
      );
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
    if (this.editing) {
      await this.writing;
      return;
    }
    await this.flushWrites();
  }

  private async flushWrites(): Promise<void> {
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
        const { data, writable } = await loading;
        if (!writable)
          throw new Error('Calibration file could not be read safely.');
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
    const wasEditing = this.editing;
    // Stop new learning before draining old writes. The editor is launched
    // only after every pending atomic rename has completed.
    this.editing = true;
    try {
      if (!wasEditing) await this.flushWrites();
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
    } catch (error) {
      this.editing = wasEditing;
      throw error;
    }
    return this.filePath;
  }

  isEditing(): boolean {
    return this.editing;
  }
  resumeLearning(): void {
    this.editing = false;
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
    const previous = (await this.load()).data;
    const parsed: unknown = JSON.parse(
      await fsp.readFile(this.filePath, 'utf8')
    );
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('Calibration must be a JSON object keyed by track ID.');
    const entries = Object.entries(parsed);
    if (entries.length > MAX_CALIBRATION_TRACKS)
      throw new Error('Too many tracks in calibration file.');
    const next = new Map<string, PitLaneTrackData>();
    for (const [trackId, value] of entries) {
      if (!isTrackData(trackId, value)) {
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
        this.incompleteReadTracks.has(trackId) ||
        before?.pitEntryPct !== after?.pitEntryPct ||
        before?.pitExitPct !== after?.pitExitPct
      ) {
        changes.push({ trackId, data: after ?? null });
      }
    }
    // Include deleted records that a retried read no longer contains.
    for (const trackId of this.incompleteReadTracks) {
      if (!changes.some((change) => change.trackId === trackId))
        changes.push({ trackId, data: next.get(trackId) ?? null });
    }
    this.incompleteReadTracks.clear();
    this.loading = Promise.resolve({ data: next, writable: true });
    this.editing = false;
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
export const isPitLaneDataEditing = () => store.isEditing();
export const resumePitLaneDataLearning = () => store.resumeLearning();
