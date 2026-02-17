import { memo } from 'react';
import { useTelemetryValue } from '@irdashies/context';

export interface PitExitInputsProps {
  showThrottle: boolean;
  showClutch: boolean;
}

interface InputBarColumnProps {
  value: number;
  color: string;
  label: string;
}

const InputBarColumn = ({ value, color, label }: InputBarColumnProps) => (
  <div className="flex flex-col items-center gap-1">
    <span className="text-xs text-white font-medium tabular-nums leading-none">
      {Math.round(value * 100)}
    </span>
    <div
      className="relative w-8 bg-slate-700/50 rounded overflow-hidden"
      style={{ height: '80px' }}
    >
      <div
        className="absolute bottom-0 w-full transition-[height] duration-50 ease-out"
        style={{ height: `${value * 100}%`, backgroundColor: color }}
      />
    </div>
    <span className="text-[10px] text-slate-400 leading-none">{label}</span>
  </div>
);

/**
 * Pit exit input bars matching the unified bar style of the pitlane helper.
 */
export const PitExitInputs = memo(
  ({ showThrottle, showClutch }: PitExitInputsProps) => {
    const throttle = useTelemetryValue('Throttle') ?? 0;
    const clutchRaw = useTelemetryValue('Clutch') ?? 1;

    // 0=disengaged (pedal pressed) to 1=fully engaged (pedal not pressed) so invert
    const clutch = 1 - clutchRaw;

    if (!showThrottle && !showClutch) {
      return null;
    }

    return (
      <>
        {showClutch && (
          <InputBarColumn
            value={clutch}
            color="rgb(59, 130, 246)"
            label="clt"
          />
        )}
        {showThrottle && (
          <InputBarColumn
            value={throttle}
            color="rgb(34, 197, 94)"
            label="thr"
          />
        )}
      </>
    );
  }
);

PitExitInputs.displayName = 'PitExitInputs';
