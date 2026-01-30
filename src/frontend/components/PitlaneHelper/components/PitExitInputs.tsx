import { memo } from 'react';
import { useTelemetryValue } from '@irdashies/context';
import { InputBar } from '../../Input/InputBar/InputBar';

export interface PitExitInputsProps {
  showThrottle: boolean;
  showClutch: boolean;
}

/**
 * Compact version of InputBar specifically for pit exit assistance.
 * Shows throttle and/or clutch inputs to help drivers optimize their pit exit.
 */
export const PitExitInputs = memo(({
  showThrottle,
  showClutch,
}: PitExitInputsProps) => {
  const throttle = useTelemetryValue('Throttle');
  const clutchRaw = useTelemetryValue('Clutch');

  // 0=disengaged (pedal pressed) to 1=fully engaged (pedal not pressed) so we need to invert it
  const clutch = clutchRaw !== undefined ? 1 - clutchRaw : undefined;

  // Don't render if neither input is enabled
  if (!showThrottle && !showClutch) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="text-xs text-slate-400 mb-1">Pit Exit Inputs</div>
      <div className="h-16">
        <InputBar
          throttle={throttle}
          clutch={clutch}
          settings={{
            includeThrottle: showThrottle,
            includeClutch: showClutch,
            includeBrake: false, // Never show brake for pit exit
            includeAbs: false,
          }}
        />
      </div>
    </div>
  );
});

PitExitInputs.displayName = 'PitExitInputs';
