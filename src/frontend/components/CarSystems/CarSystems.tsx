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

/** Placeholder for a row the current car does not have. */
const BLANK = '--';

const formatValue = (adjustment: CarSystemAdjustment): string => {
  const value = adjustment.value.toFixed(adjustment.precision);
  return adjustment.unit ? `${value}${adjustment.unit}` : value;
};

interface SystemRowProps {
  label: string;
  adjustment?: CarSystemAdjustment;
  isCompact: boolean;
  rowIndex: number;
}

export const SystemRow = memo(
  ({ label, adjustment, isCompact, rowIndex }: SystemRowProps) => {
    const unsupported = adjustment === undefined;
    // Off and unsupported are different states that happen to look alike: one
    // is a system the driver switched off, the other a system the car does not
    // have. Both are subdued, and the value distinguishes them.
    const subdued = unsupported || adjustment.isOff;

    return (
      <tr
        className={rowIndex % 2 === 0 ? 'bg-slate-800/70' : 'bg-slate-900/70'}
      >
        <td
          className={`${isCompact ? '' : 'py-0.5'} px-2 whitespace-nowrap ${
            subdued ? 'text-white/40' : 'text-white/80'
          }`}
        >
          {label}
        </td>
        <td
          className={`${isCompact ? '' : 'py-0.5'} px-2 text-right tabular-nums whitespace-nowrap ${
            subdued ? 'text-white/40' : 'text-white'
          }`}
        >
          {unsupported ? BLANK : formatValue(adjustment)}
        </td>
      </tr>
    );
  }
);
SystemRow.displayName = 'SystemRow';

export const CarSystems = () => {
  const settings = useCarSystemsSettings();
  const generalSettings = useGeneralSettings();
  const snapshot = useCarSystemsSnapshot();
  const { isDriving } = useDrivingState();
  const isSessionVisible = useSessionVisibility(settings?.sessionVisibility);

  const isCompact =
    generalSettings?.compactMode === 'compact' ||
    generalSettings?.compactMode === 'ultra';

  // Keyed by display row, so the Clio's dcPeakBrakeBias fills the brake bias
  // row rather than going unmatched.
  const byRow = useMemo(() => {
    const map = new Map<string, CarSystemAdjustment>();
    for (const adjustment of snapshot?.adjustments ?? []) {
      map.set(carSystemRowKey(adjustment.key), adjustment);
    }
    return map;
  }, [snapshot?.adjustments]);

  const rows = useMemo(() => {
    const configured = settings?.rows ?? [];
    return configured
      .map((key) => {
        const definition = CAR_SYSTEM_ADJUSTMENTS.find((d) => d.key === key);
        if (!definition) return undefined;
        return { key, label: definition.label, adjustment: byRow.get(key) };
      })
      .filter((row): row is NonNullable<typeof row> => row !== undefined)
      .filter(
        (row) => settings?.showUnsupportedRows || row.adjustment !== undefined
      );
  }, [settings?.rows, settings?.showUnsupportedRows, byRow]);

  if (!isSessionVisible) return <></>;
  if (settings?.showOnlyWhenOnTrack && !isDriving) return <></>;
  if (rows.length === 0) return <></>;

  return (
    <div
      className={`w-full bg-slate-800/(--bg-opacity) rounded-sm ${isCompact ? '' : 'p-2'} overflow-hidden`}
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
      }}
    >
      <table className="w-full table-auto text-sm border-separate border-spacing-y-0.5">
        <tbody>
          {rows.map((row, index) => (
            <SystemRow
              key={row.key}
              label={row.label}
              adjustment={row.adjustment}
              isCompact={isCompact}
              rowIndex={index}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
};
