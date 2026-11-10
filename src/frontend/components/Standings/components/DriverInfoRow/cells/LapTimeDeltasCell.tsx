import { t } from '@irdashies/frontend/i18n';
import { memo, Fragment } from 'react';
import { buildDeltaPlaceholder } from './deltaPlaceholder';

interface LapTimeDeltasCellProps {
  lapTimeDeltas?: number[];
  emptyLapDeltaPlaceholders: number[] | null;
  compactMode?: string;
  decimalPlaces?: number;
}

export const LapTimeDeltasCell = memo(
  ({
    lapTimeDeltas,
    emptyLapDeltaPlaceholders,
    compactMode,
    decimalPlaces,
  }: LapTimeDeltasCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    if (!emptyLapDeltaPlaceholders) {
      return null;
    }

    // Keeps a stable column width whether or not a value is present, so the
    // header label above stays aligned with the data regardless of which
    // rows/laps have a delta yet.
    const placeholderText = buildDeltaPlaceholder(decimalPlaces ?? 1);

    return (
      <Fragment>
        {emptyLapDeltaPlaceholders.map((_, index) => {
          const deltaValue = lapTimeDeltas?.[index];
          if (deltaValue !== undefined) {
            return (
              <td
                key={index}
                data-column="lapTimeDelta"
                className={`w-auto ${pxClass} text-center whitespace-nowrap ${deltaValue > 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {Math.abs(deltaValue).toFixed(decimalPlaces)}
              </td>
            );
          } else {
            return (
              <td
                key={index}
                data-column="lapTimeDelta"
                className={`w-auto ${pxClass} text-center whitespace-nowrap text-white/40`}
              >
                {t(placeholderText)}
              </td>
            );
          }
        })}
      </Fragment>
    );
  }
);

LapTimeDeltasCell.displayName = 'LapTimeDeltasCell';
