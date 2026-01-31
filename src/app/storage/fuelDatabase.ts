import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { FuelLapData } from '../../types';

interface FuelStorageFormat {
  laps: Record<string, FuelLapData[]>;
  settings: Record<string, { qualifyMax: number | null }>;
}

export class FuelDatabase {
  private filePath: string;
  private data: FuelStorageFormat;

  constructor() {
    const dataPath = app.getPath('userData');
    this.filePath = path.join(dataPath, 'fuel_data.json');
    this.data = this.load();
  }

  private load(): FuelStorageFormat {
    try {
      if (fs.existsSync(this.filePath)) {
        const content = fs.readFileSync(this.filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error('[FuelDatabase] Failed to load data:', e);
    }
    return { laps: {}, settings: {} };
  }

  private save() {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[FuelDatabase] Failed to save data:', e);
    }
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

    this.save();
  }

  public getLaps(trackId: string | number, carName: string): FuelLapData[] {
    const key = this.getContextKey(trackId, carName);
    return this.data.laps[key] || [];
  }

  public saveQualifyMax(trackId: string | number, carName: string, val: number | null) {
    const key = this.getContextKey(trackId, carName);
    this.data.settings[key] = { qualifyMax: val };
    this.save();
  }

  public getQualifyMax(trackId: string | number, carName: string): number | null {
    const key = this.getContextKey(trackId, carName);
    return this.data.settings[key]?.qualifyMax ?? null;
  }

  public clearLaps(trackId: string | number, carName: string) {
    const key = this.getContextKey(trackId, carName);
    this.data.laps[key] = [];
    this.save();
  }

  public clearAllLaps() {
    this.data = { laps: {}, settings: {} };
    this.save();
  }

  public close() {
    // No-op for JSON storage
  }
}
