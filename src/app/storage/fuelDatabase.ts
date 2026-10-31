import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { FuelLapData } from '../../types';
import logger from '../logger';
import { createDebouncedAtomicWriter } from './debouncedAtomicWriter';
import { reportStorageResult, storageErrorCode } from './storageStatus';

const MAX_FUEL_CONTEXTS = 500;

interface FuelStorageFormat {
  laps: Record<string, FuelLapData[]>;
  /** Oldest to newest saved context, shared by laps and qualifying settings. */
  contextOrder?: string[];
  settings: Record<string, { qualifyMax: number | null }>;
}

export class FuelDatabase {
  private filePath: string;
  private data: FuelStorageFormat;
  private contextOrder: Set<string>;

  // Ten laps per context, at most 500 track/car contexts.
  private writer: ReturnType<typeof createDebouncedAtomicWriter>;

  constructor() {
    const dataPath = app.getPath('userData');
    this.filePath = path.join(dataPath, 'fuel_data.json');
    this.data = this.load();
    // Legacy files have no shared ordering; start with their insertion order.
    this.contextOrder = new Set([
      ...Object.keys(this.data.laps),
      ...Object.keys(this.data.settings),
    ]);
    if (Array.isArray(this.data.contextOrder)) {
      for (const key of this.data.contextOrder) {
        // Ignore malformed/stale metadata and keep contexts absent from it.
        if (typeof key === 'string' && this.contextOrder.delete(key)) {
          this.contextOrder.add(key);
        }
      }
    }
    this.writer = createDebouncedAtomicWriter({
      filePath: this.filePath,
      serialize: () => JSON.stringify(this.data, null, 2),
      onSuccess: () => reportStorageResult('fuel'),
      onError: (error) => {
        logger.error(
          '[FuelDatabase] Failed to save data:',
          storageErrorCode(error)
        );
        reportStorageResult('fuel', error);
      },
    });
  }

  private load(): FuelStorageFormat {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      logger.warn(
        '[FuelDatabase] Failed to load fuel_data.json:',
        storageErrorCode(e)
      );
    }
    return { laps: {}, settings: {} };
  }

  private save(contextKey?: string) {
    if (contextKey !== undefined) {
      this.contextOrder.delete(contextKey);
      this.contextOrder.add(contextKey);
    }
    if (this.contextOrder.size > MAX_FUEL_CONTEXTS) {
      this.contextOrder = new Set(
        [...this.contextOrder].slice(-MAX_FUEL_CONTEXTS)
      );
      this.data.laps = Object.fromEntries(
        Object.entries(this.data.laps).filter(([key]) =>
          this.contextOrder.has(key)
        )
      );
      this.data.settings = Object.fromEntries(
        Object.entries(this.data.settings).filter(([key]) =>
          this.contextOrder.has(key)
        )
      );
    }
    this.data.contextOrder = [...this.contextOrder];
    this.writer.schedule();
  }

  /** Awaited by the before-quit coordinator; callers keep immediate cache reads. */
  public flush(): Promise<void> {
    return this.writer.flush();
  }

  private getContextKey(trackId: string | number, carName: string): string {
    return `${trackId}:${carName}`;
  }

  public saveLap(trackId: string | number, carName: string, lap: FuelLapData) {
    const key = this.getContextKey(trackId, carName);
    if (!this.data.laps[key]) {
      this.data.laps[key] = [];
    }

    // Add new lap (at the beginning for easier retrieval of 10 most recent)
    this.data.laps[key].unshift({ ...lap, isHistorical: true });

    // Prune to keep only 10 most recent
    if (this.data.laps[key].length > 10) {
      this.data.laps[key] = this.data.laps[key].slice(0, 10);
    }

    this.save(key);
  }

  public getLaps(trackId: string | number, carName: string): FuelLapData[] {
    const key = this.getContextKey(trackId, carName);
    return this.data.laps[key] || [];
  }

  public saveQualifyMax(
    trackId: string | number,
    carName: string,
    val: number | null
  ) {
    const key = this.getContextKey(trackId, carName);
    this.data.settings[key] = { qualifyMax: val };
    this.save(key);
  }

  public getQualifyMax(
    trackId: string | number,
    carName: string
  ): number | null {
    const key = this.getContextKey(trackId, carName);
    return this.data.settings[key]?.qualifyMax ?? null;
  }

  public clearLaps(trackId: string | number, carName: string) {
    const key = this.getContextKey(trackId, carName);
    this.data.laps[key] = [];
    this.save(key);
  }

  public clearAllLaps() {
    this.data = { laps: {}, settings: {} };
    this.contextOrder.clear();
    this.save();
  }
}
