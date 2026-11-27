import { describe, expect, it } from 'vitest';
import { CarLeftRight } from '@irdashies/types';
import type { LmuRawTelemetry } from './native';
import {
  classifyLmuBlindSpot,
  createLmuRelativePositionsBuffer,
  deriveLmuRelativePositions,
  lmuRelativePositionsAvailable,
  summariseLmuBlindSpot,
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
    // Positive is ahead. The car is 10 m further along than the player, and
    // this is the sign convention consumers rely on -- the rotation matches
    // TinyPedal, the output sign is ours.
    expect(positions?.longitudinal[1]).toBeCloseTo(10);
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

describe('summariseLmuBlindSpot offsets', () => {
  // Fixtures are world positions. Once rotated into the player's frame a car
  // ahead comes out positive, which for this orientation means a lower world
  // Z -- hence the negative Z on the cars these tests call "ahead". See the
  // sign note in proximity.ts.
  it('reports how far fore or aft the car alongside is, in metres', () => {
    // 2.5 m to the left and 1.5 m ahead.
    const summary = summariseLmuBlindSpot(
      deriveLmuRelativePositions(
        fixture([
          [0, 0],
          [2.5, -1.5],
        ])
      )
    );

    expect(summary?.state).toBe(CarLeftRight.CarLeft);
    expect(summary?.leftLongitudinalM).toBeCloseTo(1.5, 3);
    expect(summary?.rightLongitudinalM).toBeNull();
  });

  it('keeps fore and aft signed, so a bar can show which', () => {
    const ahead = summariseLmuBlindSpot(
      deriveLmuRelativePositions(
        fixture([
          [0, 0],
          [2.5, -2],
        ])
      )
    );
    const behind = summariseLmuBlindSpot(
      deriveLmuRelativePositions(
        fixture([
          [0, 0],
          [2.5, 2],
        ])
      )
    );

    expect(ahead?.leftLongitudinalM).toBeGreaterThan(0);
    expect(behind?.leftLongitudinalM).toBeLessThan(0);
  });

  it('picks the car nearest abeam when two share a side', () => {
    const summary = summariseLmuBlindSpot(
      deriveLmuRelativePositions(
        fixture([
          [0, 0],
          [2.5, -4],
          [2.5, -0.5],
        ])
      )
    );

    expect(summary?.state).toBe(CarLeftRight.Cars2Left);
    expect(summary?.leftLongitudinalM).toBeCloseTo(0.5, 3);
  });

  it('reports each side separately when three wide', () => {
    const summary = summariseLmuBlindSpot(
      deriveLmuRelativePositions(
        fixture([
          [0, 0],
          [2.5, -1],
          [-2.5, 1],
        ])
      )
    );

    expect(summary?.state).toBe(CarLeftRight.CarLeftRight);
    expect(summary?.leftLongitudinalM).toBeCloseTo(1, 3);
    expect(summary?.rightLongitudinalM).toBeCloseTo(-1, 3);
  });

  it('offers no offset for a clear track', () => {
    const summary = summariseLmuBlindSpot(
      deriveLmuRelativePositions(
        fixture([
          [0, 0],
          [-40, -0],
        ])
      )
    );

    expect(summary?.state).toBe(CarLeftRight.Clear);
    expect(summary?.leftLongitudinalM).toBeNull();
    expect(summary?.rightLongitudinalM).toBeNull();
  });
});

describe('deriveLmuRelativePositions performance guards', () => {
  it('reuses a caller buffer instead of allocating per frame', () => {
    const buffer = createLmuRelativePositionsBuffer();

    const first = deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-2.5, 1],
      ]),
      buffer
    );
    const second = deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-2.5, 2],
      ]),
      buffer
    );

    expect(first).toBe(buffer);
    expect(second).toBe(buffer);
    expect(second?.lateral).toBe(buffer.lateral);
  });

  it('clears slots a shorter grid no longer uses', () => {
    // A stale `available` from a bigger frame would read as a phantom car.
    const buffer = createLmuRelativePositionsBuffer();
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-2.5, 1],
        [2.5, 1],
      ]),
      buffer
    );
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-2.5, 1],
      ]),
      buffer
    );

    expect(buffer.available).toHaveLength(2);
    expect(buffer.available[2]).toBeUndefined();
  });

  it('skips cars outside the relevance radius', () => {
    // Beyond the radius nothing is computed, so no rotation and no atan2 is
    // paid for a car the radar could not draw.
    const buffer = createLmuRelativePositionsBuffer();
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [0, 500],
      ]),
      buffer
    );

    expect(buffer.available[1]).toBe(false);
  });

  it('computes a car as far away as the radar can draw', () => {
    const buffer = createLmuRelativePositionsBuffer();
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-3, 95],
      ]),
      buffer
    );

    expect(buffer.available[1]).toBe(true);
    expect(buffer.longitudinal[1]).toBeCloseTo(-95);
    expect(buffer.lateral[1]).toBeCloseTo(3);
  });

  it('does not let a distant car change the blind spot', () => {
    const buffer = createLmuRelativePositionsBuffer();
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-3, 60],
      ]),
      buffer
    );

    expect(summariseLmuBlindSpot(buffer)?.state).toBe(CarLeftRight.Clear);
  });

  it('still computes a car just inside the radius', () => {
    const buffer = createLmuRelativePositionsBuffer();
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [0, 19],
      ]),
      buffer
    );

    expect(buffer.available[1]).toBe(true);
  });
});

describe('LMU opponent time alignment', () => {
  const timed = (
    frames: { player: number; opponent: number; opponentZ: number }[]
  ) =>
    frames.map(
      ({ player, opponent, opponentZ }) =>
        ({
          ...fixture([
            [0, 0],
            [-3, opponentZ],
          ]),
          vehElapsedTime: new Float64Array([player, opponent]),
        }) as LmuRawTelemetry
    );

  it('carries an older opponent sample forward to the player clock', () => {
    const buffer = createLmuRelativePositionsBuffer();
    const [first, second] = timed([
      { player: 10.0, opponent: 10.0, opponentZ: 50 },
      { player: 10.02, opponent: 10.01, opponentZ: 50.7 },
    ]);
    deriveLmuRelativePositions(first, buffer);
    deriveLmuRelativePositions(second, buffer);

    expect(buffer.longitudinal[1]).toBeCloseTo(-(50.7 + 0.7));
  });

  it('is unchanged when the same frame is derived twice', () => {
    const buffer = createLmuRelativePositionsBuffer();
    const [first, second] = timed([
      { player: 10.0, opponent: 10.0, opponentZ: 50 },
      { player: 10.02, opponent: 10.01, opponentZ: 50.7 },
    ]);
    deriveLmuRelativePositions(first, buffer);
    deriveLmuRelativePositions(second, buffer);
    const once = buffer.longitudinal[1];
    deriveLmuRelativePositions(second, buffer);

    expect(buffer.longitudinal[1]).toBeCloseTo(once);
  });

  it('does not count a move twice when the per-car clock stands still', () => {
    const buffer = createLmuRelativePositionsBuffer();
    const [first, second, third] = timed([
      { player: 10.0, opponent: 10.0, opponentZ: 50 },
      { player: 10.02, opponent: 10.01, opponentZ: 50.7 },
      { player: 10.02, opponent: 10.01, opponentZ: 51.4 },
    ]);
    deriveLmuRelativePositions(first, buffer);
    deriveLmuRelativePositions(second, buffer);
    deriveLmuRelativePositions(third, buffer);

    expect(buffer.longitudinal[1]).toBeCloseTo(-(51.4 + 0.7));
  });

  it('uses the raw position until two samples exist', () => {
    const buffer = createLmuRelativePositionsBuffer();
    const [only] = timed([{ player: 10.02, opponent: 10.01, opponentZ: 50 }]);
    deriveLmuRelativePositions(only, buffer);

    expect(buffer.longitudinal[1]).toBeCloseTo(-50);
  });

  it('does not extrapolate across a clock reset', () => {
    const buffer = createLmuRelativePositionsBuffer();
    const [late, reset] = timed([
      { player: 500.0, opponent: 500.0, opponentZ: 50 },
      { player: 1.02, opponent: 1.01, opponentZ: 80 },
    ]);
    deriveLmuRelativePositions(late, buffer);
    deriveLmuRelativePositions(reset, buffer);

    expect(buffer.longitudinal[1]).toBeCloseTo(-80);
  });

  it('does not extrapolate across a teleport', () => {
    const buffer = createLmuRelativePositionsBuffer();
    const [before, after] = timed([
      { player: 1.02, opponent: 1.02, opponentZ: 80 },
      { player: 1.06, opponent: 1.03, opponentZ: 100 },
    ]);
    deriveLmuRelativePositions(before, buffer);
    deriveLmuRelativePositions(after, buffer);

    expect(buffer.longitudinal[1]).toBeCloseTo(-100);
  });

  it('leaves opponents alone when the sim sends no per-car clock', () => {
    const buffer = createLmuRelativePositionsBuffer();
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-3, 50],
      ]),
      buffer
    );
    deriveLmuRelativePositions(
      fixture([
        [0, 0],
        [-3, 50.7],
      ]),
      buffer
    );

    expect(buffer.longitudinal[1]).toBeCloseTo(-50.7);
  });
});

describe('lmuRelativePositionsAvailable', () => {
  it('accepts a frame carrying player position and orientation', () => {
    expect(
      lmuRelativePositionsAvailable(
        fixture([
          [0, 0],
          [-2.5, 1],
        ])
      )
    ).toBe(true);
  });

  it('rejects a frame with no player vehicle', () => {
    const raw = {
      ...fixture([[0, 0]]),
      playerHasVehicle: false,
    } as LmuRawTelemetry;

    expect(lmuRelativePositionsAvailable(raw)).toBe(false);
  });

  it('rejects a frame with no world positions', () => {
    const raw = {
      ...fixture([[0, 0]]),
      vehPosX: undefined,
    } as unknown as LmuRawTelemetry;

    expect(lmuRelativePositionsAvailable(raw)).toBe(false);
  });
});
