import { memo } from 'react';

export interface InputGearProps {
  gear?: number;
  speedMs?: number;
  unit?: number;
  settings: {
    size: number;
    unit: 'mph' | 'km/h' | 'auto' | 'none';
    showspeed: boolean;
    showspeedunit: boolean;
  };
}

export const InputGear = memo(
  ({ gear, speedMs, unit, settings }: InputGearProps) => {
    const isMetric =
      (unit === 1 && settings.unit === 'auto') || settings.unit === 'km/h';
    const speed = (speedMs ?? 0) * (isMetric ? 3.6 : 2.23694);
    const displayUnit = isMetric ? 'km/h' : 'mph';
    let gearText = '';
    switch (gear) {
      case -1:
        gearText = 'R';
        break;
      case 0:
      case null:
      case undefined:
        gearText = 'N';
        break;
      default:
        gearText = `${gear}`;
        break;
    }

    const displaySize = settings.size / 100;
    const displayMultiplier =
      settings.showspeed && settings.showspeedunit
        ? 50
        : settings.showspeed
          ? 55
          : 90;

    return (
      <div className="@container-[size] flex items-center justify-center p-1 font-mono w-full h-full">
        <div className="flex flex-col items-center">
          <div
            className="font-bold leading-none"
            style={{
              fontSize: `min(${displaySize * displayMultiplier}cqh, ${displaySize * 100}cqw)`,
            }}
          >
            {gearText}
          </div>
          {settings.showspeed && (
            <div
              className="text-gray-200 leading-none"
              style={{
                fontSize: `min(${displaySize * (displayMultiplier / 3)}cqh, ${displaySize * 30}cqw)`,
              }}
            >
              {speed.toFixed(0)}
            </div>
          )}
          {settings.showspeed && settings.showspeedunit && (
            <div
              className="text-gray-400 leading-none"
              style={{
                fontSize: `min(${displaySize * (displayMultiplier / 5)}cqh, ${displaySize * 20}cqw)`,
              }}
            >
              {displayUnit}
            </div>
          )}
        </div>
      </div>
    );
  }
);

InputGear.displayName = 'InputGear';
