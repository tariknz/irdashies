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
  useGeneralSettings,
} from '@irdashies/context';
import { useLapTimeLog } from './hooks/useLapTimeLog';
import { getDemoLapTimeLogData, LapEntry } from './demoData';
import { TimerIcon, TargetIcon, XIcon } from '@phosphor-icons/react';
import { LapTimeRow } from './components/LapTimeRow';
import type { LapTimeLogConfig } from '@irdashies/types';
import { formatTime, formatDelta } from '@irdashies/utils/time';
import { LapTimeCell } from './components/LapTimeCell';

const FREEZE_TIME = 5;

export const LapTimeLog = () => {
  const { isDemoMode } = useDashboard();
  const { isDriving } = useDrivingState();
  const playerIndex = useFocusCarIdx();
  const data = useLapTimeLog();
  const isSessionVisible = useSessionVisibility(
    data.settings?.sessionVisibility
  );

  // session visible?
  if (!data.settings || playerIndex === undefined || !isSessionVisible) {
    return null;
  }

  // Show only when on track setting
  if (data.settings?.showOnlyWhenOnTrack && !isDriving) {
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
        alltimelap={demoData.alltimelap}
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
      current={isDriving ? data.current : undefined}
      lastlap={data.lastlap}
      bestlap={data.bestlap}
      alltimelap={data.alltimelap}
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
  alltimelap,
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
  alltimelap?: number;
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

  // predicted lap time
  const predicted =
    reference !== undefined && delta !== undefined
      ? reference + delta
      : undefined;

  // predicted delta
  const hasPredictedDelta =
    current !== undefined &&
    current > FREEZE_TIME &&
    predicted !== undefined &&
    predicted > 0 &&
    delta !== undefined;
  const deltaIsGreen = hasPredictedDelta && delta < 0;
  const deltaIsRed = hasPredictedDelta && delta > 0;

  // for the flash
  let bgColor = 'bg-slate-900/[var(--fg-alpha)]';
  if (current !== undefined && current <= FREEZE_TIME) {
    const isMatchingLap = (value?: number) =>
      lastlap !== undefined &&
      lastlap > 0 &&
      value !== undefined &&
      value > 0 &&
      Math.abs(lastlap - value) < 0.001;
    const isSessionBest = isMatchingLap(bestlap);
    const isOverallBest = isMatchingLap(overall);
    const isPersonalBest = isMatchingLap(alltimelap);
    bgColor = 'bg-slate-900';
    if (isSessionBest) bgColor = 'bg-green-700';
    if (isOverallBest) bgColor = 'bg-purple-800';
    if (isPersonalBest) bgColor = 'bg-yellow-600';
  }

  const generalSettings = useGeneralSettings();
  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';

  // wdiget alignment
  const alignment =
    settings.alignment === 'bottom' ? 'items-end' : 'items-start';
  const reverse = settings.reverse ? 'flex-col-reverse' : 'flex-col';

  return (
    <div className={`h-full flex ${alignment}`}>
      <div
        className={`w-full text-sm bg-slate-800/[var(--bg-opacity)] rounded-md text-white ${!isCompact ? 'p-2' : 'p-0.5'}`}
        style={
          {
            '--bg-opacity': `${settings.background.opacity}%`,
          } as React.CSSProperties
        }
      >
        <div
          className={`w-full flex gap-0.5 ${reverse}`}
          style={{ fontSize: `${settings.scale}%` } as React.CSSProperties}
        >
          {/* Current Lap Timer (The Big One) */}
          {settings.showCurrentLap && (
            <div
              id="current-lap"
              className={`text-[1.8em] min-h-[2em] w-full p-1 ${bgColor} flex relative items-center justify-center rounded-sm transition-colors duration-500 ease-in-out`}
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
                    : current > FREEZE_TIME || (current > 0 && !lastlap)
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
                      ? predicted
                      : lastlap
                )}
              </div>
              {settings.delta.enabled && (
                <div
                  className={`absolute right-2 text-[0.8em] text-center tabular-nums ${
                    !dirty && delta && deltaIsGreen
                      ? 'text-green-400'
                      : !dirty && delta && deltaIsRed
                        ? 'text-red-400'
                        : 'text-zinc-400'
                  }`}
                >
                  {formatDelta(hasPredictedDelta ? delta : 0)}
                </div>
              )}
            </div>
          )}

          {/* Main Stats */}
          <div className="flex w-full gap-1">
            {settings.showAllTimeLap && (
              <LapTimeCell
                label="PERSONAL"
                time={alltimelap}
                alltime={alltimelap}
                settings={settings}
              />
            )}
            {settings.showBestLap && (
              <LapTimeCell
                label="SESSION"
                time={bestlap}
                best={bestlap}
                overall={overall}
                alltime={alltimelap}
                settings={settings}
              />
            )}
            {settings.showLastLap && (
              <LapTimeCell
                label="LAST LAP"
                time={lastlap}
                best={bestlap}
                overall={overall}
                alltime={alltimelap}
                settings={settings}
              />
            )}
          </div>

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
                  alltime={alltimelap}
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
