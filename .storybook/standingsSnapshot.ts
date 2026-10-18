import type { Session, StandingsSnapshot, Telemetry } from '@irdashies/types';
import { StandingsProcessor } from '../src/app/processors/StandingsProcessor';
import sessionFixture from '../src/app/irsdk/node/utils/mock-data/session.json';
import telemetryFixture from '../src/app/irsdk/node/utils/mock-data/telemetry.json';

const processor = new StandingsProcessor();
processor.init(sessionFixture as unknown as Session);
processor.onFrame(telemetryFixture as unknown as Telemetry);

export const standingsStorySnapshot: StandingsSnapshot = processor.snapshot();

const raceResults = (
  sessionFixture as unknown as Session
).SessionInfo.Sessions.find(
  (session) => session.SessionNum === 2
)?.ResultsPositions;

/** Synthetic final classification with all cars out of the world. */
export const finishedStandingsStorySnapshot: StandingsSnapshot = {
  ...standingsStorySnapshot,
  sessionNum: 2,
  sessionState: 6,
  carIdxTrackSurface: standingsStorySnapshot.carIdxTrackSurface.map(() => -1),
  carIdxLapDistPct: standingsStorySnapshot.carIdxLapDistPct.map(() => -1),
  finalRaceTiming: standingsStorySnapshot.carIdxF2Time.map((_, carIdx) => {
    const result = raceResults?.find((row) => row.CarIdx === carIdx);
    return result
      ? { lapsComplete: 20, resultTime: result.ClassPosition * 5.25 }
      : null;
  }),
};
