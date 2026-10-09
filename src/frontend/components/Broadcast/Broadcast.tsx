import { useEffect, useMemo, useState } from 'react';
import {
  CaretDownIcon,
  CaretUpIcon,
  FlagIcon,
  MicrophoneIcon,
} from '@phosphor-icons/react';
import {
  sessionBarSelectors,
  useCarIdxSpeed,
  useDriverTires,
  useFocusCarIdx,
  useSessionBarSelector,
  useSessionLapsTiming,
  useSessionTimeTiming,
  useSessionVisibility,
  useTrackDisplayName,
} from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { Standings } from '@irdashies/domain';
import type {
  BroadcastTheme,
  NameFormat,
  StandingsWidgetSettings,
} from '@irdashies/types';
import { formatTime } from '@irdashies/utils/time';
import { clampSetting } from '@irdashies/utils/clampSetting';
import { CarManufacturer } from '../shared/CarManufacturer/CarManufacturer';
import { Compound } from '../shared/Compound/Compound';
import { CountryFlag } from '../Standings/components/CountryFlag/CountryFlag';
import { useBroadcastSettings } from './hooks/useBroadcastSettings';
import {
  buildBroadcastRows,
  diffClassPositions,
  findBattle,
  isSessionFinished,
  racePhase,
  type BroadcastRow,
} from './broadcastRows';
import { GridCard, PodiumCard } from './components/PhaseScreens';
import { classColor, driverName } from './format';

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
  | { kind: 'gained' }
  | { kind: 'pits' }
  | { kind: 'tyres' };

/** Header label for the pages that show the same column for every class. */
const PAGE_LABELS: Partial<Record<Page['kind'], string>> = {
  gained: '+/- Start',
  pits: 'Last Pit',
  tyres: 'Tyres',
};

const ordinal = (n: number) =>
  `${n}${['th', 'st', 'nd', 'rd'][n % 100 > 10 && n % 100 < 14 ? 0 : n % 10] ?? 'th'}`;

interface PositionChange {
  delta: number;
  /** Bumps on every change so the highlight animation restarts. */
  seq: number;
}

/**
 * Remembers the last class position change of each car. A new session
 * reorders everyone at once, which is not an overtake, so it starts clean.
 */
const usePositionChanges = (
  standings: readonly Standings[],
  sessionNum: number | null | undefined
) => {
  const [state, setState] = useState({
    standings,
    sessionNum,
    seq: 0,
    changes: new Map<number, PositionChange>(),
  });
  if (state.sessionNum !== sessionNum) {
    setState({ standings, sessionNum, seq: state.seq, changes: new Map() });
  } else if (state.standings !== standings) {
    const diff = diffClassPositions(state.standings, standings);
    const seq = state.seq + 1;
    const changes = diff.size ? new Map(state.changes) : state.changes;
    for (const [carIdx, delta] of diff) changes.set(carIdx, { delta, seq });
    setState({ standings, sessionNum, seq, changes });
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
  const { sessionType, timeRemaining, isFixedLapRace, state } =
    useSessionTimeTiming();
  const { currentLap, totalRaceLaps } = useSessionLapsTiming();
  // iRacing keeps the clock and lap counter running through the cool-down.
  if (isSessionFinished(state)) return <>FINISH</>;
  if (sessionType === 'Race' && isFixedLapRace && totalRaceLaps > 0) {
    return (
      <>
        LAP {currentLap} / {totalRaceLaps}
      </>
    );
  }
  return <>{formatTime(Math.max(timeRemaining, 0), 'duration')}</>;
};

/** Tower look per series style; class names stay literal for Tailwind. */
const THEMES: Record<
  BroadcastTheme,
  { header: string; panel: string; position: string }
> = {
  imsa: {
    header:
      'border border-white/20 bg-linear-to-b from-slate-700 to-slate-950 text-cyan-300 italic',
    panel: 'bg-slate-950/(--bg-opacity)',
    position: '',
  },
  wec: {
    header: 'bg-linear-to-r from-sky-700 to-blue-950 text-white italic',
    panel: 'bg-blue-950/(--bg-opacity)',
    position: '',
  },
  f1: {
    header: 'bg-red-600 text-white',
    panel: 'bg-zinc-900/(--bg-opacity)',
    position: 'rounded-xs bg-white text-center text-slate-900 not-italic',
  },
};

/** Only inline images are shown; the config is user-editable JSON. */
const isImageDataUrl = (src?: string): src is string =>
  !!src && src.startsWith('data:image/');

const Header = ({
  title,
  logo,
  theme,
}: {
  title: string;
  logo?: string;
  theme: BroadcastTheme;
}) => (
  <div
    className={`rounded-t-sm px-2 py-0.5 text-center font-bold leading-tight tracking-wide uppercase ${THEMES[theme].header}`}
  >
    {isImageDataUrl(logo) && (
      <img src={logo} alt="" className="mx-auto max-h-12 py-1" />
    )}
    <div className="truncate text-base">{title}</div>
    <div className="text-lg tabular-nums">
      <SessionClock />
    </div>
  </div>
);

const GapCell = ({ standing }: { standing: Standings }) => {
  if (standing.onPitRoad || standing.classPosition === 1) return null;
  if (standing.gap?.laps) return <>-{standing.gap.laps}L</>;
  if (standing.gap?.value === undefined) return null;
  return <>-{standing.gap.value.toFixed(3)}</>;
};

const GainedCell = ({ change }: { change?: number }) => {
  if (!change) return <span className="text-white/50">-</span>;
  const gained = change > 0;
  const Arrow = gained ? CaretUpIcon : CaretDownIcon;
  return (
    <span
      className={`flex items-center ${gained ? 'text-green-400' : 'text-red-400'}`}
    >
      <Arrow size={12} weight="fill" />
      {Math.abs(change)}
    </span>
  );
};

/** Pit, repair and penalty markers, like the circled P on TV towers. */
const StatusBadges = ({ standing }: { standing: Standings }) => (
  <>
    {standing.repair && (
      <span
        title="Repair"
        className="relative size-3.5 rounded-full border-2 border-black bg-orange-500"
      />
    )}
    {(standing.penalty || standing.slowdown) && (
      <FlagIcon
        className="relative rounded-xs bg-black p-px text-white"
        size={14}
        weight="fill"
      />
    )}
    {standing.onPitRoad && (
      <span className="relative flex size-4 items-center justify-center rounded-full border border-current text-[10px] not-italic leading-none">
        P
      </span>
    )}
  </>
);

const DriverRow = ({
  standing,
  page,
  nameFormat,
  positionStyle,
  focused,
}: {
  standing: Standings;
  page: Page;
  nameFormat: NameFormat;
  positionStyle: string;
  /** The car the camera is on. */
  focused: boolean;
}) => {
  const color = classColor(standing.carClass.color);
  const dimmed =
    page.kind === 'gaps' && page.classId !== String(standing.carClass.id);
  return (
    <div
      className={[
        'relative flex h-full items-center gap-1.5 pr-2 font-bold italic uppercase transition-opacity duration-500',
        dimmed || standing.dnf ? 'opacity-40' : '',
        focused ? `${color} text-slate-900` : 'text-white',
      ].join(' ')}
    >
      <span className={`relative w-6 ${positionStyle || 'text-right'}`}>
        {standing.classPosition}.
      </span>
      <span className="relative flex size-5 items-center justify-center rounded-xs bg-slate-700/80 text-sm">
        {standing.carId !== undefined && (
          <CarManufacturer carId={standing.carId} />
        )}
      </span>
      <span
        className={`relative w-8 rounded-xs text-center ${focused ? 'bg-slate-900 text-white' : `text-slate-900 ${color}`}`}
      >
        {standing.driver.carNum}
      </span>
      {standing.driver.flairId !== undefined && (
        <span className="relative text-xs not-italic">
          <CountryFlag flairId={standing.driver.flairId} />
        </span>
      )}
      <span className="relative flex-1 truncate">
        {driverName(standing, nameFormat)}
      </span>
      {standing.radioActive && (
        <MicrophoneIcon className="relative" size={12} weight="fill" />
      )}
      <StatusBadges standing={standing} />
      <span className="relative tabular-nums">
        {page.kind === 'gaps' && !dimmed && <GapCell standing={standing} />}
        {page.kind === 'gained' && (
          <GainedCell change={standing.positionChange} />
        )}
        {page.kind === 'pits' &&
          (standing.lastPitLap ? `L${standing.lastPitLap}` : '-')}
        {page.kind === 'tyres' && (
          <Compound tireCompound={standing.tireCompound} />
        )}
      </span>
    </div>
  );
};

const ClassHeader = ({
  row,
  page,
}: {
  row: Extract<BroadcastRow, { kind: 'class' }>;
  page: Page;
}) => {
  const label =
    page.kind === 'gaps'
      ? `class-${page.classId}` === row.key
        ? 'Intervals'
        : undefined
      : PAGE_LABELS[page.kind];
  return (
    <div className="flex h-full items-end justify-between border-t-2 border-white/10 px-2 font-bold italic uppercase">
      <span className="flex items-center gap-2 text-white">
        <span className={`h-3 w-1 ${classColor(row.color)}`} />
        {row.name}
      </span>
      {label && (
        <span
          key={page.kind}
          className="animate-broadcast-enter text-xs text-white/70"
        >
          {label}
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

/** Lower third for the car on camera; reads speed itself so speed ticks
    re-render only this card, not the tower. */
const FocusCard = ({ standing }: { standing: Standings }) => {
  const speed = useCarIdxSpeed()[standing.carIdx];
  return (
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
        {speed !== undefined && (
          <span className="ml-auto">{Math.round(speed)} km/h</span>
        )}
      </div>
    </div>
  );
};

export const Broadcast = () => {
  const settings = useBroadcastSettings();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);
  const trackName = useTrackDisplayName();
  const groups = useDriverStandings(STANDINGS_OPTIONS, {
    showAll: true,
    livePositions: true,
  });
  const perClass = clampSetting(settings?.driversPerClass, 1, 30, 5);
  const standings = useMemo(() => groups.flatMap(([, d]) => d), [groups]);
  const sessionNum = useSessionBarSelector(sessionBarSelectors.sessionNum);
  const changes = usePositionChanges(standings, sessionNum);
  const focusCarIdx = useFocusCarIdx();
  const hasTyreChoice = (useDriverTires()?.length ?? 0) > 1;
  const rows = useMemo(
    () => buildBroadcastRows(groups, perClass, focusCarIdx),
    [groups, perClass, focusCarIdx]
  );
  // Rebuilt only when the set of classes or available pages changes, not on
  // every standings update, so the page rotation keeps its place.
  const classList = JSON.stringify(
    groups.map(([classId, drivers]) => [
      classId,
      drivers[0]?.carClass.name ?? '',
    ])
  );
  // Positions gained only exist in a race, against the qualifying grid.
  const hasGained = standings.some((s) => s.positionChange !== undefined);
  const hasPits = standings.some((s) => s.lastPitLap);
  const pages = useMemo<Page[]>(
    () => [
      { kind: 'names' },
      ...(JSON.parse(classList) as [string, string][]).map(
        ([classId, className]): Page => ({ kind: 'gaps', classId, className })
      ),
      ...(hasGained ? [{ kind: 'gained' } as const] : []),
      ...(hasPits ? [{ kind: 'pits' } as const] : []),
      ...(hasTyreChoice ? [{ kind: 'tyres' } as const] : []),
    ],
    [classList, hasGained, hasPits, hasTyreChoice]
  );
  const { page, tick, effect } = usePageRotation(
    pages,
    clampSetting(settings?.pageSeconds, 3, 30, 8)
  );
  const battle =
    page.kind === 'gaps'
      ? findBattle(
          groups.find(([id]) => id === page.classId)?.[1] ?? [],
          perClass,
          BATTLE_GAP_SECONDS
        )
      : undefined;
  const focus = standings.find((s) => s.carIdx === focusCarIdx);
  const { sessionType, state: sessionState } = useSessionTimeTiming();
  const phase =
    settings?.phaseScreens !== false
      ? racePhase(sessionType, sessionState)
      : undefined;
  const nameFormat = settings?.driverNameFormat ?? 'surname';
  const theme = settings?.theme ?? 'imsa';
  const look = THEMES[theme] ?? THEMES.imsa;

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
      <div className={`overflow-hidden rounded-sm shadow-lg ${look.panel}`}>
        <Header
          title={settings?.title || trackName || ''}
          logo={settings?.logo}
          theme={theme}
        />
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
                {/* A car that just moved glows green (gained) or red (lost),
                    then fades. Kept outside the page transition so it never
                    replays. */}
                {change && row.kind === 'driver' && (
                  <span
                    key={change.seq}
                    className={`absolute inset-y-0.5 right-0 left-0 animate-broadcast-fade rounded-xs ${
                      change.delta > 0
                        ? 'bg-green-500/35 shadow-[0_0_12px_2px_rgba(34,197,94,0.8)]'
                        : 'bg-red-500/35 shadow-[0_0_12px_2px_rgba(239,68,68,0.8)]'
                    }`}
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
                      positionStyle={look.position}
                      focused={row.standing.carIdx === focusCarIdx}
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
      {phase === 'grid' && <GridCard groups={groups} perClass={perClass} />}
      {phase === 'podium' && <PodiumCard groups={groups} />}
      {settings?.showFocusCard !== false && focus && (
        <FocusCard key={focus.carIdx} standing={focus} />
      )}
    </div>
  );
};
