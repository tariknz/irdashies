import {
  IncidentType,
  type FuelCalculatorBridge,
  type FuelLapData,
  type Incident,
  type LapTraceBridge,
  type LapTraceRecord,
  type RaceControlBridge,
  type Session,
} from '@irdashies/types';
import { makeSyntheticLapTrace } from '@irdashies/frontend/components/LapTrace/fixtures/syntheticLap';

/** Browser-only sample storage. Nothing is written to disk or sent to the sim. */
export function createPreviewStorage() {
  let session: Session | null = null;
  const laps = new Map<string, FuelLapData[]>();
  const traces = new Map<string, LapTraceRecord | null>();
  const referenceCallbacks = new Set<() => void>();
  const clearCallbacks = new Set<() => void>();
  let incidentsCleared = false;

  const fuel: FuelCalculatorBridge = {
    getHistoricalLaps: async (trackId, carName) => {
      const key = `${trackId}:${carName}`;
      if (!laps.has(key)) {
        laps.set(
          key,
          Array.from({ length: 10 }, (_, i) => ({
            lapNumber: i + 1,
            fuelUsed: 2.2 + (i % 3) * 0.08,
            lapTime: 114 + (i % 3) * 0.4,
            isGreenFlag: true,
            isValidForCalc: true,
            isOutLap: false,
            isHistorical: true,
            timestamp: i * 114000,
          }))
        );
      }
      return structuredClone(laps.get(key) ?? []);
    },
    saveLap: async (trackId, carName, lap) => {
      const key = `${trackId}:${carName}`;
      const history = laps.get(key) ?? [];
      laps.set(key, [...history, structuredClone(lap)].slice(-20));
    },
    clearHistory: async (trackId, carName) => {
      laps.set(`${trackId}:${carName}`, []);
    },
    clearAllHistory: async () => {
      for (const key of laps.keys()) laps.set(key, []);
    },
    getQualifyMax: async () => 2.4,
    saveQualifyMax: async () => undefined,
    startNewLog: async () => undefined,
    logData: async () => undefined,
  };

  const lapTrace: LapTraceBridge = {
    getLapTrace: async (trackId, carPath, kind) => {
      const key = `${trackId}:${carPath}:${kind}`;
      if (!traces.has(key) && kind === 'best') {
        const trackLengthM =
          parseFloat(session?.WeekendInfo?.TrackLength ?? '5') * 1000;
        traces.set(key, {
          ...makeSyntheticLapTrace({
            trackId,
            carPath,
            trackLengthM,
            cornerApexesM: [0.13, 0.3, 0.5, 0.65, 0.8, 0.92].map(
              (pct) => pct * trackLengthM
            ),
          }),
          trackConfigName: session?.WeekendInfo?.TrackConfigName ?? '',
        });
      }
      return structuredClone(traces.get(key) ?? null);
    },
    saveLapTrace: async (trackId, carPath, kind, record) => {
      traces.set(`${trackId}:${carPath}:${kind}`, structuredClone(record));
    },
    clearLapTrace: async (trackId, carPath, kind) => {
      traces.set(`${trackId}:${carPath}:${kind}`, null);
    },
    pickAndParseIbtLap: async () => null,
    pickGarage61Csv: async () => null,
    fetchLapTraceFromGarage61: async () => {
      throw new Error('Import reference laps in the irDashies app.');
    },
    notifyReferenceUpdated: () => referenceCallbacks.forEach((cb) => cb()),
    onReferenceUpdated: (cb) => {
      referenceCallbacks.add(cb);
      return () => referenceCallbacks.delete(cb);
    },
    requestClearBestLap: () => clearCallbacks.forEach((cb) => cb()),
    onClearBestLap: (cb) => {
      clearCallbacks.add(cb);
      return () => clearCallbacks.delete(cb);
    },
    getCurrentBestLapInfo: async () => {
      const driver = session?.DriverInfo?.Drivers.find(
        (d) => d.CarIdx === session?.DriverInfo.DriverCarIdx
      );
      if (!session || !driver) return null;
      return {
        trackName: session.WeekendInfo.TrackDisplayName,
        carName: driver.CarScreenName,
        hasBest:
          traces.get(
            `${session.WeekendInfo.TrackID}:${driver.CarPath}:best`
          ) !== null,
      };
    },
    getGarage61SearchInfo: async () => null,
  };

  const raceControl: RaceControlBridge = {
    getIncidents: async () => {
      const race = session?.SessionInfo?.Sessions.find(
        (s) => s.SessionType === 'Race'
      );
      const drivers =
        session?.DriverInfo?.Drivers.filter((d) => !d.CarIsPaceCar).slice(
          0,
          3
        ) ?? [];
      const types = [
        IncidentType.OffTrack,
        IncidentType.PitEntry,
        IncidentType.Slowdown,
      ];
      const incidents: Incident[] = incidentsCleared
        ? []
        : drivers.map((driver, i) => ({
            id: `preview-${i}`,
            carIdx: driver.CarIdx,
            driverName: driver.UserName,
            carNumber: driver.CarNumber,
            teamName: driver.TeamName,
            sessionNum: race?.SessionNum ?? 0,
            sessionTime: 540 + i * 15,
            lapNum: 3,
            replayFrameNum: 0,
            type: types[i],
            lapDistPct: 0.2 + i * 0.15,
            timestamp: i * 15000,
          }));
      return {
        sessionId: String(session?.WeekendInfo?.SubSessionID ?? ''),
        incidents,
      };
    },
    replayIncident: async () => undefined,
    focusDriver: async () => undefined,
    clearIncidents: async () => {
      incidentsCleared = true;
    },
    updateThresholds: async () => undefined,
    updateRetention: async () => undefined,
    showGantryWindow: async () => false,
  };

  return {
    fuel,
    lapTrace,
    raceControl,
    updateSession: (value: Session) => {
      session = value;
    },
  };
}
