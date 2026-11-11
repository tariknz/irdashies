import { memo } from 'react';
import {
  useSessionVisibility,
  useDashboard,
  useWeekendInfoNumCarClasses,
  useGeneralSettings,
} from '@irdashies/context';
import type { GeneralSettingsType } from '@irdashies/types';
import { useCarBehind } from './hooks/useCarBehind';
import { useFasterCarsSettings } from './hooks/useFasterCarsSettings';
import { getTailwindStyle } from '@irdashies/utils/colors';
import {
  DriverRatingBadge,
  type DriverRatingBadgeProps,
} from '../shared/DriverRatingBadge/DriverRatingBadge';
import { getDemoCarsBehind } from './demoData';
import { formatClassLabel } from './formatClassLabel';

export interface FasterCarsFromBehindProps {
  carIdx?: number;
  name?: string;
  license?: string;
  rating?: number;
  distance?: number;
  percent?: number;
  classColor?: number;
  className?: string;
  classPosition?: number;
  isMultiClass?: boolean;
  isClosest?: boolean;
}

const CARD_DENSITY = {
  off: {
    spacing: 'gap-1',
    row: 'h-[33px] gap-2.5 pr-2.5 text-base',
    classBlock: 'w-[38px] gap-px leading-3',
    countdown: 'text-[19px]',
    bar: 'h-[3px]',
  },
  compact: {
    spacing: 'gap-[3px]',
    row: 'h-7 gap-2 pr-2 text-md',
    classBlock: 'w-9 gap-0 leading-3',
    countdown: 'text-[17px]',
    bar: 'h-0.5',
  },
  ultra: {
    spacing: 'gap-0.5',
    row: 'h-6 gap-1.5 pr-1.5 text-sm',
    classBlock: 'w-[34px] gap-0 leading-[11px]',
    countdown: 'text-base',
    bar: 'h-0.5',
  },
} satisfies Record<NonNullable<GeneralSettingsType['compactMode']>, unknown>;

export const FasterCarsFromBehind = () => {
  const { isDemoMode } = useDashboard();
  const numCarClasses = useWeekendInfoNumCarClasses();
  const isMultiClass = isDemoMode || (numCarClasses ?? 0) > 1;
  const settings = useFasterCarsSettings();
  const density = CARD_DENSITY[useGeneralSettings()?.compactMode ?? 'off'];
  const carsBehind = useCarBehind({
    distanceThreshold: settings?.distanceThreshold,
  });

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  // Generate demo data when in demo mode
  const demoCarsBehind = isDemoMode
    ? getDemoCarsBehind(settings?.numberDriversBehind || 1)
    : carsBehind;

  if (demoCarsBehind.length === 0) return null;

  // Apply alignment based on alignDriverBoxes setting
  const containerAlignment =
    settings.alignDriverBoxes === 'Bottom' ? 'justify-end' : 'justify-start';

  // Apply ordering based on closestDriverBox setting
  const orderedCars =
    settings.closestDriverBox === 'Reverse'
      ? [...demoCarsBehind].reverse()
      : demoCarsBehind;

  return (
    <div
      role="list"
      aria-label="Faster cars behind"
      className={`flex h-full flex-col ${density.spacing} ${containerAlignment}`}
    >
      {orderedCars.map((car) => (
        <FasterCarsFromBehindDisplay
          key={car.carIdx}
          {...car}
          isMultiClass={isMultiClass}
          isClosest={car.carIdx === demoCarsBehind[0]?.carIdx}
        />
      ))}
    </div>
  );
};

export const FasterCarsFromBehindDisplay = memo(
  ({
    name,
    license,
    rating,
    distance,
    percent,
    classColor,
    className,
    classPosition,
    isMultiClass = false,
    isClosest = false,
  }: FasterCarsFromBehindProps) => {
    const settings = useFasterCarsSettings();
    const density = CARD_DENSITY[useGeneralSettings()?.compactMode ?? 'off'];

    if (!name) {
      return null;
    }

    const validDistance =
      typeof distance === 'number' && Number.isFinite(distance);
    const urgent = validDistance && Math.abs(distance) < 0.5;
    const proximity = Number.isFinite(percent)
      ? Math.max(0, Math.min(100, percent ?? 0))
      : 0;
    const classStyle = getTailwindStyle(classColor, undefined, isMultiClass);
    const classLabel = className?.trim() || '—';
    const position =
      typeof classPosition === 'number' &&
      Number.isInteger(classPosition) &&
      classPosition > 0
        ? classPosition
        : undefined;
    const classDescription = `${classLabel === '—' ? 'Class unavailable' : classLabel}, ${position === undefined ? 'class position unavailable' : `class position ${position}`}`;

    name = settings?.removeNumbersFromName ? name.replace(/\d/g, '') : name;

    return (
      <div
        role="listitem"
        className={`w-full min-w-0 overflow-hidden rounded-sm text-[#edf0f4] ${isClosest ? 'bg-settings-control' : 'bg-[#1b222b]'}`}
      >
        <div className={`flex min-w-0 items-center ${density.row}`}>
          <span
            role="group"
            aria-label={classDescription}
            title={classDescription}
            className={`relative isolate flex shrink-0 self-stretch flex-col items-center justify-center overflow-hidden text-[11px] font-semibold ${density.classBlock}`}
            style={{ color: classStyle.canvasFill }}
          >
            <span
              aria-hidden="true"
              className={`absolute inset-0 -z-10 opacity-15 ${classStyle.classHeader}`}
            />
            <span className="block max-w-full px-0.5 font-mono">
              {formatClassLabel(className)}
            </span>
            <span className="max-w-full truncate px-1 text-[#edf0f4] tabular-nums">
              {position === undefined ? '—' : `P${position}`}
            </span>
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-1">
            {settings?.showName && (
              <div className="min-w-0 flex-1 truncate font-medium" title={name}>
                {name}
              </div>
            )}
            {settings?.showBadge && (
              <div className="flex shrink-0 items-center">
                <DriverRatingBadge
                  license={license}
                  rating={rating}
                  format={
                    settings.badgeFormat as DriverRatingBadgeProps['format']
                  }
                />
              </div>
            )}
          </div>
          {settings?.showDistance && (
            <span
              aria-label={
                validDistance
                  ? `${Math.abs(distance).toFixed(1)} seconds behind`
                  : 'Gap unavailable'
              }
              className={`min-w-[5ch] shrink-0 text-right leading-none font-semibold tabular-nums ${density.countdown} ${urgent ? 'text-red-300' : ''}`}
            >
              {validDistance ? `−${Math.abs(distance).toFixed(1)}` : '—'}
              <span className="ml-1 text-[11px] font-normal text-[#a5afbd]">
                s
              </span>
            </span>
          )}
        </div>

        <div aria-hidden="true" className={`bg-[#3a414b] ${density.bar}`}>
          <div
            className={`h-full w-full origin-left transition-[transform,background-color] duration-200 ease-linear motion-reduce:transition-none ${urgent ? 'bg-red-300' : 'bg-[#edbf68]'}`}
            style={{ transform: `scaleX(${proximity / 100})` }}
          />
        </div>
      </div>
    );
  }
);
FasterCarsFromBehindDisplay.displayName = 'FasterCarsFromBehindDisplay';
