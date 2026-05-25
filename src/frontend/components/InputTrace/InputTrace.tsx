import { useDrivingState, useSessionVisibility } from '@irdashies/context';
import { useInputs } from '../Input/hooks/useInputs';
import { InputTrace as InputTraceViz } from '../Input/InputTrace/InputTrace';
import { useInputTraceSettings } from './hooks/useInputTraceSettings';

export const InputTrace = () => {
  const settings = useInputTraceSettings();
  const inputs = useInputs(settings?.useRawValues ?? false);
  const { isDriving } = useDrivingState();

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  if (!settings) return <></>;

  if (settings.showOnlyWhenOnTrack && !isDriving) return <></>;

  return (
    <div
      className="w-full h-full p-2 rounded-md bg-slate-800/(--bg-opacity) [&_svg]:h-full [&_svg]:w-full"
      style={{
        ['--bg-opacity' as string]: `${settings.background?.opacity ?? 80}%`,
      }}
    >
      <InputTraceViz
        input={{
          brake: inputs.brake,
          throttle: inputs.throttle,
          clutch: inputs.clutch,
          brakeAbsActive: inputs.brakeAbsActive,
          steer: inputs.steer,
        }}
        settings={settings.trace}
      />
    </div>
  );
};
