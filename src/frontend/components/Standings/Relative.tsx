import { useAutoAnimate } from '@formkit/auto-animate/react';
import { useRef } from 'react';
import { DriverInfoRow } from './components/DriverInfoRow/DriverInfoRow';
import { useDriverRelatives } from './hooks/useDriverRelatives';
import { useRowHeight, useRelativeSettings } from './hooks';
import { DriverRatingBadge } from './components/DriverRatingBadge/DriverRatingBadge';
import { SessionBar } from './components/SessionBar/SessionBar';
import { SessionFooter } from './components/SessionFooter/SessionFooter';

export const Relative = () => {
  const config = useRelativeSettings();
  const buffer = config?.buffer ?? 3;
  const standings = useDriverRelatives({ buffer });
  const [parent] = useAutoAnimate();
  const tableRef = useRef<HTMLTableElement>(null);
  const rowHeight = useRowHeight(tableRef, standings.length > 0);

  // Always render 2 * buffer + 1 rows (buffer above + player + buffer below)
  const totalRows = 2 * buffer + 1;
  const playerIndex = standings.findIndex((result) => result.isPlayer);

  // If no player found, render empty table with consistent height
  if (playerIndex === -1) {
    const emptyRows = Array.from({ length: totalRows }, (_, index) => (
      <EmptyRow key={`empty-${index}`} rowHeight={rowHeight} />
    ));

    return (
      <div className="w-full h-full">
        <SessionBar />
        <table
          ref={tableRef}
          className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3"
        >
          <tbody ref={parent}>{emptyRows}</tbody>
        </table>
        <SessionFooter />
      </div>
    );
  }

  // Create an array of fixed size with placeholder rows
  const rows = Array.from({ length: totalRows }, (_, index) => {
    // Calculate the actual index in the standings array
    // Center the player in the middle of the display
    const centerIndex = Math.floor(totalRows / 2); // buffer
    const actualIndex = index - centerIndex + playerIndex;
    const result = standings[actualIndex];

    if (!result) {
      // If no result, render an empty row with the correct height
      return (
        <EmptyRow key={`placeholder-${index}`} rowHeight={rowHeight} />
      );
    }

    return (
      <DriverInfoRow
        key={result.carIdx}
        carIdx={result.carIdx}
        classColor={result.carClass.color}
        carNumber={result.driver?.carNum || ''}
        name={result.driver?.name || ''}
        isPlayer={result.isPlayer}
        hasFastestTime={result.hasFastestTime}
        delta={result.delta}
        position={result.classPosition}
        onPitRoad={result.onPitRoad}
        onTrack={result.onTrack}
        radioActive={result.radioActive}
        isLapped={result.lappedState === 'behind'}
        isLappingAhead={result.lappedState === 'ahead'}
        badge={
          <DriverRatingBadge
            license={result.driver?.license}
            rating={result.driver?.rating}
          />
        }
      />
    );
  });

  return (
    <div className="w-full h-full">
      <SessionBar />
      <table
        ref={tableRef}
        className="w-full table-auto text-sm border-separate border-spacing-y-0.5 mb-3 mt-3"
      >
        <tbody ref={parent}>{rows}</tbody>
      </table>
      <SessionFooter />
    </div>
  );
};

// Reusable empty row component
const EmptyRow = ({ rowHeight }: { rowHeight: number }) => (
  <tr
    style={{ height: `${rowHeight}px` }}
    className="opacity-0 pointer-events-none"
  >
    <td colSpan={4}></td>
  </tr>
);