import { useMemo } from 'react';
import { getColor } from '@irdashies/utils/colors';

const INPUT_CONFIG = [
  { key: 'clutch', color: getColor('blue') },
  { key: 'brake', color: getColor('red') },
  { key: 'throttle', color: getColor('green') }
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
  const { includeAbs = true, includeClutch, includeBrake, includeThrottle } = settings;

  const activeInputs = useMemo(() => {
    return INPUT_CONFIG.filter(({ key }) => {
      if (key === 'clutch') return includeClutch;
      if (key === 'throttle') return includeThrottle;
      if (key === 'brake') return includeBrake;
      return false;
    }).map(({ key, color }) => {
      const value = key === 'clutch' ? clutch ?? 0 : key === 'brake' ? brake ?? 0 : throttle ?? 0;
      const isBrakeWithAbs = key === 'brake' && brakeAbsActive && includeAbs;
      return {
        key,
        value,
        color: isBrakeWithAbs ? getColor('yellow', 500) : color,
        showAbs: isBrakeWithAbs,
      };
    });
  }, [brake, throttle, clutch, brakeAbsActive, includeClutch, includeBrake, includeThrottle, includeAbs]);

  return (
    <div
      style={{
        display: 'flex',
        gap: '0.25rem',
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {activeInputs.map(({ key, value, color, showAbs }) => (
        <div
          key={key}
          data-testid={`input-bar-${key}`}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: '10px',
              color: 'white',
              textAlign: 'center',
              height: '15px',
              lineHeight: '15px',
              flexShrink: 0,
            }}
          >
            {(value * 100).toFixed(0)}
          </div>
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-end',
              position: 'relative',
              minHeight: 0,
            }}
          >
            <div
              data-testid={`input-bar-fill-${key}`}
              style={{
                width: '100%',
                height: `${value * 100}%`,
                backgroundColor: color,
                transition: 'height 0.05s ease-out',
              }}
            />
            {showAbs && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '4px',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  fontSize: '11px',
                  fontWeight: 'bold',
                  color: '#fff',
                  textShadow: '0 1px 4px #000',
                  pointerEvents: 'none',
                }}
              >
                ABS
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
