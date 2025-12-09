import { InputContainer } from './InputContainer/InputContainer';
import { useInputSettings } from './hooks/useInputSettings';
import { useInputs } from './hooks/useInputs';
import { useTachometerData } from './hooks/useTachometerData';
import { useTachometerSettings } from './hooks/useTachometerSettings';
import { Tachometer } from './InputTachometer/InputTachometer';

export const Input = () => {
  const inputs = useInputs();
  const settings = useInputSettings();
  const tachometerData = useTachometerData();
  const tachometerSettings = useTachometerSettings();

  return (
    <div className="h-full flex flex-col">
      {/* Tachometer at the top when enabled */}
      {tachometerSettings.enabled && (
        <div className="flex justify-center mb-2 flex-shrink-0">
          <Tachometer
            rpm={tachometerData.rpm}
            maxRpm={tachometerData.maxRpm}
            shiftRpm={tachometerData.shiftRpm}
            blinkRpm={tachometerData.blinkRpm}
            showRpmText={tachometerSettings.showRpmText}
          />
        </div>
      )}

      {/* Input container takes remaining space */}
      <div className="flex-1 min-h-0">
        <InputContainer {...inputs} settings={settings} />
      </div>
    </div>
  );
};