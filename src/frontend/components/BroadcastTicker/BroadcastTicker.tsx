import { useMemo, useState } from 'react';
import {
  useSessionVisibility,
  useWeekendInfoTeamRacing,
} from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { Standings } from '@irdashies/domain';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../shared/DriverName/DriverName';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { useBroadcastTickerSettings } from './hooks/useBroadcastTickerSettings';
import { TICKER_MODES, tickerEntries, type TickerMode } from './tickerEntries';

const MODE_LABELS: Record<TickerMode, string> = {
  overall: 'Standings',
  fastest: 'Fastest Lap',
  manufacturers: 'Manufacturers',
};

const Entry = ({
  standing,
  mode,
  teamRacing,
}: {
  standing: Standings;
  mode: TickerMode;
  teamRacing: boolean;
}) => (
  <span className="flex shrink-0 items-center gap-2 pr-16 font-bold uppercase">
    <span className="text-lg">{standing.position}</span>
    <span
      className={`rounded-xs px-1.5 italic text-slate-900 ${getTailwindStyle(standing.carClass.color, undefined, true).classHeader}`}
    >
      {standing.driver.carNum}
    </span>
    <span>
      {teamRacing && standing.driver.teamName
        ? standing.driver.teamName
        : formatDriverName(
            extractDriverName(standing.driver.name),
            'name-surname'
          )}
    </span>
    {standing.carId !== undefined && (
      <span className="text-xl">
        <CarManufacturer carId={standing.carId} />
      </span>
    )}
    {mode === 'fastest' && standing.fastestTime > 0 && (
      <span className="tabular-nums">
        {formatTime(standing.fastestTime, 'full')}
      </span>
    )}
  </span>
);

export const BroadcastTicker = () => {
  const settings = useBroadcastTickerSettings();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const teamRacing = !!useWeekendInfoTeamRacing();
  const groups = useDriverStandings(undefined, {
    showAll: true,
    livePositions: true,
  });
  const [modeIndex, setModeIndex] = useState(0);
  const mode = TICKER_MODES[modeIndex % TICKER_MODES.length];
  const entries = useMemo(
    () =>
      tickerEntries(
        groups.flatMap(([, d]) => d),
        mode
      ),
    [groups, mode]
  );

  if (!isSessionVisible || entries.length === 0) return null;

  const loopSeconds = entries.length * (settings?.secondsPerEntry ?? 3);
  const list = entries.map((s) => (
    <Entry key={s.carIdx} standing={s} mode={mode} teamRacing={teamRacing} />
  ));

  return (
    <div
      className="flex h-full w-full flex-col justify-end text-white"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 85}%`,
        opacity: settings?.translucent?.enabled
          ? settings.translucent.opacity / 100
          : undefined,
      }}
    >
      <div className="flex gap-1 pl-6 text-sm font-bold uppercase">
        <span className="rounded-t-md bg-slate-900/(--bg-opacity) px-6 py-0.5">
          Overall
        </span>
        <span
          key={mode}
          className="animate-broadcast-enter rounded-t-md bg-slate-900/(--bg-opacity) px-6 py-0.5"
        >
          {MODE_LABELS[mode]}
        </span>
      </div>
      <div className="flex h-10 items-center overflow-hidden bg-slate-900/(--bg-opacity)">
        {/* The list is rendered twice and slid by half its width, so the loop
            is seamless. Each finished loop moves on to the next mode. */}
        <div
          key={mode}
          className="flex w-max"
          style={{ animation: `broadcast-marquee ${loopSeconds}s linear` }}
          onAnimationEnd={() => setModeIndex((i) => i + 1)}
        >
          {list}
          {list}
        </div>
      </div>
    </div>
  );
};
