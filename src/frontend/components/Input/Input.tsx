import { InputContainer } from './InputContainer/InputContainer';
import { useInputSettings } from './hooks/useInputSettings';
import { useInputs } from './hooks/useInputs';
import { useTachometerData } from './hooks/useTachometerData';
import { useTachometerSettings } from './hooks/useTachometerSettings';
import { Tachometer } from './InputTachometer/InputTachometer';
import { useDrivingState, useSessionVisibility } from '@irdashies/context';

export const Input = () => {
  const inputs = useInputs();
  const settings = useInputSettings();
  const { isDriving } = useDrivingState();
  const tachometerData = useTachometerData();
  const tachometerSettings = useTachometerSettings();

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;
  
  // Show only when on track setting
  if (settings?.showOnlyWhenOnTrack && !isDriving) {
    return <></>;
  }

  return (
    <div className="h-full flex flex-col">
      {/* Tachometer at the top when enabled */}
      {tachometerSettings.enabled && (
        <div className="flex justify-center mb-2 shrink-0">
          <div
            className="bg-slate-800/(--bg-opacity)"
            style={{
              ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 80}%`,
            }}
          >
            <Tachometer
              rpm={tachometerData.rpm}
              maxRpm={tachometerData.maxRpm}
              shiftRpm={tachometerData.shiftRpm}
              blinkRpm={tachometerData.blinkRpm}
              showRpmText={tachometerSettings.showRpmText}
            />
          </div>
        </div>
      )}

      {/* Input container takes remaining space */}
      <div className="flex-1 min-h-0">
        <InputContainer {...inputs} settings={settings} />
      </div>
    </div>
  );
};
