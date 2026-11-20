import type {
  FuelProjectionSnapshot,
  PitLaneTrackData,
  PitStopEstimateBreakdown,
  PitStopEstimateSnapshot,
  PitStopModelFile,
  PitStopReport,
  ReferenceLap,
  LapTimesSnapshot,
  ReferenceLapsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import { GlobalFlags, TrackLocation } from '@irdashies/types';
import { PitSvFlags } from '../irsdk/types/enums';
import type { PitStopModelPersistence } from '../storage/pitStopModel';
import type { TelemetryProcessor } from './TelemetryProcessor';
import { PitStopDetector } from './pitStop/PitStopDetector';
import type {
  CompletedStop,
  PlayerStopProgress,
} from './pitStop/PitStopDetector';
import {
  circularMedian,
  fuelStopNeeded,
  lapSeconds,
  nearestAround,
  parseSpeedKph,
  projectTraffic,
  parseTrackLengthMetres,
  rejoinOffset,
  resolveLaneLoss,
  resolveServiceRule,
  serviceEstimate,
  serviceKey,
  forwardPct,
  spanSeconds,
  MAX_LANE_SAMPLE_STATIONARY_SECONDS,
  transitKey,
  tyreCount,
  type Estimate,
  type ResolvedServiceRule,
} from './pitStop/pitStopModel';
import { ruleSetKey } from './pitStop/pitServiceRules';

export const PIT_STOP_ESTIMATE_CHANNEL = 'pit-stop-estimate.snapshot';

/** Measuring window around the lane, in metres. */
const WINDOW_BEFORE_METRES = 300;
const WINDOW_AFTER_METRES = 500;
const FALLBACK_WINDOW_PCT = 0.05;
const CAUTION = GlobalFlags.Caution | GlobalFlags.CautionWaving;

export interface PitStopEstimateDependencies {
  persistence: PitStopModelPersistence;
  referenceLaps: () => ReferenceLapsSnapshot | undefined;
  /** Each car's recent pace, so cars move at their own speed during a stop. */
  lapTimes?: () => LapTimesSnapshot | undefined;
  fuel: () => FuelProjectionSnapshot | undefined;
  /** Saved pit lane calibration, used until a stop has been seen here. */
  pitLane?: (trackId: string) => Promise<PitLaneTrackData | null>;
  report?: (report: PitStopReport) => void;
}

interface Around {
  ahead: number | null;
  behind: number | null;
  aheadGap: number | null;
  behindGap: number | null;
}

const NO_AROUND: Around = {
  ahead: null,
  behind: null,
  aheadGap: null,
  behindGap: null,
};

interface CarInfo {
  carId: number;
  carClassId: number;
  carPath: string;
  classEstLapSeconds: number;
  ignored: boolean;
}

/** The estimate as it stood at pit entry, counted down during the stop. */
interface StopPlan {
  lane: Estimate;
  service: Estimate;
  weak: boolean;
}

type Include = (carIdx: number) => boolean;

const numberAt = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const booleanAt = (frame: Telemetry, key: keyof Telemetry): boolean =>
  frame[key]?.value?.[0] === true;

const wrap01 = (value: number) => ((value % 1) + 1) % 1;

const round = (value: number | null, places: number) =>
  value === null ? null : Number(value.toFixed(places));

const hiddenSnapshot = (version: number): PitStopEstimateSnapshot => ({
  state: 'hidden',
  offsetPct: null,
  offsetFarPct: null,
  offsetNearPct: null,
  lapsLost: 0,
  lossSeconds: null,
  fuelStopNeeded: null,
  inStop: false,
  aheadCarIdx: null,
  aheadGapSeconds: null,
  behindCarIdx: null,
  behindGapSeconds: null,
  sessionNum: null,
  version,
});

/** In-memory copy for tape replays, so they never change saved data. */
export const memoryOverlay = (
  base: PitStopModelPersistence
): PitStopModelPersistence => {
  const data: PitStopModelFile = structuredClone(base.read());
  return {
    read: () => data,
    addTransit: (key, sample) => {
      data.transit[key] = [...(data.transit[key] ?? []), sample];
    },
    addService: (key, sample) => {
      data.service[key] = [...(data.service[key] ?? []), sample];
    },
  };
};

export class PitStopEstimateProcessor implements TelemetryProcessor<
  PitStopEstimateSnapshot,
  typeof PIT_STOP_ESTIMATE_CHANNEL
> {
  readonly channel = PIT_STOP_ESTIMATE_CHANNEL;
  readonly tickRateHz = 10;

  private readonly detector = new PitStopDetector();
  private latest: PitStopEstimateSnapshot = hiddenSnapshot(0);
  private version = 0;

  private cars = new Map<number, CarInfo>();
  private playerCarIdx = -1;
  private trackId = 0;
  private seriesId = 0;
  private ruleSet = 'default';
  private build = '';
  private trackLengthMetres = 0;
  private pitSpeedLimitKph = 0;
  private tankLitres = 0;
  private tankPct = 1;
  private sessionTypes = new Map<number, string>();
  private sessionNum: number | null = null;
  private watchingReplay = false;
  private calibration: PitLaneTrackData | null = null;
  private calibrationTrack = '';

  private resolvedService: ResolvedServiceRule | null = null;
  private resolvedLane: Estimate | null = null;
  private resolvedFor: unknown = null;
  private resolvedReferenceVersion = -1;
  private samplesAdded = 0;
  private resolvedSamples = -1;
  private referenceVersion = -1;
  private bestLaps = new Map<number, ReferenceLap>();
  private classLaps = new Map<number, ReferenceLap>();

  private lastBreakdown: PitStopEstimateBreakdown | null = null;
  private lastPlan: StopPlan | null = null;
  private lastTraffic: Around = NO_AROUND;
  private stopPlan: StopPlan | null = null;
  private pendingPrediction:
    | ({
        breakdown: PitStopEstimateBreakdown | null;
        lap: number | null;
      } & Around)
    | null = null;

  constructor(
    private readonly dependencies: PitStopEstimateDependencies | null
  ) {}

  init(session: Session): void {
    const weekend = session.WeekendInfo;
    const driverInfo = session.DriverInfo;
    this.cars = new Map();
    for (const driver of driverInfo?.Drivers ?? []) {
      this.cars.set(driver.CarIdx, {
        carId: driver.CarID,
        carClassId: driver.CarClassID,
        carPath: driver.CarPath ?? '',
        classEstLapSeconds: driver.CarClassEstLapTime,
        ignored: driver.CarIsPaceCar === 1 || driver.IsSpectator === 1,
      });
    }
    this.playerCarIdx = driverInfo?.DriverCarIdx ?? -1;
    this.trackId = weekend?.TrackID ?? 0;
    this.seriesId = weekend?.SeriesID ?? 0;
    this.ruleSet = ruleSetKey(weekend?.AltAssetTag);
    this.build = weekend?.BuildVersion ?? '';
    this.trackLengthMetres = parseTrackLengthMetres(weekend?.TrackLength);
    this.pitSpeedLimitKph = parseSpeedKph(weekend?.TrackPitSpeedLimit);
    this.tankLitres = driverInfo?.DriverCarFuelMaxLtr ?? 0;
    this.tankPct = driverInfo?.DriverCarMaxFuelPct || 1;
    this.sessionTypes = new Map(
      (session.SessionInfo?.Sessions ?? []).map((entry) => [
        entry.SessionNum,
        entry.SessionType,
      ])
    );
    this.resolvedFor = null;
    this.loadCalibration();
  }

  private loadCalibration() {
    const trackId = String(this.trackId);
    if (!this.dependencies?.pitLane || trackId === this.calibrationTrack)
      return;
    this.calibrationTrack = trackId;
    this.calibration = null;
    this.dependencies
      .pitLane(trackId)
      .then((data) => {
        if (this.calibrationTrack !== trackId) return;
        this.calibration = data;
        this.resolvedFor = null;
      })
      .catch(() => undefined);
  }

  onFrame(frame: Telemetry): void {
    if (!this.dependencies) return;
    const time = numberAt(frame, 'SessionTime');
    const pcts = frame.CarIdxLapDistPct?.value;
    const onPitRoad = frame.CarIdxOnPitRoad?.value;
    const surfaces = frame.CarIdxTrackSurface?.value;
    if (time === null || !pcts || !onPitRoad || !surfaces) return;

    const sessionNum = numberAt(frame, 'SessionNum');
    if (sessionNum !== this.sessionNum) {
      this.sessionNum = sessionNum;
      this.detector.reset();
      this.pendingPrediction = null;
      this.stopPlan = null;
    }

    const flags = numberAt(frame, 'SessionFlags') ?? 0;
    const caution = (flags & CAUTION) !== 0;
    const pitSvFlags = numberAt(frame, 'PitSvFlags') ?? 0;
    const window = this.windowPct();

    const events = this.detector.update({
      time,
      pct: pcts,
      onPitRoad,
      surface: surfaces,
      caution,
      playerCarIdx: this.playerCarIdx,
      pitstopActive: booleanAt(frame, 'PitstopActive'),
      fuelLevel: numberAt(frame, 'FuelLevel') ?? 0,
      pitSvFlags,
      repairLeft: numberAt(frame, 'PitRepairLeft') ?? 0,
      playerTowing: (numberAt(frame, 'PlayerCarTowTime') ?? 0) > 0,
      playerReversing: (numberAt(frame, 'Gear') ?? 0) < 0,
      beforePct: window.before,
      afterPct: window.after,
    });

    this.refreshReferenceLaps();
    const include: Include = (carIdx) =>
      carIdx !== this.playerCarIdx &&
      !this.cars.get(carIdx)?.ignored &&
      onPitRoad[carIdx] !== true &&
      surfaces[carIdx] !== TrackLocation.NotInWorld;

    if (events.playerEntered) {
      const lap = frame.CarIdxLap?.value?.[this.playerCarIdx];
      this.pendingPrediction = {
        breakdown: this.lastBreakdown,
        lap: typeof lap === 'number' && lap >= 0 ? lap : null,
        ...this.lastTraffic,
      };
      this.stopPlan = this.lastPlan;
    }
    for (const stop of events.completed) this.recordStop(stop, pcts, include);

    this.predict(
      frame,
      time,
      pcts,
      include,
      onPitRoad,
      surfaces,
      caution,
      pitSvFlags
    );
  }

  /** The nearest cars each side of `pct` and the reference-lap time to them. */
  private around(
    pct: number | null,
    pcts: readonly number[],
    include: (carIdx: number) => boolean
  ): Around {
    if (pct === null || !(pct >= 0)) return NO_AROUND;
    const { ahead, behind } = nearestAround(pct, pcts, include);
    return {
      ahead,
      behind,
      aheadGap: ahead === null ? null : this.gapSeconds(pct, pcts[ahead]),
      behindGap: behind === null ? null : this.gapSeconds(pcts[behind], pct),
    };
  }

  /**
   * Cars around the rejoin point when the player gets there, each moved at its
   * own pace: its recent laps, or its class estimate scaled to the player's
   * pace against the player's class estimate.
   */
  private projectedTraffic(
    pcts: readonly number[],
    include: Include,
    offsetPct: number | null,
    lossSeconds: number,
    rejoinPct: number | null
  ): Around {
    const player = this.cars.get(this.playerCarIdx);
    if (offsetPct === null || !player) return NO_AROUND;

    const lapTimes = this.dependencies?.lapTimes?.()?.lapTimes ?? [];
    const reference = this.referenceFor(this.playerCarIdx);
    const playerPace =
      (lapTimes[this.playerCarIdx] ?? 0) > 0
        ? lapTimes[this.playerCarIdx]
        : reference
          ? reference.finishTime - reference.startTime
          : player.classEstLapSeconds;
    const scale =
      player.classEstLapSeconds > 0
        ? playerPace / player.classEstLapSeconds
        : 1;
    const traffic = projectTraffic({
      playerPct: pcts[this.playerCarIdx],
      offsetPct,
      lossSeconds,
      exitPct: rejoinPct,
      reference,
      playerLapSeconds: playerPace,
      carPcts: pcts,
      carLapSeconds: (carIdx) => {
        const own = lapTimes[carIdx] ?? 0;
        if (own > 0) return own;
        const estimate = this.cars.get(carIdx)?.classEstLapSeconds ?? 0;
        return estimate > 0 ? estimate * scale : 0;
      },
      include,
    });
    const round2 = (value: number | null) =>
      value === null ? null : Number(value.toFixed(2));
    return {
      ahead: traffic.ahead,
      behind: traffic.behind,
      aheadGap: round2(traffic.aheadGap),
      behindGap: round2(traffic.behindGap),
    };
  }

  private gapSeconds(from: number, to: number): number | null {
    const reference = this.referenceFor(this.playerCarIdx);
    const seconds = reference
      ? spanSeconds(reference, from, to)
      : (this.cars.get(this.playerCarIdx)?.classEstLapSeconds ?? 0) > 0
        ? forwardPct(from, to) *
          (this.cars.get(this.playerCarIdx) as CarInfo).classEstLapSeconds
        : null;
    return seconds === null ? null : Number(seconds.toFixed(2));
  }

  private windowPct() {
    if (!(this.trackLengthMetres > 0)) {
      return { before: FALLBACK_WINDOW_PCT, after: FALLBACK_WINDOW_PCT };
    }
    return {
      before: Math.min(0.1, WINDOW_BEFORE_METRES / this.trackLengthMetres),
      after: Math.min(0.1, WINDOW_AFTER_METRES / this.trackLengthMetres),
    };
  }

  private refreshReferenceLaps() {
    const snapshot = this.dependencies?.referenceLaps();
    if (!snapshot || snapshot.version === this.referenceVersion) return;
    this.referenceVersion = snapshot.version;
    this.bestLaps = new Map(snapshot.bestLaps);
    this.classLaps = new Map(snapshot.persistedLaps);
  }

  private referenceFor(carIdx: number): ReferenceLap | null {
    const car = this.cars.get(carIdx);
    return (
      this.bestLaps.get(carIdx) ??
      (car ? this.classLaps.get(car.carClassId) : undefined) ??
      null
    );
  }

  private recordStop(
    stop: CompletedStop,
    pcts: readonly number[],
    include: Include
  ) {
    const deps = this.dependencies;
    const car = this.cars.get(stop.carIdx);
    if (!deps || !car || car.ignored) return;
    const isPlayer = stop.carIdx === this.playerCarIdx;
    if (isPlayer) this.stopPlan = null;
    const reference = this.referenceFor(stop.carIdx);
    const referenceSeconds = reference
      ? spanSeconds(reference, stop.windowStartPct, stop.windowEndPct)
      : null;
    const context = {
      at: Date.now(),
      build: this.build,
      seriesId: this.seriesId,
      trackId: this.trackId,
      carId: car.carId,
      carClassId: car.carClassId,
      ruleSet: this.ruleSet,
    };

    if (
      !this.watchingReplay &&
      !stop.tainted &&
      stop.windowSeconds > 0 &&
      stop.stationarySeconds <= MAX_LANE_SAMPLE_STATIONARY_SECONDS
    ) {
      deps.persistence.addTransit(transitKey(this.trackId, car.carId), {
        ...context,
        source: isPlayer ? 'player' : 'opponent',
        pitSpeedLimitKph: this.pitSpeedLimitKph,
        entryPct: stop.entryPct,
        exitPct: stop.exitPct,
        windowSeconds: stop.windowSeconds,
        stationarySeconds: stop.stationarySeconds,
        referenceSeconds,
        windowStartPct: stop.windowStartPct,
        windowEndPct: stop.windowEndPct,
      });
      this.samplesAdded++;
    }

    if (!isPlayer) return;
    const service = stop.service;
    if (!this.watchingReplay && service && service.serviceSeconds > 0) {
      deps.persistence.addService(serviceKey(this.ruleSet, car.carId), {
        ...context,
        serviceSeconds: service.serviceSeconds,
        stationarySeconds: stop.stationarySeconds,
        fuelAddedLitres: service.fuelAddedLitres,
        fuelSeconds: service.fuelSeconds,
        tankLitres: this.tankLitres,
        tankPct: this.tankPct,
        tyresChanged: service.tyresChanged,
        repairSeconds: service.repairSeconds,
        fastRepair: service.fastRepair,
        tearOff: service.tearOff,
      });
      this.samplesAdded++;
    }

    const prediction = this.pendingPrediction;
    this.pendingPrediction = null;
    // The car is at the window end, back to racing speed.
    const actual = this.around(pcts[this.playerCarIdx], pcts, include);
    deps.report?.({
      at: Date.now(),
      seriesId: this.seriesId,
      sessionType:
        (this.sessionNum !== null
          ? this.sessionTypes.get(this.sessionNum)
          : undefined) ?? '',
      lap: prediction?.lap ?? null,
      cautionDuringStop: stop.caution,
      taintReasons: stop.taintReasons,
      firstTaintSeconds: stop.firstTaintSeconds,
      trackId: this.trackId,
      carId: car.carId,
      carClassId: car.carClassId,
      carPath: car.carPath,
      ruleSet: this.ruleSet,
      build: this.build,
      predicted: prediction?.breakdown ?? null,
      actualLossSeconds:
        !stop.tainted && referenceSeconds !== null
          ? Number((stop.windowSeconds - referenceSeconds).toFixed(2))
          : null,
      actualStationarySeconds: Number(stop.stationarySeconds.toFixed(2)),
      actualServiceSeconds: Number((service?.serviceSeconds ?? 0).toFixed(2)),
      actualFuelLitres: Number((service?.fuelAddedLitres ?? 0).toFixed(2)),
      actualFuelSeconds:
        service?.fuelSeconds != null
          ? Number(service.fuelSeconds.toFixed(2))
          : null,
      actualTyres: tyreCount(service?.tyresChanged ?? 0),
      predictedAheadCarIdx: prediction?.ahead ?? null,
      predictedBehindCarIdx: prediction?.behind ?? null,
      actualAheadCarIdx: actual.ahead,
      actualBehindCarIdx: actual.behind,
      predictedAheadGapSeconds: prediction?.aheadGap ?? null,
      predictedBehindGapSeconds: prediction?.behindGap ?? null,
      actualAheadGapSeconds: actual.aheadGap,
      actualBehindGapSeconds: actual.behindGap,
    });
  }

  private entryExit(file: PitStopModelFile): {
    entryPct: number | null;
    exitPct: number | null;
  } {
    const prefix = `${this.trackId}:`;
    const entries: number[] = [];
    const exits: number[] = [];
    for (const [key, samples] of Object.entries(file.transit)) {
      if (!key.startsWith(prefix)) continue;
      for (const sample of samples) {
        entries.push(sample.entryPct);
        exits.push(sample.exitPct);
      }
    }
    return {
      entryPct:
        circularMedian(entries) ?? this.calibration?.pitEntryPct ?? null,
      exitPct: circularMedian(exits) ?? this.calibration?.pitExitPct ?? null,
    };
  }

  private resolve(player: CarInfo, reference: ReferenceLap | null) {
    const deps = this.dependencies as PitStopEstimateDependencies;
    const file = deps.persistence.read();
    if (
      this.resolvedFor === file &&
      this.resolvedSamples === this.samplesAdded &&
      this.resolvedReferenceVersion === this.referenceVersion &&
      this.resolvedService !== null
    ) {
      return;
    }
    this.resolvedFor = file;
    this.resolvedSamples = this.samplesAdded;
    this.resolvedReferenceVersion = this.referenceVersion;
    const { entryPct, exitPct } = this.entryExit(file);
    this.resolvedLane = resolveLaneLoss({
      file,
      trackId: this.trackId,
      carId: player.carId,
      carClassId: player.carClassId,
      reference,
      entryPct,
      exitPct,
      trackLengthMetres: this.trackLengthMetres,
      pitSpeedLimitKph: this.pitSpeedLimitKph,
    });
    this.resolvedService = resolveServiceRule({
      file,
      ruleSet: this.ruleSet,
      carId: player.carId,
      carClassId: player.carClassId,
      carPath: player.carPath,
      tankLitres: this.tankLitres,
    });
  }

  private predict(
    frame: Telemetry,
    time: number,
    pcts: readonly number[],
    include: Include,
    onPitRoad: readonly boolean[],
    surfaces: readonly number[],
    caution: boolean,
    pitSvFlags: number
  ) {
    const player = this.cars.get(this.playerCarIdx);
    const playerPct = pcts[this.playerCarIdx];
    const progress = this.detector.playerStop(this.playerCarIdx);
    const plan = progress ? this.stopPlan : null;
    const visible =
      !!player &&
      !this.watchingReplay &&
      this.sessionNum !== null &&
      this.sessionTypes.get(this.sessionNum) === 'Race' &&
      booleanAt(frame, 'IsOnTrack') &&
      playerPct >= 0 &&
      (plan !== null || onPitRoad[this.playerCarIdx] !== true) &&
      surfaces[this.playerCarIdx] !== TrackLocation.NotInWorld;
    if (!visible || !player) {
      this.lastBreakdown = null;
      this.lastPlan = null;
      this.lastTraffic = NO_AROUND;
      this.publish(hiddenSnapshot(0));
      return;
    }

    const reference = this.referenceFor(this.playerCarIdx);
    const fallbackLap =
      player.classEstLapSeconds > 0 ? player.classEstLapSeconds : null;
    const fuel = this.dependencies?.fuel();
    const stopNeeded = fuel
      ? fuelStopNeeded(
          fuel.fuelLevel,
          fuel.estimatedLapsRemaining,
          fuel.hasValidRaceEstimate,
          fuel.completedLaps
        )
      : null;

    if (plan && progress) {
      this.publishStop(
        plan,
        progress,
        time,
        pcts,
        include,
        reference,
        fallbackLap,
        caution,
        stopNeeded
      );
      return;
    }

    this.resolve(player, reference);
    const lane = this.resolvedLane;
    const service = this.resolvedService as ResolvedServiceRule;

    const fuelLevel = numberAt(frame, 'FuelLevel') ?? 0;
    const space = Math.max(0, this.tankLitres * this.tankPct - fuelLevel);
    const fuelWanted =
      (pitSvFlags & PitSvFlags.FuelFill) !== 0
        ? Math.min(space, Math.max(0, numberAt(frame, 'PitSvFuel') ?? 0))
        : 0;
    const request = {
      fuelLitres: fuelWanted,
      tyres: tyreCount(pitSvFlags),
      repairSeconds:
        (pitSvFlags & PitSvFlags.FastRepair) !== 0
          ? 0
          : Math.max(0, numberAt(frame, 'PitRepairLeft') ?? 0),
    };
    const serviceTime = serviceEstimate(service, request);

    if (!lane) {
      this.lastBreakdown = null;
      this.lastPlan = null;
      this.lastTraffic = NO_AROUND;
      this.publish({
        ...hiddenSnapshot(0),
        state: 'calibrating',
        fuelStopNeeded: stopNeeded,
        sessionNum: this.sessionNum,
      });
      return;
    }

    const loss = lane.seconds + serviceTime.seconds;
    const near = lane.nearSeconds + serviceTime.nearSeconds;
    const far = lane.farSeconds + serviceTime.farSeconds;

    this.lastBreakdown = {
      lossSeconds: loss,
      lossFarSeconds: far,
      lossNearSeconds: near,
      laneSeconds: lane.seconds,
      laneSource: lane.source,
      serviceSeconds: serviceTime.seconds,
      fuelRateSource: service.fuelRateSource,
      tyreSource: service.tyreSource,
      overheadSeconds:
        request.fuelLitres > 0 || request.tyres > 0 || request.repairSeconds > 0
          ? service.rule.overheadSeconds
          : 0,
      overheadSource: service.overheadSource,
      fuelLitres: request.fuelLitres,
      fuelSource: request.fuelLitres > 0 ? 'pitMenu' : 'none',
      tyres: request.tyres,
      repairSeconds: request.repairSeconds,
      tableRow: service.tableRow,
      ruleFamily: service.family,
    };

    const weak =
      lane.source === 'model' ||
      (request.fuelLitres > 0 && service.fuelRateSource === 'generic') ||
      (request.tyres > 0 && service.tyreSource === 'generic');
    this.lastPlan = { lane, service: serviceTime, weak };
    this.publishRejoin({
      losses: { mid: loss, near, far },
      pcts,
      include,
      reference,
      fallbackLap,
      rejoinPct: this.entryExit(
        (this.dependencies as PitStopEstimateDependencies).persistence.read()
      ).exitPct,
      state: caution ? 'unreliable' : weak ? 'calibrating' : 'ok',
      stopNeeded,
      inStop: false,
    });
  }

  /**
   * During a stop: the loss planned at pit entry, less the time already lost
   * since the window start. Service time is the real stall time once it runs
   * longer than planned or has finished.
   */
  private publishStop(
    plan: StopPlan,
    progress: PlayerStopProgress,
    time: number,
    pcts: readonly number[],
    include: Include,
    reference: ReferenceLap | null,
    fallbackLap: number | null,
    caution: boolean,
    stopNeeded: boolean | null
  ) {
    const playerPct = pcts[this.playerCarIdx];
    const anchored = Number.isFinite(progress.windowStartTime);
    const startTime = anchored ? progress.windowStartTime : progress.entryTime;
    const startPct = anchored ? progress.windowStartPct : progress.entryPct;
    const driven = reference
      ? (spanSeconds(reference, startPct, playerPct) ??
        forwardPct(startPct, playerPct) * lapSeconds(reference))
      : forwardPct(startPct, playerPct) * (fallbackLap ?? 0);
    const lostSoFar = time - startTime - driven;
    const stall = progress.stationarySeconds;
    const service = (planned: number) =>
      progress.serviceDone ? stall : Math.max(planned, stall);
    const left = (lane: number, planned: number) =>
      Math.max(0, lane + service(planned) - lostSoFar);

    const { exitPct } = this.entryExit(
      (this.dependencies as PitStopEstimateDependencies).persistence.read()
    );
    const windowEnd =
      exitPct === null ? null : wrap01(exitPct + this.windowPct().after);
    const rejoinPct =
      windowEnd !== null && forwardPct(playerPct, windowEnd) < 0.5
        ? windowEnd
        : playerPct;

    this.publishRejoin({
      losses: {
        mid: left(plan.lane.seconds, plan.service.seconds),
        near: left(plan.lane.nearSeconds, plan.service.nearSeconds),
        far: left(plan.lane.farSeconds, plan.service.farSeconds),
      },
      pcts,
      include,
      reference,
      fallbackLap,
      rejoinPct,
      state: caution ? 'unreliable' : plan.weak ? 'calibrating' : 'ok',
      stopNeeded,
      inStop: true,
    });
  }

  private publishRejoin(input: {
    losses: { mid: number; near: number; far: number };
    pcts: readonly number[];
    include: Include;
    reference: ReferenceLap | null;
    fallbackLap: number | null;
    rejoinPct: number | null;
    state: PitStopEstimateSnapshot['state'];
    stopNeeded: boolean | null;
    inStop: boolean;
  }) {
    const { losses, pcts, reference, fallbackLap } = input;
    const playerPct = pcts[this.playerCarIdx];
    const offset = (loss: number) =>
      rejoinOffset(playerPct, loss, reference, fallbackLap);
    const mid = offset(losses.mid);
    const near = offset(losses.near);
    const far = offset(losses.far);
    const traffic = this.projectedTraffic(
      pcts,
      input.include,
      mid?.offsetPct ?? null,
      losses.mid,
      input.rejoinPct
    );
    this.lastTraffic = traffic;
    this.publish({
      state: input.state,
      offsetPct: round(mid?.offsetPct ?? null, 4),
      offsetNearPct: round(near?.offsetPct ?? null, 4),
      offsetFarPct: round(far?.offsetPct ?? null, 4),
      lapsLost: mid?.lapsLost ?? 0,
      lossSeconds: round(losses.mid, 1),
      fuelStopNeeded: input.stopNeeded,
      inStop: input.inStop,
      aheadCarIdx: traffic.ahead,
      aheadGapSeconds: round(traffic.aheadGap, 1),
      behindCarIdx: traffic.behind,
      behindGapSeconds: round(traffic.behindGap, 1),
      sessionNum: this.sessionNum,
      version: 0,
    });
  }

  private publish(next: PitStopEstimateSnapshot) {
    const current = this.latest;
    if (
      current.state === next.state &&
      current.offsetPct === next.offsetPct &&
      current.offsetNearPct === next.offsetNearPct &&
      current.offsetFarPct === next.offsetFarPct &&
      current.lapsLost === next.lapsLost &&
      current.lossSeconds === next.lossSeconds &&
      current.fuelStopNeeded === next.fuelStopNeeded &&
      current.inStop === next.inStop &&
      current.aheadCarIdx === next.aheadCarIdx &&
      current.aheadGapSeconds === next.aheadGapSeconds &&
      current.behindCarIdx === next.behindCarIdx &&
      current.behindGapSeconds === next.behindGapSeconds &&
      current.sessionNum === next.sessionNum
    ) {
      return;
    }
    this.version++;
    this.latest = { ...next, version: this.version };
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') this.watchingReplay = event.replay;
    if (event.type === 'enter' || event.type === 'disconnect') {
      this.detector.reset();
      this.sessionNum = null;
      this.pendingPrediction = null;
      this.stopPlan = null;
      this.lastBreakdown = null;
      this.lastPlan = null;
      this.lastTraffic = NO_AROUND;
      this.publish(hiddenSnapshot(0));
    }
    if (event.type === 'sessionNumChange') {
      this.detector.reset();
      this.pendingPrediction = null;
      this.stopPlan = null;
    }
  }

  snapshot(): PitStopEstimateSnapshot {
    return this.latest;
  }
}
