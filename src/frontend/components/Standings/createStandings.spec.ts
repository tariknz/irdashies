import { describe, it, expect } from 'vitest';
import { createDriverStandings, groupStandingsByClass, sliceRelevantDrivers } from './createStandings';
import type { Session, Telemetry, SessionInfo } from '@irdashies/types';

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
        value: [1]
      }
    } as Telemetry;

    const standings = createStandings(
      mockSessionData,
      mockTelemetryWithConnected,
      mockCurrentSession,
    );

    expect(standings[0][1][0].onTrack).toBe(true);
  });

  describe('sliceRelevantDrivers', () => {
    interface DummyStanding { name: string; isPlayer?: boolean }
    it('should return only top 3 drivers for classes outside of player\'s class', () => {
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

    it('should return all player\'s class even when player is not in standings', () => {
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
    undefined,
  );
  const driverClass = session?.DriverInfo?.Drivers?.find(
    (driver) => driver.CarIdx === session?.DriverInfo?.DriverCarIdx
  )?.CarClassID;
  const grouped = groupStandingsByClass(standings);
  return sliceRelevantDrivers(grouped, driverClass, options);
};
