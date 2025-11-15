import { InputContainer } from './InputContainer/InputContainer';
import { useInputSettings } from './hooks/useInputSettings';
import { useInputs } from './hooks/useInputs';
import { InputWidgetSettings } from '../Settings/types';

export const Input = (props?: InputWidgetSettings['config']) => {
  const inputs = useInputs();
  const settingsFromHook = useInputSettings();
  
  // Use props if provided (browser mode), otherwise use hook (Electron mode)
  const settings = props || settingsFromHook;

  console.log('⚙️ Input component - props:', JSON.stringify(props, null, 2));
  console.log('⚙️ Input component - settingsFromHook:', JSON.stringify(settingsFromHook, null, 2));
  console.log('⚙️ Input component - final settings:', JSON.stringify(settings, null, 2));

  // Debug: Check if inputs are available
  if (!inputs || Object.values(inputs).every(v => v === undefined)) {
    console.log('⚠️ Input component: No telemetry data available yet');
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-800/50 text-white">
        <div className="text-center">
          <div className="text-2xl mb-2">🎮</div>
          <div>Waiting for telemetry data...</div>
        </div>
      </div>
    );
  }

  return <InputContainer {...inputs} settings={settings} />;
};
