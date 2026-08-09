import type {
  Session,
  SessionBarSnapshot,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

type MutableSessionBarSnapshot = Omit<
  SessionBarSnapshot,
  'competitorCarIds' | 'competitorPositions'
> & {
  competitorCarIds: number[];
  competitorPositions: number[];
};

const n = (f: Telemetry, k: keyof Telemetry): number | undefined => {
  const v = f[k]?.value?.[0];
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
};
const a = (f: Telemetry, k: keyof Telemetry): readonly unknown[] => {
  const value = f[k]?.value;
  return Array.isArray(value) ? value : [];
};

export class SessionBarProcessor implements TelemetryProcessor<SessionBarSnapshot> {
  readonly channel = 'session-bar.snapshot';
  // Sample every source frame so the per-lap top speed remains accurate. The
  // channel bus still limits renderer delivery to its configured 5 Hz.
  readonly tickRateHz = 25;
  private session?: Session;
  private lastTime = -Infinity;
  private lap = -1;
  private lapTop = 0;
  private enabled = true;
  private readonly latest = this.empty();

  init(session: Session): void {
    this.session = session;
  }
  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;
    const time = n(frame, 'SessionTime');
    if (time === undefined) return;
    const sessionNum = n(frame, 'SessionNum') ?? null;
    if (
      this.latest.sessionNum !== null &&
      sessionNum !== this.latest.sessionNum
    )
      this.reset(sessionNum);
    const currentLap = n(frame, 'Lap') ?? 0;
    const speed = n(frame, 'Speed') ?? 0;
    if (this.lap >= 0 && currentLap > this.lap) {
      this.latest.lastLapTopSpeed = this.lapTop || null;
      this.latest.sessionBestTopSpeed =
        Math.max(
          this.latest.sessionBestTopSpeed ?? 0,
          this.latest.lastLapTopSpeed ?? 0
        ) || null;
      this.lapTop = 0;
    } else if (this.lap >= 0 && currentLap < this.lap) {
      this.lapTop = 0;
    }
    this.lap = currentLap;
    this.lapTop = Math.max(this.lapTop, speed);
    if (time < this.lastTime || time - this.lastTime < 0.2 - 1e-6) return;
    this.lastTime = time;
    const info = this.session?.SessionInfo?.Sessions?.find(
      (s) => s.SessionNum === sessionNum
    );
    const drivers = this.session?.DriverInfo?.Drivers ?? [];
    const playerCarIdx = this.session?.DriverInfo?.DriverCarIdx ?? null;
    const player = drivers.find((d) => d?.CarIdx === playerCarIdx);
    const positions = a(frame, 'CarIdxPosition');
    const classPositions = a(frame, 'CarIdxClassPosition');
    this.latest.competitorCarIds.length = 0;
    this.latest.competitorPositions.length = 0;
    let classSize = 0;
    for (const driver of drivers) {
      if (!driver || driver.CarIsPaceCar || driver.IsSpectator) continue;
      if (driver.CarClassID === player?.CarClassID) classSize += 1;
      this.latest.competitorCarIds.push(driver.CarID ?? 0);
      const position = positions[driver.CarIdx];
      this.latest.competitorPositions.push(
        typeof position === 'number' ? position : 0
      );
    }
    const bestLaps = a(frame, 'CarIdxBestLapTime');
    let sessionBest: number | undefined;
    for (const value of bestLaps)
      if (
        typeof value === 'number' &&
        value > 0 &&
        (sessionBest === undefined || value < sessionBest)
      )
        sessionBest = value;
    const isClio = player?.CarID === 162;
    Object.assign(this.latest, {
      sessionName: info?.SessionType,
      trackDisplayName: this.session?.WeekendInfo?.TrackDisplayName,
      displayUnits: n(frame, 'DisplayUnits') ?? 0,
      brakeBias: n(frame, isClio ? 'dcPeakBrakeBias' : 'dcBrakeBias'),
      brakeBiasIsClio: isClio,
      incidents: n(frame, 'PlayerCarTeamIncidentCount') ?? 0,
      incidentLimit: this.session?.WeekendInfo?.WeekendOptions?.IncidentLimit,
      incidentWarningInitialLimit:
        this.session?.WeekendInfo?.WeekendOptions?.IncidentWarningInitialLimit,
      incidentWarningSubsequentLimit:
        this.session?.WeekendInfo?.WeekendOptions
          ?.IncidentWarningSubsequentLimit,
      trackWetness: n(frame, 'TrackWetness') ?? 0,
      precipitation: n(frame, 'Precipitation'),
      relativeHumidity: n(frame, 'RelativeHumidity'),
      airTemp: n(frame, 'AirTemp'),
      trackTemp: n(frame, 'TrackTempCrew'),
      windDirection: n(frame, 'WindDir'),
      windVelocity: n(frame, 'WindVel'),
      windYaw: n(frame, 'YawNorth'),
      fuelLevel: n(frame, 'FuelLevel'),
      lastLapTime: n(frame, 'LapLastLapTime'),
      bestLapTime: n(frame, 'LapBestLapTime'),
      sessionBestLap: sessionBest,
      sessionTimeOfDay: n(frame, 'SessionTimeOfDay'),
      playerCarIdx,
      playerCarId: player?.CarID,
      playerClassified: Boolean(
        player && !player.CarIsPaceCar && !player.IsSpectator
      ),
      playerOverallPosition:
        typeof positions[playerCarIdx ?? -1] === 'number'
          ? (positions[playerCarIdx ?? -1] as number)
          : 0,
      playerClassPosition:
        typeof classPositions[playerCarIdx ?? -1] === 'number'
          ? (classPositions[playerCarIdx ?? -1] as number)
          : 0,
      playerClassSize: classSize,
      sessionNum,
      version: this.latest.version + 1,
    });
  }
  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.enabled = !event.replay;
      if (event.replay) this.reset(null);
    } else this.reset(null);
  }
  snapshot(): SessionBarSnapshot {
    return {
      ...this.latest,
      competitorCarIds: [...this.latest.competitorCarIds],
      competitorPositions: [...this.latest.competitorPositions],
    };
  }
  snapshotVersion(): number {
    return this.latest.version;
  }
  private reset(sessionNum: number | null): void {
    const version = this.latest.version + 1;
    Object.assign(this.latest, this.empty(), { sessionNum, version });
    this.lastTime = -Infinity;
    this.lap = -1;
    this.lapTop = 0;
  }
  private empty(): MutableSessionBarSnapshot {
    return {
      sessionName: undefined,
      trackDisplayName: undefined,
      displayUnits: 0,
      brakeBias: undefined,
      brakeBiasIsClio: false,
      incidents: 0,
      incidentLimit: undefined,
      incidentWarningInitialLimit: undefined,
      incidentWarningSubsequentLimit: undefined,
      trackWetness: 0,
      precipitation: undefined,
      relativeHumidity: undefined,
      airTemp: undefined,
      trackTemp: undefined,
      windDirection: undefined,
      windVelocity: undefined,
      windYaw: undefined,
      fuelLevel: undefined,
      lastLapTime: undefined,
      bestLapTime: undefined,
      sessionBestLap: undefined,
      sessionTimeOfDay: undefined,
      playerCarIdx: null,
      playerCarId: undefined,
      playerClassified: false,
      playerOverallPosition: 0,
      playerClassPosition: 0,
      playerClassSize: 0,
      competitorCarIds: [],
      competitorPositions: [],
      lastLapTopSpeed: null,
      sessionBestTopSpeed: null,
      sessionNum: null,
      version: 0,
    };
  }
}
