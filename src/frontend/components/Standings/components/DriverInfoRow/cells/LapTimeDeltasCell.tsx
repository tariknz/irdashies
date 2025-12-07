import { memo, Fragment } from 'react';

interface LapTimeDeltasCellProps {
  hidden?: boolean;
  lapTimeDeltas?: number[];
  emptyLapDeltaPlaceholders: number[] | null;
  isPlayer: boolean;
}

export const LapTimeDeltasCell = memo(({ hidden, lapTimeDeltas, emptyLapDeltaPlaceholders, isPlayer }: LapTimeDeltasCellProps) => {
  if (lapTimeDeltas !== undefined) {
    return (
      <Fragment>
        {lapTimeDeltas.map((deltaValue, index) => (
          <td
            key={`lapTimeDelta-${index}`}
            data-column="lapTimeDelta"
            className={`w-auto px-1 text-center whitespace-nowrap ${deltaValue > 0 ? 'text-green-400' : 'text-red-400'}`}
          >
            {hidden ? '' : Math.abs(deltaValue).toFixed(1)}
          </td>
        ))}
      </Fragment>
    );
  }
  
  if (emptyLapDeltaPlaceholders) {
    if (isPlayer) {
      return (
        <Fragment>
          {emptyLapDeltaPlaceholders.map((index) => (
            <td key={`empty-lapTimeDelta-${index}`} data-column="lapTimeDelta" className="w-auto px-1 text-center whitespace-nowrap">{hidden ? '' : '-'}</td>
          ))}
        </Fragment>
      );
    }
    return (
      <Fragment>
        {emptyLapDeltaPlaceholders.map((index) => (
          <td key={`placeholder-lapTimeDelta-${index}`} data-column="lapTimeDelta" className="w-auto px-1 text-center whitespace-nowrap">{hidden ? '' : ''}</td>
        ))}
      </Fragment>
    );
  }
  
  return null;
});

LapTimeDeltasCell.displayName = 'LapTimeDeltasCell';

