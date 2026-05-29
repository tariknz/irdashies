import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import logger from '../logger';

export interface PersonalBestEntry {
  trackId: string | number;
  carName: string;
  time: number;
  timestamp: number; // When this PB was set
}

export interface PersonalBestData {
  version: number;
  bests: Record<string, number>; // key: "${trackId}:${carName}", value: time
}

const DATA_VERSION = 1;

class PersonalBestLapTimesDatabase {
  private filePath: string;
  private data: PersonalBestData;

  constructor() {
    this.filePath = path.join(
      app.getPath('userData'),
      'personalBestLapTimes.json'
    );
    this.data = this.load();
  }

  private load(): PersonalBestData {
    try {
      if (fs.existsSync(this.filePath)) {
        const fileContent = fs.readFileSync(this.filePath, 'utf-8');
        const loaded = JSON.parse(fileContent) as Partial<PersonalBestData>;
        
        const isValid =
          loaded?.version === DATA_VERSION &&
          loaded?.bests != null &&
          typeof loaded.bests === 'object' &&
          !Array.isArray(loaded.bests);

        if (!isValid) {
          logger.warn(
            `[PersonalBestDatabase] Invalid or mismatched data, resetting`
          );
          return this.createEmptyData();
        }
        return loaded as PersonalBestData;
      }
    } catch (error) {
      logger.error(
        `[PersonalBestDatabase] Failed to load personal best data`,
        error
      );
    }
    return this.createEmptyData();
  }

  private createEmptyData(): PersonalBestData {
    return {
      version: DATA_VERSION,
      bests: {},
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.data, null, 2));
    } catch (error) {
      logger.error(
        `[PersonalBestDatabase] Failed to save personal best data`,
        error
      );
      throw error;
    }
  }

  private generateKey(
    trackId: string | number,
    carName: string
  ): string {
    return `${trackId}:${carName}`;
  }

  public getPersonalBest(
    trackId: string | number,
    carName: string
  ): number | null {
    const key = this.generateKey(trackId, carName);
    return this.data.bests[key] ?? null;
  }

  public setPersonalBest(
    trackId: string | number,
    carName: string,
    time: number
  ): void {
    const key = this.generateKey(trackId, carName);
    const currentBest = this.data.bests[key];

    // Only update if it's a new PB (lower time)
    if (currentBest == null || time < currentBest) {
      this.data.bests[key] = time;

      this.save();
      logger.info(
        `[PersonalBestDatabase] New PB: ${carName} at track ${trackId} - ${time.toFixed(3)}s`
      );
    }
  }
  
}

export const personalBestDatabase = new PersonalBestLapTimesDatabase();
