import type {
  Incident,
  IncidentThresholds,
  CarIncidentState,
} from '../../types/raceControl';

type IncidentListener = (incident: Incident) => void;

export class IncidentDetector {
  private carStates = new Map<number, CarIncidentState>();
  private listeners = new Set<IncidentListener>();
  private sessionDrivers = new Map<
    number,
    { name: string; carNumber: string; teamName: string; isPaceCar: boolean }
  >();
  private isDev: boolean;

  constructor(
    private thresholds: IncidentThresholds,
    isDev: boolean
  ) {
    this.isDev = isDev;
  }

  updateThresholds(thresholds: IncidentThresholds) {
    this.thresholds = thresholds;
  }

  updateSession(session: {
    DriverInfo?: {
      Drivers?: {
        CarIdx: number;
        UserName: string;
        CarNumber: string;
        TeamName: string;
        CarIsPaceCar: number;
      }[];
    };
  }) {
    this.carStates.clear();
    this.sessionDrivers.clear();
    session.DriverInfo?.Drivers?.forEach((d) => {
      this.sessionDrivers.set(d.CarIdx, {
        name: d.UserName,
        carNumber: d.CarNumber,
        teamName: d.TeamName,
        isPaceCar: d.CarIsPaceCar === 1,
      });
    });
  }

  /** Exposed for testing. Returns speed in km/h. Returns 0 for backwards movement. */
  calculateSpeed(
    prevLapDistPct: number,
    currLapDistPct: number,
    deltaTime: number,
    trackLengthM: number
  ): number {
    if (deltaTime <= 0) return 0;
    let distPct = currLapDistPct - prevLapDistPct;
    if (distPct < -0.5) distPct += 1.0; // wrap-around
    if (distPct <= 0) return 0;
    const distanceM = trackLengthM * distPct;
    return (distanceM / deltaTime) * 3.6;
  }

  onIncident(cb: IncidentListener) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  processTelemetry() {
    // Implemented in subsequent tasks
  }

  private emit(incident: Incident) {
    this.listeners.forEach((cb) => cb(incident));
  }
}
