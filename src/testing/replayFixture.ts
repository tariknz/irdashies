import type { Session, Telemetry } from '@irdashies/types';

/**
 * Replay fixtures are short windows lifted from real telemetry captures by
 * `tools/telemetry-replay/extract-capture-fixture.py`, downsampled and with the
 * roster anonymised.
 *
 * They exist so processors and stores can be exercised against values iRacing
 * actually produced — real class layouts, real pit sequences, real lap
 * transitions — rather than hand-written numbers that only cover the cases the
 * author already thought of.
 */
export interface ReplayFixture {
  meta: {
    name: string;
    sessionNum: number;
    from: number;
    to: number;
    hz: number;
    frames: number;
    anonymised: boolean;
  };
  weekend: Record<string, string>;
  /** DriverCarIdx / PaceCarIdx as the sim reported them. */
  driverInfo?: Record<string, string>;
  sessions: {
    SessionNum: number;
    SessionType?: string;
    /** Gap, interval, position change and iRating all derive from these. */
    ResultsPositions?: Record<string, number>[];
    ResultsFastestLap?: Record<string, number>[];
  }[];
  /** Grid positions, used for position change in race sessions. */
  qualifying?: Record<string, number>[];
  drivers: Record<string, string | number>[];
  frames: Record<string, number | boolean | number[] | boolean[]>[];
}

/** Wraps a fixture frame into the shape the SDK hands processors. */
export const toTelemetry = (
  frame: ReplayFixture['frames'][number]
): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, value]) => [
      name,
      { value: Array.isArray(value) ? value : [value] },
    ])
  ) as unknown as Telemetry;

const numeric = (value: unknown): number => {
  const parsed = Number(String(value ?? '').replace(/"/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

const text = (value: unknown): string => String(value ?? '').replace(/"/g, '');

/** Rebuilds the session object the frontend and processors read. */
export const toSession = (fixture: ReplayFixture): Session => {
  // Both indices come from the capture. Guessing them gets the player wrong,
  // which silently empties every relative window, and leaves the pace car
  // unfiltered so it turns up as a nameless entry.
  const paceCar = fixture.drivers.find((d) => numeric(d.CarIsPaceCar) === 1);
  const driverCarIdx = fixture.driverInfo?.DriverCarIdx;
  const paceCarIdx = fixture.driverInfo?.PaceCarIdx;

  return {
    WeekendInfo: {
      TrackID: numeric(fixture.weekend.TrackID),
      TrackDisplayName: text(fixture.weekend.TrackDisplayName),
      TrackLength: text(fixture.weekend.TrackLength),
      NumCarClasses: numeric(fixture.weekend.NumCarClasses),
      TeamRacing: numeric(fixture.weekend.TeamRacing),
      EventType: text(fixture.weekend.EventType),
    },
    SessionInfo: {
      Sessions: fixture.sessions.map((session) => ({
        SessionNum: session.SessionNum,
        SessionType: session.SessionType,
        ResultsPositions: session.ResultsPositions ?? [],
        ResultsFastestLap: session.ResultsFastestLap ?? [],
      })),
    },
    QualifyResultsInfo: { Results: fixture.qualifying ?? [] },
    DriverInfo: {
      // Nullish, not undefined: the extractor emits null when the capture had
      // no value, and numeric(null) is 0 — which would silently name car 0 as
      // the player and empty every relative window.
      DriverCarIdx:
        driverCarIdx != null
          ? numeric(driverCarIdx)
          : numeric(fixture.drivers[0]?.CarIdx),
      PaceCarIdx:
        paceCarIdx != null
          ? numeric(paceCarIdx)
          : paceCar
            ? numeric(paceCar.CarIdx)
            : -1,
      Drivers: fixture.drivers.map((driver) => ({
        CarIdx: numeric(driver.CarIdx),
        UserName: text(driver.UserName),
        UserID: numeric(driver.UserID),
        CarNumber: text(driver.CarNumber),
        CarNumberRaw: numeric(driver.CarNumber),
        CarID: numeric(driver.CarID),
        CarClassID: numeric(driver.CarClassID),
        CarClassShortName: text(driver.CarClassShortName),
        CarClassColor: numeric(driver.CarClassColor),
        CarClassRelSpeed: numeric(driver.CarClassRelSpeed),
        CarClassEstLapTime: numeric(driver.CarClassEstLapTime),
        TeamName: text(driver.TeamName),
        IRating: numeric(driver.IRating),
        LicString: text(driver.LicString),
        FlairID: numeric(driver.FlairID),
        CarIsPaceCar: numeric(driver.CarIsPaceCar),
        IsSpectator: numeric(driver.IsSpectator),
      })),
    },
  } as unknown as Session;
};

/**
 * Feeds every frame of a fixture to a processor and returns the snapshot after
 * each one, so a test can assert on the sequence rather than a single moment.
 */
export const replayThrough = <T>(
  fixture: ReplayFixture,
  processor: {
    init?: (session: Session) => void;
    onFrame: (frame: Telemetry) => void;
    snapshot: () => T;
  },
  clone: (snapshot: T) => T = (snapshot) => snapshot
): T[] => {
  processor.init?.(toSession(fixture));
  return fixture.frames.map((frame) => {
    processor.onFrame(toTelemetry(frame));
    return clone(processor.snapshot());
  });
};

/** Distinct car classes present in a fixture, for asserting field shape. */
export const classesIn = (fixture: ReplayFixture): string[] => [
  ...new Set(
    fixture.drivers
      .filter((d) => numeric(d.CarIsPaceCar) === 0)
      .map((d) => text(d.CarClassShortName))
      .filter(Boolean)
  ),
];
