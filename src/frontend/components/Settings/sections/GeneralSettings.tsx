import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { GeneralSettingsType } from '@irdashies/types';

const FONT_SIZE_PRESETS = {
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
  '2xl': '2X Large',
  '3xl': '3X Large',
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

const COLOR_THEME_PRESETS: Record<string, string> = {
  default: 'Slate (default)',
  black: 'Black',
  ...Object.fromEntries(Array.from(HIGHLIGHT_COLOR_PRESETS.values()).map(name => [name.toLowerCase(), name]))
};

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

  const FONT_SIZE_VALUES: (keyof typeof FONT_SIZE_PRESETS)[] = ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'];

  const getSliderValue = (size: string | undefined): number => {
    const index = FONT_SIZE_VALUES.indexOf(size as keyof typeof FONT_SIZE_PRESETS);
    return index >= 0 ? index : 1; // Default to 1 (sm) if not found
  };

  const getSizeFromSliderValue = (value: number): keyof typeof FONT_SIZE_PRESETS => {
    return FONT_SIZE_VALUES[value] || 'sm';
  };

  const handleFontSizeChange = (newSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl') => {
    const newSettings = { ...settings, fontSize: newSize };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseInt(event.target.value);
    const newSize = getSizeFromSliderValue(sliderValue);
    handleFontSizeChange(newSize);
  };

  const handleColorThemeChange = (newTheme: GeneralSettingsType['colorPalette']) => {
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

        {/* Font Size Slider */}
        <div className="mt-4">
          <input
            type="range"
            min="0"
            max="6"
            step="1"
            value={getSliderValue(settings.fontSize)}
            onChange={handleSliderChange}
            className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider accent-blue-500"
          />
        </div>
      </div>

      {/* Color Theme Settings */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-200">Color Theme</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-300">{COLOR_THEME_PRESETS[settings.colorPalette ?? 'default']}</span>
            {settings.colorPalette && settings.colorPalette !== 'default' && settings.colorPalette !== 'black' && (
              <span
                className={`bg-${settings.colorPalette}-800 rounded border-2 border-${settings.colorPalette}-500`}
                style={{ width: '20px', height: '20px' }}
              ></span>
            )}
          </div>
        </div>

        {/* Color Theme Dropdown */}
        <div className="mt-4">
          <select
            value={settings.colorPalette ?? 'default'}
            onChange={(e) => handleColorThemeChange(e.target.value as GeneralSettingsType['colorPalette'])}
            className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            {Object.entries(COLOR_THEME_PRESETS).map(([key, value]) => (
              <option key={key} value={key}>{value}</option>
            ))}
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
