import { memo, useEffect, useMemo, useState } from 'react';
import { MicrophoneIcon } from '@phosphor-icons/react';
import {
  useSessionLapsTiming,
  useSessionTimeTiming,
  useSessionVisibility,
  useTrackDisplayName,
} from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { Standings } from '@irdashies/domain';
import type { NameFormat, StandingsWidgetSettings } from '@irdashies/types';
import { getTailwindStyle } from '@irdashies/utils/colors';
import { formatTime } from '@irdashies/utils/time';
import {
  DriverName as formatDriverName,
  extractDriverName,
} from '../shared/DriverName/DriverName';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { useBroadcastSettings } from './hooks/useBroadcastSettings';
import { WeatherCard } from './WeatherCard';
import {
  buildBroadcastRows,
  diffClassPositions,
  findBattle,
  type BroadcastRow,
} from './broadcastRows';

const ROW_HEIGHT = 24;
const BATTLE_GAP_SECONDS = 1;

// Gap and interval are what a viewer needs; everything else stays off.
const STANDINGS_OPTIONS = {
  gap: { enabled: true },
  interval: { enabled: true },
} as StandingsWidgetSettings['config'];

/** What the right-hand column of the tower shows right now. */
type Page =
  | { kind: 'names' }
  | { kind: 'gaps'; classId: string; className: string }
  | { kind: 'makes' };

const classColor = (color: number) =>
  getTailwindStyle(color, undefined, true).classHeader;

const driverName = (standing: Standings, format: NameFormat) =>
  formatDriverName(extractDriverName(standing.driver.name), format);

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

interface PositionChange {
  delta: number;
  /** Bumps on every change so the highlight animation restarts. */
  seq: number;
}

/** Remembers the last class position change of each car. */
const usePositionChanges = (standings: readonly Standings[]) => {
  const [state, setState] = useState({
    standings,
    seq: 0,
    changes: new Map<number, PositionChange>(),
  });
  if (state.standings !== standings) {
    const diff = diffClassPositions(state.standings, standings);
    const seq = state.seq + 1;
    const changes = diff.size ? new Map(state.changes) : state.changes;
    for (const [carIdx, delta] of diff) changes.set(carIdx, { delta, seq });
    setState({ standings, seq, changes });
  }
  return state.changes;
};

const TRANSITIONS = [
  'slide-left',
  'slide-right',
  'slide-up',
  'fade-in',
  'flip',
  'wipe',
  'zoom',
  'checker',
] as const;
type Transition = (typeof TRANSITIONS)[number];

/** Any transition but the last one, so two page flips never look alike. */
const pickTransition = (last?: Transition): Transition => {
  const options = TRANSITIONS.filter((t) => t !== last);
  return options[Math.floor(Math.random() * options.length)];
};

/** Cycles through the pages like a TV timing tower. */
const usePageRotation = (pages: readonly Page[], seconds: number) => {
  const [flip, setFlip] = useState<{ tick: number; effect?: Transition }>({
    tick: 0,
  });
  useEffect(() => {
    const id = setInterval(
      () =>
        setFlip((f) => ({
          tick: f.tick + 1,
          effect: pickTransition(f.effect),
        })),
      seconds * 1000
    );
    return () => clearInterval(id);
  }, [seconds]);
  return { ...flip, page: pages[flip.tick % pages.length] };
};

/** Rows enter one after another, top to bottom. */
const rowAnimation = (effect: Transition | undefined, index: number) =>
  effect && effect !== 'checker'
    ? { animation: `broadcast-${effect} 450ms ease-out ${index * 35}ms both` }
    : undefined;

const CHECKER_COLUMNS = 8;

/** Dark tiles that cover the tower and vanish in a chessboard pattern. */
const CheckerOverlay = ({ rowCount }: { rowCount: number }) => (
  <div
    className="pointer-events-none absolute inset-0 grid"
    style={{
      gridTemplateColumns: `repeat(${CHECKER_COLUMNS}, 1fr)`,
      gridAutoRows: ROW_HEIGHT,
    }}
  >
    {Array.from({ length: rowCount * CHECKER_COLUMNS }, (_, i) => {
      const row = Math.floor(i / CHECKER_COLUMNS);
      const col = i % CHECKER_COLUMNS;
      const delay = ((row + col) % 2) * 250 + (row + col) * 15;
      return (
        <span
          key={i}
          className="bg-slate-950"
          style={{
            animation: `broadcast-checker 300ms ease-in ${delay}ms both`,
          }}
        />
      );
    })}
  </div>
);

const SessionClock = () => {
  const { sessionType, timeRemaining, isFixedLapRace } = useSessionTimeTiming();
  const { currentLap, totalRaceLaps } = useSessionLapsTiming();
  if (sessionType === 'Race' && isFixedLapRace && totalRaceLaps > 0) {
    return (
      <>
        LAP {currentLap} / {totalRaceLaps}
      </>
    );
  }
  return <>{formatTime(Math.max(timeRemaining, 0), 'duration')}</>;
};

const Header = ({ title }: { title: string }) => (
  <div className="rounded-t-sm border border-white/20 bg-linear-to-b from-slate-700 to-slate-950 px-2 py-0.5 text-center font-bold italic leading-tight tracking-wide text-cyan-300 uppercase">
    <div className="truncate text-base">{title}</div>
    <div className="text-lg tabular-nums">
      <SessionClock />
    </div>
  </div>
);

const GapCell = ({ standing }: { standing: Standings }) => {
  if (standing.onPitRoad) {
    return <span className="bg-white px-1 not-italic text-slate-900">PIT</span>;
  }
  if (standing.classPosition === 1) return null;
  if (standing.gap?.laps) return <>-{standing.gap.laps}L</>;
  if (standing.gap?.value === undefined) return null;
  return <>-{standing.gap.value.toFixed(3)}</>;
};

const DriverRow = memo(
  ({
    standing,
    page,
    nameFormat,
  }: {
    standing: Standings;
    page: Page;
    nameFormat: NameFormat;
  }) => {
    const color = classColor(standing.carClass.color);
    const dimmed =
      page.kind === 'gaps' && page.classId !== String(standing.carClass.id);
    return (
      <div
        className={[
          'relative flex h-full items-center gap-1.5 pr-2 font-bold italic uppercase transition-opacity duration-500',
          dimmed || standing.dnf ? 'opacity-40' : '',
          standing.isPlayer ? 'text-amber-300' : 'text-white',
        ].join(' ')}
      >
        <span className="relative w-6 text-right">
          {standing.classPosition}.
        </span>
        <span
          className={`relative w-9 rounded-xs text-center text-slate-900 ${color}`}
        >
          {standing.driver.carNum}
        </span>
        <span className="relative flex-1 truncate">
          {driverName(standing, nameFormat)}
        </span>
        {standing.radioActive && (
          <MicrophoneIcon className="relative" size={12} weight="fill" />
        )}
        <span className="relative tabular-nums">
          {page.kind === 'gaps' && !dimmed && <GapCell standing={standing} />}
          {page.kind === 'makes' && standing.carId !== undefined && (
            <CarManufacturer carId={standing.carId} />
          )}
        </span>
      </div>
    );
  }
);
DriverRow.displayName = 'DriverRow';

const ClassHeader = ({
  row,
  page,
}: {
  row: Extract<BroadcastRow, { kind: 'class' }>;
  page: Page;
}) => {
  const showsGaps = page.kind === 'gaps' && `class-${page.classId}` === row.key;
  return (
    <div className="flex h-full items-end justify-between border-t-2 border-white/10 px-2 font-bold italic uppercase">
      <span className="flex items-center gap-2 text-white">
        <span className={`h-3 w-1 ${classColor(row.color)}`} />
        {row.name}
      </span>
      {showsGaps && (
        <span className="animate-broadcast-enter text-xs text-white/70">
          Intervals
        </span>
      )}
    </div>
  );
};

const BattleCard = ({
  standing,
  showGap,
}: {
  standing: Standings;
  showGap: boolean;
}) => (
  <div className="animate-broadcast-enter">
    <div className="flex h-12 items-center justify-center bg-slate-800/(--bg-opacity) text-[2.5rem]">
      {standing.carId !== undefined && (
        <CarManufacturer carId={standing.carId} />
      )}
    </div>
    <div
      className={`flex items-center gap-2 px-2 py-0.5 font-bold italic uppercase text-slate-900 ${classColor(standing.carClass.color)}`}
    >
      <span>{standing.classPosition}.</span>
      <span>{standing.driver.carNum}</span>
      <span className="flex-1 truncate">{driverName(standing, 'surname')}</span>
      {showGap && standing.interval !== undefined && (
        <span className="tabular-nums">-{standing.interval.toFixed(3)}</span>
      )}
    </div>
  </div>
);

const FocusCard = ({ standing }: { standing: Standings }) => (
  <div className="animate-broadcast-enter overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) text-white">
    <div
      className={`flex items-center justify-between px-2 py-0.5 text-sm font-bold italic uppercase text-slate-900 ${classColor(standing.carClass.color)}`}
    >
      <span>{standing.carClass.name}</span>
      <span>P{standing.classPosition}</span>
    </div>
    <div className="flex items-center gap-3 px-2 py-1">
      <span className="text-2xl font-bold italic text-white/70">
        {standing.driver.carNum}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 truncate text-lg font-bold italic uppercase">
          {driverName(standing, 'name-surname')}
          {standing.radioActive && <MicrophoneIcon size={16} weight="fill" />}
        </div>
        {standing.driver.teamName && (
          <div className="truncate text-sm text-white/60">
            {standing.driver.teamName}
          </div>
        )}
      </div>
      {standing.carId !== undefined && (
        <span className="text-3xl">
          <CarManufacturer carId={standing.carId} />
        </span>
      )}
    </div>
    <div className="flex gap-4 border-t border-white/10 px-2 py-1 text-sm tabular-nums">
      <span>
        <span className="text-white/50">LAST </span>
        {formatTime(standing.lastTime, 'full') || '-'}
      </span>
      <span>
        <span className="text-white/50">BEST </span>
        {formatTime(standing.fastestTime, 'full') || '-'}
      </span>
    </div>
  </div>
);

export const Broadcast = () => {
  const settings = useBroadcastSettings();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const trackName = useTrackDisplayName();
  const groups = useDriverStandings(STANDINGS_OPTIONS, {
    showAll: true,
    livePositions: true,
  });
  const perClass = settings?.driversPerClass ?? 5;
  const standings = useMemo(() => groups.flatMap(([, d]) => d), [groups]);
  const changes = usePositionChanges(standings);
  const rows = useMemo(
    () => buildBroadcastRows(groups, perClass),
    [groups, perClass]
  );
  const pages = useMemo<Page[]>(
    () => [
      { kind: 'names' },
      ...groups.map(([classId, drivers]): Page => ({
        kind: 'gaps',
        classId,
        className: drivers[0]?.carClass.name ?? '',
      })),
      { kind: 'makes' },
    ],
    [groups]
  );
  const { page, tick, effect } = usePageRotation(
    pages,
    settings?.pageSeconds ?? 8
  );
  const battle =
    page.kind === 'gaps'
      ? findBattle(
          groups.find(([id]) => id === page.classId)?.[1] ?? [],
          perClass,
          BATTLE_GAP_SECONDS
        )
      : undefined;
  const focus = standings.find((s) => s.isPlayer);
  const nameFormat = settings?.driverNameFormat ?? 'surname';

  if (!isSessionVisible || rows.length === 0) return null;

  return (
    <div
      className="flex w-full flex-col gap-2 text-sm"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 85}%`,
        opacity: settings?.translucent?.enabled
          ? settings.translucent.opacity / 100
          : undefined,
      }}
    >
      <div className="overflow-hidden rounded-sm bg-slate-950/(--bg-opacity) shadow-lg">
        <Header title={settings?.title || trackName || ''} />
        {/* Rows are absolutely placed so a position swap slides instead of jumping. */}
        <div
          className="relative"
          style={{ height: rows.length * ROW_HEIGHT + 4 }}
        >
          {rows.map((row, index) => {
            const change =
              row.kind === 'driver'
                ? changes.get(row.standing.carIdx)
                : undefined;
            return (
              <div
                key={row.key}
                className="absolute inset-x-0 transition-transform duration-700 ease-in-out"
                style={{
                  height: ROW_HEIGHT,
                  transform: `translateY(${index * ROW_HEIGHT}px)`,
                }}
              >
                {/* A car that just moved is painted in its class colour, then
                    fades. Kept outside the page transition so it never replays. */}
                {change && row.kind === 'driver' && (
                  <span
                    key={change.seq}
                    className={`absolute inset-y-0.5 right-0 left-6 animate-broadcast-fade ${classColor(row.standing.carClass.color)}`}
                  />
                )}
                <div
                  key={tick}
                  className="relative h-full"
                  style={rowAnimation(effect, index)}
                >
                  {row.kind === 'class' ? (
                    <ClassHeader row={row} page={page} />
                  ) : (
                    <DriverRow
                      standing={row.standing}
                      page={page}
                      nameFormat={nameFormat}
                    />
                  )}
                </div>
              </div>
            );
          })}
          {effect === 'checker' && (
            <CheckerOverlay key={tick} rowCount={rows.length} />
          )}
        </div>
        {battle && page.kind === 'gaps' && (
          <div key={`${battle[0].carIdx}-${battle[1].carIdx}`}>
            <div className="border-t-2 border-white/10 px-2 py-0.5 font-bold italic text-white uppercase">
              {page.className} battle for{' '}
              {ordinal(battle[0].classPosition ?? 0)}
            </div>
            <BattleCard standing={battle[0]} showGap={false} />
            <BattleCard standing={battle[1]} showGap />
          </div>
        )}
      </div>
      {settings?.weather?.enabled && (
        <WeatherCard
          intervalMinutes={settings.weather.intervalMinutes}
          showSeconds={settings.weather.showSeconds}
        />
      )}
      {settings?.showFocusCard !== false && focus && (
        <FocusCard key={focus.carIdx} standing={focus} />
      )}
    </div>
  );
};
