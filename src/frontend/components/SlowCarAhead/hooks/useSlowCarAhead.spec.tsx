import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  TrackLocation,
  type ActiveSimulator,
  type Driver,
  type SlowCarAheadConfig,
} from '@irdashies/types';
import { useSlowCarAhead } from './useSlowCarAhead';

const mocks = vi.hoisted(() => ({
  simulator: null as ActiveSimulator | null,
  trackLength: 1000,
  focusCarIdx: 0 as number | undefined,
  drivers: [] as Driver[] | undefined,
  lapDistPct: [] as number[],
  onPitRoad: [] as boolean[],
  trackSurface: [] as number[],
  offTrack: [] as boolean[],
  speeds: [] as number[],
  settings: {} as SlowCarAheadConfig,
}));

vi.mock('@irdashies/context', () => ({
  useActiveSimulator: () => mocks.simulator,
  useCarIdxOffTrack: () => mocks.offTrack,
  useCarIdxSpeed: () => mocks.speeds,
  useFocusCarIdx: () => mocks.focusCarIdx,
  useSessionDrivers: () => mocks.drivers,
  useTrackLength: () => mocks.trackLength,
  useTrackStateSnapshot: () => ({
    carIdxLapDistPct: mocks.lapDistPct,
    carIdxOnPitRoad: mocks.onPitRoad,
    carIdxTrackSurface: mocks.trackSurface,
  }),
}));

vi.mock('./useSlowCarAheadSettings', () => ({
  useSlowCarAheadSettings: () => mocks.settings,
}));

interface CarSetup {
  carIdx: number;
  pct: number;
  speed: number;
  onPitRoad?: boolean;
  surface?: number;
  offTrack?: boolean;
  paceCar?: boolean;
}

const PLAYER_IDX = 0;

const player = (overrides: Partial<CarSetup> = {}): CarSetup => ({
  carIdx: PLAYER_IDX,
  pct: 0.5,
  speed: 150,
  ...overrides,
});

const setup = (cars: CarSetup[]) => {
  const size = Math.max(...cars.map((car) => car.carIdx)) + 1;
  mocks.lapDistPct = new Array(size).fill(-1);
  mocks.onPitRoad = new Array(size).fill(false);
  mocks.trackSurface = new Array(size).fill(TrackLocation.NotInWorld);
  mocks.offTrack = new Array(size).fill(false);
  mocks.speeds = new Array(size).fill(0);
  mocks.drivers = cars.map(
    (car) =>
      ({
        CarIdx: car.carIdx,
        CarIsPaceCar: car.paceCar ? 1 : 0,
        UserName: `Driver ${car.carIdx}`,
      }) as Driver
  );

  for (const car of cars) {
    mocks.lapDistPct[car.carIdx] = car.pct;
    mocks.onPitRoad[car.carIdx] = car.onPitRoad ?? false;
    mocks.trackSurface[car.carIdx] = car.surface ?? TrackLocation.OnTrack;
    mocks.offTrack[car.carIdx] = car.offTrack ?? false;
    mocks.speeds[car.carIdx] = car.speed;
  }
};

const render = () => renderHook(() => useSlowCarAhead()).result.current;

const PIT_OR_ABSENT_SURFACES = [
  ['in its pit stall', TrackLocation.InPitStall],
  ['approaching the pits', TrackLocation.ApproachingPits],
  ['not in the world', TrackLocation.NotInWorld],
] as const;

describe('useSlowCarAhead', () => {
  beforeEach(() => {
    mocks.simulator = 'iracing';
    mocks.trackLength = 1000;
    mocks.focusCarIdx = PLAYER_IDX;
    mocks.settings = {
      maxDistance: 250,
      slowSpeedThreshold: 50,
      stoppedSpeedThreshold: 5,
      barThickness: 10,
      showOnlyWhenOnTrack: true,
      sessionVisibility: {
        race: true,
        loneQualify: false,
        openQualify: true,
        practice: true,
        offlineTesting: true,
      },
    };
    setup([player()]);
  });

  it('returns a slow car within range with its distance', () => {
    setup([player(), { carIdx: 3, pct: 0.6, speed: 30 }]);

    const result = render();

    expect(result?.driver.CarIdx).toBe(3);
    expect(result?.distance).toBeCloseTo(100);
    expect(result?.isStopped).toBe(false);
    expect(result?.isOffTrack).toBe(false);
  });

  it('picks the nearest of several slow cars', () => {
    setup([
      player(),
      { carIdx: 1, pct: 0.7, speed: 30 },
      { carIdx: 2, pct: 0.55, speed: 30 },
      { carIdx: 3, pct: 0.62, speed: 30 },
    ]);

    const result = render();

    expect(result?.driver.CarIdx).toBe(2);
    expect(result?.distance).toBeCloseTo(50);
  });

  it('ignores a slow car behind the focus car', () => {
    setup([player(), { carIdx: 1, pct: 0.4, speed: 30 }]);

    expect(render()).toBeNull();
  });

  it('ignores a slow car beyond the maximum distance', () => {
    setup([player(), { carIdx: 1, pct: 0.8, speed: 30 }]);

    expect(render()).toBeNull();
  });

  it('ignores a slow car on pit road', () => {
    setup([player(), { carIdx: 1, pct: 0.6, speed: 30, onPitRoad: true }]);

    expect(render()).toBeNull();
  });

  it('ignores a car that is not slow', () => {
    setup([player(), { carIdx: 1, pct: 0.6, speed: 80 }]);

    expect(render()).toBeNull();
  });

  it('ignores a slow car that is not much slower than the player', () => {
    setup([player({ speed: 60 }), { carIdx: 1, pct: 0.6, speed: 30 }]);

    expect(render()).toBeNull();
  });

  it.each([
    ['stopped', 5, true],
    ['stopped', 0, true],
    ['slow', 6, false],
  ])(
    'reports a car at %s speed %i as isStopped=%s',
    (_label, speed, isStopped) => {
      setup([player(), { carIdx: 1, pct: 0.6, speed }]);

      expect(render()?.isStopped).toBe(isStopped);
    }
  );

  it.each([true, false])(
    'reports isOffTrack=%s from the off-track array',
    (offTrack) => {
      setup([player(), { carIdx: 1, pct: 0.6, speed: 0, offTrack }]);

      expect(render()?.isOffTrack).toBe(offTrack);
    }
  );

  it('counts a car just past the line as ahead of a player just before it', () => {
    setup([player({ pct: 0.99 }), { carIdx: 1, pct: 0.01, speed: 30 }]);

    const result = render();

    expect(result?.driver.CarIdx).toBe(1);
    expect(result?.distance).toBeCloseTo(20);
  });

  it('counts a car just before the line as behind a player just past it', () => {
    setup([player({ pct: 0.01 }), { carIdx: 1, pct: 0.99, speed: 30 }]);

    expect(render()).toBeNull();
  });

  it('skips the pace car', () => {
    setup([player(), { carIdx: 1, pct: 0.6, speed: 30, paceCar: true }]);

    expect(render()).toBeNull();
  });

  it('measures from the focus car and never returns it', () => {
    mocks.focusCarIdx = 4;
    setup([
      { carIdx: 0, pct: 0.5, speed: 0 },
      { carIdx: 4, pct: 0.6, speed: 150 },
      { carIdx: 5, pct: 0.65, speed: 0 },
    ]);

    const result = render();

    expect(result?.driver.CarIdx).toBe(5);
    expect(result?.distance).toBeCloseTo(50);
  });

  it('returns null without drivers or a focus car', () => {
    setup([player(), { carIdx: 1, pct: 0.6, speed: 30 }]);
    mocks.drivers = undefined;
    expect(render()).toBeNull();

    setup([player(), { carIdx: 1, pct: 0.6, speed: 30 }]);
    mocks.focusCarIdx = undefined;
    expect(render()).toBeNull();
  });

  describe('under LMU', () => {
    beforeEach(() => {
      mocks.simulator = 'lmu';
    });

    it.each(PIT_OR_ABSENT_SURFACES)(
      'ignores a stopped car %s that is not flagged on pit road',
      (_label, surface) => {
        setup([player(), { carIdx: 1, pct: 0.6, speed: 0, surface }]);

        expect(render()).toBeNull();
      }
    );

    it('still returns a slow car on track', () => {
      setup([player(), { carIdx: 1, pct: 0.6, speed: 0 }]);

      const result = render();

      expect(result?.driver.CarIdx).toBe(1);
      expect(result?.isStopped).toBe(true);
    });

    it('falls through to a farther car on track past one in its stall', () => {
      setup([
        player(),
        {
          carIdx: 1,
          pct: 0.55,
          speed: 0,
          surface: TrackLocation.InPitStall,
        },
        { carIdx: 2, pct: 0.7, speed: 20 },
      ]);

      const result = render();

      expect(result?.driver.CarIdx).toBe(2);
      expect(result?.distance).toBeCloseTo(200);
    });
  });

  describe.each([
    ['iRacing', 'iracing'],
    ['no known simulator', null],
  ] as const)('under %s', (_label, simulator) => {
    beforeEach(() => {
      mocks.simulator = simulator;
    });

    it.each(PIT_OR_ABSENT_SURFACES)(
      'still returns a stopped car %s that is not flagged on pit road',
      (_surfaceLabel, surface) => {
        setup([player(), { carIdx: 1, pct: 0.6, speed: 0, surface }]);

        const result = render();

        expect(result?.driver.CarIdx).toBe(1);
        expect(result?.distance).toBeCloseTo(100);
        expect(result?.isStopped).toBe(true);
      }
    );
  });
});
