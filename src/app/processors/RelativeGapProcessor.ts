import type {
  Driver,
  ReferenceLap,
  ReferenceLapsSnapshot,
  RelativeGapsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const FALLBACK_LAP_TIME = 90;
const UPDATE_INTERVAL_SECONDS = 0.2;
const TIME_EPSILON = 1e-6;

const lapTimeOrFallback = (value: number | undefined): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : FALLBACK_LAP_TIME;

export interface ReferenceLapSource {
  snapshot(): ReferenceLapsSnapshot;
}

const numericValue = (
  frame: Telemetry,
  key: keyof Telemetry
): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const numericArray = (
  frame: Telemetry,
  key: keyof Telemetry
): readonly unknown[] => {
  const value = frame[key]?.value;
  return Array.isArray(value) ? value : [];
};

const interpolateAtPoint = (lap: ReferenceLap, trackPct: number): number => {
  const count = lap.pointsCount;
  if (count < 2 || trackPct < 0 || trackPct > 1) return 0;
  const previousIndex = Math.min(
    Math.max(Math.floor(trackPct * count), 0),
    count - 1
  );
  const nextIndex = Math.min(
    Math.max(Math.floor((trackPct + lap.interval) * count), 0),
    count - 1
  );
  const previousPosition = lap.pointPos[previousIndex];
  const nextPosition = lap.pointPos[nextIndex];
  const previousTime = lap.times[previousIndex];
  let nextTime = lap.times[nextIndex];
  let width = nextPosition - previousPosition;
  if (width <= 0) {
    width = 1 - previousPosition + nextPosition;
    nextTime += lap.finishTime - lap.startTime;
  }
  const fraction = (trackPct - previousPosition) / width;
  const fractionSquared = fraction * fraction;
  const fractionCubed = fractionSquared * fraction;
  return (
    (2 * fractionCubed - 3 * fractionSquared + 1) * previousTime +
    (fractionCubed - 2 * fractionSquared + fraction) *
      width *
      lap.tangents[previousIndex] +
    (-2 * fractionCubed + 3 * fractionSquared) * nextTime +
    (fractionCubed - fractionSquared) * width * lap.tangents[nextIndex]
  );
};

export class RelativeGapProcessor implements TelemetryProcessor<RelativeGapsSnapshot> {
  readonly channel = 'relative-gaps.snapshot';
  readonly tickRateHz = 5;

  private drivers: readonly (Driver | undefined)[] = [];
  private driversByCarIdx = new Map<number, Driver>();
  private bestLaps = new Map<number, ReferenceLap>();
  private persistedLaps = new Map<number, ReferenceLap>();
  private referenceVersion = -1;
  private readonly relativePcts: (number | null)[] = [];
  private readonly deltas: (number | null)[] = [];
  private driverCarIdx: number | null = null;
  private lastUpdateTime: number | null = null;
  private enabled = true;
  private latest: RelativeGapsSnapshot = this.emptySnapshot();

  constructor(private readonly referenceLaps: ReferenceLapSource) {}

  init(session: Session): void {
    this.drivers = (session.DriverInfo?.Drivers ?? []) as (
      Driver | undefined
    )[];
    this.driversByCarIdx.clear();
    for (const driver of this.drivers) {
      if (driver) this.driversByCarIdx.set(driver.CarIdx, driver);
    }
    const driverCarIdx = session.DriverInfo?.DriverCarIdx;
    this.driverCarIdx =
      typeof driverCarIdx === 'number' && driverCarIdx >= 0
        ? driverCarIdx
        : null;
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;
    const sessionTime = numericValue(frame, 'SessionTime');
    if (sessionTime === null) return;
    const cameraCarIdx = numericValue(frame, 'CamCarIdx');
    const focusCarIdx =
      cameraCarIdx !== null && cameraCarIdx >= 0
        ? cameraCarIdx
        : this.driverCarIdx;
    const focusChanged = focusCarIdx !== this.latest.focusCarIdx;
    const timeWentBackwards =
      this.lastUpdateTime !== null && sessionTime < this.lastUpdateTime;
    if (
      !focusChanged &&
      !timeWentBackwards &&
      this.lastUpdateTime !== null &&
      sessionTime - this.lastUpdateTime < UPDATE_INTERVAL_SECONDS - TIME_EPSILON
    ) {
      return;
    }
    this.lastUpdateTime = sessionTime;

    const sessionNum = numericValue(frame, 'SessionNum');
    if (
      this.latest.sessionNum !== null &&
      sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    ) {
      this.reset(sessionNum);
    }
    const lapDistPcts = numericArray(frame, 'CarIdxLapDistPct');
    if (focusCarIdx === null || lapDistPcts.length === 0) {
      this.relativePcts.length = 0;
      this.deltas.length = 0;
      this.publish(null, this.relativePcts, this.deltas, sessionNum);
      return;
    }
    const focusPct = lapDistPcts[focusCarIdx];
    if (typeof focusPct !== 'number' || !Number.isFinite(focusPct)) {
      this.relativePcts.length = 0;
      this.deltas.length = 0;
      this.publish(focusCarIdx, this.relativePcts, this.deltas, sessionNum);
      return;
    }

    const pitRoad = numericArray(frame, 'CarIdxOnPitRoad');
    const estimatedTimes = numericArray(frame, 'CarIdxEstTime');
    const laps = numericArray(frame, 'CarIdxLap');
    this.relativePcts.length = lapDistPcts.length;
    this.relativePcts.fill(null);
    this.deltas.length = lapDistPcts.length;
    this.deltas.fill(null);
    const referenceSnapshot = this.referenceLaps.snapshot();
    if (referenceSnapshot.version !== this.referenceVersion) {
      this.referenceVersion = referenceSnapshot.version;
      this.bestLaps = new Map(referenceSnapshot.bestLaps);
      this.persistedLaps = new Map(referenceSnapshot.persistedLaps);
    }

    for (const driver of this.drivers) {
      if (!driver || driver.CarIdx < 0) continue;
      const opponentIdx = driver.CarIdx;
      const opponentPct = lapDistPcts[opponentIdx];
      if (typeof opponentPct !== 'number' || !Number.isFinite(opponentPct)) {
        continue;
      }
      let relativePct = opponentPct - focusPct;
      if (relativePct > 0.5) relativePct -= 1;
      else if (relativePct < -0.5) relativePct += 1;
      this.relativePcts[opponentIdx] = relativePct;
      if (opponentIdx === focusCarIdx) {
        this.deltas[opponentIdx] = 0;
        continue;
      }

      const targetAhead = relativePct > 0 && relativePct <= 0.5;
      const aheadIdx = targetAhead ? opponentIdx : focusCarIdx;
      const behindIdx = targetAhead ? focusCarIdx : opponentIdx;
      const behindDriver = this.driverAt(behindIdx);
      const behindLap = laps[behindIdx];
      const usePersistence = typeof behindLap !== 'number' || behindLap <= 3;
      const referenceLap = usePersistence
        ? this.persistedLaps.get(behindDriver?.CarClassID ?? -1)
        : (this.bestLaps.get(behindIdx) ??
          this.persistedLaps.get(behindDriver?.CarClassID ?? -1));
      const anyoneOnPitRoad = Boolean(pitRoad[aheadIdx] || pitRoad[behindIdx]);
      this.deltas[opponentIdx] =
        anyoneOnPitRoad || !referenceLap || referenceLap.finishTime < 0
          ? this.estimatedDelta(
              aheadIdx,
              behindIdx,
              targetAhead,
              estimatedTimes
            )
          : this.referenceDelta(referenceLap, opponentPct, focusPct);
    }
    this.publish(focusCarIdx, this.relativePcts, this.deltas, sessionNum);
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.reset(null);
      this.enabled = !event.replay;
      return;
    }
    this.reset(null);
    if (event.type === 'disconnect') this.enabled = false;
  }

  snapshot(): RelativeGapsSnapshot {
    return this.latest;
  }

  private driverAt(carIdx: number): Driver | undefined {
    return this.driversByCarIdx.get(carIdx);
  }

  private estimatedDelta(
    aheadIdx: number,
    behindIdx: number,
    targetAhead: boolean,
    estimatedTimes: readonly unknown[]
  ): number | null {
    const aheadTime = estimatedTimes[aheadIdx];
    const behindTime = estimatedTimes[behindIdx];
    if (
      typeof aheadTime !== 'number' ||
      !Number.isFinite(aheadTime) ||
      typeof behindTime !== 'number' ||
      !Number.isFinite(behindTime)
    ) {
      return null;
    }
    const aheadLapTime = lapTimeOrFallback(
      this.driverAt(aheadIdx)?.CarClassEstLapTime
    );
    const behindLapTime = lapTimeOrFallback(
      this.driverAt(behindIdx)?.CarClassEstLapTime
    );
    const scaledAheadTime = aheadTime * (behindLapTime / aheadLapTime);
    let delta = targetAhead
      ? scaledAheadTime - behindTime
      : behindTime - scaledAheadTime;
    if (targetAhead && delta < -behindLapTime / 2) delta += behindLapTime;
    if (!targetAhead && delta > behindLapTime / 2) delta -= behindLapTime;
    return delta;
  }

  private referenceDelta(
    referenceLap: ReferenceLap,
    opponentPct: number,
    focusPct: number
  ): number {
    let delta =
      interpolateAtPoint(referenceLap, opponentPct) -
      interpolateAtPoint(referenceLap, focusPct);
    const lapTime = referenceLap.finishTime - referenceLap.startTime;
    const trackPctDiff = opponentPct - focusPct;
    if (trackPctDiff <= -0.5) delta += lapTime;
    else if (trackPctDiff >= 0.5) delta -= lapTime;
    return delta;
  }

  private publish(
    focusCarIdx: number | null,
    relativePcts: readonly (number | null)[],
    deltas: readonly (number | null)[],
    sessionNum: number | null
  ): void {
    this.latest = {
      focusCarIdx,
      relativePcts,
      deltas,
      sessionNum,
      version: this.latest.version + 1,
    };
  }

  private reset(sessionNum: number | null): void {
    const version = this.latest.version + 1;
    this.lastUpdateTime = null;
    this.referenceVersion = -1;
    this.bestLaps.clear();
    this.persistedLaps.clear();
    this.relativePcts.length = 0;
    this.deltas.length = 0;
    this.latest = { ...this.emptySnapshot(), sessionNum, version };
  }

  private emptySnapshot(): RelativeGapsSnapshot {
    return {
      focusCarIdx: null,
      relativePcts: [],
      deltas: [],
      sessionNum: null,
      version: 0,
    };
  }
}
