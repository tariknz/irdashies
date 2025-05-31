import { useState } from 'react';
import { useDashboard } from '@irdashies/context';

interface GeneralSettings {
  fontSize: 'xs' | 'sm' | 'lg' | 'xl';
}

const FONT_SIZE_PRESETS = {
  xs: 'Extra Small',
  sm: 'Small',
  lg: 'Large',
  xl: 'Extra Large',
};

export const GeneralSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const [settings, setSettings] = useState<GeneralSettings>({
    fontSize: currentDashboard?.generalSettings?.fontSize ?? 'sm',
  });

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  const updateDashboard = (newSettings: GeneralSettings) => {
    console.log('GeneralSettings: updateDashboard', newSettings);
    const updatedDashboard = {
      ...currentDashboard,
      generalSettings: newSettings,
    };
    console.log('GeneralSettings: calling onDashboardUpdated', updatedDashboard);
    onDashboardUpdated(updatedDashboard);
  };

  const handleFontSizeChange = (newSize: 'xs' | 'sm' | 'lg' | 'xl') => {
    console.log('GeneralSettings: handleFontSizeChange', newSize);
    const newSettings = { ...settings, fontSize: newSize };
    setSettings(newSettings);
    updateDashboard(newSettings);
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
            <span className="text-sm text-slate-300">{FONT_SIZE_PRESETS[settings.fontSize]}</span>
          </div>
        </div>

        {/* Font Size Presets */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => handleFontSizeChange('xs')}
            className={`px-3 py-1 rounded text-sm ${
              settings.fontSize === 'xs'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {FONT_SIZE_PRESETS.xs}
          </button>
          <button
            onClick={() => handleFontSizeChange('sm')}
            className={`px-3 py-1 rounded text-sm ${
              settings.fontSize === 'sm'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {FONT_SIZE_PRESETS.sm}
          </button>
          <button
            onClick={() => handleFontSizeChange('lg')}
            className={`px-3 py-1 rounded text-sm ${
              settings.fontSize === 'lg'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {FONT_SIZE_PRESETS.lg}
          </button>
          <button
            onClick={() => handleFontSizeChange('xl')}
            className={`px-3 py-1 rounded text-sm ${
              settings.fontSize === 'xl'
                ? 'bg-blue-500 text-white'
                : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
            }`}
          >
            {FONT_SIZE_PRESETS.xl}
          </button>
        </div>
      </div>
    </div>
  );
}; 