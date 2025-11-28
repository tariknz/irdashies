import { InputWidgetSettings } from '../../Settings/types';
import { InputBar } from '../InputBar/InputBar';
import { InputGear } from '../InputGear/InputGear';
import { InputSteer } from '../InputSteer/InputSteer';
import { InputTrace } from '../InputTrace/InputTrace';

export interface InputProps {
  brake?: number;
  throttle?: number;
  clutch?: number;
  gear?: number;
  speed?: number;
  unit?: number;
  steer?: number;
  brakeAbsActive?: boolean;
  settings?: InputWidgetSettings['config'];
}

export const InputContainer = ({
  brake,
  throttle,
  clutch,
  gear,
  speed,
  steer,
  unit,
  brakeAbsActive,
  settings,
}: InputProps) => {
  return (
    <div className="w-full h-full inline-flex gap-1 p-2 flex-row bg-slate-800/50">
      {(settings?.trace?.enabled ?? true) && (
        <InputTrace input={{ brake, throttle, brakeAbsActive, steer }} settings={settings?.trace} />
      )}
      {(settings?.bar?.enabled ?? true) && (
        <InputBar
          brake={brake}
          brakeAbsActive={brakeAbsActive}
          throttle={throttle}
          clutch={clutch}
          settings={settings?.bar}
        />
      )}
      {(settings?.gear?.enabled ?? true) && (
        <InputGear
          gear={gear}
          speedMs={speed}
          unit={unit}
          settings={settings?.gear}
        />
      )}
      {(settings?.steer?.enabled ?? true) && (
        <InputSteer
          angleRad={steer}
          wheelStyle={settings?.steer?.config?.style}
          wheelColor={settings?.steer?.config?.color}
        />
      )}
    </div>
  );
};
