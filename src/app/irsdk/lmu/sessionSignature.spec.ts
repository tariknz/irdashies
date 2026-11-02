import { describe, expect, it } from 'vitest';
import type { LmuRawSession } from '../native/lmu';
import { lmuSessionSignature } from './sessionSignature';

const session = (playerVehicleIdx: number, playerHasVehicle: boolean) =>
  ({
    trackName: 'Bahrain International Circuit',
    session: 1,
    numVehicles: 2,
    playerVehicleIdx,
    playerHasVehicle,
    drivers: [
      {
        id: 20,
        name: 'Driver',
        vehicleName: 'Car',
        className: 'Hypercar',
      },
    ],
  }) as LmuRawSession;

describe('lmuSessionSignature', () => {
  it('changes when the player acquires a vehicle', () => {
    expect(lmuSessionSignature(session(-1, false))).not.toBe(
      lmuSessionSignature(session(54, true))
    );
  });

  it.each([
    ['qualification', 72],
    ['bestLapTime', 73],
    ['lastLapTime', 74],
    ['totalLaps', 5],
    ['classId', 2],
    ['vehicleModel', 'Updated Car'],
  ])('changes when driver %s changes', (field, value) => {
    const before = session(20, true);
    const after = session(20, true);
    Object.assign(after.drivers[0], { [field]: value });

    expect(lmuSessionSignature(before)).not.toBe(lmuSessionSignature(after));
  });
});
