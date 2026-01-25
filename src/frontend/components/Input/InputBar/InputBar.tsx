import { useMemo } from 'react';
import { getColor } from '@irdashies/utils/colors';

const INPUT_CONFIG = [
  { key: 'clutch', color: getColor('blue') },
  { key: 'brake', color: getColor('red') },
  { key: 'throttle', color: getColor('green') },
] as const;

export interface InputBarProps {
  brake?: number;
  throttle?: number;
  clutch?: number;
  brakeAbsActive?: boolean;
  settings?: {
    includeClutch: boolean;
    includeBrake: boolean;
    includeThrottle: boolean;
    includeAbs: boolean;
  };
}

export const InputBar = ({
  brake,
  throttle,
  clutch,
  brakeAbsActive,
  settings = {
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
    includeAbs: true,
  },
}: InputBarProps) => {
  const {
    includeAbs = true,
    includeClutch,
    includeBrake,
    includeThrottle,
  } = settings;

  const activeInputs = useMemo(() => {
    return INPUT_CONFIG.filter(({ key }) => {
      if (key === 'clutch') return includeClutch;
      if (key === 'throttle') return includeThrottle;
      if (key === 'brake') return includeBrake;
      return false;
    }).map(({ key, color }) => {
      const value =
        key === 'clutch'
          ? (clutch ?? 0)
          : key === 'brake'
            ? (brake ?? 0)
            : (throttle ?? 0);
      const isBrakeWithAbs = key === 'brake' && brakeAbsActive && includeAbs;
      return {
        key,
        value,
        color: isBrakeWithAbs ? getColor('yellow', 500) : color,
        showAbs: isBrakeWithAbs,
      };
    });
  }, [
    brake,
    throttle,
    clutch,
    brakeAbsActive,
    includeClutch,
    includeBrake,
    includeThrottle,
    includeAbs,
  ]);

  return (
    <div className="flex gap-1 w-full h-full relative justify-center">
      {activeInputs.map(({ key, value, color, showAbs }) => (
        <div
          key={key}
          data-testid={`input-bar-${key}`}
          className="flex flex-col relative min-w-0 h-full"
          style={{ aspectRatio: '1 / 4', width: 'auto' }}
        >
          <div className={`text-xs text-center flex justify-center ${value === 0 ? 'text-gray-400' : 'text-white'}`}>
            {(value * 100).toFixed(0)}
          </div>
          <div className="flex-1 flex flex-col justify-end relative min-h-0">
            <div
              data-testid={`input-bar-fill-${key}`}
              className="w-full transition-[height] duration-50 ease-out"
              style={{
                height: `${value * 100}%`,
                backgroundColor: color,
              }}
            />
            {showAbs && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 text-[11px] font-bold text-white text-shadow-md pointer-events-none">
                ABS
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
