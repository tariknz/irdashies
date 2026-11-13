import type {
  FuelProjectionSnapshot,
  PitLaneTrackData,
  PitStopEstimateBreakdown,
  PitStopEstimateSnapshot,
  PitStopModelFile,
  PitStopReport,
  ReferenceLap,
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
import type { CompletedStop } from './pitStop/PitStopDetector';
import {
  circularMedian,
  fuelStopNeeded,
  nearestAround,
  parseSpeedKph,
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

const numberAt = (frame: Telemetry, key: keyof Telemetry): number | null => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const booleanAt = (frame: Telemetry, key: keyof Telemetry): boolean =>
  frame[key]?.value?.[0] === true;

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
  private lastOffsetPct: number | null = null;
  private pendingPrediction:
    | ({
        breakdown: PitStopEstimateBreakdown | null;
        lap: number | null;
      } & Around)
    | null = null;
  private actualAround: Around = {
    ahead: null,
    behind: null,
    aheadGap: null,
    behindGap: null,
  };

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
      beforePct: window.before,
      afterPct: window.after,
    });

    this.refreshReferenceLaps();
    const include = (carIdx: number) =>
      carIdx !== this.playerCarIdx &&
      !this.cars.get(carIdx)?.ignored &&
      onPitRoad[carIdx] !== true &&
      surfaces[carIdx] !== TrackLocation.NotInWorld;

    if (events.playerEntered) {
      const ghost =
        this.lastOffsetPct !== null
          ? (((pcts[this.playerCarIdx] - this.lastOffsetPct) % 1) + 1) % 1
          : null;
      const lap = frame.CarIdxLap?.value?.[this.playerCarIdx];
      this.pendingPrediction = {
        breakdown: this.lastBreakdown,
        lap: typeof lap === 'number' && lap >= 0 ? lap : null,
        ...this.around(ghost, pcts, include),
      };
    }
    if (events.playerExited) {
      this.actualAround = this.around(pcts[this.playerCarIdx], pcts, include);
    }
    for (const stop of events.completed) this.recordStop(stop);

    this.predict(frame, pcts, onPitRoad, surfaces, caution, pitSvFlags);
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

  private recordStop(stop: CompletedStop) {
    const deps = this.dependencies;
    const car = this.cars.get(stop.carIdx);
    if (!deps || !car || car.ignored) return;
    const isPlayer = stop.carIdx === this.playerCarIdx;
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
    deps.report?.({
      at: Date.now(),
      seriesId: this.seriesId,
      sessionType:
        (this.sessionNum !== null
          ? this.sessionTypes.get(this.sessionNum)
          : undefined) ?? '',
      lap: prediction?.lap ?? null,
      cautionDuringStop: stop.caution,
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
      actualAheadCarIdx: this.actualAround.ahead,
      actualBehindCarIdx: this.actualAround.behind,
      predictedAheadGapSeconds: prediction?.aheadGap ?? null,
      predictedBehindGapSeconds: prediction?.behindGap ?? null,
      actualAheadGapSeconds: this.actualAround.aheadGap,
      actualBehindGapSeconds: this.actualAround.behindGap,
    });
    this.actualAround = NO_AROUND;
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
    pcts: readonly number[],
    onPitRoad: readonly boolean[],
    surfaces: readonly number[],
    caution: boolean,
    pitSvFlags: number
  ) {
    const player = this.cars.get(this.playerCarIdx);
    const playerPct = pcts[this.playerCarIdx];
    const visible =
      !!player &&
      !this.watchingReplay &&
      this.sessionNum !== null &&
      this.sessionTypes.get(this.sessionNum) === 'Race' &&
      booleanAt(frame, 'IsOnTrack') &&
      playerPct >= 0 &&
      onPitRoad[this.playerCarIdx] !== true &&
      surfaces[this.playerCarIdx] !== TrackLocation.NotInWorld;
    if (!visible || !player) {
      this.lastOffsetPct = null;
      this.publish(hiddenSnapshot(0));
      return;
    }

    const reference = this.referenceFor(this.playerCarIdx);
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
    const fuel = this.dependencies?.fuel();
    const stopNeeded = fuel
      ? fuelStopNeeded(
          fuel.fuelLevel,
          fuel.estimatedLapsRemaining,
          fuel.hasValidRaceEstimate,
          fuel.completedLaps
        )
      : null;

    if (!lane) {
      this.lastOffsetPct = null;
      this.lastBreakdown = null;
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
    const fallbackLap =
      player.classEstLapSeconds > 0 ? player.classEstLapSeconds : null;
    const mid = rejoinOffset(playerPct, loss, reference, fallbackLap);
    const nearOffset = rejoinOffset(playerPct, near, reference, fallbackLap);
    const farOffset = rejoinOffset(playerPct, far, reference, fallbackLap);

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
    this.lastOffsetPct = mid?.offsetPct ?? null;

    const weak =
      lane.source === 'model' ||
      (request.fuelLitres > 0 && service.fuelRateSource === 'generic') ||
      (request.tyres > 0 && service.tyreSource === 'generic');
    this.publish({
      state: caution ? 'unreliable' : weak ? 'calibrating' : 'ok',
      offsetPct: round(mid?.offsetPct ?? null, 4),
      offsetNearPct: round(nearOffset?.offsetPct ?? null, 4),
      offsetFarPct: round(farOffset?.offsetPct ?? null, 4),
      lapsLost: mid?.lapsLost ?? 0,
      lossSeconds: round(loss, 1),
      fuelStopNeeded: stopNeeded,
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
      this.lastOffsetPct = null;
      this.lastBreakdown = null;
      this.publish(hiddenSnapshot(0));
    }
    if (event.type === 'sessionNumChange') {
      this.detector.reset();
      this.pendingPrediction = null;
    }
  }

  snapshot(): PitStopEstimateSnapshot {
    return this.latest;
  }
}
