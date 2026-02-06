import { memo } from 'react';
import { Gap } from '../../../createStandings';

interface DeltaCellProps {
  delta?: number | Gap;
  showForUndefined?: string;
  decimalPlaces?: number;
}

export const DeltaCell = memo(
  ({
    delta,
    showForUndefined = '-',
    decimalPlaces = 2,
  }: DeltaCellProps) => {
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

    return (
      <td
        data-column="delta"
        className="w-auto px-2 whitespace-nowrap text-center"
      >
        {displayValue}
      </td>
    );
  }
);

DeltaCell.displayName = 'DeltaCell';
