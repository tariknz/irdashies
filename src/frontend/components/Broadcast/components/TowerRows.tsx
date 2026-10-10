import {
  CaretDownIcon,
  CaretUpIcon,
  FlagIcon,
  MicrophoneIcon,
} from '@phosphor-icons/react';
import type { Standings } from '@irdashies/domain';
import type { NameFormat } from '@irdashies/types';
import { CarManufacturer } from '../../shared/CarManufacturer/CarManufacturer';
import { Compound } from '../../shared/Compound/Compound';
import { CountryFlag } from '../../Standings/components/CountryFlag/CountryFlag';
import type { BroadcastRow } from '../broadcastRows';
import { classColor, driverName } from '../format';
import { PAGE_LABELS, type Page } from '../towerPages';

/**
 * Gained or lost a class place just now: an arrow that fades out. Placed by the
 * tower over the gap DriverRow leaves after the position, outside the page
 * flip animation so a page change does not replay it.
 */
export const PositionArrow = ({ delta }: { delta: number }) => (
  <span
    className={`pointer-events-none absolute inset-y-0 left-7.5 flex animate-broadcast-fade items-center ${delta > 0 ? 'text-green-400' : 'text-red-400'}`}
  >
    {delta > 0 ? (
      <CaretUpIcon size={12} weight="fill" />
    ) : (
      <CaretDownIcon size={12} weight="fill" />
    )}
  </span>
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

export const DriverRow = ({
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
      {/* Room for the PositionArrow, which sits outside the page flip. */}
      <span className="w-3" />
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

export const ClassHeader = ({
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
