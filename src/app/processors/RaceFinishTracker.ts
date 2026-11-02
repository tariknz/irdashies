import type {
  RaceFinishTiming,
  Session,
  StandingsSnapshot,
} from '@irdashies/types';
import { SessionState, TrackLocation } from '../irsdk/types/enums';

// Fixed ceiling prevents session-derived arrays growing beyond an SDK grid.
const MAX_CARS = 256;

/** Owned by StandingsProcessor, so every window sees the same finish timing. */
export class RaceFinishTracker {
  readonly timings: (RaceFinishTiming | null)[] = [];
  private readonly previousLaps: (number | undefined)[] = [];
  private readonly previousPct: (number | undefined)[] = [];
  private readonly crossings: (number | undefined)[] = [];
  private previousTime: number | null = null;
  private sawRacing = false;
  private leaderFinish: number | null = null;

  reset(): void {
    this.timings.length = 0;
    this.previousLaps.length = 0;
    this.previousPct.length = 0;
    this.crossings.length = 0;
    this.previousTime = null;
    this.sawRacing = false;
    this.leaderFinish = null;
  }

  update(
    snapshot: StandingsSnapshot,
    completed: readonly unknown[] | undefined,
    session: Session | undefined
  ): void {
    const currentSession = session?.SessionInfo?.Sessions?.find(
      (entry) => entry.SessionNum === snapshot.sessionNum
    );
    if (currentSession?.SessionType !== 'Race') return;
    const { sessionTime: time, sessionState: state } = snapshot;
    if (state === SessionState.Racing) this.sawRacing = true;
    const afterFlag = state >= SessionState.Checkered;
    const count = Math.min(completed?.length ?? 0, MAX_CARS);
    const dt = this.previousTime === null ? 0 : time - this.previousTime;
    this.crossings.length = count;

    for (let car = 0; car < count; car += 1) {
      this.crossings[car] = undefined;
      const laps = completed?.[car];
      const pct = snapshot.carIdxLapDistPct[car];
      const previousLap = this.previousLaps[car];
      const previousPct = this.previousPct[car];
      const valid =
        typeof laps === 'number' &&
        Number.isInteger(laps) &&
        laps >= 0 &&
        Number.isFinite(pct) &&
        pct >= 0 &&
        pct < 1 &&
        snapshot.carIdxTrackSurface[car] > TrackLocation.NotInWorld;
      if (
        valid &&
        afterFlag &&
        this.sawRacing &&
        dt > 0 &&
        dt <= 1 &&
        previousLap !== undefined &&
        laps === previousLap + 1 &&
        previousPct !== undefined &&
        previousPct > 0.5 &&
        pct < 0.5
      ) {
        this.crossings[car] = time - (dt * pct) / (1 - previousPct + pct);
      }
      // Missing cars must not create a crossing when telemetry resumes.
      this.previousLaps[car] = valid ? laps : undefined;
      this.previousPct[car] = valid ? pct : undefined;
    }
    this.previousLaps.length = count;
    this.previousPct.length = count;

    if (afterFlag) {
      const leader = snapshot.carIdxPosition.findIndex(
        (position, car) =>
          position === 1 && car !== session?.DriverInfo?.PaceCarIdx
      );
      if (this.leaderFinish === null && this.crossings[leader] !== undefined) {
        this.leaderFinish = this.crossings[leader] ?? null;
      }
      for (let car = 0; car < count; car += 1) {
        const crossing = this.crossings[car];
        if (
          car !== session?.DriverInfo?.PaceCarIdx &&
          !this.timings[car] &&
          crossing !== undefined &&
          this.leaderFinish !== null &&
          crossing >= this.leaderFinish
        ) {
          this.timings[car] = {
            lapsComplete: completed?.[car] as number,
            crossingTime: crossing,
          };
        }
      }

      // Official results also support late joins and cars missing from telemetry.
      // Provisional result Time/F2 values can lag by a lap; never freeze those.
      if (currentSession.ResultsOfficial === 1) {
        for (const result of currentSession.ResultsPositions ?? []) {
          const car = result.CarIdx;
          if (
            !Number.isInteger(car) ||
            car < 0 ||
            car >= MAX_CARS ||
            car === session?.DriverInfo?.PaceCarIdx ||
            !Number.isInteger(result.LapsComplete) ||
            result.LapsComplete <= 0 ||
            result.Position < 1
          )
            continue;
          const resultTime =
            Number.isFinite(result.Time) && result.Time >= 0
              ? result.Time
              : undefined;
          const previous = this.timings[car];
          if (
            previous?.lapsComplete === result.LapsComplete &&
            previous.resultTime === resultTime
          )
            continue;
          this.timings[car] = {
            lapsComplete: result.LapsComplete,
            crossingTime:
              previous?.lapsComplete === result.LapsComplete
                ? previous.crossingTime
                : undefined,
            resultTime,
          };
        }
      }
    }
    this.previousTime = time;
  }
}
