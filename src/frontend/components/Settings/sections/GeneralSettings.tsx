import { useState } from 'react';
import { useDashboard } from '@irdashies/context';

interface GeneralSettings {
  fontSize: number;
}

const FONT_SIZE_PRESETS = {
  small: 12,
  medium: 16,
  large: 20,
  xlarge: 24,
};

export const GeneralSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const [settings, setSettings] = useState<GeneralSettings>({
    fontSize: currentDashboard?.generalSettings?.fontSize ?? FONT_SIZE_PRESETS.medium,
  });

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  const handleFontSizeChange = (newSize: number) => {
    const newSettings = { ...settings, fontSize: newSize };
    setSettings(newSettings);
    
    // Update the dashboard with new settings
    const updatedDashboard = {
      ...currentDashboard,
      generalSettings: newSettings,
    };
    onDashboardUpdated(updatedDashboard);
  };

  return (
    <div className="flex flex-col h-full space-y-6">
      <div>
        <h2 className="text-xl mb-4">General Settings</h2>
        <p className="text-slate-400 mb-4">Configure general application settings and preferences.</p>
      </div>

      {/* Font Size Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-200">Font Size</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">{settings.fontSize}px</span>
          </div>
        </div>

        {/* Font Size Slider */}
        <div className="space-y-2">
          <input
            type="range"
            min="8"
            max="32"
            value={settings.fontSize}
            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer"
          />
          
          {/* Font Size Presets */}
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => handleFontSizeChange(FONT_SIZE_PRESETS.small)}
              className={`px-3 py-1 rounded text-sm ${
                settings.fontSize === FONT_SIZE_PRESETS.small
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Small
            </button>
            <button
              onClick={() => handleFontSizeChange(FONT_SIZE_PRESETS.medium)}
              className={`px-3 py-1 rounded text-sm ${
                settings.fontSize === FONT_SIZE_PRESETS.medium
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Medium
            </button>
            <button
              onClick={() => handleFontSizeChange(FONT_SIZE_PRESETS.large)}
              className={`px-3 py-1 rounded text-sm ${
                settings.fontSize === FONT_SIZE_PRESETS.large
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              Large
            </button>
            <button
              onClick={() => handleFontSizeChange(FONT_SIZE_PRESETS.xlarge)}
              className={`px-3 py-1 rounded text-sm ${
                settings.fontSize === FONT_SIZE_PRESETS.xlarge
                  ? 'bg-blue-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              X-Large
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 