import type {
  Sector,
  SectorTimingResultSnapshot,
  SectorTimingSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const MIN_PROGRESS = 0.00005;
const MAX_FORWARD_JUMP = 0.5;
const MAX_LAP_PCT_PER_SECOND = 0.08;
const MAX_SPEED_CHECK_WINDOW = 5;

const numericValue = (
  frame: Telemetry,
  key: keyof Telemetry
): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

export const getSectorIdx = (
  lapDistPct: number,
  sectors: readonly Sector[]
): number => {
  let index = 0;
  for (let i = 0; i < sectors.length; i += 1) {
    if (lapDistPct >= sectors[i].SectorStartPct) index = i;
  }
  return index;
};

export const interpolateSectorCrossingTime = (
  boundary: number,
  previousPct: number,
  previousTime: number,
  currentPct: number,
  currentTime: number
): number => {
  const distance = currentPct - previousPct;
  if (distance === 0) return currentTime;
  return (
    previousTime +
    ((boundary - previousPct) / distance) * (currentTime - previousTime)
  );
};

const emptyResult = (count: number): SectorTimingResultSnapshot => ({
  currentLapSectorTimes: Array<number | null>(count).fill(null),
  previousLapSectorTimes: Array<number | null>(count).fill(null),
  currentLapSectorUnclean: Array<boolean>(count).fill(false),
  previousLapSectorUnclean: Array<boolean>(count).fill(false),
  sessionBestSectorTimes: Array<number | null>(count).fill(null),
  previousSessionBestSectorTimes: Array<number | null>(count).fill(null),
});

const cloneResult = (
  result: SectorTimingResultSnapshot
): SectorTimingResultSnapshot => ({
  currentLapSectorTimes: [...result.currentLapSectorTimes],
  previousLapSectorTimes: [...result.previousLapSectorTimes],
  currentLapSectorUnclean: [...result.currentLapSectorUnclean],
  previousLapSectorUnclean: [...result.previousLapSectorUnclean],
  sessionBestSectorTimes: [...result.sessionBestSectorTimes],
  previousSessionBestSectorTimes: [...result.previousSessionBestSectorTimes],
});

export class SectorTimingProcessor implements TelemetryProcessor<SectorTimingSnapshot> {
  readonly channel = 'sector-timing.snapshot';
  readonly tickRateHz = 'event';

  private lastLapDistPct = -1;
  private lastSessionTime = -1;
  private sectorEntryUnclean = false;
  private wasOnTrack = false;
  private enabled = true;
  private latest: SectorTimingSnapshot = this.emptySnapshot();

  init(session: Session): void {
    const sectors = [...(session.SplitTimeInfo?.Sectors ?? [])].sort(
      (a, b) => a.SectorStartPct - b.SectorStartPct
    );
    const unchanged =
      sectors.length === this.latest.sectors.length &&
      sectors.every(
        (sector, index) =>
          sector.SectorNum === this.latest.sectors[index].SectorNum &&
          sector.SectorStartPct === this.latest.sectors[index].SectorStartPct
      );
    if (unchanged) return;
    this.resetState(sectors, this.latest.sessionNum);
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled || this.latest.sectors.length === 0) return;
    const lapDistPct = numericValue(frame, 'LapDistPct');
    const sessionTime = numericValue(frame, 'SessionTime');
    const sessionNum = numericValue(frame, 'SessionNum');
    const isOnTrack = frame.IsOnTrack?.value?.[0] === true;
    if (lapDistPct === null || sessionTime === null) return;
    if (
      sessionNum !== null &&
      this.latest.sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    ) {
      this.resetState(this.latest.sectors, sessionNum);
    }
    if (this.wasOnTrack && !isOnTrack && this.latest.sectorEntryValid) {
      this.sectorEntryUnclean = true;
    }
    if (!isOnTrack) {
      this.wasOnTrack = false;
      return;
    }
    this.wasOnTrack = true;
    if (this.lastLapDistPct < 0) {
      this.lastLapDistPct = lapDistPct;
      this.lastSessionTime = sessionTime;
      this.latest = {
        ...this.latest,
        currentSectorIdx: getSectorIdx(lapDistPct, this.latest.sectors),
        sectorEntryTime: sessionTime,
        sessionNum,
        version: this.latest.version + 1,
      };
      return;
    }

    const delta = lapDistPct - this.lastLapDistPct;
    const lastSectorStart =
      this.latest.sectors[this.latest.sectors.length - 1]?.SectorStartPct ?? 0;
    const firstSectorEnd = this.latest.sectors[1]?.SectorStartPct ?? 1;
    const wrapped =
      delta < 0 &&
      this.lastLapDistPct >= lastSectorStart &&
      lapDistPct < firstSectorEnd;
    if (wrapped) {
      const crossingTime = interpolateSectorCrossingTime(
        1,
        this.lastLapDistPct,
        this.lastSessionTime,
        lapDistPct + 1,
        sessionTime
      );
      this.completeSector(crossingTime, 0, true);
      this.lastLapDistPct = lapDistPct;
      this.lastSessionTime = sessionTime;
      this.publishEvent(sessionNum);
      return;
    }

    const tickDuration = sessionTime - this.lastSessionTime;
    const teleported =
      delta < 0 ||
      delta > MAX_FORWARD_JUMP ||
      (delta > 0 &&
        tickDuration > 0 &&
        tickDuration < MAX_SPEED_CHECK_WINDOW &&
        delta / tickDuration > MAX_LAP_PCT_PER_SECOND);
    if (teleported) {
      const currentSectorIdx = getSectorIdx(lapDistPct, this.latest.sectors);
      const inclusive = cloneResult(this.latest.inclusive);
      const clean = cloneResult(this.latest.clean);
      (inclusive.currentLapSectorTimes as (number | null)[])[currentSectorIdx] =
        null;
      (clean.currentLapSectorTimes as (number | null)[])[currentSectorIdx] =
        null;
      this.sectorEntryUnclean = false;
      this.lastLapDistPct = lapDistPct;
      this.lastSessionTime = sessionTime;
      this.latest = {
        ...this.latest,
        inclusive,
        clean,
        currentSectorIdx,
        sectorEntryTime: sessionTime,
        sectorEntryValid: false,
      };
      this.publishEvent(sessionNum);
      return;
    }

    const previousPct = this.lastLapDistPct;
    const previousTime = this.lastSessionTime;
    this.lastLapDistPct = lapDistPct;
    this.lastSessionTime = sessionTime;
    if (delta >= MIN_PROGRESS) {
      const nextSectorIdx = getSectorIdx(lapDistPct, this.latest.sectors);
      if (nextSectorIdx !== this.latest.currentSectorIdx) {
        const crossingTime = interpolateSectorCrossingTime(
          this.latest.sectors[nextSectorIdx].SectorStartPct,
          previousPct,
          previousTime,
          lapDistPct,
          sessionTime
        );
        this.completeSector(crossingTime, nextSectorIdx, false);
        this.publishEvent(sessionNum);
      }
    }
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.enabled = !event.replay;
      if (!this.enabled) this.resetState(this.latest.sectors, null);
      return;
    }
    this.resetState(
      event.type === 'disconnect' ? [] : this.latest.sectors,
      null
    );
  }

  snapshot(): SectorTimingSnapshot {
    return this.latest;
  }

  private completeSector(
    crossingTime: number,
    nextSectorIdx: number,
    resetLap: boolean
  ): void {
    const completedIdx = this.latest.currentSectorIdx;
    const sectorTime = crossingTime - this.latest.sectorEntryTime;
    const resetCurrentLap = (result: SectorTimingResultSnapshot) => ({
      ...result,
      currentLapSectorTimes: Array<number | null>(
        this.latest.sectors.length
      ).fill(null),
      currentLapSectorUnclean: Array<boolean>(this.latest.sectors.length).fill(
        false
      ),
    });
    const inclusive = this.latest.sectorEntryValid
      ? this.record(this.latest.inclusive, completedIdx, sectorTime, resetLap)
      : resetLap
        ? resetCurrentLap(this.latest.inclusive)
        : this.latest.inclusive;
    const clean =
      this.latest.sectorEntryValid && !this.sectorEntryUnclean
        ? this.record(this.latest.clean, completedIdx, sectorTime, resetLap)
        : resetLap
          ? resetCurrentLap(this.latest.clean)
          : this.latest.clean;
    this.latest = {
      ...this.latest,
      inclusive,
      clean,
      currentSectorIdx: nextSectorIdx,
      sectorEntryTime: crossingTime,
      sectorEntryValid: true,
    };
    this.sectorEntryUnclean = false;
  }

  private record(
    source: SectorTimingResultSnapshot,
    sectorIdx: number,
    sectorTime: number,
    resetLap: boolean
  ): SectorTimingResultSnapshot {
    const result = cloneResult(source);
    const current = result.currentLapSectorTimes as (number | null)[];
    const previous = result.previousLapSectorTimes as (number | null)[];
    const currentUnclean = result.currentLapSectorUnclean as boolean[];
    const previousUnclean = result.previousLapSectorUnclean as boolean[];
    const bests = result.sessionBestSectorTimes as (number | null)[];
    const previousBests = result.previousSessionBestSectorTimes as (
      number | null
    )[];
    const oldBest = bests[sectorIdx];
    if (oldBest === null || sectorTime < oldBest) {
      previousBests[sectorIdx] = oldBest;
      bests[sectorIdx] = sectorTime;
    }
    previous[sectorIdx] = sectorTime;
    previousUnclean[sectorIdx] = this.sectorEntryUnclean;
    if (resetLap) {
      result.currentLapSectorTimes = Array<number | null>(
        this.latest.sectors.length
      ).fill(null);
      result.currentLapSectorUnclean = Array<boolean>(
        this.latest.sectors.length
      ).fill(false);
    } else {
      current[sectorIdx] = sectorTime;
      currentUnclean[sectorIdx] = this.sectorEntryUnclean;
    }
    return result;
  }

  private publishEvent(sessionNum: number | null): void {
    this.latest = {
      ...this.latest,
      sessionNum,
      version: this.latest.version + 1,
    };
  }

  private resetState(
    sectors: readonly Sector[],
    sessionNum: number | null
  ): void {
    this.lastLapDistPct = -1;
    this.lastSessionTime = -1;
    this.sectorEntryUnclean = false;
    this.wasOnTrack = false;
    this.latest = this.emptySnapshot(
      sectors,
      sessionNum,
      this.latest.version + 1
    );
  }

  private emptySnapshot(
    sectors: readonly Sector[] = [],
    sessionNum: number | null = null,
    version = 0
  ): SectorTimingSnapshot {
    return {
      sectors,
      currentSectorIdx: 0,
      sectorEntryTime: 0,
      sectorEntryValid: false,
      inclusive: emptyResult(sectors.length),
      clean: emptyResult(sectors.length),
      sessionNum,
      version,
    };
  }
}
