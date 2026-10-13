import { describe, expect, it } from 'vitest';
import type { LmuRawSession } from './native';
import { lmuSessionSignature } from './sessionSignature';
import { fixture } from './rawSessionFixture';

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

describe('lmuSessionSignature running order', () => {
  it('changes when a driver changes place', () => {
    // Without this an overtake moved nothing the signature could see, so the
    // standings held their old order until somebody completed a lap.
    const before = fixture();
    const after = {
      ...before,
      drivers: before.drivers.map((d, i) =>
        i === 0 ? { ...d, place: d.place + 1 } : d
      ),
    };

    expect(lmuSessionSignature(after)).not.toBe(lmuSessionSignature(before));
  });

  it('changes when a driver sets a better lap', () => {
    const before = fixture();
    const after = {
      ...before,
      drivers: before.drivers.map((d, i) =>
        i === 0 ? { ...d, bestLapTime: 1 } : d
      ),
    };

    expect(lmuSessionSignature(after)).not.toBe(lmuSessionSignature(before));
  });
});
