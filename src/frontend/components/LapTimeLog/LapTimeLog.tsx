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
  useDemoFrame,
  useGeneralSettings,
} from '@irdashies/context';
import { useLapTimeLog } from './hooks/useLapTimeLog';
import { getDemoLapTimeLogData, LapEntry } from './demoData';
import { TimerIcon, TargetIcon, XIcon } from '@phosphor-icons/react';
import { LapTimeRow } from './components/LapTimeRow';
import { LapHistoryChart } from './components/LapHistoryChart';
import type { LapTimeLogConfig } from '@irdashies/types';
import { formatTime, formatDelta } from '@irdashies/utils/time';
import { LapTimeCell } from './components/LapTimeCell';
import { LiveDeltaBar } from './components/LiveDeltaBar';

const FREEZE_TIME = 5;
const EMBEDDED_HISTORY_LAPS = 20;

export const LapTimeLog = ({ embedded = false }: { embedded?: boolean }) => {
  const { isDemoMode } = useDashboard();
  const { isDriving } = useDrivingState();
  const playerIndex = useFocusCarIdx();
  const data = useLapTimeLog(embedded);
  const demoData = useDemoFrame(isDemoMode, getDemoLapTimeLogData);
  const settings = useMemo(
    () =>
      embedded && data.settings
        ? {
            ...data.settings,
            history: {
              ...data.settings.history,
              enabled: true,
              count: EMBEDDED_HISTORY_LAPS,
            },
          }
        : data.settings,
    [embedded, data.settings]
  );
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  if (!settings || playerIndex === undefined || !isSessionVisible) {
    return null;
  }

  if (settings.showOnlyWhenOnTrack && !isDriving) {
    return null;
  }

  if (isDemoMode && demoData) {
    return (
      <LapTimeLogDisplay
        settings={settings}
        current={demoData.current}
        lastlap={demoData.lastlap}
        bestlap={demoData.bestlap}
        alltimelap={demoData.alltimelap}
        reference={demoData.reference}
        delta={demoData.delta}
        overall={demoData.overall}
        dirty={demoData.dirty}
        history={demoData.history}
        embedded={embedded}
      />
    );
  }

  return (
    <LapTimeLogDisplay
      settings={settings}
      current={isDriving ? data.current : undefined}
      lastlap={data.lastlap}
      bestlap={data.bestlap}
      alltimelap={data.alltimelap}
      reference={data.reference}
      delta={data.delta}
      overall={data.overall}
      dirty={data.dirty}
      history={data.history}
      embedded={embedded}
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
  embedded = false,
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
  embedded?: boolean;
}) => {
  // sort laps
  const sortedHistory = useMemo(() => {
    if (!history) return [];
    // Filtered before the slice, so hiding laps still shows the configured
    // number of laps rather than silently shortening the list.
    const laps = history.filter(
      (entry) =>
        !(settings.history.hidePittedLaps && entry.pitted) &&
        !(settings.history.hideCautionLaps && entry.caution)
    );
    return [...laps]
      .sort((a, b) => b.lap - a.lap)
      .slice(0, settings.history.count);
  }, [
    history,
    settings.history.count,
    settings.history.hidePittedLaps,
    settings.history.hideCautionLaps,
  ]);

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

  const embeddedAlignment =
    settings.alignment === 'bottom' ? 'mt-auto shrink-0' : 'shrink-0';

  return (
    <div
      className={
        embedded
          ? 'h-full overflow-y-auto flex flex-col'
          : `h-full flex ${alignment}`
      }
    >
      <div
        className={`w-full text-sm bg-slate-800/[var(--bg-opacity)] rounded-md text-white ${!isCompact ? 'p-2' : 'p-0.5'} ${embedded ? embeddedAlignment : ''}`}
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

          {settings.delta.enabled && settings.delta.showOnCurrentLap && (
            <LiveDeltaBar
              delta={delta}
              active={hasPredictedDelta}
              dirty={dirty}
            />
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

          {/* History List / Chart */}
          {settings.history.enabled &&
            (settings.history.style === 'chart' ? (
              <LapHistoryChart
                history={sortedHistory}
                best={bestlap}
                overall={overall}
                alltime={alltimelap}
                foregroundOpacity={settings.foreground.opacity}
              />
            ) : (
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
            ))}
        </div>
      </div>
    </div>
  );
};
