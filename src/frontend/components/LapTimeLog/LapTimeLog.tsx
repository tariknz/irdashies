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
  const [predictedLap, setPredictedLap] = useState<number>(0);
  const deltaMethod = settings.config.delta?.method ?? 'bestlap';

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
  const lastPredictionUpdate = useRef<number>(0);

  // calculate overall best
  const sessionBestOverall = useMemo(() => {
    if (!carIdxBestLapTime?.length) return undefined;
    const validLaps = carIdxBestLapTime.filter((lap) => lap > 0);
    if (validLaps.length === 0) return undefined;
    return Math.min(...validLaps);
  }, [carIdxBestLapTime]);

  // calculate predicted
  const referenceTime = {
    lastlap: lastLapTime,
    bestlap: bestLapTime,
    overall: sessionBestOverall,
  }[deltaMethod] ?? bestLapTime;

  // get current delta against chosen target
  const deltaMethodMap = {
    lastlap: 'LapDeltaToSessionLastlLap',
    bestlap: 'LapDeltaToBestLap',
    overall: 'LapDeltaToSessionBestLap',
  } as const;
  const liveDelta = useTelemetryValue<number>(deltaMethodMap[deltaMethod]) ?? 0;

  const deltaCheckMap = {
    lastlap: 'LapDeltaToSessionLastlLap_OK',
    bestlap: 'LapDeltaToBestLap_OK',
    overall: 'LapDeltaToSessionBestLap_OK',
  } as const;
  const deltaCheck = useTelemetryValue<number>(deltaCheckMap[deltaMethod]) ?? 0;

  // 1. handles resets/restarts
  useEffect(() => {
    const sessionChanged = sessionNum !== prevSessionNum.current;
    const sessionRestarted = sessionTime < prevSessionTime.current - 5;
    if (sessionChanged || sessionRestarted) {
      lastLoggedLap.current = -1;
      lastLoggedTime.current = -1;
      setTimeout(() => setIsDirty(false), 0);
      setTimeout(() => setPredictedLap(0), 0);
      setTimeout(() => setHistory([]), 0);
    }
    prevSessionNum.current = sessionNum;
    prevSessionTime.current = sessionTime;
  }, [sessionNum, sessionTime]);

  /// 2. live tracking during the lap
  useEffect(() => {
    const now = Date.now();
    // 2a. prediction Logic (throttle to 100ms)
    if (now - lastPredictionUpdate.current >= 100) {
      setPredictedLap((prev) => {
        const currentPrediction = referenceTime > 0 ? referenceTime + liveDelta : 0;
        if (
          deltaCheck &&
          currentPrediction > currentLapTime &&
          lapCompleted === lastLoggedLap.current
        ) {
          lastPredictionUpdate.current = now;
          return currentPrediction;
        }
        return prev;
      });
    }
    // 2b. incident/dirty lap logic
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
    lapCompleted,
    liveDelta,
    deltaCheck,
    referenceTime,
    incidentCount,
    playerTrackSurface,
  ]);

  // 3. lap completion Logic
  useEffect(() => {
    setHistory((prev) => {
      // check for new lap
      const isNewLap = lapCompleted > 0 && lapCompleted > lastLoggedLap.current;
      const isValidTime = lastLapTime > 0 && lastLapTime !== lastLoggedTime.current;
      if (!isNewLap || !isValidTime) return prev;
      if (prev.some((entry) => entry.lap === lapCompleted)) return prev;
      // add history
      const newEntry: LapEntry = {
        lap: lapCompleted,
        time: lastLapTime,
        delta: referenceAtStartOfLap.current
          ? lastLapTime - referenceAtStartOfLap.current
          : 0,
        dirty: isDirty,
      };
      // reset for new lap
      lastLoggedLap.current = lapCompleted;
      lastLoggedTime.current = lastLapTime;
      referenceAtStartOfLap.current = referenceTime ?? 0;
      incidentsAtLapStart.current = incidentCount;
      setTimeout(() => setIsDirty(false), 0);
      return [newEntry, ...prev].slice(0, MAX_HISTORY_ENTRIES);
    });
  }, [lapCompleted, lastLapTime, isDirty, incidentCount, referenceTime]);

  // demo mode
  if (isDemoMode) {
    const demoData = getDemoLapTimeLogData();
    return (
      <LapTimeLogDisplay
        settings={settings}
        current={demoData.current}
        lastlap={demoData.lastlap}
        bestlap={demoData.bestlap}
        predicted={demoData.predicted}
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
      current={currentLapTime}
      lastlap={lastLapTime}
      bestlap={bestLapTime}
      predicted={predictedLap}
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
  predicted,
  overall,
  dirty,
  history,
}: {
  settings: LapTimeLogWidgetSettings;
  current?: number;
  lastlap?: number;
  bestlap?: number;
  predicted?: number;
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
  const deltalap =
    settings.config.delta.method === 'lastlap'
      ? lastlap
      : settings.config.delta.method === 'overall'
        ? overall
        : bestlap;
  const delta = (predicted ?? 0) - (deltalap ?? 0);
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
        className="w-full text-sm bg-slate-800/[var(--bg-opacity)] rounded-md p-1 text-white"
        style={
          {
            '--bg-opacity': `${settings.config.background.opacity}%`,
          } as React.CSSProperties
        }
      >
        <div
          className={`w-full flex gap-0.5 ${reverse}`}
          style={
            { 'fontSize': `${settings.config.scale}%` } as React.CSSProperties
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
                  current !== undefined && current > FREEZE_TIME
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
                  current !== undefined && current > FREEZE_TIME
                    ? predicted
                    : lastlap
                )}
              </div>
              {settings.config.delta?.enabled && (
                <div
                  className={`absolute right-2 text-center tabular-nums ${
                    !dirty && deltaIsGreen
                      ? 'text-green-400'
                      : !dirty && deltaIsRed
                        ? 'text-red-400'
                        : 'text-zinc-400'
                  }`}
                >
                  {formatDelta(
                    current !== undefined && current > FREEZE_TIME ? delta : 0
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
              delta={(lastlap ?? 0) - (deltalap ?? 0)}
              best={bestlap}
              overall={overall}
              settings={settings}
            />
          )}
          {settings.config.showBestLap && (
            <LapTimeRow
              label="BEST"
              time={bestlap}
              delta={(bestlap ?? 0) - (deltalap ?? 0)}
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
