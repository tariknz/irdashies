import { memo } from 'react';
import { Gap } from '../../../createStandings';

interface DeltaCellProps {
  delta?: number | Gap;
  showForUndefined?: string;
  decimalPlaces?: number;
  compactMode?: string;
  inRotationGroup?: boolean;
}

export const DeltaCell = memo(
  ({
    delta,
    showForUndefined = '-',
    decimalPlaces = 2,
    compactMode,
    inRotationGroup = false,
  }: DeltaCellProps) => {
    const pxClass =
      compactMode === 'ultra'
        ? ''
        : compactMode === 'compact'
          ? 'px-1'
          : 'px-2';
    // Helper function to check if delta is a Gap object
    const isGapObject = (val: number | Gap | undefined): val is Gap => {
      return typeof val === 'object' && val !== undefined && 'laps' in val;
    };

    // Determine what to display
    let displayValue: string = showForUndefined;

    if (delta !== undefined) {
      if (isGapObject(delta)) {
        // It's a Gap object
        if (delta.laps !== 0) {
          // Show lap difference
          displayValue = `${delta.laps}L`;
        } else if (delta.value !== undefined) {
          // Show time difference from Gap.value
          displayValue = delta.value.toFixed(decimalPlaces);
        }
      } else {
        // It's a plain number - show time difference
        displayValue = delta.toFixed(decimalPlaces);
      }
    }

    const content = (
      <div
        className={`${inRotationGroup ? 'w-full h-full flex items-center justify-center' : ''} whitespace-nowrap tabular-nums`}
      >
        {displayValue}
      </div>
    );

    if (inRotationGroup) return content;

    return (
      <td
        data-column="delta"
        className={`w-auto ${pxClass} whitespace-nowrap text-center tabular-nums`}
      >
        {displayValue}
      </td>
    );
  }
);

DeltaCell.displayName = 'DeltaCell';
