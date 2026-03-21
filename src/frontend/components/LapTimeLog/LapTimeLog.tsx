/**
 * Main Lap Time Log Component
 * Displays a widget showing the current lap, last lap, and best lap times
 */
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  useTelemetryValue,
  useTelemetryValues,
  useFocusCarIdx,
  useDrivingState,
  useSessionVisibility,
  useDashboard,
} from '@irdashies/context';
import { useLapTimeLogSettings } from './hooks/useLapTimeLogSettings';
import { getDemoLapTimeLogData, LapEntry } from './demoData';
import { TimerIcon, TargetIcon, XIcon } from '@phosphor-icons/react';
import { LapTimeRow } from './components/LapTimeRow';
import type { LapTimeLogWidgetSettings } from '@irdashies/types';
import { formatDelta } from './components/LapTimeRow';
import { formatTime } from '@irdashies/utils/time';

const TRACK_SURFACE_OFF_TRACK = 4;
const FREEZE_TIME = 5;
const MAX_HISTORY_ENTRIES = 10;

export const LapTimeLog = () => {
  const { isDemoMode } = useDashboard();
  const settings = useLapTimeLogSettings();
  const isSessionVisible = useSessionVisibility(
    settings?.config?.sessionVisibility
  );
  const playerIndex = useFocusCarIdx();
  const { isDriving } = useDrivingState();
  const [history, setHistory] = useState<LapEntry[]>([]);
  const [isDirty, setIsDirty] = useState<boolean>(false);
  const [displayTime, setDisplayTime] = useState<number | undefined>(0);
  const [savedDelta, setSavedDelta] = useState<number>(0);
  const deltaMethod = settings?.config?.delta?.method ?? 'bestlap';

  // get telemetry
  const lapCompleted = useTelemetryValue<number>('LapCompleted') ?? 0;
  const currentLapTime = useTelemetryValue<number>('LapCurrentLapTime') ?? 0;
  const lastLapTime = useTelemetryValue<number>('LapLastLapTime') ?? 0;
  const bestLapTime = useTelemetryValue<number>('LapBestLapTime') ?? 0;
  const carIdxBestLapTime = useTelemetryValues<number[]>('CarIdxBestLapTime') ?? 0;
  const sessionNum = useTelemetryValue<number>('SessionNum') ?? 0;
  const sessionTime = useTelemetryValue<number>('SessionTime') ?? 0;
  const playerTrackSurface = useTelemetryValue<number>('PlayerTrackSurface') ?? 0;
  const incidentCount = useTelemetryValue<number>('PlayerCarMyIncidentCount') ?? 0;

  // refs for tracking state changes
  const lastLoggedLap = useRef<number>(-1);
  const lastLoggedTime = useRef<number>(-1);
  const prevSessionNum = useRef<number>(sessionNum);
  const prevSessionTime = useRef<number>(sessionTime);
  const referenceAtStartOfLap = useRef<number>(0);
  const incidentsAtLapStart = useRef<number>(incidentCount);
  const lastDeltaUpdate = useRef<number>(0);
  const lapTransition = useRef<boolean>(false);

  // calculate overall best
  const sessionBestOverall = useMemo(() => {
    if (!carIdxBestLapTime?.length) return undefined;
    const validLaps = carIdxBestLapTime.filter((lap) => lap > 0);
    if (validLaps.length === 0) return undefined;
    return Math.min(...validLaps);
  }, [carIdxBestLapTime]);

  // calculate predicted
  const referenceTime =
    {
      lastlap: lastLapTime,
      bestlap: bestLapTime,
    }[deltaMethod] ?? bestLapTime;

  // get current delta against chosen target
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
      lastLoggedLap.current = -1;
      lastLoggedTime.current = -1;
      referenceAtStartOfLap.current = 0;
      incidentsAtLapStart.current = 0;
      lastDeltaUpdate.current = 0;
      lapTransition.current = false;
      setTimeout(() => setIsDirty(false), 0);
      setTimeout(() => setSavedDelta(0), 0);
      setTimeout(() => setDisplayTime(undefined), 0);
      setTimeout(() => setHistory([]), 0);
    }
    prevSessionNum.current = sessionNum;
    prevSessionTime.current = sessionTime;
  }, [sessionNum, sessionTime]);

  /// 2. check for new lap
  useEffect(() => {
    lapTransition.current = lapCompleted > 0 && lapCompleted > lastLoggedLap.current;
  }, [lapCompleted]);

  /// 3. live tracking during the lap
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
    setHistory((prev) => {
      // wait for new last lap time
      const isValidTime = lastLapTime > 0 && lastLapTime !== lastLoggedTime.current;
      if (!lapTransition.current || !isValidTime) return prev;
      if (prev.some((entry) => entry.lap === lapCompleted)) return prev;
      // add history
      const newEntry: LapEntry = {
        lap: lapCompleted,
        time: lastLapTime,
        delta: referenceAtStartOfLap.current > 0
          ? lastLapTime - referenceAtStartOfLap.current
          : 0,
        dirty: isDirty,
      };
      // reset for new lap
      lastLoggedLap.current = lapCompleted;
      lastLoggedTime.current = lastLapTime;
      referenceAtStartOfLap.current = referenceTime ?? 0;
      incidentsAtLapStart.current = incidentCount;
      lapTransition.current = false;
      setTimeout(() => setIsDirty(false), 0);
      setTimeout(() => setSavedDelta(0), 0);
      return [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
    });
  }, [lapCompleted, lastLapTime, isDirty, incidentCount, referenceTime]);

  // demo mode
  if (isDemoMode && settings) {
    const demoData = getDemoLapTimeLogData();
    return (
      <LapTimeLogDisplay
        settings={settings}
        current={demoData.current}
        lastlap={demoData.lastlap}
        bestlap={demoData.bestlap}
        reference={demoData.reference}
        delta={demoData.delta}
        overall={demoData.overall}
        dirty={demoData.dirty}
        history={demoData.history}
      />
    );
  }

  if (
    !settings ||
    !settings.enabled ||
    playerIndex === undefined ||
    !isSessionVisible ||
    !isDriving
  ) {
    return null;
  }

  return (
    <LapTimeLogDisplay
      settings={settings}
      current={displayTime}
      lastlap={lastLapTime}
      bestlap={bestLapTime}
      reference={referenceTime}
      delta={savedDelta}
      overall={sessionBestOverall}
      dirty={isDirty}
      history={history}
    />
  );
};

export const LapTimeLogDisplay = ({
  settings,
  current,
  lastlap,
  bestlap,
  reference,
  delta,
  overall,
  dirty,
  history,
}: {
  settings: LapTimeLogWidgetSettings;
  current?: number;
  lastlap?: number;
  bestlap?: number;
  reference?: number;
  delta?: number;
  overall?: number;
  dirty?: boolean;
  history?: LapEntry[];
}) => {
  // sort laps
  const sortedHistory = useMemo(() => {
    if (!history) return [];
    return [...history]
      .sort((a, b) => b.lap - a.lap)
      .slice(0, settings.config.history.count);
  }, [history, settings]);

  // predicted delta
  const deltaIsGreen = 
    current !== undefined && 
    current > 5 &&
    delta !== undefined &&    
    delta < 0;
  const deltaIsRed = 
    current !== undefined && 
    current > 5 &&
    delta !== undefined &&    
    delta > 0;

  // for the flash
  let bgColor = 'bg-slate-900/[var(--fg-alpha)]';
  if (current !== undefined && current <= FREEZE_TIME) {
    const isSessionBest =
      lastlap !== undefined &&
      lastlap > 0 &&
      overall !== undefined &&
      overall > 0 &&
      Math.abs(lastlap - overall) < 0.001;
    const isPersonalBest =
      lastlap !== undefined &&
      lastlap > 0 &&
      bestlap !== undefined &&
      bestlap > 0 &&
      Math.abs(lastlap - bestlap) < 0.001;
    bgColor = 'bg-slate-900';
    if (isPersonalBest) bgColor = 'bg-green-700';
    if (isSessionBest) bgColor = 'bg-purple-800';
  }

  // wdiget alignment
  const alignment = settings.config.alignment === 'bottom' ? 'items-end' : 'items-start';
  const reverse = settings.config.reverse ? 'flex-col-reverse' : 'flex-col';

  return (
    <div className={`h-full flex ${alignment}`}>
      <div
        className="w-full text-sm bg-slate-800/[var(--bg-opacity)] p-0.5 rounded-md text-white"
        style={
          {
            '--bg-opacity': `${settings.config.background.opacity}%`,
          } as React.CSSProperties
        }
      >
        <div
          className={`w-full flex gap-0.5 ${reverse}`}
          style={
            { fontSize: `${settings.config.scale}%` } as React.CSSProperties
          }
        >
          {/* Current Lap Timer (The Big One) */}
          {settings.config.showCurrentLap && (
            <div
              id="current-lap"
              className={`text-[1.8em] min-h-[2em] w-full p-1 ${bgColor} flex relative items-center justify-center rounded-sm transition-colors duration-500`}
              style={
                {
                  '--fg-alpha': `${settings?.config.foreground.opacity}%`,
                } as React.CSSProperties
              }
            >
              <div className="absolute left-2">
                <TimerIcon weight="bold" />
              </div>
              <div className="w-full text-center tabular-nums">
                {formatTime(
                  current === undefined
                    ? undefined
                    : current > FREEZE_TIME
                      ? current
                      : lastlap
                )}
              </div>
            </div>
          )}

          {/* Predicted (With Delta) */}
          {settings.config.showPredictedLap && (
            <div
              id="predicted-lap"
              className={`text-[1.3em] min-h-[2em] w-full p-1 ${dirty ? 'text-zinc-400' : 'text-white'} bg-slate-900/[var(--fg-alpha)] flex relative items-center justify-center rounded-sm`}
              style={
                {
                  '--fg-alpha': `${settings?.config.foreground.opacity / 2}%`,
                } as React.CSSProperties
              }
            >
              <div className="absolute left-3">
                {dirty ? (
                  <XIcon weight="regular" />
                ) : (
                  <TargetIcon weight="regular" />
                )}
              </div>
              <div className="w-full text-center tabular-nums">
                {formatTime(
                  current === undefined
                    ? undefined
                    : current > FREEZE_TIME
                      ? (reference ?? 0) + (delta  ?? 0)
                      : lastlap
                )}
              </div>
              {settings.config.delta?.enabled && (
                <div
                  className={`absolute right-2 text-center tabular-nums ${
                    !dirty && delta && deltaIsGreen
                      ? 'text-green-400'
                      : !dirty && delta && deltaIsRed
                        ? 'text-red-400'
                        : 'text-zinc-400'
                  }`}
                >
                  {formatDelta(
                    delta && current !== undefined && current > FREEZE_TIME
                      ? delta
                      : 0
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main Stats */}
          {settings.config.showLastLap && (
            <LapTimeRow
              label="LAST"
              time={lastlap}
              delta={(lastlap ?? 0) - (reference ?? 0)}
              best={bestlap}
              overall={overall}
              settings={settings}
            />
          )}
          {settings.config.showBestLap && (
            <LapTimeRow
              label="BEST"
              time={bestlap}
              delta={(bestlap ?? 0) - (reference ?? 0)}
              best={bestlap}
              overall={overall}
              settings={settings}
            />
          )}

          {/* History List */}
          {settings.config.history?.enabled && (
            <>
              {sortedHistory.map((entry) => (
                <LapTimeRow
                  key={entry.lap} // Critical for React performance
                  label={`LAP ${entry.lap}`}
                  time={entry.time}
                  delta={entry.delta}
                  dirty={entry.dirty}
                  best={bestlap}
                  overall={overall}
                  settings={settings}
                />
              ))}
            </>
          )}

        </div>
      </div>
    </div>
  );
};
