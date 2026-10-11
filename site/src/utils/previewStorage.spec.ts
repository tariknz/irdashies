import { describe, expect, it } from 'vitest';
import type { Session } from '@irdashies/types';
import mockSession from '../../../src/app/irsdk/node/utils/mock-data/session.json';
import { createPreviewStorage } from './previewStorage';

const session = mockSession as unknown as Session;

describe('preview storage', () => {
  it('isolates saved fuel histories and protects them from consumer mutation', async () => {
    const { fuel } = createPreviewStorage();
    const history = await fuel.getHistoricalLaps(465, 'car-a');
    const originalUsage = history[0].fuelUsed;
    history[0].fuelUsed = 999;
    expect((await fuel.getHistoricalLaps(465, 'car-a'))[0].fuelUsed).toBe(
      originalUsage
    );

    await fuel.saveLap(465, 'car-a', { ...history[0], fuelUsed: 3 });
    expect((await fuel.getHistoricalLaps(465, 'car-a')).at(-1)?.fuelUsed).toBe(
      3
    );
    expect(await fuel.getHistoricalLaps(465, 'car-b')).toHaveLength(10);
    await fuel.clearHistory(465, 'car-a');
    expect(await fuel.getHistoricalLaps(465, 'car-a')).toEqual([]);
    expect(await fuel.getHistoricalLaps(465, 'car-b')).toHaveLength(10);
    await fuel.clearAllHistory();
    expect(await fuel.getHistoricalLaps(465, 'car-b')).toEqual([]);
  });

  it('provides a reference for the actual demo track and retains explicit clears', async () => {
    const storage = createPreviewStorage();
    storage.updateSession(session);
    const trackId = session.WeekendInfo.TrackID;
    const driver = session.DriverInfo.Drivers.find(
      (d) => d.CarIdx === session.DriverInfo.DriverCarIdx
    );
    if (!driver) throw new Error('Missing demo driver');
    const trace = await storage.lapTrace.getLapTrace(
      trackId,
      driver.CarPath,
      'best'
    );
    expect(trace?.trackId).toBe(trackId);
    expect(trace?.carPath).toBe(driver.CarPath);
    expect(trace?.trackConfigName).toBe(session.WeekendInfo.TrackConfigName);
    expect(trace?.trackLengthM).toBeCloseTo(
      parseFloat(session.WeekendInfo.TrackLength) * 1000
    );
    expect(trace?.samples.length).toBeGreaterThan(100);

    if (!trace) throw new Error('Missing preview reference lap');
    const originalDistance = trace.samples.distanceM[10];
    trace.samples.distanceM[10] = -1;
    const reloaded = await storage.lapTrace.getLapTrace(
      trackId,
      driver.CarPath,
      'best'
    );
    expect(reloaded?.samples.distanceM[10]).toBe(originalDistance);
    await storage.lapTrace.clearLapTrace(trackId, driver.CarPath, 'best');
    expect(
      await storage.lapTrace.getLapTrace(trackId, driver.CarPath, 'best')
    ).toBeNull();
    expect((await storage.lapTrace.getCurrentBestLapInfo())?.hasBest).toBe(
      false
    );
    expect(
      await storage.lapTrace.getLapTrace(trackId, driver.CarPath, 'manual')
    ).toBeNull();
  });

  it('uses real demo drivers for incidents and leaves the feed empty after clearing', async () => {
    const storage = createPreviewStorage();
    storage.updateSession(session);
    const feed = await storage.raceControl.getIncidents();
    expect(feed.sessionId).toBe(String(session.WeekendInfo.SubSessionID));
    expect(feed.incidents).toHaveLength(3);
    for (const incident of feed.incidents) {
      const driver = session.DriverInfo.Drivers.find(
        (d) => d.CarIdx === incident.carIdx
      );
      expect(incident.driverName).toBe(driver?.UserName);
      expect(incident.carNumber).toBe(driver?.CarNumber);
    }
    await storage.raceControl.clearIncidents();
    expect((await storage.raceControl.getIncidents()).incidents).toEqual([]);
  });
});
