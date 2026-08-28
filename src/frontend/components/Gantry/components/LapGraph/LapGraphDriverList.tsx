import { memo } from 'react';
import { brightenColor } from './useLapGraphSeries';

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
}

export interface LapGraphDriverListProps {
  /** Drivers in the selected class, leader first. */
  drivers: readonly DriverListEntry[];
  /** Class colour, shared by every line in the chart. */
  classColor: string;
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
 */
export const LapGraphDriverList = memo(
  ({
    drivers,
    classColor,
    shownCarIdxs,
    focusedCarIdx,
    onToggle,
    onHover,
  }: LapGraphDriverListProps) => {
    const shown = new Set(shownCarIdxs);

    return (
      <div className="w-[24ch] max-w-[40%] shrink-0 flex flex-col min-h-0 border-l border-slate-700/50 pl-2">
        <div className="shrink-0 pb-1 text-slate-500 font-bold uppercase tracking-wider">
          Drivers
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto">
          {drivers.length === 0 && (
            <div className="text-slate-600">Waiting for the grid.</div>
          )}
          {drivers.map((entry) => {
            const isShown =
              entry.hasLine && (entry.isPlayer || shown.has(entry.carIdx));
            const isFocused = entry.carIdx === focusedCarIdx;
            // The player's line is always drawn, so toggling it would change
            // nothing on screen while latching the auto-pin set off.
            const canToggle = entry.hasLine && !entry.isPlayer;
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
                  'flex items-center gap-1.5 w-full px-1 py-0.5 rounded-sm text-left',
                  'focus:outline-none focus:ring-1 focus:ring-sky-400',
                  !entry.hasLine
                    ? 'text-slate-600'
                    : isFocused
                      ? 'bg-sky-500/20 text-white'
                      : isShown
                        ? 'text-slate-200 hover:bg-slate-700/40'
                        : 'text-slate-500 hover:bg-slate-800/70',
                  entry.isPlayer ? 'text-amber-300' : '',
                  canToggle ? 'cursor-pointer' : 'cursor-default',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <span className="w-5 shrink-0 text-right tabular-nums text-slate-500">
                  {entry.position ?? '-'}
                </span>
                <span
                  className="w-1.5 h-3 shrink-0 rounded-xs border border-slate-600"
                  style={{
                    backgroundColor: isShown
                      ? isFocused
                        ? brightenColor(classColor)
                        : classColor
                      : 'transparent',
                  }}
                />
                <span className="w-[4ch] shrink-0 tabular-nums">
                  #{entry.carNumber}
                </span>
                <span className="flex-1 min-w-0 truncate">
                  {entry.displayName}
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
