import { memo, Fragment } from 'react';

interface LapTimeDeltasCellProps {
  lapTimeDeltas?: number[];
  emptyLapDeltaPlaceholders: number[] | null;
  isPlayer: boolean;
  compactMode?: string;
  decimalPlaces?: number;
}

export const LapTimeDeltasCell = memo(
  ({
    lapTimeDeltas,
    emptyLapDeltaPlaceholders,
    isPlayer,
    compactMode,
    decimalPlaces,
  }: LapTimeDeltasCellProps) => {
    const pxClass = compactMode === 'ultra' ? '' : 'px-1';

    if (!emptyLapDeltaPlaceholders) {
      return null;
    }

    return (
      <Fragment>
        {emptyLapDeltaPlaceholders.map((_, index) => {
          const deltaValue = lapTimeDeltas?.[index];
          if (deltaValue !== undefined) {
            return (
              <td
                key={`lapTimeDelta-${index}`}
                data-column="lapTimeDelta"
                className={`w-auto ${pxClass} text-center whitespace-nowrap ${deltaValue > 0 ? 'text-green-400' : 'text-red-400'}`}
              >
                {Math.abs(deltaValue).toFixed(decimalPlaces)}
              </td>
            );
          } else {
            return (
              <td
                key={`empty-lapTimeDelta-${index}`}
                data-column="lapTimeDelta"
                className={`w-auto ${pxClass} text-center whitespace-nowrap`}
              >
                {isPlayer ? '-' : ''}
              </td>
            );
          }
        })}
      </Fragment>
    );
  }
);

LapTimeDeltasCell.displayName = 'LapTimeDeltasCell';
