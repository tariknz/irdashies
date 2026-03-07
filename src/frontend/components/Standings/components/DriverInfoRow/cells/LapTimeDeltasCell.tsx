import { memo, Fragment } from 'react';
import { useGeneralSettings } from '@irdashies/context';

interface LapTimeDeltasCellProps {
  lapTimeDeltas?: number[];
  emptyLapDeltaPlaceholders: number[] | null;
  isPlayer: boolean;
}

export const LapTimeDeltasCell = memo(
  ({
    lapTimeDeltas,
    emptyLapDeltaPlaceholders,
    isPlayer,
  }: LapTimeDeltasCellProps) => {
    const compactMode = useGeneralSettings()?.compactMode;
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
                {Math.abs(deltaValue).toFixed(1)}
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
