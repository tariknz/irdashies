import { memo, useMemo } from 'react';
import { Check } from '@phosphor-icons/react';
import { getTailwindStyle } from '@irdashies/utils/colors';
import {
  identityForGridSlot,
  swatchDashArrayForGridSlot,
} from '../../lapGraphPalette';

export interface DriverListEntry {
  carIdx: number;
  carNumber: string;
  /** Already formatted for display. Do not reformat. */
  displayName: string;
  /** Class position right now, or undefined before the grid forms. */
  position: number | undefined;
  isPlayer: boolean;
  /** False until the car has completed a lap the chart can draw. */
  hasLine: boolean;
  /** Qualifying grid slot driving the line's colour/pattern identity. */
  gridSlot: number;
}

export interface LapGraphDriverListProps {
  /** Drivers in the selected class, leader first. */
  drivers: readonly DriverListEntry[];
  /** Numeric class colour, shared by every line in the chart. */
  classColorValue: number;
  /** Whether the session currently has more than one car class. */
  isMultiClass: boolean;
  /** Cars currently drawn at full strength. */
  shownCarIdxs: readonly number[];
  /** The one line drawn brightest, from the Follow control or list hover. */
  focusedCarIdx: number | null;
  onToggle: (carIdx: number) => void;
  onHover: (carIdx: number | null) => void;
}

/**
 * The class roster down the side of the chart, in running order. Clicking a
 * name draws that car's line; hovering one lifts it above the field.
 *
 * Row styling replicates Standings' DriverInfoRow/cell classes directly —
 * Rule N3 forbids importing from another widget folder, so this is a
 * deliberate copy, same as Battle.tsx does for the same cells.
 */
export const LapGraphDriverList = memo(
  ({
    drivers,
    classColorValue,
    isMultiClass,
    shownCarIdxs,
    focusedCarIdx,
    onToggle,
    onHover,
  }: LapGraphDriverListProps) => {
    const shown = new Set(shownCarIdxs);
    // Match CarNumberCell: class-colour chip via the same shared helper.
    const tailwindStyles = useMemo(
      () => getTailwindStyle(classColorValue, undefined, isMultiClass),
      [classColorValue, isMultiClass]
    );

    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {drivers.length === 0 && (
            <div className="px-4 py-3 text-sm text-slate-400">
              Waiting for the grid.
            </div>
          )}
          {drivers.map((entry) => {
            const isShown =
              entry.hasLine && (entry.isPlayer || shown.has(entry.carIdx));
            const isFocused = entry.carIdx === focusedCarIdx;
            // The player's line is always drawn, so toggling it would change
            // nothing on screen while latching the auto-pin set off.
            const canToggle = entry.hasLine && !entry.isPlayer;
            const identity = identityForGridSlot(entry.gridSlot);
            const swatchDashArray = swatchDashArrayForGridSlot(entry.gridSlot);

            // One mutually-exclusive chain, highest precedence first, so two
            // same-specificity utilities never fight over stylesheet order.
            const rowStateClasses = entry.isPlayer
              ? 'bg-yellow-500/20 text-amber-300'
              : !entry.hasLine
                ? 'text-slate-500'
                : isFocused
                  ? 'bg-slate-800 text-white'
                  : isShown
                    ? 'text-slate-100 hover:bg-slate-800'
                    : 'text-slate-400 hover:bg-slate-800';

            return (
              <button
                key={entry.carIdx}
                type="button"
                aria-pressed={isShown}
                // aria-disabled, not disabled: Chromium swallows pointer events
                // on a disabled control, which would strand the hover highlight
                // on whichever car the pointer crossed last.
                aria-disabled={!canToggle}
                onClick={() => {
                  if (canToggle) onToggle(entry.carIdx);
                }}
                onPointerEnter={() => onHover(entry.carIdx)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(entry.carIdx)}
                onBlur={() => onHover(null)}
                title={
                  !entry.hasLine
                    ? `${entry.displayName} has no completed laps yet`
                    : entry.isPlayer
                      ? 'Your own line is always drawn'
                      : `${isShown ? 'Hide' : 'Show'} ${entry.displayName}`
                }
                className={[
                  'flex min-h-9 w-full items-center gap-2 border-b border-settings-hover px-4 py-1 text-left text-sm tabular-nums transition-colors',
                  rowStateClasses,
                  // Kept out of the chain above: cursor is not a colour
                  // utility, so it has no ordering conflict to resolve.
                  canToggle ? 'cursor-pointer' : 'cursor-default',
                ].join(' ')}
              >
                <span className="w-6 shrink-0 text-right text-slate-400">
                  {entry.position ?? '-'}
                </span>
                <span
                  className={`${tailwindStyles.driverIcon} border-l-4 text-white text-right px-1 whitespace-nowrap text-xs`}
                >
                  <span className="inline-block min-w-[4ch]">
                    #{entry.carNumber}
                  </span>
                </span>
                <svg
                  width="14"
                  height="10"
                  viewBox="0 0 14 10"
                  aria-hidden="true"
                  className="shrink-0"
                >
                  <line
                    x1={1}
                    y1={5}
                    x2={13}
                    y2={5}
                    stroke={identity.color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeDasharray={swatchDashArray}
                  />
                </svg>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{entry.displayName}</span>
                </span>
                <span className="flex size-4 shrink-0 items-center justify-center">
                  {isShown && (
                    <Check
                      size={14}
                      weight="bold"
                      aria-hidden="true"
                      className="text-accent-400"
                    />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }
);
LapGraphDriverList.displayName = 'LapGraphDriverList';
