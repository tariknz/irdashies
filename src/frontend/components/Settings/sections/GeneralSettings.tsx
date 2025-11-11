import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { GeneralSettingsType } from '@irdashies/types';

const FONT_SIZE_PRESETS = {
  xs: 'Extra Small',
  sm: 'Small',
  lg: 'Large',
  xl: 'Extra Large',
};

const COLOR_THEME_PRESETS: Record<string, string> = {
  default: 'Slate (default)',
  black: 'Black',
};

const HIGHLIGHT_COLOR_PRESETS = new Map([
  [15680580, 'Red'],
  [16347926, 'Orange'],
  [16096779, 'Amber'],
  [15381256, 'Yellow'],
  [8702998,  'Lime'],
  [2278750,  'Green'],
  [1096065,  'Emerald'],
  [1357990,  'Teal'],
  [440020,   'Cyan'],
  [960745,   'Sky'],
  [3395327,  'Blue'],
  [6514417,  'Indigo'],
  [9133302,  'Violet'],
  [11430911, 'Purple'],
  [14239471, 'Fuchsia'],
  [16734344, 'Pink'],
  [16007006, 'Rose'],
  [7434618,  'Zinc'],
  [7893356,  'Stone']
]);

export const GeneralSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const [settings, setSettings] = useState<GeneralSettingsType>({
    fontSize: currentDashboard?.generalSettings?.fontSize ?? 'sm',
    colorPalette: currentDashboard?.generalSettings?.colorPalette ?? 'default',
    highlightColor: currentDashboard?.generalSettings?.highlightColor ?? 960745
  });

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  const updateDashboard = (newSettings: GeneralSettingsType) => {
    const updatedDashboard = {
      ...currentDashboard,
      generalSettings: newSettings,
    };
    onDashboardUpdated(updatedDashboard);
  };

  const handleFontSizeChange = (newSize: 'xs' | 'sm' | 'lg' | 'xl') => {
    const newSettings = { ...settings, fontSize: newSize };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleColorThemeChange = (newTheme: 'default' | 'black') => {
    const newSettings = { ...settings, colorPalette: newTheme };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleHighlightColorChange = (newColor: number) => {
    const newSettings = { ...settings, highlightColor: newColor };
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
            <span className="text-sm text-slate-300">{FONT_SIZE_PRESETS[settings.fontSize ?? 'sm']}</span>
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

      {/* Color Theme Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-200">Color Theme</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">{COLOR_THEME_PRESETS[settings.colorPalette ?? 'default']}</span>
          </div>
        </div>

        {/* Color Theme Dropdown */}
        <div className="mt-4">
          <select
            value={settings.colorPalette ?? 'default'}
            onChange={(e) => handleColorThemeChange(e.target.value as 'default' | 'black')}
            className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="default">{COLOR_THEME_PRESETS.default}</option>
            <option value="black">{COLOR_THEME_PRESETS.black}</option>
          </select>
        </div>
      </div>

      {/* Highlight Color Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-200">Highlight Color</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">{HIGHLIGHT_COLOR_PRESETS.get(settings.highlightColor ?? 960745)}</span>
            <span 
              className={`bg-${HIGHLIGHT_COLOR_PRESETS.get(settings.highlightColor ?? 960745)?.toLowerCase()}-800 rounded border-2 border-${HIGHLIGHT_COLOR_PRESETS.get(settings.highlightColor ?? 960745)?.toLowerCase()}-500`} 
              style={{ width: '20px', height: '20px' }}>
            </span>
          </div>
        </div>

        {/* Highlight Color Dropdown */}
        <div className="mt-4">
          <select
            value={settings.highlightColor ?? 960745}
            onChange={(e) => handleHighlightColorChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
          </select>
        </div>
      </div>

    </div>
  );
};
