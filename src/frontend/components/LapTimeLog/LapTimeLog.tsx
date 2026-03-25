/**
 * Main Lap Time Log Component
 * Displays a widget showing the current lap, last lap, and best lap times
 */
import React, { useMemo } from 'react';
import {
  useFocusCarIdx,
  useDrivingState,
  useSessionVisibility,
  useDashboard,
} from '@irdashies/context';
import { useLapTimeLog } from './hooks/useLapTimeLog';
import { getDemoLapTimeLogData, LapEntry } from './demoData';
import { TimerIcon, TargetIcon, XIcon } from '@phosphor-icons/react';
import { LapTimeRow } from './components/LapTimeRow';
import type { LapTimeLogConfig } from '@irdashies/types';
import { formatDelta } from './components/LapTimeRow';
import { formatTime } from '@irdashies/utils/time';

const FREEZE_TIME = 5;

export const LapTimeLog = () => {
  const { isDemoMode } = useDashboard();
  const { isDriving } = useDrivingState();
  const playerIndex = useFocusCarIdx();
  const data = useLapTimeLog();
  const isSessionVisible = useSessionVisibility(data.settings?.sessionVisibility);

  if (
    !data.settings ||
    playerIndex === undefined ||
    !isSessionVisible ||
    !isDriving
  ) {
    return null;
  }

  // demo mode
  if (isDemoMode) {
    const demoData = getDemoLapTimeLogData();
    return (
      <LapTimeLogDisplay
        settings={data.settings}
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

  return (
    <LapTimeLogDisplay
      settings={data.settings}
      current={data.current}
      lastlap={data.lastlap}
      bestlap={data.bestlap}
      reference={data.reference}
      delta={data.delta}
      overall={data.overall}
      dirty={data.dirty}
      history={data.history}
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
  settings: LapTimeLogConfig;
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
      .slice(0, settings.history.count);
  }, [history, settings.history.count]);

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
  const alignment = settings.alignment === 'bottom' ? 'items-end' : 'items-start';
  const reverse = settings.reverse ? 'flex-col-reverse' : 'flex-col';

  return (
    <div className={`h-full flex ${alignment}`}>
      <div
        className="w-full text-sm bg-slate-800/[var(--bg-opacity)] p-0.5 rounded-md text-white"
        style={
          {
            '--bg-opacity': `${settings.background.opacity}%`,
          } as React.CSSProperties
        }
      >
        <div
          className={`w-full flex gap-0.5 ${reverse}`}
          style={
            { fontSize: `${settings.scale}%` } as React.CSSProperties
          }
        >
          {/* Current Lap Timer (The Big One) */}
          {settings.showCurrentLap && (
            <div
              id="current-lap"
              className={`text-[1.8em] min-h-[2em] w-full p-1 ${bgColor} flex relative items-center justify-center rounded-sm transition-colors duration-500`}
              style={
                {
                  '--fg-alpha': `${settings.foreground.opacity}%`,
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
          {settings.showPredictedLap && (
            <div
              id="predicted-lap"
              className={`text-[1.3em] min-h-[2em] w-full p-1 ${dirty ? 'text-zinc-400' : 'text-white'} bg-slate-900/[var(--fg-alpha)] flex relative items-center justify-center rounded-sm`}
              style={
                {
                  '--fg-alpha': `${settings.foreground.opacity / 2}%`,
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
              {settings.delta.enabled && (
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
          {settings.showBestLap && (
            <LapTimeRow
              label="BEST"
              time={bestlap}
              delta={(bestlap ?? 0) - (reference ?? 0)}
              best={bestlap}
              overall={overall}
              settings={settings}
            />
          )}
          {settings.showLastLap && (
            <LapTimeRow
              label="LAST"
              time={lastlap}
              delta={(lastlap ?? 0) - (reference ?? 0)}
              best={bestlap}
              overall={overall}
              settings={settings}
            />
          )}

          {/* History List */}
          {settings.history.enabled && (
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
