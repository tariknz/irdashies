import { memo, useMemo } from 'react';
import {
  useCarSystemsSnapshot,
  useDrivingState,
  useSessionVisibility,
  useGeneralSettings,
} from '@irdashies/context';
import {
  CAR_SYSTEM_ADJUSTMENTS,
  carSystemRowKey,
  type CarSystemAdjustment,
} from '@irdashies/types';
import { useCarSystemsSettings } from './hooks/useCarSystemsSettings';

/** Shown for a column the current car does not have. */
const BLANK = '--';

const formatValue = (adjustment: CarSystemAdjustment): string => {
  const value = adjustment.value.toFixed(adjustment.precision);
  return adjustment.unit ? `${value}${adjustment.unit}` : value;
};

interface SystemColumnProps {
  short: string;
  chip: string;
  adjustment?: CarSystemAdjustment;
  isCompact: boolean;
}

export const SystemColumn = memo(
  ({ short, chip, adjustment, isCompact }: SystemColumnProps) => {
    const unsupported = adjustment === undefined;
    // Off and unsupported look alike on purpose - both are "nothing to read
    // here" - and the value below tells them apart: a number the driver set to
    // zero, or a blank for a system the car does not have.
    const subdued = unsupported || adjustment.isOff;

    return (
      <div className="flex flex-1 min-w-0 flex-col items-center gap-0.5">
        {/* px-1 rather than the Pitlane Helper's px-2: its chips are standalone
            status pills, these are packed side by side, and the wider padding
            truncated a three-letter label once the column count got high. */}
        <div
          className={`w-full text-center text-xs font-bold py-1 px-1 rounded truncate ${
            subdued ? 'bg-slate-600/60 text-white/60' : `${chip} text-white`
          }`}
        >
          {short}
        </div>
        {/* The value carries the glance, so it outweighs its own label - the
            same balance the Pitlane Helper strikes between its big readouts
            and their small captions. */}
        <div
          className={`${isCompact ? 'text-base' : 'text-[1.35em] py-0.5'} text-center font-semibold tabular-nums whitespace-nowrap leading-none ${
            subdued ? 'text-white/40' : 'text-white'
          }`}
        >
          {unsupported ? BLANK : formatValue(adjustment)}
        </div>
      </div>
    );
  }
);
SystemColumn.displayName = 'SystemColumn';

export const CarSystems = () => {
  const settings = useCarSystemsSettings();
  const generalSettings = useGeneralSettings();
  const snapshot = useCarSystemsSnapshot();
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';

  // Keyed by display column, so the Clio's dcPeakBrakeBias fills the brake bias
  // column rather than going unmatched.
  const byColumn = useMemo(() => {
    const map = new Map<string, CarSystemAdjustment>();
    for (const adjustment of snapshot?.adjustments ?? []) {
      map.set(carSystemRowKey(adjustment.key), adjustment);
    }
    return map;
  }, [snapshot?.adjustments]);

  const columns = useMemo(() => {
    const configured = settings?.rows ?? [];
    return configured
      .map((key) => {
        const definition = CAR_SYSTEM_ADJUSTMENTS.find((d) => d.key === key);
        if (!definition) return undefined;
        return {
          key,
          short: definition.short,
          chip: definition.chip,
          adjustment: byColumn.get(key),
        };
      })
      .filter(
        (column): column is NonNullable<typeof column> => column !== undefined
      )
      .filter(
        (column) =>
          settings?.showUnsupportedRows || column.adjustment !== undefined
      );
  }, [settings?.rows, settings?.showUnsupportedRows, byColumn]);

  if (!isSessionVisible) return <></>;
  if (settings?.showOnlyWhenOnTrack && !isDriving) return <></>;
  if (columns.length === 0) return <></>;

  return (
    <div
      className={`w-full bg-slate-800/(--bg-opacity) rounded text-white font-medium ${isCompact ? 'p-1' : 'p-2'}`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <div className={`flex w-full ${isCompact ? 'gap-1' : 'gap-2'}`}>
        {columns.map((column) => (
          <SystemColumn
            key={column.key}
            short={column.short}
            chip={column.chip}
            adjustment={column.adjustment}
            isCompact={isCompact}
          />
        ))}
      </div>
    </div>
  );
};
