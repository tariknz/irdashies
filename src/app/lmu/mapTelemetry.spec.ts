import { describe, expect, it } from 'vitest';
import { CarLeftRight, TIMED_SESSION_LAPS } from '@irdashies/types';
import type { LmuRawTelemetry } from './native';
import { mapLmuSectorTimes, mapLmuTelemetry } from './mapTelemetry';
import { fixture } from './rawFixture';
import { createLmuLapDistanceState } from './lapDistance';

describe('mapLmuTelemetry', () => {
  it('maps session scalars', () => {
    const t = mapLmuTelemetry(fixture());
    // Both clocks are the player's 100 Hz mElapsedTime, not scoring's 5 Hz
    // mCurrentET (1250.5 in the fixture). See the session-clock specs below.
    expect(t.SessionTick.value[0]).toBe(250.4);
    expect(t.SessionTime.value[0]).toBe(250.4);
    expect(t.SessionTimeTotal.value[0]).toBe(3600);
    expect(t.SessionTimeRemain.value[0]).toBe(2349.5);
    // The fixture is session 1 -- practice -- which is always timed, so both
    // report the no-lap-limit sentinel however many laps mMaxLaps claims.
    // See the lap-limit specs below.
    expect(t.SessionLapsTotal.value[0]).toBe(TIMED_SESSION_LAPS);
    expect(t.SessionLapsRemain.value[0]).toBe(TIMED_SESSION_LAPS);
    expect(t.SessionNum.value[0]).toBe(1);
    expect(t.SessionState.value[0]).toBe(3);
    expect(t.SessionTimeOfDay.value[0]).toBe(0.45);
  });

  it('maps game phase to iRacing session state', () => {
    const base = fixture();
    const phases: [number, number][] = [
      [0, 0],
      [1, 2],
      [2, 1],
      [3, 3],
      [4, 3],
      [5, 4],
      [6, 4],
      [7, 5],
      [8, 6],
      [9, 4],
    ];
    for (const [phase, state] of phases) {
      expect(
        mapLmuTelemetry({ ...base, gamePhase: phase }).SessionState.value[0]
      ).toBe(state);
    }
  });

  it('maps player telemetry', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.PlayerCarIdx.value[0]).toBe(1);
    expect(t.Speed.value[0]).toBeCloseTo(51.234);
    expect(t.FuelLevel.value[0]).toBe(42);
    expect(t.FuelLevelPct.value[0]).toBeCloseTo(42 / 110);
    expect(t.WaterTemp.value[0]).toBe(95);
    expect(t.OilTemp.value[0]).toBe(110);
    expect(t.Gear.value[0]).toBe(5);
    expect(t.RPM.value[0]).toBe(8200);
    expect(t.LapCurrentLapTime.value[0]).toBeCloseTo(50.4);
    expect(t.Throttle.value[0]).toBeCloseTo(0.79);
    expect(t.Brake.value[0]).toBe(0);
    expect(t.Clutch.value[0]).toBe(1);
    expect(t.ClutchRaw.value[0]).toBe(1);
    expect(t.RadioTransmitCarIdx.value[0]).toBe(-1);
    expect(t.BrakeABSactive.value[0]).toBe(true);
    expect(t.Speed).toBeDefined();
    expect(t.SteeringWheelAngle.value[0]).toBeCloseTo(
      0.29 * ((480 * Math.PI) / 360)
    );
    expect(t.dcBrakeBias.value[0]).toBeCloseTo(45);
    expect(t.dcPitSpeedLimiterToggle.value[0]).toBe(false);
    expect(t.LatAccel.value[0]).toBeCloseTo(9.80665);
    expect(t.LongAccel.value[0]).toBeCloseTo(-19.6133);
    expect(t.LFtempCL.value[0]).toBe(80);
    expect(t.RRcoldPressure.value[0]).toBe(183);
    expect(t.LRwearM.value[0]).toBe(0.7);
    expect(t.RFbrakeLinePress.value[0]).toBe(0.5);
    expect(t.RRshockDefl.value[0]).toBe(0.07);
  });

  it('maps the LMU pit limiter switch, not only active intervention', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      speedLimiter: 1,
      speedLimiterActive: false,
    });

    expect(t.dcPitSpeedLimiterToggle.value[0]).toBe(true);
  });

  it('handles the no-player case', () => {
    const rest: Record<string, unknown> = { ...fixture() };
    delete rest.speed;
    rest.playerHasVehicle = false;
    rest.playerVehicleIdx = -1;
    const t = mapLmuTelemetry(rest as unknown as LmuRawTelemetry);
    expect(t.PlayerCarIdx.value[0]).toBe(-1);
    expect(t.Speed.value[0]).toBe(0);
    expect(t.OnPitRoad.value[0]).toBe(false);
    expect(t.IsOnTrack.value[0]).toBe(false);
  });

  it('maps per-car arrays by slot', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.CarIdxPosition.value).toEqual([2, 1, 3]);
    expect(t.CarIdxLapDistPct.value).toEqual([0.4, 0.6, 0.2]);
    expect(t.CarIdxLap.value).toEqual([2, 3, 1]);
    expect(t.CarIdxClass.value).toEqual([0, 0, 1]);
    expect(t.CarIdxBestLapTime.value).toEqual([134.5, 132.8, 137.1]);
    expect(t.CarIdxEstTime.value).toEqual([50, 60, 20]);
    expect(t.CarIdxOnPitRoad.value).toEqual([false, false, true]);
    expect(t.CarIdxTrackSurface.value).toEqual([3, 3, 1]);
  });

  it('clamps LMU lap distance progress for map positioning', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      vehLapDistPct: new Float64Array([-0.1, 0.6, 1.2]),
    });
    expect(t.CarIdxLapDistPct.value).toEqual([-1, 0.6, 1]);
    expect(t.LapDistPct.value[0]).toBe(0.6);
  });

  it('maps nearby world positions to iRacing blind-spot states', () => {
    const base = {
      ...fixture(),
      playerVehicleIdx: 0,
      vehTelemetryAvailable: new Uint8Array([1, 1, 1]),
      vehPosX: new Float64Array([0, 3, 20]),
      vehPosZ: new Float64Array([0, 0, 20]),
      vehOriX: new Float64Array([0, 0, 0]),
      vehOriZ: new Float64Array([1, 1, 1]),
    };

    expect(mapLmuTelemetry(base).CarLeftRight.value[0]).toBe(
      CarLeftRight.CarLeft
    );
    expect(
      mapLmuTelemetry({
        ...base,
        vehPosX: new Float64Array([0, -3, 20]),
      }).CarLeftRight.value[0]
    ).toBe(CarLeftRight.CarRight);
    expect(
      mapLmuTelemetry({
        ...base,
        vehPosX: new Float64Array([0, 3, -3]),
        vehPosZ: new Float64Array([0, 0, 0]),
      }).CarLeftRight.value[0]
    ).toBe(CarLeftRight.CarLeftRight);
  });

  it('rotates world positions into the player frame', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      playerVehicleIdx: 0,
      vehTelemetryAvailable: new Uint8Array([1, 1]),
      vehPosX: new Float64Array([0, 0]),
      vehPosZ: new Float64Array([0, 3]),
      vehOriX: new Float64Array([1, 1]),
      vehOriZ: new Float64Array([0, 0]),
    });

    expect(t.CarLeftRight.value[0]).toBe(CarLeftRight.CarLeft);
  });

  it('turns the blind-spot signal off when native position data is missing', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      vehTelemetryAvailable: new Uint8Array([0, 0, 0]),
    });

    expect(t.CarLeftRight.value[0]).toBe(CarLeftRight.Off);
  });

  it('computes wind magnitude', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.WindVel.value[0]).toBeCloseTo(Math.hypot(2, 0, -3));
  });

  it('maps LMU race flags', () => {
    const base = fixture();
    expect(
      mapLmuTelemetry({ ...base, gamePhase: 5 }).SessionFlags.value[0]
    ).toBe(0);
    expect(
      mapLmuTelemetry({
        ...base,
        sectorFlags: new Uint8Array([0, 1, 0]),
      }).SessionFlags.value[0]
    ).toBe(8);
    expect(
      mapLmuTelemetry({ ...base, gamePhase: 8 }).SessionFlags.value[0]
    ).toBe(1);
    expect(
      mapLmuTelemetry({
        ...base,
        gamePhase: 5,
        sectorFlags: new Uint8Array([255, 0, 0]),
      }).SessionFlags.value[0]
    ).toBe(0);
    expect(
      mapLmuTelemetry({
        ...base,
        gamePhase: 5,
        vehFlag: new Uint8Array([0, 6, 0]),
      }).SessionFlags.value[0]
    ).toBe(32);
  });

  it('converts cumulative LMU sector times and invalid sentinels', () => {
    const times = mapLmuSectorTimes(32.4, 73.4, 133.4);
    expect(times[0]).toBeCloseTo(32.4);
    expect(times[1]).toBeCloseTo(41);
    expect(times[2]).toBeCloseTo(60);
    expect(mapLmuSectorTimes(-1, -1, -1)).toEqual([null, null, null]);
    expect(mapLmuSectorTimes(32.4, -1, 133.4)).toEqual([32.4, null, null]);
  });

  it('maps direct LMU sector timing telemetry', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.LmuSectorIdx?.value[0]).toBe(1);
    expect(t.LmuCurrentSectorTimes?.value[0]).toBeCloseTo(32.8);
    expect(t.LmuCurrentSectorTimes?.value[1]).toBeCloseTo(41.4);
    expect(t.LmuCurrentSectorTimes?.value[2]).toBeNull();
    expect(t.LmuLastSectorTimes?.value[0]).toBeCloseTo(32.4);
    expect(t.LmuLastSectorTimes?.value[1]).toBeCloseTo(41);
    expect(t.LmuLastSectorTimes?.value[2]).toBeCloseTo(60);
  });
});

describe('mapLmuTelemetry lap-distance reconstruction', () => {
  it('advances the fraction between scoring updates', () => {
    // LMU only publishes lap distance at 5 Hz, so two polls 15 ms apart carry
    // a byte-identical scoring fraction. Without the integrator LapTrace's
    // sample buffer drops the second one.
    const state = createLmuLapDistanceState();
    const first = fixture();
    const second = fixture();
    second.elapsedTime = (first.elapsedTime ?? 0) + 0.015;

    const a = mapLmuTelemetry(first, state).LapDistPct?.value[0] as number;
    const b = mapLmuTelemetry(second, state).LapDistPct?.value[0] as number;

    expect(b).toBeGreaterThan(a);
  });

  it('smooths the player slot of CarIdxLapDistPct and no other', () => {
    // The per-car array feeds the blind-spot monitor and the relative-gap
    // processor. Only the player can be smoothed: per-car speed is not
    // exported, so there is nothing to integrate the others with.
    const state = createLmuLapDistanceState();
    const first = fixture();
    const second = fixture();
    second.elapsedTime = (first.elapsedTime ?? 0) + 0.015;

    mapLmuTelemetry(first, state);
    const t = mapLmuTelemetry(second, state);
    const perCar = t.CarIdxLapDistPct?.value as number[];

    // playerVehicleIdx is 1 in the fixture.
    expect(perCar[1]).toBe(t.LapDistPct?.value[0]);
    expect(perCar[1]).toBeGreaterThan(0.6);
    expect(perCar[0]).toBe(0.4);
    expect(perCar[2]).toBe(0.2);
  });

  it('leaves the per-car array alone when there is no integrator', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.CarIdxLapDistPct?.value).toEqual([0.4, 0.6, 0.2]);
  });

  it('is byte-identical to the raw scoring value without a state object', () => {
    const withoutState = mapLmuTelemetry(fixture());
    expect(withoutState.LapDistPct?.value[0]).toBe(0.6);
  });

  it('leaves the no-player path untouched even when given a state object', () => {
    // Spectating or in the garage there is no elapsedTime either, so feeding
    // the integrator would anchor it on a fabricated (pct 0, t -1) pair.
    const state = createLmuLapDistanceState();
    const raw = fixture();
    raw.playerHasVehicle = false;
    raw.playerVehicleIdx = -1;

    const bare = fixture();
    bare.playerHasVehicle = false;
    bare.playerVehicleIdx = -1;

    expect(mapLmuTelemetry(raw, state).LapDistPct?.value[0]).toBe(
      mapLmuTelemetry(bare).LapDistPct?.value[0]
    );
  });

  it('never publishes a backward step within a lap', () => {
    // A reversal reaches LapTrace as a dirty lap, which is then never promoted
    // to a reference -- silently. See lapDistance.spec.ts for the unit-level
    // property; this is the same invariant at the mapper boundary.
    const state = createLmuLapDistanceState();
    let previous = -Infinity;
    for (let i = 0; i < 200; i += 1) {
      const raw = fixture();
      raw.elapsedTime = 250.4 + i * 0.008;
      const value = mapLmuTelemetry(raw, state).LapDistPct?.value[0] as number;
      expect(value).toBeGreaterThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('mapLmuTelemetry session clock', () => {
  it('takes the clock from the 100 Hz telemetry block', () => {
    // Scoring's currentET only moves at 5 Hz, so LapTrace stamped every
    // sample inside a 200 ms window with an identical time.
    const raw = fixture();
    raw.currentET = 1250.5;
    raw.elapsedTime = 250.4;

    const t = mapLmuTelemetry(raw);

    expect(t.SessionTime?.value[0]).toBe(250.4);
    expect(t.SessionTick?.value[0]).toBe(250.4);
  });

  it('falls back to scoring when there is no player car', () => {
    // mElapsedTime is absent spectating and in the garage.
    const raw = fixture();
    raw.currentET = 1250.5;
    raw.elapsedTime = undefined;

    const t = mapLmuTelemetry(raw);

    expect(t.SessionTime?.value[0]).toBe(1250.5);
  });
});

describe('mapLmuTelemetry absent-value sentinels', () => {
  /**
   * Slot 0 as the addon really leaves a hole: every array keeps the zero it
   * was created with, except vehLapDistPct, which is explicitly filled -1.
   */
  const withHole = () => {
    const raw = fixture();
    const hole = <T>(values: T) => values;
    raw.vehLapDistPct = hole([
      -1, 0.6, 0.2,
    ]) as unknown as typeof raw.vehLapDistPct;
    raw.vehBestLapTime = hole([
      0, 132.8, 137.1,
    ]) as unknown as typeof raw.vehBestLapTime;
    raw.vehLastLapTime = hole([
      0, 133.4, 138.9,
    ]) as unknown as typeof raw.vehLastLapTime;
    raw.vehTotalLaps = hole([0, 3, 1]) as unknown as typeof raw.vehTotalLaps;
    raw.vehClass = hole([0, 0, 1]) as unknown as typeof raw.vehClass;
    return raw;
  };

  it('reports an empty slot as absent, not as zero', () => {
    // The addon sizes per-car arrays to max(mID)+1 and writes only real cars,
    // so a hole keeps the zero the array was created with. formatTime renders
    // 0 as "0:00.000" and only treats a negative as absent, which is why an
    // empty slot used to show a lap time of zero in the standings.
    const t = mapLmuTelemetry(withHole());

    expect((t.CarIdxBestLapTime?.value as number[])[0]).toBe(-1);
    expect((t.CarIdxLastLapTime?.value as number[])[0]).toBe(-1);
    expect((t.CarIdxLap?.value as number[])[0]).toBe(-1);
    expect((t.CarIdxLapCompleted?.value as number[])[0]).toBe(-1);
    expect((t.CarIdxClass?.value as number[])[0]).toBe(-1);
    expect((t.CarIdxTrackSurface?.value as number[])[0]).toBe(-1);
  });

  it('leaves real cars in the same frame untouched', () => {
    const t = mapLmuTelemetry(withHole());

    expect((t.CarIdxBestLapTime?.value as number[])[1]).toBe(132.8);
    expect((t.CarIdxLastLapTime?.value as number[])[2]).toBe(138.9);
    expect((t.CarIdxLap?.value as number[])[1]).toBe(3);
    expect((t.CarIdxClass?.value as number[])[2]).toBe(1);
    // Occupied cars keep a real class of 0 -- only the hole is sentinelled.
    expect((t.CarIdxClass?.value as number[])[1]).toBe(0);
  });

  it('keeps a real zero lap count but not a zero lap time', () => {
    // The two fields need different rules. A car on its first lap genuinely
    // has 0 completed laps, and createStandings normalises a falsy lap count
    // to 1 -- turning that into -1 would corrupt the lap-gap arithmetic. A
    // lap time of 0 is never real, so it is absent whoever wrote it.
    const raw = fixture();
    raw.vehTotalLaps = [0, 3, 1] as unknown as typeof raw.vehTotalLaps;
    raw.vehBestLapTime = [
      0, 132.8, 137.1,
    ] as unknown as typeof raw.vehBestLapTime;

    const t = mapLmuTelemetry(raw);

    expect((t.CarIdxLap?.value as number[])[0]).toBe(0);
    expect((t.CarIdxBestLapTime?.value as number[])[0]).toBe(-1);
  });

  it('reports the player as absent when there is no player car', () => {
    const raw = fixture();
    raw.playerHasVehicle = false;
    raw.playerVehicleIdx = -1;

    const t = mapLmuTelemetry(raw);

    expect(t.LapBestLapTime?.value[0]).toBe(-1);
    expect(t.LapLastLapTime?.value[0]).toBe(-1);
    expect(t.PlayerTrackSurface?.value[0]).toBe(-1);
  });

  it('leaves the gap fields at zero, which is what iRacing uses there', () => {
    // CarIdxF2Time and CarIdxEstTime are 0-for-absent in iRacing's own
    // telemetry, so a sentinel here would be the bug.
    const t = mapLmuTelemetry(withHole());

    expect((t.CarIdxF2Time?.value as number[])[0]).toBe(0);
    expect((t.CarIdxEstTime?.value as number[])[0]).toBe(50);
  });
});

describe('mapLmuTelemetry fuel', () => {
  it('derives the fraction from litres and capacity', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.FuelLevel?.value[0]).toBe(42);
    expect(t.FuelLevelPct?.value[0]).toBeCloseTo(42 / 110);
  });

  it('reports zero rather than a wrong fraction when capacity is unknown', () => {
    // Nothing better is expressible here: the fuel processor coerces a
    // missing value to 0 on its way out and FuelProjectionSnapshot requires
    // a number, so absence cannot cross that boundary. The fuel calculator
    // only trusts a fraction between 0.01 and 0.99, so a 0 makes it estimate
    // the tank -- which is exactly what it would do for an absent value.
    const raw = fixture();
    raw.fuelCapacity = undefined;

    const t = mapLmuTelemetry(raw);

    expect(t.FuelLevel?.value[0]).toBe(42);
    expect(t.FuelLevelPct?.value[0]).toBe(0);
  });

  it('does not divide by a zero capacity', () => {
    const raw = fixture();
    raw.fuelCapacity = 0;

    const t = mapLmuTelemetry(raw);

    expect(t.FuelLevelPct?.value[0]).toBe(0);
    expect(Number.isFinite(t.FuelLevelPct?.value[0] as number)).toBe(true);
  });
});

describe('mapLmuTelemetry session lap limit', () => {
  /** Session ids below 10 are practice and qualifying; 10 and up are races. */
  const RACE = 10;

  it('counts down the laps of a lap-limited race', () => {
    const raw = fixture();
    raw.session = RACE;

    const t = mapLmuTelemetry(raw);

    // maxLaps 12, and the player (index 1) has completed 3.
    expect(t.SessionLapsTotal?.value[0]).toBe(12);
    expect(t.SessionLapsRemain?.value[0]).toBe(9);
  });

  it('reports no lap limit in practice and qualifying', () => {
    // The bug this fixes: mMaxLaps is not a lap count in a timed session, and
    // passing it through made the fuel calculator cap it at 1000 laps and ask
    // for thousands of litres.
    for (const session of [0, 1, 5, 8]) {
      const raw = fixture();
      raw.session = session;

      const t = mapLmuTelemetry(raw);

      expect(t.SessionLapsRemain?.value[0]).toBe(TIMED_SESSION_LAPS);
      expect(t.SessionLapsTotal?.value[0]).toBe(TIMED_SESSION_LAPS);
    }
  });

  it('reports no lap limit for a timed race', () => {
    // An endurance race is a race, but still has no lap limit. rF2 signals
    // that with a value far beyond any real race.
    const raw = fixture();
    raw.session = RACE;
    raw.maxLaps = 2147483647;

    const t = mapLmuTelemetry(raw);

    expect(t.SessionLapsRemain?.value[0]).toBe(TIMED_SESSION_LAPS);
    expect(t.SessionLapsTotal?.value[0]).toBe(TIMED_SESSION_LAPS);
  });

  it('reports no lap limit when a race reports zero laps', () => {
    const raw = fixture();
    raw.session = RACE;
    raw.maxLaps = 0;

    const t = mapLmuTelemetry(raw);

    expect(t.SessionLapsRemain?.value[0]).toBe(TIMED_SESSION_LAPS);
  });

  it('never reports a negative remaining count', () => {
    // Past the limit on the last lap.
    const raw = fixture();
    raw.session = RACE;
    raw.maxLaps = 2;

    const t = mapLmuTelemetry(raw);

    expect(t.SessionLapsRemain?.value[0]).toBe(0);
  });
});

describe('mapLmuTelemetry brake bias', () => {
  /**
   * LMU publishes only mRearBrakeBias, as a 0-1 fraction; there is no
   * mFrontBrakeBias, front is simply its complement. dcBrakeBias is percent
   * front, which is how the widget formats it, so the complement has to be
   * scaled -- otherwise a 50.8:49.2 split in LMU's own UI showed as "0.5%"
   * and looked frozen as it was adjusted.
   */
  it('reports percent front, matching the split LMU shows', () => {
    const raw = { ...fixture(), rearBrakeBias: 0.492 };

    const t = mapLmuTelemetry(raw);

    expect(t.dcBrakeBias.value[0]).toBeCloseTo(50.8, 4);
  });

  it('does not publish the bias a second time as a rear brake valve', () => {
    // It used to, which put a Rear Brake Valve column on screen reading the
    // same percentage as the Brake Bias column next to it.
    const t = mapLmuTelemetry({ ...fixture(), rearBrakeBias: 0.492 });

    expect(t.dcPeakBrakeBias).toBeUndefined();
  });

  it('moves a full point of bias as a full point', () => {
    const forward = mapLmuTelemetry({ ...fixture(), rearBrakeBias: 0.46 });
    const back = mapLmuTelemetry({ ...fixture(), rearBrakeBias: 0.47 });

    expect(
      (forward.dcBrakeBias.value[0] as number) -
        (back.dcBrakeBias.value[0] as number)
    ).toBeCloseTo(1, 4);
  });

  it('reports no bias when the sim omits it', () => {
    const t = mapLmuTelemetry({ ...fixture(), rearBrakeBias: undefined });

    expect(t.dcBrakeBias.value[0]).toBe(0);
  });
});

describe('mapLmuTelemetry REST channels', () => {
  it('omits the channels entirely when no REST data is supplied', () => {
    // What keeps iRacing and every pre-existing spec unaffected: absent, not
    // present-and-zero.
    const t = mapLmuTelemetry(fixture());

    expect(t.LmuPitStopTime).toBeUndefined();
    expect(t.LmuRepairTime).toBeUndefined();
  });

  it('publishes the cells it is given', () => {
    const t = mapLmuTelemetry(fixture(), undefined, undefined, {
      pitStopTime: { value: [32.5] },
      repairTime: { value: [12.25] },
    });

    expect(t.LmuPitStopTime?.value[0]).toBe(32.5);
    expect(t.LmuRepairTime?.value[0]).toBe(12.25);
  });

  it('hands the cell over by reference rather than copying it', () => {
    // The zero-allocation read path depends on this. The poller replaces a
    // cell on change, so there is nothing to clone per frame.
    const cell = { value: [32.5] } as const;
    const t = mapLmuTelemetry(fixture(), undefined, undefined, {
      pitStopTime: cell,
    });

    expect(t.LmuPitStopTime).toBe(cell);
  });

  it('publishes only the cells present, leaving the rest absent', () => {
    const t = mapLmuTelemetry(fixture(), undefined, undefined, {
      repairTime: { value: [5] },
    });

    expect(t.LmuPitStopTime).toBeUndefined();
    expect(t.LmuRepairTime?.value[0]).toBe(5);
  });
});

describe('mapLmuTelemetry virtual energy', () => {
  it('publishes the shared-memory energy channels', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      virtualEnergy: 0.62,
      stateOfCharge: 0.4,
      regen: 0.1,
    });

    expect(t.LmuVirtualEnergy?.value[0]).toBeCloseTo(0.62, 5);
    expect(t.LmuStateOfCharge?.value[0]).toBeCloseTo(0.4, 5);
    expect(t.LmuRegen?.value[0]).toBeCloseTo(0.1, 5);
  });

  it('publishes a zero rather than treating it as absent', () => {
    // A car with no hybrid system reports 0, and that is a real reading. Only
    // a tape or a pre-export build omits the field entirely.
    const t = mapLmuTelemetry({ ...fixture(), virtualEnergy: 0 });

    expect(t.LmuVirtualEnergy?.value[0]).toBe(0);
  });

  it('omits the channels when the addon does not export them', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      virtualEnergy: undefined,
      stateOfCharge: undefined,
      regen: undefined,
    });

    expect(t.LmuVirtualEnergy).toBeUndefined();
    expect(t.LmuStateOfCharge).toBeUndefined();
    expect(t.LmuRegen).toBeUndefined();
  });
});

describe('mapLmuTelemetry class position', () => {
  it('ranks a practice session by best lap time, within class', () => {
    // Session 1 is practice. Best laps are 134.5, 132.8, 137.1 and the classes
    // are [0, 0, 1], so slot 1 leads class 0 ahead of slot 0, and slot 2 is
    // alone in class 1.
    const t = mapLmuTelemetry(fixture());
    const positions = t.CarIdxClassPosition.value as number[];

    expect(positions).toEqual([2, 1, 1]);
  });

  it('does not simply echo the slot order', () => {
    // The symptom this guards: a column counting 1,2,3 down the car list
    // regardless of who is quickest.
    const t = mapLmuTelemetry(fixture());
    const positions = t.CarIdxClassPosition.value as number[];

    expect(positions).not.toEqual([1, 2, 3]);
  });

  it('publishes a non-empty array, so the fallback is not reached', () => {
    // Empty means useDriverPositions falls through to the qualifying grid,
    // which under LMU practice is entry order.
    const t = mapLmuTelemetry(fixture());

    expect((t.CarIdxClassPosition.value as number[]).length).toBeGreaterThan(0);
  });
});

describe('mapLmuTelemetry outright position', () => {
  it('orders practice by best lap, not by the entry order LMU reports', () => {
    // The symptom: the standings sort rows on CarIdxPosition, so while this
    // echoed mPlace the class column was right and the list still read as
    // car-number order. Fixture best laps are 134.5, 132.8, 137.1.
    const t = mapLmuTelemetry(fixture());

    expect(t.CarIdxPosition.value).toEqual([2, 1, 3]);
  });

  it('keeps the sim-reported places in a race', () => {
    // mPlace already accounts for laps completed and sector order, which a
    // best-lap sort would throw away.
    const raw = {
      ...fixture(),
      session: 10,
      vehPlaces: new Int32Array([3, 1, 2]),
    };

    const t = mapLmuTelemetry(raw);

    expect(t.CarIdxPosition.value).toEqual([3, 1, 2]);
  });

  it('agrees with the class column about who is ahead', () => {
    // Both come from one ordering pass, so they cannot disagree.
    const t = mapLmuTelemetry(fixture());
    const outright = t.CarIdxPosition.value as number[];
    const inClass = t.CarIdxClassPosition.value as number[];

    // Slot 1 leads class 0 and is also outright first.
    expect(inClass[1]).toBe(1);
    expect(outright[1]).toBe(1);
    expect(outright[0]).toBeGreaterThan(outright[1]);
  });
});

describe('mapLmuTelemetry adjustable dials', () => {
  // Several of these dc* channels are absent from the generated Telemetry
  // type, which covers only the variables iRacing's own capture listed.
  // CarSystemsProcessor reads them by string key, so this does too.
  const dial = (t: ReturnType<typeof mapLmuTelemetry>, key: string) =>
    (t as unknown as Record<string, { value: unknown[] } | undefined>)[key];

  it('publishes a dial the car has', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      abs: 4,
      absMax: 10,
      motorMap: 3,
      motorMapMax: 9,
      frontAntiSway: 2,
      frontAntiSwayMax: 5,
      rearAntiSway: 1,
      rearAntiSwayMax: 5,
    });

    expect(dial(t, 'dcABS')?.value[0]).toBe(4);
    expect(dial(t, 'dcEnginePower')?.value[0]).toBe(3);
    expect(dial(t, 'dcAntiRollFront')?.value[0]).toBe(2);
    expect(dial(t, 'dcAntiRollRear')?.value[0]).toBe(1);
  });

  it('omits a dial the car does not have', () => {
    // Setting and max both zero is how LMU reports a control that is not
    // fitted. Publishing it would give the car a row reading "off" forever,
    // and the row is latched for the session once discovered.
    const t = mapLmuTelemetry({ ...fixture(), abs: 0, absMax: 0 });

    expect(dial(t, 'dcABS')).toBeUndefined();
  });

  it('keeps a dial the driver has switched off', () => {
    const t = mapLmuTelemetry({ ...fixture(), abs: 0, absMax: 10 });

    expect(dial(t, 'dcABS')?.value[0]).toBe(0);
  });

  it('fills the traction slots in order', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      tc: 5,
      tcMax: 11,
      tcSlip: 3,
      tcSlipMax: 6,
    });

    expect(dial(t, 'dcTractionControl')?.value[0]).toBe(5);
    expect(dial(t, 'dcTractionControl2')?.value[0]).toBe(3);
  });

  it('starts at the first traction slot when the car has no overall level', () => {
    // A car offering only slip and cut would otherwise leave the TC column
    // blank and show its first dial under TC2.
    const t = mapLmuTelemetry({
      ...fixture(),
      tcSlip: 3,
      tcSlipMax: 6,
      tcCut: 2,
      tcCutMax: 6,
    });

    expect(dial(t, 'dcTractionControl')?.value[0]).toBe(3);
    expect(dial(t, 'dcTractionControl2')?.value[0]).toBe(2);
  });

  it('drops the third traction dial rather than inventing a slot', () => {
    const t = mapLmuTelemetry({
      ...fixture(),
      tc: 5,
      tcMax: 11,
      tcSlip: 3,
      tcSlipMax: 6,
      tcCut: 2,
      tcCutMax: 6,
    });

    expect(dial(t, 'dcTractionControl')?.value[0]).toBe(5);
    expect(dial(t, 'dcTractionControl2')?.value[0]).toBe(3);
  });

  it('publishes no traction row for a car with no traction control', () => {
    const t = mapLmuTelemetry(fixture());

    expect(dial(t, 'dcTractionControl')).toBeUndefined();
    expect(dial(t, 'dcTractionControl2')).toBeUndefined();
  });
});
