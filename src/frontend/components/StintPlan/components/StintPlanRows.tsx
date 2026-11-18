import { memo, type ReactNode } from 'react';
import {
  ClockIcon,
  GasPumpIcon,
  InfoIcon,
  WarningIcon,
} from '@phosphor-icons/react';
import type {
  RacePlanBoxState,
  RacePlanDriftLevel,
  RacePlanFuelLevel,
} from '@irdashies/domain';

interface StintPlanFrameProps {
  opacity: number;
  children: ReactNode;
}

export const StintPlanFrame = ({ opacity, children }: StintPlanFrameProps) => (
  <div
    className="flex h-full w-full flex-col gap-1 overflow-hidden rounded-sm bg-slate-800/(--bg-opacity) p-2 text-sm text-white"
    style={{ ['--bg-opacity' as string]: `${opacity}%` }}
  >
    {children}
  </div>
);

export const StintPlanBanner = memo(({ text }: { text: string }) => (
  <div className="flex items-center gap-1 rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-200">
    <WarningIcon size={14} weight="fill" className="flex-none" />
    <span className="truncate">{text}</span>
  </div>
));
StintPlanBanner.displayName = 'StintPlanBanner';

export const StintPlanNotice = memo(
  ({ title, hint }: { title: string; hint: string | null }) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center text-slate-300">
      <InfoIcon size={18} className="text-slate-400" />
      <p>{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
);
StintPlanNotice.displayName = 'StintPlanNotice';

interface ClashIconProps {
  clashes: number;
  warnings: number;
  text: string;
}

export const ClashIcon = memo(({ clashes, warnings, text }: ClashIconProps) => {
  if (clashes === 0 && warnings === 0) return null;
  const label =
    clashes > 0
      ? `${clashes} ${clashes === 1 ? 'clash' : 'clashes'} with driver availability`
      : `${warnings} availability ${warnings === 1 ? 'warning' : 'warnings'}`;
  return (
    <span
      title={`${label}\n${text}`}
      aria-label={label}
      role="img"
      className={`flex flex-none items-center gap-0.5 text-xs ${clashes > 0 ? 'text-red-400' : 'text-amber-300'}`}
    >
      <WarningIcon size={16} weight="fill" />
      {clashes + warnings}
    </span>
  );
});
ClashIcon.displayName = 'ClashIcon';

interface StintHeaderProps extends ClashIconProps {
  stintLabel: string;
  driverName: string | null;
}

export const StintHeader = memo(
  ({ stintLabel, driverName, clashes, warnings, text }: StintHeaderProps) => (
    <div className="flex items-center gap-2">
      <span className="flex-none text-xs font-bold uppercase tracking-wider text-slate-400">
        {stintLabel}
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">
        {driverName}
      </span>
      <ClashIcon clashes={clashes} warnings={warnings} text={text} />
    </div>
  )
);
StintHeader.displayName = 'StintHeader';

interface BoxRowProps {
  lapLabel: string | null;
  boxKind: RacePlanBoxState['kind'];
  boxLabel: string;
}

export const BoxRow = memo(({ lapLabel, boxKind, boxLabel }: BoxRowProps) => (
  <div className="flex items-center gap-2">
    <span className="flex-1 tabular-nums text-slate-200">{lapLabel}</span>
    <span
      className={[
        'rounded-sm px-1.5 py-0.5 font-bold tabular-nums',
        boxKind === 'box-now'
          ? 'animate-pulse bg-amber-400 text-slate-900'
          : boxKind === 'box-in'
            ? 'bg-slate-700 text-white'
            : 'bg-slate-700/60 text-slate-400',
      ].join(' ')}
    >
      {boxLabel}
    </span>
  </div>
));
BoxRow.displayName = 'BoxRow';

const FUEL_ACTUAL_CLASS: Record<RacePlanFuelLevel, string> = {
  'on-target': 'text-green-400',
  over: 'text-red-400',
  unknown: 'text-slate-400',
};

interface FuelRowProps {
  target: string | null;
  actual: string | null;
  level: RacePlanFuelLevel;
}

export const FuelRow = memo(({ target, actual, level }: FuelRowProps) => (
  <div className="flex items-center gap-1.5 tabular-nums">
    <GasPumpIcon size={14} className="flex-none text-slate-400" />
    <span className="text-slate-400">Target</span>
    <span>{target ?? '--'}</span>
    <span className="text-slate-400">Actual</span>
    <span className={FUEL_ACTUAL_CLASS[level]}>{actual ?? '--'}</span>
    <span className="text-xs text-slate-400">L/lap</span>
  </div>
));
FuelRow.displayName = 'FuelRow';

interface NextRowProps {
  label: string;
  driverName: string;
  start: string;
}

export const NextRow = memo(({ label, driverName, start }: NextRowProps) => (
  <div className="flex items-center gap-1.5">
    <ClockIcon size={14} className="flex-none text-slate-400" />
    <span className="text-slate-400">{label}</span>
    <span className="min-w-0 truncate font-semibold">{driverName}</span>
    <span className="ml-auto flex-none tabular-nums text-slate-200">
      {start}
    </span>
  </div>
));
NextRow.displayName = 'NextRow';

const DRIFT_CLASS: Record<RacePlanDriftLevel, string> = {
  behind: 'text-amber-300',
  ahead: 'text-green-400',
  'on-plan': 'text-slate-300',
};

export const DriftRow = memo(
  ({ text, level }: { text: string; level: RacePlanDriftLevel }) => (
    <div className={`tabular-nums ${DRIFT_CLASS[level]}`}>{text}</div>
  )
);
DriftRow.displayName = 'DriftRow';
