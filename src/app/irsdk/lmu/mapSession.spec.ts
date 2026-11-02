import { describe, expect, it } from 'vitest';
import type { LmuRawSession } from '../native/lmu';
import {
  deriveLmuShiftLightRpm,
  mapLmuSession,
  resolveLmuCarId,
  resolveLmuTrackId,
} from './mapSession';

function fixture(): LmuRawSession {
  return {
    running: true,
    gameVersion: 1902,
    trackName: 'Spa Francorchamps',
    session: 2,
    maxLaps: 12,
    lapDist: 7004,
    numVehicles: 3,
    gamePhase: 4,
    cloudCoverage: 10,
    raining: 0,
    ambientTemp: 23.5,
    trackTemp: 31,
    wind: [2, 0, -3],
    engineMaxRPM: 9000,
    fuelCapacity: 110,
    maxGears: 6,
    classes: [
      { id: 0, name: 'GT3' },
      { id: 1, name: 'GTE' },
    ],
    drivers: [
      {
        id: 0,
        isPlayer: false,
        name: 'Driver A',
        vehicleName: 'Team WRT 2026 #32:WEC',
        vehicleModel: 'BMW M4 GT3',
        className: 'GT3',
        vehFilename: 'ferrari_296_gt3',
        classId: 0,
        totalLaps: 2,
        sector: 1,
        finishStatus: 0,
        lapDist: 2801,
        bestSector1: 32.5,
        bestSector2: 41.2,
        bestLapTime: 134.5,
        lastSector1: 33.1,
        lastSector2: 42.0,
        lastLapTime: 135.6,
        numPitstops: 1,
        numPenalties: 0,
        inPits: 0,
        place: 2,
        timeBehindNext: 3.4,
        lapsBehindNext: 0,
        timeBehindLeader: 10.5,
        lapsBehindLeader: 1,
        qualification: 2,
        timeIntoLap: 50,
        estimatedLapTime: 134,
        pitState: 0,
        individualPhase: 10,
        underYellow: 0,
        countLapFlag: 1,
        inGarageStall: 0,
        pitLapDist: 0,
        steamId: 111,
        fuelFraction: 0.5,
      },
      {
        id: 1,
        isPlayer: true,
        name: 'Driver B',
        vehicleName: 'Ferrari 296 GT3',
        vehicleModel: 'Ferrari 296 GT3',
        className: 'GT3',
        vehFilename: 'ferrari_296_gt3',
        classId: 0,
        totalLaps: 3,
        sector: 1,
        finishStatus: 0,
        lapDist: 4202,
        bestSector1: 32.1,
        bestSector2: 40.8,
        bestLapTime: 132.8,
        lastSector1: 32.4,
        lastSector2: 41.0,
        lastLapTime: 133.4,
        numPitstops: 0,
        numPenalties: 0,
        inPits: 0,
        place: 1,
        timeBehindNext: Infinity,
        lapsBehindNext: 0,
        timeBehindLeader: 0,
        lapsBehindLeader: 0,
        qualification: 1,
        timeIntoLap: 60,
        estimatedLapTime: 132,
        pitState: 0,
        individualPhase: 9,
        underYellow: 0,
        countLapFlag: 1,
        inGarageStall: 0,
        pitLapDist: 0,
        steamId: 222,
        fuelFraction: 0.4,
      },
      {
        id: 3,
        isPlayer: false,
        name: 'Driver C',
        vehicleName: 'Porsche 911 RSR',
        vehicleModel: 'Porsche 911 RSR',
        className: 'GTE',
        vehFilename: 'porsche_911_rsr',
        classId: 1,
        totalLaps: 1,
        sector: 2,
        finishStatus: 0,
        lapDist: 1400,
        bestSector1: 40.1,
        bestSector2: 51.5,
        bestLapTime: 165.2,
        lastSector1: 41.0,
        lastSector2: 52.0,
        lastLapTime: 166.0,
        numPitstops: 0,
        numPenalties: 0,
        inPits: 0,
        place: 3,
        timeBehindNext: 5.6,
        lapsBehindNext: 1,
        timeBehindLeader: -1,
        lapsBehindLeader: 0,
        qualification: 0,
        timeIntoLap: 20,
        estimatedLapTime: 164,
        pitState: 0,
        individualPhase: 8,
        underYellow: 0,
        countLapFlag: 1,
        inGarageStall: 0,
        pitLapDist: 0,
        steamId: 333,
        fuelFraction: 0.7,
      },
    ],
  } as unknown as LmuRawSession;
}

describe('mapLmuSession', () => {
  it('maps weekend info', () => {
    const s = mapLmuSession(fixture());
    expect(s.WeekendInfo.TrackName).toBe('Spa Francorchamps');
    expect(s.WeekendInfo.TrackID).toBe(resolveLmuTrackId('Spa Francorchamps'));
    expect(s.WeekendInfo.TrackDisplayName).toBe('Spa Francorchamps');
    expect(s.WeekendInfo.TrackLength).toBe('7004 m');
    expect(s.WeekendInfo.SubSessionID).toBe(2);
    expect(s.WeekendInfo.NumCarClasses).toBe(2);
    expect(s.WeekendInfo.NumCarTypes).toBe(3);
  });

  it('maps a calibrated live pit speed limit', () => {
    expect(
      mapLmuSession(fixture(), null, 80 / 3.6).WeekendInfo.TrackPitSpeedLimit
    ).toBe('80.00 kph');
    expect(mapLmuSession(fixture()).WeekendInfo.TrackPitSpeedLimit).toBe('');
  });

  it('maps driver info with the player flagged', () => {
    const s = mapLmuSession(fixture());
    expect(s.DriverInfo.DriverCarIdx).toBe(1);
    expect(s.DriverInfo.Drivers).toHaveLength(3);
    const player = s.DriverInfo.Drivers[1];
    expect(player.CarIdx).toBe(1);
    expect(player.UserName).toBe('Driver B');
    expect(player.CarScreenName).toBe('Ferrari 296 GT3');
    expect(player.CarID).toBe(10006);
    expect(s.DriverInfo.Drivers[0].CarID).toBe(10003);
    expect(player.CarClassShortName).toBe('GT3');
    expect(player.CarClassID).toBe(0);
    expect(s.DriverInfo.DriverCarRedLine).toBe(9000);
  });

  it('flags only AI-controlled cars as AI', () => {
    const raw = fixture();
    raw.drivers[0].control = 1;
    raw.drivers[1].control = 0;
    raw.drivers[2].control = 2;

    const drivers = mapLmuSession(raw).DriverInfo.Drivers;

    expect(drivers.map((d) => d.CarIsAIControlled)).toEqual([
      true,
      false,
      false,
    ]);
    expect(drivers.map((d) => d.CarIsAI)).toEqual([1, 0, 0]);
  });

  it('leaves AI state unknown when the addon does not report control', () => {
    const drivers = mapLmuSession(fixture()).DriverInfo.Drivers;

    expect(drivers.every((d) => d.CarIsAIControlled === undefined)).toBe(true);
    expect(drivers.every((d) => d.CarIsAI === 0)).toBe(true);
  });

  it('derives LMU shift lights from the engine limit', () => {
    expect(deriveLmuShiftLightRpm(9000)).toEqual({
      first: 8190,
      shift: 8550,
      last: 8730,
      blink: 8730,
    });
    expect(deriveLmuShiftLightRpm(0)).toEqual({
      first: 7735,
      shift: 8075,
      last: 8245,
      blink: 8245,
    });

    const driverInfo = mapLmuSession(fixture()).DriverInfo;
    expect(driverInfo.DriverCarSLFirstRPM).toBe(8190);
    expect(driverInfo.DriverCarSLShiftRPM).toBe(8550);
    expect(driverInfo.DriverCarSLLastRPM).toBe(8730);
    expect(driverInfo.DriverCarSLBlinkRPM).toBe(8730);
  });

  it.each([
    'Alpine A424',
    'Peugeot 9X8',
    'Lexus RC F GT3',
    'Genesis GMR-001',
    'Duqueine M30-D08',
    'Ginetta G61-LT-P3',
    'ADESS AD03 Evo',
    'Unknown Prototype',
  ])('leaves the unsupported LMU model %s without a logo id', (model) => {
    expect(resolveLmuCarId(model)).toBe(0);
  });

  it.each(['Ligier JS P320', 'Ligier JS P320 Nissan', 'Ligier JSP320'])(
    'resolves the LMP3 Ligier model %s',
    (model) => {
      expect(resolveLmuCarId(model)).toBe(10013);
    }
  );

  it('does not let LMP3 models collide with Hypercar or LMGT3 brands', () => {
    const lmp3 = ['Ligier JS P320', 'Duqueine M30-D08', 'ADESS AD03 Evo'].map(
      resolveLmuCarId
    );
    const others = [
      'Ferrari 499P',
      'Porsche 963',
      'Toyota GR010 Hybrid',
      'Cadillac V-Series.R',
      'BMW M Hybrid V8',
      'Aston Martin Valkyrie',
      'Ferrari 296 GT3',
      'Ford Mustang GT3',
      'Chevrolet Corvette Z06 GT3.R',
      'McLaren 720S GT3 Evo',
      'Lamborghini Huracan GT3 Evo2',
      'Mercedes-AMG GT3',
    ].map(resolveLmuCarId);

    expect(others).toEqual([
      10006, 10011, 10012, 10004, 10003, 10001, 10006, 10007, 10005, 10009,
      10008, 10010,
    ]);
    expect(lmp3.filter((id) => others.includes(id) && id !== 0)).toEqual([]);
  });

  it('builds qualifying results with per-class ranking', () => {
    const s = mapLmuSession(fixture());
    const qualy = s.QualifyResultsInfo?.Results ?? [];
    expect(qualy.map((r) => [r.CarIdx, r.Position, r.ClassPosition])).toEqual([
      [1, 1, 1],
      [0, 2, 2],
    ]);
  });

  it('skips drivers without a qualification time', () => {
    const s = mapLmuSession(fixture());
    expect(
      (s.QualifyResultsInfo?.Results ?? []).some((r) => r.CarIdx === 3)
    ).toBe(false);
  });

  it('shapes the session info list', () => {
    const s = mapLmuSession(fixture());
    expect(s.SessionInfo.Sessions).toHaveLength(1);
    expect(s.SessionInfo.Sessions[0].SessionLaps).toBe('12');
    expect(s.SessionInfo.Sessions[0].QualifyPositions).toHaveLength(2);
    expect(s.SplitTimeInfo.Sectors).toEqual([
      { SectorNum: 0, SectorStartPct: 0 },
      { SectorNum: 1, SectorStartPct: 1 / 3 },
      { SectorNum: 2, SectorStartPct: 2 / 3 },
    ]);
  });

  it('gives each LMU track a stable simulator-specific id', () => {
    expect(resolveLmuTrackId('Imola')).toBe(resolveLmuTrackId(' imola '));
    expect(resolveLmuTrackId('Imola')).not.toBe(resolveLmuTrackId('Lusail'));
    expect(resolveLmuTrackId('Imola')).toBeGreaterThanOrEqual(1_000_000);
  });

  it('includes a recorded LMU track map when available', () => {
    const trackMap = {
      active: {
        inside: 'M0,0 L1,1 Z',
        outside: 'M0,0 L1,1 Z',
        trackPathPoints: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
        totalLength: 1,
      },
      startFinish: {
        line: 'M0,-1 L0,1',
        point: { x: 0, y: 0, length: 0 },
        direction: 'anticlockwise' as const,
      },
    };

    expect(mapLmuSession(fixture(), trackMap).LmuTrackMap).toEqual(trackMap);
  });

  it.each([
    [0, 'Offline Testing'],
    [1, 'Practice'],
    [4, 'Practice'],
    [5, 'Open Qualify'],
    [8, 'Open Qualify'],
    [9, 'Practice'],
    [10, 'Race'],
    [13, 'Race'],
  ])('maps LMU session %i to %s', (session, expected) => {
    const s = mapLmuSession({ ...fixture(), session });
    expect(s.SessionInfo.Sessions[0].SessionType).toBe(expected);
  });
});
