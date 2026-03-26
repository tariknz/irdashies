import { useState, useEffect, useMemo, useRef } from 'react';
import {
  useTelemetryValue,
  useTelemetryValues,
  useTelemetryValuesRounded,
} from '@irdashies/context';
import type { LapEntry } from '../demoData';
import { useLapTimeLogSettings } from './useLapTimeLogSettings';

const TRACK_SURFACE_OFF_TRACK = 4;
const MAX_HISTORY_ENTRIES = 10;

export const useLapTimeLog = () => {

  // reset functions
  const resetSessionState = () => {
    setHistory([]);
    setSavedDelta(0);
    setIsDirty(false);
    setDisplayTime(undefined);
  };

  const resetLapState = () => {
    setIsDirty(false);
    setSavedDelta(0);
  };

  // Get settings
  const settings = useLapTimeLogSettings();

  // States
  const [history, setHistory] = useState<LapEntry[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [displayTime, setDisplayTime] = useState<number | undefined>(0);
  const [savedDelta, setSavedDelta] = useState<number>(0);

  // Telemetry
  const lapCompleted = useTelemetryValue<number>('LapCompleted') ?? 0;
  const currentLapTime = useTelemetryValue<number>('LapCurrentLapTime') ?? 0;
  const lastLapTime = useTelemetryValue<number>('LapLastLapTime') ?? 0;
  const bestLapTime = useTelemetryValue<number>('LapBestLapTime') ?? 0;
  const carIdxBestLapTime = useTelemetryValues<number[]>('CarIdxBestLapTime');
  const sessionNum = useTelemetryValue<number>('SessionNum') ?? 0;
  const sessionTime = useTelemetryValuesRounded('SessionTime', 0)[0] ?? 0;
  const playerTrackSurface = useTelemetryValue<number>('PlayerTrackSurface') ?? 0;
  const incidentCount = useTelemetryValue<number>('PlayerCarMyIncidentCount') ?? 0;

  // Refs
  const lastLoggedLap = useRef<number>(lapCompleted);
  const lastLoggedTime = useRef<number>(0);
  const prevSessionNum = useRef<number>(sessionNum);
  const prevSessionTime = useRef<number>(sessionTime);
  const referenceAtStartOfLap = useRef<number>(0);
  const incidentsAtLapStart = useRef<number>(incidentCount);
  const lastDeltaUpdate = useRef<number>(0);
  const lapTransition = useRef<boolean>(false);

  // Get overall best
  const sessionBestOverall = useMemo(() => {
    if (!carIdxBestLapTime?.length) return undefined;
    const validLaps = carIdxBestLapTime.filter((lap) => lap > 0);
    return validLaps.length === 0 ? undefined : Math.min(...validLaps);
  }, [carIdxBestLapTime]);

  // Calculate predicted lap time
  const deltaMethod = settings?.delta?.method ?? 'bestlap';
  const referenceTime = deltaMethod === 'lastlap' ? lastLapTime : bestLapTime;

  const deltaMethodMap = {
    lastlap: 'LapDeltaToSessionLastlLap',
    bestlap: 'LapDeltaToSessionBestLap',
  } as const;
  const liveDelta = useTelemetryValue<number>(deltaMethodMap[deltaMethod]) ?? 0;

  const deltaCheckMap = {
    lastlap: 'LapDeltaToSessionLastlLap_OK',
    bestlap: 'LapDeltaToSessionBestLap_OK',
  } as const;
  const deltaCheck = useTelemetryValue<number>(deltaCheckMap[deltaMethod]) ?? 0;

  // 1. handles resets/restarts
  useEffect(() => {
    const sessionChanged = sessionNum !== prevSessionNum.current;
    const sessionRestarted = sessionTime < prevSessionTime.current - 5;
    if (sessionChanged || sessionRestarted) {
      lastLoggedLap.current = lapCompleted;
      lastLoggedTime.current = lastLapTime;      
      incidentsAtLapStart.current = incidentCount;
      referenceAtStartOfLap.current = 0;
      lastDeltaUpdate.current = 0;
      lapTransition.current = false;
      resetSessionState();
    }
    prevSessionNum.current = sessionNum;
    prevSessionTime.current = sessionTime;
  }, [sessionNum, sessionTime, lapCompleted, incidentCount, lastLapTime]);

  // 2. check for new lap
  useEffect(() => {
    lapTransition.current = lapCompleted > 0 && lapCompleted != lastLoggedLap.current;
    // auto reset to prevent stuck timer
    const timeout = setTimeout(() => {
      lapTransition.current = false;
    }, 5000);
    // cleanup
    return () => clearTimeout(timeout);
  }, [lapCompleted]);

  // 3. live tracking during the lap
  useEffect(() => {
    // 3a. get valid time for current lap
    setDisplayTime(() => {
      if (lapTransition.current) {
        return undefined; // hide for milliseconds during transition
      } else {
        return currentLapTime;
      }
    });
    // 3b. prediction Logic (throttle to 100ms)
    const now = Date.now();
    if (now - lastDeltaUpdate.current >= 100) {
      setSavedDelta((prev) => {
        const currentDelta = liveDelta ?? 0;
        if (
          deltaCheck &&
          displayTime &&
          currentLapTime > 5 &&
          !lapTransition.current
        ) {
          lastDeltaUpdate.current = now;
          return currentDelta;
        }
        return prev;
      });
    }
    // 3c. incident/dirty lap logic
    setIsDirty((prev) => {
      if (!prev) {
        const offTrack = playerTrackSurface === TRACK_SURFACE_OFF_TRACK;
        const incidentOccurred = incidentCount > incidentsAtLapStart.current;
        return offTrack || incidentOccurred;
      }
      return prev;
    });
  }, [
    currentLapTime,
    displayTime,
    lapCompleted,
    liveDelta,
    deltaCheck,
    referenceTime,
    incidentCount,
    playerTrackSurface,
  ]);

  // 4. log lap history and reset
  useEffect(() => {
    // wait for new last lap time
    const isValidTime = lastLapTime > 0 && lastLapTime !== lastLoggedTime.current;
    if (!lapTransition.current || !isValidTime) return;
    // prevent duplicates
    if (history.some((entry) => entry.lap === lapCompleted)) return;
    // add new entry
    const newEntry: LapEntry = {
      lap: lapCompleted,
      time: lastLapTime,
      delta:
        referenceAtStartOfLap.current > 0
          ? lastLapTime - referenceAtStartOfLap.current
          : 0,
      dirty: isDirty,
    };
    setHistory((prev) =>
      [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES)
    );
    // reset for new lap
    lastLoggedLap.current = lapCompleted;
    lastLoggedTime.current = lastLapTime;
    referenceAtStartOfLap.current = referenceTime ?? 0;
    incidentsAtLapStart.current = incidentCount;
    lapTransition.current = false;
    resetLapState();
  }, [lapCompleted, lastLapTime, isDirty, incidentCount, referenceTime, history]);

  return {
    current: displayTime,
    lastlap: lastLapTime,
    bestlap: bestLapTime,
    reference: referenceTime,
    delta: savedDelta,
    overall: sessionBestOverall,
    dirty: isDirty,
    history: history,
    settings: settings,
  };
};
