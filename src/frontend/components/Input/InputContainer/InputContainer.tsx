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
  settings,
}: InputProps) => {
  return (
    <div className="w-full h-full inline-flex gap-1 p-2 flex-row bg-slate-800/50">
      {settings?.trace.enabled && <InputTrace input={{ brake, throttle }} settings={settings.trace} />}
      {settings?.bar.enabled && <InputBar brake={brake} throttle={throttle} clutch={clutch} settings={settings.bar} />}
      {settings?.gear.enabled && <InputGear gear={gear} speedMs={speed} unit={unit} settings={settings.gear} />}
      {settings?.steer?.enabled && <InputSteer angleRad={steer} />}
    </div>
  );
};
