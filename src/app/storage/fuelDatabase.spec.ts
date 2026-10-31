import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from 'vitest';
import { FuelDatabase } from './fuelDatabase';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { getStorageStatus, reportStorageResult } from './storageStatus';
import { FuelLapData } from '../../types';

const { testDir } = vi.hoisted(() => ({
  testDir: `./tmp-data/fuel-database-spec-${process.pid}`,
}));

vi.mock('../logger', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

// Mock electron
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn().mockReturnValue(testDir),
  },
}));

describe('FuelDatabase', () => {
  let db: FuelDatabase;

  beforeEach(() => {
    fs.rmSync(testDir, { recursive: true, force: true });
    fs.mkdirSync(testDir, { recursive: true });
    db = new FuelDatabase();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.flush();
    reportStorageResult('fuel');
  });

  afterAll(() => {
    // Clean up test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
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
  it.each(['writeFile', 'rename'] as const)(
    'preserves fuel history on ENOSPC during %s and retains unsaved data for recovery',
    async (operation) => {
      db.saveQualifyMax(1, 'car', 2);
      await db.flush();
      const file = path.join(testDir, 'fuel_data.json');
      const previous = await fsp.readFile(file, 'utf8');
      vi.spyOn(fsp, operation).mockRejectedValueOnce(
        Object.assign(new Error('full'), { code: 'ENOSPC' })
      );
      db.saveQualifyMax(1, 'car', 3);
      await db.flush();
      expect(await fsp.readFile(file, 'utf8')).toBe(previous);
      expect(db.getQualifyMax(1, 'car')).toBe(3);
      expect(getStorageStatus().diskFull).toBe(true);
      await db.flush();
      expect(
        JSON.parse(await fsp.readFile(file, 'utf8')).settings['1:car']
          .qualifyMax
      ).toBe(3);
      expect(getStorageStatus().diskFull).toBe(false);
    }
  );
  it('caps the persisted context collection while keeping the newest context', async () => {
    for (let i = 0; i <= 500; i++) db.saveQualifyMax(i, 'car', i);
    await db.flush();
    const stored = JSON.parse(
      await fsp.readFile(path.join(testDir, 'fuel_data.json'), 'utf8')
    );
    expect(Object.keys(stored.settings)).toHaveLength(500);
    expect(db.getQualifyMax(0, 'car')).toBeNull();
    expect(db.getQualifyMax(500, 'car')).toBe(500);
  });
});
