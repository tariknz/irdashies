import { describe, expect, it } from 'vitest';
import { CarLeftRight } from '@irdashies/types';
import type { LmuRawTelemetry } from '../native/lmu';
import { mapLmuSectorTimes, mapLmuTelemetry } from './mapTelemetry';

function fixture(): LmuRawTelemetry {
  return {
    running: true,
    gameVersion: 1902,
    trackName: 'Spa Francorchamps',
    playerName: 'Alonso',
    serverName: 'Server',
    session: 1,
    currentET: 1250.5,
    endET: 3600,
    maxLaps: 12,
    lapDist: 7004,
    numVehicles: 3,
    gamePhase: 4,
    yellowFlagState: 0,
    sectorFlags: new Uint8Array([0, 0, 0]),
    inRealtime: true,
    gameMode: 3,
    isFixedSetup: false,
    maxPlayers: 60,
    sessionTimeRemaining: 2349.5,
    timeOfDay: 0.45,
    trackGripLevel: 1,
    cloudCoverage: 20,
    raining: 0,
    darkCloud: 0,
    ambientTemp: 23.5,
    trackTemp: 31.2,
    minPathWetness: 0,
    maxPathWetness: 0,
    avgPathWetness: 0.05,
    wind: [2, 0, -3],
    playerVehicleIdx: 1,
    playerHasVehicle: true,
    activeVehicles: 2,
    gear: 5,
    engineRPM: 8200,
    engineWaterTemp: 95,
    engineOilTemp: 110,
    clutchRPM: 8200,
    unfilteredThrottle: 0.8,
    unfilteredBrake: 0,
    unfilteredSteering: -0.3,
    unfilteredClutch: 0,
    filteredThrottle: 0.79,
    filteredBrake: 0,
    filteredSteering: -0.29,
    filteredClutch: 0,
    steeringShaftTorque: 1.2,
    fuel: 42,
    fuelCapacity: 110,
    engineMaxRPM: 9000,
    rearBrakeBias: 0.55,
    lapNumber: 3,
    elapsedTime: 250.4,
    lapStartET: 200,
    currentSector: 1,
    lapInvalidated: false,
    speedLimiterActive: false,
    speedLimiter: 0,
    absActive: 1,
    tcActive: 0,
    ignitionStarter: 0,
    maxGears: 6,
    visualSteeringWheelRange: 480,
    deltaBest: 0.2,
    batteryChargeFraction: 1,
    turboBoostPressure: 0,
    frontTireCompoundName: 'Dry',
    vehicleName: 'Ferrari 296 GT3',
    speed: 51.234,
    localVel: [50, 0, 11],
    localAccel: [9.80665, 0, -19.6133],
    pos: [0, 0, 0],
    tyreTemperature: new Float64Array([80, 81, 82, 83]),
    tyrePressure: new Float64Array([180, 181, 182, 183]),
    tyreWear: new Float64Array([0.9, 0.8, 0.7, 0.6]),
    brakePressure: new Float64Array([0.4, 0.5, 0.3, 0.35]),
    suspensionDeflection: new Float64Array([0.04, 0.05, 0.06, 0.07]),
    vehIds: [0, 1, 1],
    vehIsPlayer: [0, 1, 0],
    vehPlaces: [2, 1, 3],
    vehLapDistPct: [0.4, 0.6, 0.2],
    vehTotalLaps: [2, 3, 1],
    vehBestLapTime: [134.5, 132.8, 137.1],
    vehLastLapTime: [135.6, 133.4, 138.9],
    vehInPits: [0, 0, 1],
    vehInGarageStall: [0, 0, 0],
    vehPitState: [0, 0, 3],
    vehClass: [0, 0, 1],
    vehTimeIntoLap: [50, 60, 20],
    vehEstimatedLapTime: [134, 132, 136],
    vehTimeBehindNext: [1.2, 3.4, 5.6],
    vehTimeBehindLeader: [0, 1.2, 10.5],
    vehLapsBehindNext: [0, 0, 1],
    vehLapsBehindLeader: [0, 0, 1],
    vehQualification: [0, 132.1, 0],
    vehFinishStatus: [0, 0, 0],
    vehIndividualPhase: [10, 9, 8],
    vehLapStartET: [1000, 1100, 900],
    vehSector: [1, 2, 0],
    vehFlag: [0, 0, 6],
    vehUnderYellow: [0, 0, 0],
    vehBestSector1: [32.5, 32.1, 40.1],
    vehBestSector2: [73.7, 72.9, 91.6],
    vehLastSector1: [33.1, 32.4, 41],
    vehLastSector2: [75.1, 73.4, 93],
    vehCurSector1: [-1, 32.8, -1],
    vehCurSector2: [-1, 74.2, -1],
    vehTelemetryAvailable: [1, 1, 1],
    vehPosX: [3, 0, 20],
    vehPosZ: [0, 0, 20],
    vehOriX: [0, 0, 0],
    vehOriZ: [1, 1, 1],
  } as unknown as LmuRawTelemetry;
}

describe('mapLmuTelemetry', () => {
  it('maps session scalars', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.SessionTick.value[0]).toBe(1250.5);
    expect(t.SessionTime.value[0]).toBe(1250.5);
    expect(t.SessionTimeTotal.value[0]).toBe(3600);
    expect(t.SessionTimeRemain.value[0]).toBe(2349.5);
    expect(t.SessionLapsTotal.value[0]).toBe(12);
    expect(t.SessionLapsRemain.value[0]).toBe(9);
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
    expect(t.BrakeABSactive.value[0]).toBe(true);
    expect(t.Speed).toBeDefined();
    expect(t.SteeringWheelAngle.value[0]).toBeCloseTo(
      0.29 * ((480 * Math.PI) / 360)
    );
    expect(t.dcBrakeBias.value[0]).toBeCloseTo(0.45);
    expect(t.dcPitSpeedLimiterToggle.value[0]).toBe(false);
    expect(t.LatAccel.value[0]).toBeCloseTo(9.80665);
    expect(t.LongAccel.value[0]).toBeCloseTo(-19.6133);
    expect(t.LFtempCL.value[0]).toBe(80);
    expect(t.RRcoldPressure.value[0]).toBe(183);
    expect(t.LRwearM.value[0]).toBe(0.7);
    expect(t.RFbrakeLinePress.value[0]).toBe(0.5);
    expect(t.RRshockDefl.value[0]).toBe(0.07);
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
  });

  it('maps per-car arrays by slot', () => {
    const t = mapLmuTelemetry(fixture());
    expect(t.CarIdxPosition.value).toEqual([2, 1, 3]);
    expect(t.CarIdxLapDistPct.value).toEqual([0.4, 0.6, 0.2]);
    expect(t.CarIdxLap.value).toEqual([2, 3, 1]);
    expect(t.CarIdxClass.value).toEqual([0, 0, 1]);
    expect(t.CarIdxBestLapTime.value).toEqual([134.5, 132.8, 137.1]);
    expect(t.CarIdxOnPitRoad.value).toEqual([false, false, true]);
    expect(t.CarIdxTrackSurface.value).toEqual([4, 4, 1]);
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
