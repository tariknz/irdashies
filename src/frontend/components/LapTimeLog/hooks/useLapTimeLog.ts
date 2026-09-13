import { useState, useEffect, useMemo, useRef } from 'react';
import {
  useLapLogSnapshot,
  usePersonalBestStore,
  useSessionStore,
  useDriverCarIdx,
} from '@irdashies/context';
import { TrackLocation } from '@irdashies/types';
import type { LapEntry } from '../demoData';
import { useLapTimeLogSettings } from './useLapTimeLogSettings';

/**
 * A lap counts as pitted if the car was in the pit lane or its box at any point
 * during it. That covers the in-lap and the out-lap without special-casing
 * either: an out-lap starts in the stall, so the surface already reads
 * InPitStall when it begins.
 */
const PIT_SURFACES: readonly number[] = [
  TrackLocation.InPitStall,
  TrackLocation.ApproachingPits,
];

/**
 * Exported so the mapping onto TrackLocation is testable. It is worth pinning:
 * this file previously compared the surface against a hardcoded 4, which is not
 * a value the enum can take, so the off-track check never fired.
 */
export const isPitSurface = (surface: number): boolean =>
  PIT_SURFACES.includes(surface);

export const isOffTrackSurface = (surface: number): boolean =>
  surface === TrackLocation.OffTrack;
/**
 * The retained history has to outrun the display, not match it. "Number Of Laps
 * To Show" goes up to 20, and with pitted laps hidden the display filters this
 * list before taking that many — so a cap of 20 made the setting unsatisfiable
 * the moment a stop happened: the clean laps that could have filled the gap had
 * already been dropped here. 60 covers the maximum display count even on short
 * fuel runs where two laps in three are in-laps or out-laps, and the entries are
 * five numbers each.
 */
const MAX_HISTORY_ENTRIES = 60;
const FREEZE_TIME = 5;

export const useLapTimeLog = () => {
  // reset functions
  const resetSessionState = () => {
    setHistory([]);
    setSavedDelta(0);
    setIsDirty(false);
    setIsPitted(false);
    setDisplayTime(undefined);
  };

  const resetLapState = () => {
    setIsDirty(false);
    setIsPitted(false);
    setSavedDelta(0);
  };

  // Get settings
  const settings = useLapTimeLogSettings();

  // Get session data for personal best tracking
  const session = useSessionStore((state) => state.session);
  const trackId = session?.WeekendInfo?.TrackID?.toString() ?? 0;
  const drivers = useMemo(
    () => session?.DriverInfo?.Drivers ?? [],
    [session?.DriverInfo?.Drivers]
  );
  const playerCarIdx = useDriverCarIdx();
  const playerCarName = useMemo(() => {
    if (playerCarIdx === null || playerCarIdx === undefined) return 'unknown';
    const driver = drivers[playerCarIdx];
    return driver?.CarPath ?? 'unknown';
  }, [playerCarIdx, drivers]);

  // States
  const [history, setHistory] = useState<LapEntry[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [isPitted, setIsPitted] = useState<boolean>(false);
  const [displayTime, setDisplayTime] = useState<number | undefined>(0);
  const [savedDelta, setSavedDelta] = useState<number>(0);

  // Telemetry
  const snapshot = useLapLogSnapshot();
  const lapCompleted = snapshot?.lapCompleted ?? 0;
  const currentLapTime = snapshot?.currentLapTime ?? 0;
  const lastLapTime = snapshot?.lastLapTime ?? 0;
  const bestLapTime = snapshot?.bestLapTime ?? 0;
  const carIdxBestLapTime = snapshot?.carIdxBestLapTime;
  const sessionNum = snapshot?.sessionNum ?? 0;
  const sessionTime = snapshot?.sessionTime ?? 0;
  const playerTrackSurface = snapshot?.playerTrackSurface ?? 0;
  const incidentCount = snapshot?.incidentCount ?? 0;
  const lapDistPct = snapshot?.lapDistPct ?? 0;

  // Refs
  const lastLoggedLap = useRef<number>(lapCompleted);
  const lastLoggedTime = useRef<number>(0);
  const prevSessionNum = useRef<number>(sessionNum);
  const prevSessionTime = useRef<number>(sessionTime);
  const referenceAtStartOfLap = useRef<number>(0);
  const incidentsAtLapStart = useRef<number>(incidentCount);
  const lastDeltaUpdate = useRef<number>(0);
  const prevLapDistPct = useRef<number>(0);
  const isTransitioning = useRef<boolean>(false);

  // Get personal best store and load data
  const currentPersonalBest = usePersonalBestStore((state) =>
    !trackId || !playerCarName || playerCarName === 'unknown'
      ? undefined
      : state.getPersonalBest(trackId, playerCarName)
  );
  const setPersonalBest = usePersonalBestStore(
    (state) => state.setPersonalBest
  );
  const pbMetaData = useRef({ trackId, playerCarName, currentPersonalBest });
  useEffect(() => {
    pbMetaData.current = { trackId, playerCarName, currentPersonalBest };
  }, [trackId, playerCarName, currentPersonalBest]);

  // Get overall best
  const sessionBestOverall = useMemo(() => {
    if (!carIdxBestLapTime?.length) return undefined;
    const validLaps = carIdxBestLapTime.filter((lap) => lap > 0);
    return validLaps.length === 0 ? undefined : Math.min(...validLaps);
  }, [carIdxBestLapTime]);

  // Calculate predicted lap time
  const deltaMethod = settings?.delta?.method ?? 'bestlap';
  const referenceTime = deltaMethod === 'lastlap' ? lastLapTime : bestLapTime;

  const liveDelta =
    (deltaMethod === 'lastlap'
      ? snapshot?.deltaToSessionLastLap
      : snapshot?.deltaToSessionBestLap) ?? 0;
  const deltaCheck =
    (deltaMethod === 'lastlap'
      ? snapshot?.deltaToSessionLastLapOk
      : snapshot?.deltaToSessionBestLapOk) ?? false;

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
      isTransitioning.current = false;
      resetSessionState();
    }
    prevSessionNum.current = sessionNum;
    prevSessionTime.current = sessionTime;
  }, [sessionNum, sessionTime, lapCompleted, incidentCount, lastLapTime]);

  // 2. check for new lap (use dist method instead of delayed lapCompleted)
  useEffect(() => {
    const crossedLineDist = prevLapDistPct.current > 0.95 && lapDistPct < 0.05;
    // trigger transition
    if (crossedLineDist) {
      isTransitioning.current = true;
    } else if (lapDistPct > 0.05) {
      isTransitioning.current = false; // force reset
    }
    prevLapDistPct.current = lapDistPct;
  }, [lapDistPct]);

  // 3. live tracking during the lap
  useEffect(() => {
    // 3a. get valid time for current lap
    const newDisplayTime = isTransitioning.current ? undefined : currentLapTime;
    setDisplayTime(newDisplayTime);
    // 3b. prediction Logic (throttle to 100ms)
    const now = Date.now();
    if (now - lastDeltaUpdate.current >= 100) {
      setSavedDelta((prev) => {
        const currentDelta = liveDelta ?? 0;
        if (
          deltaCheck &&
          currentLapTime > FREEZE_TIME &&
          !isTransitioning.current
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
        // Was TRACK_SURFACE_OFF_TRACK = 4, which is not a value TrackLocation
        // can take, so this never fired and only the incident half of the
        // check worked.
        const offTrack = isOffTrackSurface(playerTrackSurface);
        const incidentOccurred = incidentCount > incidentsAtLapStart.current;
        return offTrack || incidentOccurred;
      }
      return prev;
    });

    // Latched for the lap: the surface reads OnTrack again long before the lap
    // is scored, so sampling it at the crossing would miss the stop entirely.
    setIsPitted((prev) => prev || isPitSurface(playerTrackSurface));
  }, [
    currentLapTime,
    liveDelta,
    deltaCheck,
    referenceTime,
    incidentCount,
    playerTrackSurface,
  ]);

  // 4. log lap history and reset
  useEffect(() => {
    // wait for new last lap time
    const isNewLapScored =
      lapCompleted > 0 && lapCompleted !== lastLoggedLap.current;
    const isValidTime =
      lastLapTime > 0 && lastLapTime !== lastLoggedTime.current;
    if (!isNewLapScored || !isValidTime) return;
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
      pitted: isPitted,
    };
    setHistory((prev) => [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES));
    // reset for new lap
    lastLoggedLap.current = lapCompleted;
    lastLoggedTime.current = lastLapTime;
    referenceAtStartOfLap.current = referenceTime ?? 0;
    incidentsAtLapStart.current = incidentCount;
    isTransitioning.current = false;
    resetLapState();
  }, [
    lapCompleted,
    lastLapTime,
    isDirty,
    isPitted,
    incidentCount,
    referenceTime,
    history,
  ]);

  // 5. check personal best
  useEffect(() => {
    const isValidTime = bestLapTime > 0;
    if (!isValidTime) return;
    const {
      trackId: currentTrackId,
      playerCarName: currentCar,
      currentPersonalBest: savedPB,
    } = pbMetaData.current;
    const hasPersonalBestKey =
      Boolean(currentTrackId) && currentCar !== 'unknown';
    const isBetter =
      savedPB === undefined || savedPB === null || bestLapTime < savedPB;
    if (hasPersonalBestKey && isBetter) {
      setPersonalBest(currentTrackId, currentCar, bestLapTime);
    }
  }, [bestLapTime, setPersonalBest]);

  return {
    current: displayTime,
    lastlap: lastLapTime,
    bestlap: bestLapTime,
    alltimelap: currentPersonalBest,
    reference: referenceTime,
    delta: savedDelta,
    overall: sessionBestOverall,
    dirty: isDirty,
    history: history,
    settings: settings,
  };
};
