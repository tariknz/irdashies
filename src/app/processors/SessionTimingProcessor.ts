import type {
  Session,
  SessionLifecycleEvent,
  SessionTimingSnapshot,
  Telemetry,
} from '@irdashies/types';
import { SessionState } from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const UPDATE_INTERVAL_SECONDS = 0.2;
const TIME_EPSILON = 1e-6;

const numberValue = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const numberArray = (frame: Telemetry, key: keyof Telemetry): unknown[] => {
  const value = frame[key]?.value;
  return Array.isArray(value) ? value : [];
};

const finiteAt = (values: unknown[], index: number | null): number => {
  if (index === null || index < 0) return 0;
  const value = values[index];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

export class SessionTimingProcessor implements TelemetryProcessor<SessionTimingSnapshot> {
  readonly channel = 'session-timing.snapshot';
  readonly tickRateHz = 5;

  private session?: Session;
  private driverCarIdx: number | null = null;
  private lastUpdateTime: number | null = null;
  private previousSessionState: number | null = null;
  private previousLeaderLap: number | null = null;
  private greenFlagTimestamp: number | null = null;
  private checkeredLap: number | null = null;
  private lateJoin = false;
  private enabled = true;
  private latest = this.emptySnapshot();

  constructor(private readonly lapTimes: () => readonly number[] = () => []) {}

  init(session: Session): void {
    this.session = session;
    const carIdx = session.DriverInfo?.DriverCarIdx;
    this.driverCarIdx =
      typeof carIdx === 'number' && carIdx >= 0 ? carIdx : null;
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;
    const sessionTime = numberValue(frame, 'SessionTime');
    if (sessionTime === null) return;
    const sessionNum = numberValue(frame, 'SessionNum');
    const focusCarIdx = this.focusCarIdx(frame);
    const timeWentBackwards =
      this.lastUpdateTime !== null && sessionTime < this.lastUpdateTime;
    const sessionChanged =
      this.latest.sessionNum !== null && sessionNum !== this.latest.sessionNum;
    if (timeWentBackwards || sessionChanged) this.reset(sessionNum);
    if (
      this.lastUpdateTime !== null &&
      sessionTime - this.lastUpdateTime < UPDATE_INTERVAL_SECONDS - TIME_EPSILON
    ) {
      return;
    }
    this.lastUpdateTime = sessionTime;

    const state = numberValue(frame, 'SessionState') ?? 0;
    const sessionInfo = this.session?.SessionInfo?.Sessions?.find(
      (entry) => entry.SessionNum === sessionNum
    );
    const sessionType = sessionInfo?.SessionType;
    const laps = numberArray(frame, 'CarIdxLap');
    const positions = numberArray(frame, 'CarIdxPosition');
    const lapDistPcts = numberArray(frame, 'CarIdxLapDistPct');
    const currentLap = finiteAt(laps, focusCarIdx);
    let leaderCarIdx = -1;
    for (let index = 0; index < positions.length; index += 1) {
      if (positions[index] === 1) {
        leaderCarIdx = index;
        break;
      }
    }
    const leaderLap = finiteAt(laps, leaderCarIdx);
    const leaderLapDistPct = finiteAt(lapDistPcts, leaderCarIdx);

    this.updateGreenFlag(
      sessionType,
      state,
      sessionTime,
      leaderCarIdx,
      leaderLap
    );
    if (state >= SessionState.Checkered) {
      if (this.checkeredLap === null && currentLap > 0) {
        this.checkeredLap = currentLap;
      }
    } else {
      this.checkeredLap = null;
    }

    const timeTotal = numberValue(frame, 'SessionTimeTotal') ?? 0;
    const rawTimeRemaining = numberValue(frame, 'SessionTimeRemain') ?? 0;
    const timeRemaining =
      sessionType === 'Race' &&
      state === SessionState.GetInCar &&
      rawTimeRemaining >= 604800 &&
      timeTotal >= 604800
        ? -1
        : rawTimeRemaining;
    const totalLaps =
      typeof sessionInfo?.SessionLaps === 'number'
        ? sessionInfo.SessionLaps
        : 0;
    const fixedLapRace = !(timeRemaining > 0 && timeRemaining !== 604800);
    const displayLap =
      state >= SessionState.Checkered
        ? (this.checkeredLap ?? currentLap)
        : currentLap;
    const raceValues = this.calculateRaceValues(
      frame,
      sessionType,
      state,
      focusCarIdx,
      displayLap,
      leaderCarIdx,
      leaderLap,
      leaderLapDistPct,
      totalLaps,
      timeRemaining,
      timeTotal,
      fixedLapRace
    );

    this.latest = {
      sessionType,
      state,
      currentLap: displayLap,
      totalLaps,
      time: sessionTime,
      timeTotal,
      timeRemaining,
      greenFlagTimestamp: this.greenFlagTimestamp ?? 0,
      isFixedLapRace: fixedLapRace,
      ...raceValues,
      sessionNum,
      version: this.latest.version + 1,
    };
    this.previousSessionState = state;
    this.previousLeaderLap = leaderLap;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.enabled = !event.replay;
      if (event.replay) this.reset(null);
      return;
    }
    this.reset(null);
  }

  snapshot(): SessionTimingSnapshot {
    return this.latest;
  }

  private focusCarIdx(frame: Telemetry): number | null {
    const cameraCarIdx = numberValue(frame, 'CamCarIdx');
    return cameraCarIdx !== null && cameraCarIdx >= 0
      ? cameraCarIdx
      : this.driverCarIdx;
  }

  private updateGreenFlag(
    sessionType: string | undefined,
    state: number,
    sessionTime: number,
    leaderCarIdx: number,
    leaderLap: number
  ): void {
    if (
      sessionType === 'Race' &&
      this.greenFlagTimestamp === null &&
      state === SessionState.Racing
    ) {
      if (
        this.previousSessionState !== null &&
        this.previousSessionState < SessionState.Racing
      ) {
        this.greenFlagTimestamp = sessionTime;
        this.lateJoin = false;
      } else if (this.previousSessionState === null) {
        this.lateJoin = true;
      }
    }
    if (
      this.lateJoin &&
      sessionType === 'Race' &&
      state === SessionState.Racing &&
      this.previousLeaderLap !== null &&
      leaderLap > this.previousLeaderLap &&
      leaderLap > 0
    ) {
      const averageLapTime = this.averageLapTime(leaderCarIdx);
      if (averageLapTime > 0) {
        this.greenFlagTimestamp = sessionTime - leaderLap * averageLapTime;
        this.lateJoin = false;
      }
    }
  }

  private calculateRaceValues(
    frame: Telemetry,
    sessionType: string | undefined,
    state: number,
    focusCarIdx: number | null,
    currentLap: number,
    leaderCarIdx: number,
    leaderLap: number,
    leaderLapDistPct: number,
    totalLaps: number,
    timeRemaining: number,
    timeTotal: number,
    fixedLapRace: boolean
  ): Pick<
    SessionTimingSnapshot,
    'totalRaceLaps' | 'totalRaceTime' | 'adjustedRaceTime'
  > {
    let totalRaceLaps = 0;
    let totalRaceTime = 0;
    let adjustedRaceTime = 0;
    if (sessionType !== 'Race') {
      return { totalRaceLaps, totalRaceTime, adjustedRaceTime };
    }
    const lapDistPct = numberValue(frame, 'LapDistPct') ?? 0;
    const focusBestLap = finiteAt(
      numberArray(frame, 'CarIdxBestLapTime'),
      focusCarIdx
    );
    const averageLapTime =
      this.averageLapTime(leaderCarIdx >= 0 ? leaderCarIdx : focusCarIdx) ||
      focusBestLap;
    const lapsValid = currentLap > 0 && leaderLap > 0;
    if (fixedLapRace) {
      totalRaceLaps = totalLaps;
      if (lapsValid) {
        totalRaceLaps -= Math.max(
          0,
          Math.floor(leaderLap + leaderLapDistPct - (currentLap + lapDistPct))
        );
      }
      if (averageLapTime > 0) {
        totalRaceTime = totalLaps * averageLapTime;
        adjustedRaceTime = totalRaceLaps * averageLapTime;
      }
    } else {
      totalRaceTime = timeTotal;
      if (averageLapTime > 0) {
        totalRaceLaps =
          currentLap === 0
            ? timeTotal / averageLapTime
            : timeRemaining / averageLapTime +
              (leaderLap - 1) +
              leaderLapDistPct;
        if (leaderLap > currentLap + 1) {
          totalRaceLaps -= Math.floor(leaderLap - currentLap);
        }
        if (totalLaps > 0) totalRaceLaps = Math.min(totalRaceLaps, totalLaps);
      }
    }
    if (state >= SessionState.Checkered) totalRaceLaps = currentLap;
    return { totalRaceLaps, totalRaceTime, adjustedRaceTime };
  }

  private averageLapTime(carIdx: number | null): number {
    if (carIdx === null || carIdx < 0) return 0;
    const average = this.lapTimes()[carIdx] ?? 0;
    if (average > 0) return average;
    const driver = this.session?.DriverInfo?.Drivers?.find(
      (entry) => entry?.CarIdx === carIdx
    );
    const estimate = driver?.CarClassEstLapTime;
    return typeof estimate === 'number' && estimate > 0 ? estimate : 0;
  }

  private reset(sessionNum: number | null): void {
    const version = this.latest.version + 1;
    this.lastUpdateTime = null;
    this.previousSessionState = null;
    this.previousLeaderLap = null;
    this.greenFlagTimestamp = null;
    this.checkeredLap = null;
    this.lateJoin = false;
    this.latest = { ...this.emptySnapshot(), sessionNum, version };
  }

  private emptySnapshot(): SessionTimingSnapshot {
    return {
      state: 0,
      currentLap: 0,
      totalLaps: 0,
      time: 0,
      timeTotal: 0,
      timeRemaining: 0,
      greenFlagTimestamp: 0,
      isFixedLapRace: true,
      totalRaceLaps: 0,
      totalRaceTime: 0,
      adjustedRaceTime: 0,
      sessionNum: null,
      version: 0,
    };
  }
}
