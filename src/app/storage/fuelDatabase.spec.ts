import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FuelDatabase } from './fuelDatabase';
import fs from 'node:fs';
import { FuelLapData } from '../../types';

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue('./test-data'),
  },
}));

describe('FuelDatabase', () => {
  let db: FuelDatabase;
  const testDir = './test-data';

  beforeEach(() => {
    // Ensure test directory exists
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir);
    }
    db = new FuelDatabase();
  });

  it('should save and retrieve laps for a specific context', () => {
    const lap: FuelLapData = {
      lapNumber: 1,
      fuelUsed: 2.5,
      lapTime: 100,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      timestamp: Date.now(),
    };

    db.saveLap(123, 'test-car', lap);
    const laps = db.getLaps(123, 'test-car');

    expect(laps).toHaveLength(1);
    expect(laps[0].lapNumber).toBe(1);
    expect(laps[0].fuelUsed).toBe(2.5);
  });

  it('should maintain only the 10 most recent laps (FIFO)', () => {
    const trackId = 123;
    const carName = 'test-car';

    // Save 12 laps
    for (let i = 1; i <= 12; i++) {
      db.saveLap(trackId, carName, {
        lapNumber: i,
        fuelUsed: 2.0 + i * 0.1,
        lapTime: 90,
        isGreenFlag: true,
        isValidForCalc: true,
        isOutLap: false,
        timestamp: Date.now() + i, // Ensure distinct timestamps
      });
    }

    const laps = db.getLaps(trackId, carName);

    // Should only have 10 laps
    expect(laps).toHaveLength(10);
    // Should have laps 3 to 12 (FIFO: 1 and 2 should be gone)
    // Note: getLaps returns sorted by lapNumber DESC
    expect(laps[0].lapNumber).toBe(12);
    expect(laps[9].lapNumber).toBe(3);
  });

  it('should separate laps by context (track and car)', () => {
    const lap1: FuelLapData = {
      lapNumber: 1,
      fuelUsed: 2.0,
      lapTime: 90,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      timestamp: Date.now(),
    };

    const lap2: FuelLapData = {
      lapNumber: 1,
      fuelUsed: 3.0,
      lapTime: 95,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      timestamp: Date.now(),
    };

    db.saveLap(1, 'car-A', lap1);
    db.saveLap(2, 'car-B', lap2);

    const lapsA = db.getLaps(1, 'car-A');
    const lapsB = db.getLaps(2, 'car-B');

    expect(lapsA).toHaveLength(1);
    expect(lapsA[0].fuelUsed).toBe(2.0);

    expect(lapsB).toHaveLength(1);
    expect(lapsB[0].fuelUsed).toBe(3.0);
  });

  it('should clear laps for a context', () => {
    db.saveLap(1, 'car-A', {
      lapNumber: 1,
      fuelUsed: 2.0,
      lapTime: 90,
      isGreenFlag: true,
      isValidForCalc: true,
      isOutLap: false,
      timestamp: Date.now(),
    });

    db.clearLaps(1, 'car-A');
    const laps = db.getLaps(1, 'car-A');

    expect(laps).toHaveLength(0);
  });
});
