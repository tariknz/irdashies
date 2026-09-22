import { describe, expect, it } from 'vitest';
import { CarLeftRight } from '@irdashies/types';
import type { LmuRawTelemetry } from '../native/lmu';
import {
  classifyLmuBlindSpot,
  deriveLmuRelativePositions,
} from './proximity';

const fixture = (
  positions: [number, number][],
  orientation: [number, number] = [0, 1]
) =>
  ({
    playerHasVehicle: true,
    playerVehicleIdx: 0,
    vehTelemetryAvailable: new Uint8Array(positions.map(() => 1)),
    vehPosX: new Float64Array(positions.map(([x]) => x)),
    vehPosZ: new Float64Array(positions.map(([, z]) => z)),
    vehOriX: new Float64Array(positions.map(() => orientation[0])),
    vehOriZ: new Float64Array(positions.map(() => orientation[1])),
  }) as LmuRawTelemetry;

describe('LMU proximity', () => {
  it('matches TinyPedal local-frame rotation', () => {
    const positions = deriveLmuRelativePositions(
      fixture([
        [100, 200],
        [103, 190],
      ])
    );

    expect(positions?.lateral[1]).toBeCloseTo(-3);
    expect(positions?.longitudinal[1]).toBeCloseTo(-10);
    expect(positions?.heading[1]).toBeCloseTo(0);
  });

  it('rotates positions with player orientation', () => {
    const positions = deriveLmuRelativePositions(
      fixture(
        [
          [0, 0],
          [0, 3],
        ],
        [1, 0]
      )
    );

    expect(positions?.lateral[1]).toBeCloseTo(-3);
    expect(positions?.longitudinal[1]).toBeCloseTo(0);
  });

  it('applies blind-spot overlap thresholds', () => {
    expect(
      classifyLmuBlindSpot(
        deriveLmuRelativePositions(
          fixture([
            [0, 0],
            [3, 0],
            [-3, 0],
          ])
        )
      )
    ).toBe(CarLeftRight.CarLeftRight);

    expect(
      classifyLmuBlindSpot(
        deriveLmuRelativePositions(
          fixture([
            [0, 0],
            [1, 0],
            [3, 8],
          ])
        )
      )
    ).toBe(CarLeftRight.Clear);
  });
});
