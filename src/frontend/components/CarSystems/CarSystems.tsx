import { memo, useMemo } from 'react';
import {
  useCarSystemsSnapshot,
  useDrivingState,
  useSessionVisibility,
  useGeneralSettings,
} from '@irdashies/context';
import {
  CAR_SYSTEM_ADJUSTMENTS,
  resolveCarSystemDefinition,
  type CarSystemAdjustment,
} from '@irdashies/types';
import { useCarSystemsSettings } from './hooks/useCarSystemsSettings';
import { usePlayerCarPath } from './hooks/usePlayerCarPath';

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

    // flex-auto rather than flex-1: equal-width columns size to the widest
    // possible content, so a percentage like 53.5% got the same room as a
    // single digit and crowded its neighbours. Sizing from content lets the
    // brake bias column take the width it actually needs.
    return (
      <div className="flex flex-auto min-w-0 flex-col items-center gap-0.5">
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
          className={`${isCompact ? 'text-base' : 'text-[1.35em] py-0.5'} px-2 text-center font-semibold tabular-nums whitespace-nowrap leading-none ${
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
  const carPath = usePlayerCarPath();
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';

  // One column per telemetry key. No key folds into another: dcPeakBrakeBias
  // used to be folded into brake bias on the theory that the two never
  // coexisted, and the W13 publishes both - a live 52% bias and a migration
  // dial reading 3 - so the fold overwrote the real bias with the migration
  // setting and showed it as a percentage.
  const byColumn = useMemo(() => {
    const map = new Map<string, CarSystemAdjustment>();
    for (const adjustment of snapshot?.adjustments ?? []) {
      map.set(adjustment.key, adjustment);
    }
    return map;
  }, [snapshot?.adjustments]);

  const columns = useMemo(() => {
    const configured = settings?.rows ?? [];
    return (
      configured
        .map((key) => {
          const catalogue = CAR_SYSTEM_ADJUSTMENTS.find((d) => d.key === key);
          if (!catalogue) return undefined;
          // Renamed per car where the car wires that channel to a different
          // control. The key is unchanged, so the saved row selection and the
          // snapshot both still match on it.
          const definition = resolveCarSystemDefinition(catalogue, carPath);
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
        )
        // A system the driver switched off is hidden separately from one the car
        // never had: the GR86 shows a blank TC2 because it has no second traction
        // control at all, while a GT3 car shows a greyed 0 because the driver
        // turned its traction control off. Someone who wants a strip of live
        // readings only wants both gone, but they are different facts.
        .filter(
          (column) => settings?.showOffRows || column.adjustment?.isOff !== true
        )
    );
  }, [
    settings?.rows,
    settings?.showUnsupportedRows,
    settings?.showOffRows,
    byColumn,
    carPath,
  ]);

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
