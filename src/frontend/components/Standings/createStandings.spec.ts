import { describe, it, expect } from 'vitest';
import {
  createDriverStandings,
  groupStandingsByClass,
  sliceRelevantDrivers,
  augmentStandingsWithPositionChange,
} from './createStandings';
import type { Standings } from './createStandings';
import type { Session, Telemetry, SessionInfo, Driver } from '@irdashies/types';

describe('createStandings', () => {
  const mockSessionData: Session = {
    DriverInfo: {
      DriverCarIdx: 1,
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Driver 1',
          CarNumber: '1',
          CarClassID: 1,
          CarClassShortName: 'Class 1',
          CarClassRelSpeed: 1.0,
        },
        {
          CarIdx: 1,
          UserName: 'Driver 2',
          CarNumber: '2',
          CarClassID: 2,
          CarClassShortName: 'Class 2',
          CarClassRelSpeed: 0.9,
        },
      ],
    },
    SessionInfo: {
      Sessions: [
        {
          SessionType: 'Race',
          ResultsPositions: [
            {
              CarIdx: 0,
              ClassPosition: 0,
              FastestTime: 100,
              LastTime: 105,
            },
            {
              CarIdx: 1,
              ClassPosition: 1,
              FastestTime: 110,
              LastTime: 115,
            },
          ],
          ResultsFastestLap: [
            {
              CarIdx: 0,
              FastestTime: 100,
            },
          ],
        },
      ],
    },
  } as Session;

  const mockTelemetry: Telemetry = {
    CarIdxF2Time: {
      value: [0, 10],
    },
  } as Telemetry;

  const mockCurrentSession: SessionInfo =
    mockSessionData.SessionInfo.Sessions[0];

  it('should create standings with correct data', () => {
    const standings = createStandings(
      mockSessionData,
      mockTelemetry,
      mockCurrentSession
    );
    expect(standings).toHaveLength(2);
    expect(standings[0][1][0].driver.name).toBe('Driver 1');
    expect(standings[0][1][0].delta).toBe(0);
    expect(standings[1][1][0].driver.name).toBe('Driver 2');
    expect(standings[1][1][0].delta).toBe(10);
  });

  it('should group standings by class', () => {
    const standings = createStandings(
      mockSessionData,
      mockTelemetry,
      mockCurrentSession
    );
    expect(standings).toHaveLength(2);
    expect(standings[0][0]).toBe('1');
    expect(standings[1][0]).toBe('2');
  });

  it('should slice relevant drivers correctly', () => {
    const standings = createStandings(
      mockSessionData,
      mockTelemetry,
      mockCurrentSession
    );
    expect(standings[0][1]).toHaveLength(1);
    expect(standings[1][1]).toHaveLength(1);
  });

  it('should show as on pit road when CarIdx is in PitRoadLane', () => {
    const mockTelemetryWithPitRoad = {
      ...mockTelemetry,
      CarIdxOnPitRoad: {
        value: [true],
      },
    } as Telemetry;

    const standings = createStandings(
      mockSessionData,
      mockTelemetryWithPitRoad,
      mockCurrentSession
    );

    expect(standings[0][1][0].onPitRoad).toBe(true);
  });

  it('should not show as on pit road when not in CarIdxOnPitRoad', () => {
    const mockTelemetryWithPitRoad = {
      ...mockTelemetry,
      CarIdxOnPitRoad: {
        value: [false],
      },
    } as Telemetry;

    const standings = createStandings(
      mockSessionData,
      mockTelemetryWithPitRoad,
      mockCurrentSession
    );

    expect(standings[0][1][0].onPitRoad).toBe(false);
  });

  it('should show as onTrack when CarIdxTrackSurface is positive', () => {
    const mockTelemetryWithConnected = {
      ...mockTelemetry,
      CarIdxTrackSurface: {
        value: [1],
      },
    } as Telemetry;

    const standings = createStandings(
      mockSessionData,
      mockTelemetryWithConnected,
      mockCurrentSession
    );

    expect(standings[0][1][0].onTrack).toBe(true);
  });

  it('should show all drivers from session when no results positions exist yet, sorted by car number', () => {
    const sessionWithNoResults: Session = {
      DriverInfo: {
        DriverCarIdx: 2,
        Drivers: [
          {
            CarIdx: 2,
            UserName: 'Driver B',
            CarNumber: '42',
            CarClassID: 1,
            CarClassShortName: 'Class 1',
            CarClassRelSpeed: 1.0,
            IRating: 1800,
            LicString: 'B 3.50',
            CarIsPaceCar: 0,
            IsSpectator: 0,
          },
          {
            CarIdx: 0,
            UserName: 'Driver A',
            CarNumber: '3',
            CarClassID: 1,
            CarClassShortName: 'Class 1',
            CarClassRelSpeed: 1.0,
            IRating: 2000,
            LicString: 'A 4.99',
            CarIsPaceCar: 0,
            IsSpectator: 0,
          },
          {
            CarIdx: 1,
            UserName: 'Driver C',
            CarNumber: '7',
            CarClassID: 1,
            CarClassShortName: 'Class 1',
            CarClassRelSpeed: 1.0,
            IRating: 1500,
            LicString: 'B 2.00',
            CarIsPaceCar: 0,
            IsSpectator: 0,
          },
        ],
      },
      SessionInfo: {
        Sessions: [
          {
            SessionType: 'Race',
            ResultsPositions: [],
            ResultsFastestLap: [],
          },
        ],
      },
    } as unknown as Session;

    const standings = createDriverStandings(
      {
        playerIdx: 2,
        drivers: sessionWithNoResults.DriverInfo.Drivers,
      },
      {},
      {
        resultsPositions: [],
        resultsFastestLap: [],
        sessionType: 'Race',
      },
      [],
      [],
      []
    );

    expect(standings).toHaveLength(3);
    // Sorted by car number: 3, 7, 42
    expect(standings[0].driver.carNum).toBe('3');
    expect(standings[0].driver.name).toBe('Driver A');
    expect(standings[0].position).toBe(1);
    expect(standings[1].driver.carNum).toBe('7');
    expect(standings[1].driver.name).toBe('Driver C');
    expect(standings[1].position).toBe(2);
    expect(standings[2].driver.carNum).toBe('42');
    expect(standings[2].driver.name).toBe('Driver B');
    expect(standings[2].position).toBe(3);
    expect(standings[2].isPlayer).toBe(true);
  });

  it('should show drivers with laps first, then drivers without laps sorted by car number', () => {
    const makeDriver = (carIdx: number, carNumber: string) => ({
      CarIdx: carIdx,
      UserName: `Driver ${carNumber}`,
      CarNumber: carNumber,
      CarClassID: 1,
      CarClassShortName: 'Class 1',
      CarClassRelSpeed: 1.0,
      IRating: 1500,
      LicString: 'B 2.00',
      CarIsPaceCar: 0,
      IsSpectator: 0,
    });

    // Cars 5 and 8 have done a lap and appear in resultsPositions.
    // Cars 1-4 and 6 haven't done a lap so they are absent from resultsPositions.
    const standings = createDriverStandings(
      {
        playerIdx: 0,
        drivers: [1, 2, 3, 4, 5, 6, 8].map((n) =>
          makeDriver(n, String(n))
        ) as unknown as Driver[],
      },
      {},
      {
        resultsPositions: [
          // Car 8 is faster
          {
            CarIdx: 8,
            Position: 1,
            ClassPosition: 0,
            FastestTime: 90,
            LastTime: 90,
            LapsComplete: 1,
          },
          {
            CarIdx: 5,
            Position: 2,
            ClassPosition: 1,
            FastestTime: 95,
            LastTime: 95,
            LapsComplete: 1,
          },
        ] as unknown as SessionInfo['ResultsPositions'],
        resultsFastestLap: [{ CarIdx: 8, FastestLap: 1, FastestTime: 90 }],
        sessionType: 'Practice',
      },
      [],
      [],
      []
    );

    // First come the cars with laps, ordered by position
    expect(standings[0].driver.carNum).toBe('8');
    expect(standings[1].driver.carNum).toBe('5');
    // Then cars without laps, sorted by car number ascending
    expect(standings[2].driver.carNum).toBe('1');
    expect(standings[3].driver.carNum).toBe('2');
    expect(standings[4].driver.carNum).toBe('3');
    expect(standings[5].driver.carNum).toBe('4');
    expect(standings[6].driver.carNum).toBe('6');
  });

  it('should exclude pace car and spectators from fallback standings', () => {
    const sessionWithPaceCar: Session = {
      DriverInfo: {
        DriverCarIdx: 1,
        Drivers: [
          {
            CarIdx: 0,
            UserName: 'Pace Car',
            CarNumber: '0',
            CarClassID: 1,
            CarClassShortName: 'Class 1',
            CarClassRelSpeed: 1.0,
            CarIsPaceCar: 1,
            IsSpectator: 0,
          },
          {
            CarIdx: 1,
            UserName: 'Driver 1',
            CarNumber: '1',
            CarClassID: 1,
            CarClassShortName: 'Class 1',
            CarClassRelSpeed: 1.0,
            CarIsPaceCar: 0,
            IsSpectator: 0,
          },
          {
            CarIdx: 2,
            UserName: 'Spectator',
            CarNumber: '99',
            CarClassID: 1,
            CarClassShortName: 'Class 1',
            CarClassRelSpeed: 1.0,
            CarIsPaceCar: 0,
            IsSpectator: 1,
          },
        ],
      },
      SessionInfo: {
        Sessions: [
          {
            SessionType: 'Race',
            ResultsPositions: [],
            ResultsFastestLap: [],
          },
        ],
      },
    } as unknown as Session;

    const standings = createDriverStandings(
      {
        playerIdx: 1,
        drivers: sessionWithPaceCar.DriverInfo.Drivers,
      },
      {},
      {
        resultsPositions: [],
        resultsFastestLap: [],
        sessionType: 'Race',
      },
      [],
      [],
      []
    );

    expect(standings).toHaveLength(1);
    expect(standings[0].driver.name).toBe('Driver 1');
  });

  describe('augmentStandingsWithPositionChange', () => {
    const makeStanding = (carIdx: number, classPosition: number): Standings =>
      ({
        carIdx,
        classPosition,
        isPlayer: false,
        driver: {
          name: `Driver ${carIdx}`,
          carNum: `${carIdx}`,
          license: 'A',
          rating: 1000,
        },
        carClass: {
          id: 1,
          color: 0,
          name: 'GT3',
          relativeSpeed: 1,
          estLapTime: 0,
        },
      }) as Standings;

    it('should return standings unchanged when no qualifying results', () => {
      const grouped: [string, Standings[]][] = [
        ['1', [makeStanding(0, 1), makeStanding(1, 2)]],
      ];
      const result = augmentStandingsWithPositionChange(grouped, undefined);
      expect(result[0][1][0].positionChange).toBeUndefined();
      expect(result[0][1][1].positionChange).toBeUndefined();
    });

    it('should return standings unchanged when qualifying results are empty', () => {
      const grouped: [string, Standings[]][] = [['1', [makeStanding(0, 1)]]];
      const result = augmentStandingsWithPositionChange(grouped, []);
      expect(result[0][1][0].positionChange).toBeUndefined();
    });

    it('should calculate positive positionChange when driver moved up', () => {
      // Started P3, now P1 → +2
      const grouped: [string, Standings[]][] = [['1', [makeStanding(0, 1)]]];
      const qualifyingResults = [{ CarIdx: 0, ClassPosition: 2 }] as never;
      const result = augmentStandingsWithPositionChange(
        grouped,
        qualifyingResults
      );
      expect(result[0][1][0].positionChange).toBe(2); // qualifyPos(3) - currentPos(1) = +2
    });

    it('should calculate negative positionChange when driver dropped back', () => {
      // Started P1, now P3 → -2
      const grouped: [string, Standings[]][] = [['1', [makeStanding(0, 3)]]];
      const qualifyingResults = [{ CarIdx: 0, ClassPosition: 0 }] as never;
      const result = augmentStandingsWithPositionChange(
        grouped,
        qualifyingResults
      );
      expect(result[0][1][0].positionChange).toBe(-2); // qualifyPos(1) - currentPos(3) = -2
    });

    it('should return zero positionChange when position unchanged', () => {
      const grouped: [string, Standings[]][] = [['1', [makeStanding(0, 2)]]];
      const qualifyingResults = [{ CarIdx: 0, ClassPosition: 1 }] as never;
      const result = augmentStandingsWithPositionChange(
        grouped,
        qualifyingResults
      );
      expect(result[0][1][0].positionChange).toBe(0);
    });

    it('should leave positionChange undefined for cars not in qualifying results', () => {
      const grouped: [string, Standings[]][] = [
        ['1', [makeStanding(0, 1), makeStanding(99, 2)]],
      ];
      const qualifyingResults = [{ CarIdx: 0, ClassPosition: 0 }] as never;
      const result = augmentStandingsWithPositionChange(
        grouped,
        qualifyingResults
      );
      expect(result[0][1][0].positionChange).toBe(0);
      expect(result[0][1][1].positionChange).toBeUndefined();
    });

    it('should handle multiple classes independently', () => {
      const grouped: [string, Standings[]][] = [
        ['1', [makeStanding(0, 1), makeStanding(1, 2)]],
        ['2', [makeStanding(2, 1), makeStanding(3, 2)]],
      ];
      const qualifyingResults = [
        { CarIdx: 0, ClassPosition: 1 }, // started P2, now P1 → +1
        { CarIdx: 1, ClassPosition: 0 }, // started P1, now P2 → -1
        { CarIdx: 2, ClassPosition: 0 }, // started P1, now P1 → 0
        { CarIdx: 3, ClassPosition: 2 }, // started P3, now P2 → +1
      ] as never;
      const result = augmentStandingsWithPositionChange(
        grouped,
        qualifyingResults
      );
      expect(result[0][1][0].positionChange).toBe(1);
      expect(result[0][1][1].positionChange).toBe(-1);
      expect(result[1][1][0].positionChange).toBe(0);
      expect(result[1][1][1].positionChange).toBe(1);
    });
  });

  describe('sliceRelevantDrivers', () => {
    interface DummyStanding {
      name: string;
      isPlayer?: boolean;
    }
    it("should return only top 3 drivers for classes outside of player's class", () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '4. David' },
            { name: '5. Eve' },
          ],
        ],
        [
          'GT4',
          [
            { name: '1. Clark' },
            { name: '2. Richard' },
            { name: '3. Sam' },
            { name: '4. Bingo' },
            { name: '5. Tod', isPlayer: true },
          ],
        ],
      ];

      const filteredDrivers = sliceRelevantDrivers(results, 'GT4');

      expect(filteredDrivers).toEqual([
        [
          'GT3',
          [{ name: '1. Bob' }, { name: '2. Alice' }, { name: '3. Charlie' }],
        ],
        [
          'GT4',
          [
            { name: '1. Clark' },
            { name: '2. Richard' },
            { name: '3. Sam' },
            { name: '4. Bingo' },
            { name: '5. Tod', isPlayer: true },
          ],
        ],
      ]);
    });

    it("should return all player's class even when player is not in standings", () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '4. David' },
            { name: '5. Eve' },
          ],
        ],
        [
          'GT4',
          [
            { name: '1. Clark' },
            { name: '2. Richard' },
            { name: '3. Sam' },
            { name: '4. Bingo' },
            { name: '5. Tod' },
            { name: '6. Wallace' },
          ],
        ],
      ];

      const filteredDrivers = sliceRelevantDrivers(results, 'GT4');

      expect(filteredDrivers).toEqual([
        [
          'GT3',
          [{ name: '1. Bob' }, { name: '2. Alice' }, { name: '3. Charlie' }],
        ],
        [
          'GT4',
          [
            { name: '1. Clark' },
            { name: '2. Richard' },
            { name: '3. Sam' },
            { name: '4. Bingo' },
            { name: '5. Tod' },
            { name: '6. Wallace' },
          ],
        ],
      ]);
    });

    it('should return all drivers when less than 3 available for class without player', () => {
      const results: [string, DummyStanding[]][] = [
        ['GT3', [{ name: 'Bob' }, { name: 'Alice' }]],
      ];

      const filteredDrivers = sliceRelevantDrivers(results, 'GT3');

      expect(filteredDrivers).toEqual([
        ['GT3', [{ name: 'Bob' }, { name: 'Alice' }]],
      ]);
    });

    it('should return top 3 and drivers around player', () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '4. David' },
            { name: '5. Sebastian' },
            { name: '6. Nico' },
            { name: '7. Eve' },
            { name: '8. Frank' },
            { name: '9. Max' },
            { name: '10. George' },
            { name: '11. Player', isPlayer: true },
            { name: '12. Hannah' },
          ],
        ],
      ];

      const filteredDrivers = sliceRelevantDrivers(results, 'GT3');

      expect(filteredDrivers).toEqual([
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '6. Nico' },
            { name: '7. Eve' },
            { name: '8. Frank' },
            { name: '9. Max' },
            { name: '10. George' },
            { name: '11. Player', isPlayer: true },
            { name: '12. Hannah' },
          ],
        ],
      ]);
    });

    it('should return more drivers at the end when player is top 3', () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Player', isPlayer: true },
            { name: '3. Alice' },
            { name: '4. Charlie' },
            { name: '5. David' },
            { name: '6. Sebastian' },
            { name: '7. Nico' },
            { name: '8. Eve' },
            { name: '9. Frank' },
            { name: '10. Max' },
            { name: '11. George' },
            { name: '12. Hannah' },
          ],
        ],
      ];

      const filteredDrivers = sliceRelevantDrivers(results, 'GT3');

      expect(filteredDrivers[0][1]).toHaveLength(10);

      expect(filteredDrivers).toEqual([
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Player', isPlayer: true },
            { name: '3. Alice' },
            { name: '4. Charlie' },
            { name: '5. David' },
            { name: '6. Sebastian' },
            { name: '7. Nico' },
            { name: '8. Eve' },
            { name: '9. Frank' },
            { name: '10. Max' },
          ],
        ],
      ]);
    });

    it('should return at least 10 drivers if available', () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '4. David' },
            { name: '5. Eve' },
            { name: '6. Frank' },
            { name: '7. Player', isPlayer: true },
            { name: '8. Hannah' },
            { name: '9. Irene' },
            { name: '10. Jack' },
            { name: '11. Kevin' },
          ],
        ],
      ];
      const filteredDrivers = sliceRelevantDrivers(results, 'GT3');
      expect(filteredDrivers[0][1].length).toBe(10);
    });

    it('should allow minPlayerClassDrivers to be configured', () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '4. David' },
            { name: '5. Eve' },
            { name: '6. Frank' },
            { name: '7. Player', isPlayer: true },
            { name: '8. Hannah' },
            { name: '9. Irene' },
            { name: '10. Jack' },
            { name: '11. Kevin' },
          ],
        ],
      ];
      const filteredDrivers = sliceRelevantDrivers(results, 'GT3', {
        minPlayerClassDrivers: 5,
      });
      expect(filteredDrivers[0][1].length).toBe(10);
    });

    it('should allow numTopDrivers to be configured', () => {
      const results: [string, DummyStanding[]][] = [
        [
          'GT3',
          [
            { name: '1. Bob' },
            { name: '2. Alice' },
            { name: '3. Charlie' },
            { name: '4. David' },
            { name: '5. Eve' },
            { name: '6. Frank' },
            { name: '7. Player', isPlayer: true },
            { name: '8. Hannah' },
            { name: '9. Irene' },
            { name: '10. Jack' },
            { name: '11. Kevin' },
          ],
        ],
      ];
      const filteredDrivers = sliceRelevantDrivers(results, 'GT3', {
        numTopDrivers: 1,
      });
      expect(filteredDrivers[0][1].length).toBe(10);
      expect(filteredDrivers[0][1][0].name).toBe('1. Bob');
      expect(filteredDrivers[0][1][1].name).toBe('3. Charlie');
    });
  });
});

/**
 * This method will create the standings for the current session
 * It will group the standings by class and slice the relevant drivers
 *
 * Only used to simplify testing
 */
function createStandings(
  session?: Session,
  telemetry?: Telemetry,
  currentSession?: SessionInfo,
  options?: {
    buffer?: number;
    numNonClassDrivers?: number;
    minPlayerClassDrivers?: number;
    numTopDrivers?: number;
  }
) {
  const standings = createDriverStandings(
    {
      playerIdx: session?.DriverInfo?.DriverCarIdx,
      drivers: session?.DriverInfo?.Drivers,
      qualifyingResults: session?.QualifyResultsInfo?.Results,
    },
    {
      carIdxF2TimeValue: telemetry?.CarIdxF2Time?.value,
      carIdxOnPitRoadValue: telemetry?.CarIdxOnPitRoad?.value,
      carIdxTrackSurfaceValue: telemetry?.CarIdxTrackSurface?.value,
      carIdxTireCompoundValue: telemetry?.CarIdxTireCompound?.value,
      radioTransmitCarIdx: telemetry?.RadioTransmitCarIdx?.value,
    },
    {
      resultsPositions: currentSession?.ResultsPositions,
      resultsFastestLap: currentSession?.ResultsFastestLap,
      sessionType: currentSession?.SessionType,
    },
    [],
    [],
    [],
    undefined,
    undefined
  );
  const driverClass = session?.DriverInfo?.Drivers?.find(
    (driver) => driver.CarIdx === session?.DriverInfo?.DriverCarIdx
  )?.CarClassID;
  const grouped = groupStandingsByClass(standings);
  return sliceRelevantDrivers(grouped, driverClass, options);
}
