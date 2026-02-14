import { memo, useRef, useEffect, useReducer } from 'react';
import { DriverStatusBadges } from './DriverStatusBadges';

interface PitExitState {
  exitLap: number | undefined;
  outCleared: boolean;
  lastPitLap: number | undefined;
}

type PitExitAction =
  | { type: 'reset'; lastPitLap: number | undefined }
  | { type: 'capture_exit'; exitLap: number | undefined }
  | { type: 'clear_out' };

function pitExitReducer(
  state: PitExitState,
  action: PitExitAction
): PitExitState {
  switch (action.type) {
    case 'reset':
      return {
        exitLap: undefined,
        outCleared: false,
        lastPitLap: action.lastPitLap,
      };
    case 'capture_exit':
      return { ...state, exitLap: action.exitLap };
    case 'clear_out':
      return { ...state, outCleared: true };
  }
}

interface PitStatusCellProps {
  onPitRoad?: boolean;
  carTrackSurface?: number;
  prevCarTrackSurface?: number;
  lap?: number;
  lastPitLap?: number;
  lastLap?: number;
  currentSessionType?: string;
  dnf?: boolean;
  pitStopDuration?: number | null;
  showPitTime?: boolean;
  pitLapDisplayMode?: string;
  carIdxLapDistPct?: number;
}

export const PitStatusCell = memo(
  ({
    onPitRoad,
    carTrackSurface,
    prevCarTrackSurface,
    lap,
    lastPitLap,
    lastLap,
    currentSessionType,
    dnf,
    pitStopDuration,
    showPitTime = false,
    pitLapDisplayMode,
    carIdxLapDistPct,
  }: PitStatusCellProps) => {
    const widthClass = showPitTime ? 'w-[7rem]' : 'w-[4.5rem]';
    const tow =
      carTrackSurface == 1 &&
      prevCarTrackSurface != undefined &&
      prevCarTrackSurface !== 2 &&
      currentSessionType == 'Race' &&
      !!lastLap;
    const pit =
      onPitRoad &&
      (carTrackSurface == 2 ||
        (carTrackSurface === 1 && prevCarTrackSurface == 2) ||
        prevCarTrackSurface == undefined ||
        currentSessionType != 'Race');
    // Only show L# badge for mid-race pit stops (lastPitLap > 0 means pitted after session start).
    // Cars that started from pits at session start (lastPitLap === 0) only show OUT, never L#.
    const lastPit =
      !onPitRoad && !!lastPitLap && lastPitLap > 0 && carTrackSurface != -1;

    // exitPctRef: lap dist pct captured at pit exit (only needed inside effect, not for render)
    const exitPctRef = useRef<number | undefined>(undefined);

    // Reducer holds state needed during render: exitLap and outCleared
    const [pitExit, dispatch] = useReducer(pitExitReducer, {
      exitLap: undefined,
      outCleared: false,
      lastPitLap: undefined,
    });

    useEffect(() => {
      // Reset for a new pit stop (or on initial mount when pitExit.lastPitLap is undefined).
      if (lastPitLap !== pitExit.lastPitLap) {
        exitPctRef.current = undefined;
        dispatch({ type: 'reset', lastPitLap });
        return;
      }

      // Capture exit position and lap once per pit stop.
      // carTrackSurface === 3 means the car is on track (out of pit road/box).
      // Guard with prevCarTrackSurface === 1|2 so we only capture on a genuine pit exit.
      if (
        carTrackSurface === 3 &&
        (prevCarTrackSurface === 1 || prevCarTrackSurface === 2) &&
        carIdxLapDistPct !== undefined &&
        exitPctRef.current === undefined &&
        !pitExit.outCleared
      ) {
        exitPctRef.current = carIdxLapDistPct;
        dispatch({ type: 'capture_exit', exitLap: lap });
      }

      // Latch outCleared once 85% traveled — prevents re-triggering after the next S/F crossing
      const exitPct = exitPctRef.current;
      if (
        !pitExit.outCleared &&
        exitPct !== undefined &&
        carIdxLapDistPct !== undefined
      ) {
        const distanceTraveled =
          carIdxLapDistPct >= exitPct
            ? carIdxLapDistPct - exitPct
            : 1.0 - exitPct + carIdxLapDistPct;
        if (distanceTraveled >= 0.85) {
          dispatch({ type: 'clear_out' });
        }
      }
    }, [
      onPitRoad,
      carTrackSurface,
      prevCarTrackSurface,
      carIdxLapDistPct,
      lastPitLap,
      lap,
      pitExit.lastPitLap,
      pitExit.outCleared,
    ]);

    // OUT is active from pit exit until outCleared latches (85% traveled).
    // lastPitLap can be 0 at session start (lap 0), so check !== undefined rather than truthy.
    const out =
      !onPitRoad &&
      lastPitLap !== undefined &&
      !pitExit.outCleared &&
      carTrackSurface != -1;

    // Use exitLap as the base for lapsSinceLastPit so that S/F crossings
    // that happen between pit exit and exitPct capture don't throw the count off
    const lapBaseLap = pitExit.exitLap ?? lastPitLap;

    return (
      <td
        data-column="pitStatus"
        className={`${widthClass} px-1 text-center align-middle whitespace-nowrap`}
      >
        <DriverStatusBadges
          dnf={dnf}
          tow={tow}
          pit={pit}
          out={out}
          lap={lap}
          lastPit={lastPit}
          lastPitLap={lapBaseLap}
          pitStopDuration={pitStopDuration}
          showPitTime={showPitTime}
          pitLapDisplayMode={pitLapDisplayMode}
        />
      </td>
    );
  }
);

PitStatusCell.displayName = 'PitStatusCell';
