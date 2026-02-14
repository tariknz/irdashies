import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { GeneralSettingsType } from '@irdashies/types';

const FONT_PRESETS = {
  lato: 'Lato',
  notosans: 'Noto Sans',
  roboto: 'Roboto'
};

const FONT_SIZE_PRESETS = {
  'xs': 'Extra Small',
  'sm': 'Small',
  'md': 'Medium',
  'lg': 'Large',
  'xl': 'Extra Large',
  '2xl': '2X Large',
  '3xl': '3X Large',
  '4xl': '4X Large',
  '5xl': '5X Large',
  '6xl': '6X Large',
  '7xl': '7X Large',
  '8xl': '8X Large',
  '9xl': '9X Large',
};

const FONT_WEIGHT_PRESETS = {
  normal: 'Normal',
  medium: 'Medium',
  semibold: 'Semibold',
  bold: 'Bold',
  extrabold: 'Extrabold',
};

const HIGHLIGHT_COLOR_PRESETS = new Map([
  [15680580, 'Red'],
  [16347926, 'Orange'],
  [16096779, 'Amber'],
  [15381256, 'Yellow'],
  [8702998, 'Lime'],
  [2278750, 'Green'],
  [1096065, 'Emerald'],
  [1357990, 'Teal'],
  [440020, 'Cyan'],
  [960745, 'Sky'],
  [3395327, 'Blue'],
  [6514417, 'Indigo'],
  [9133302, 'Violet'],
  [11430911, 'Purple'],
  [14239471, 'Fuchsia'],
  [16734344, 'Pink'],
  [16007006, 'Rose'],
  [7434618, 'Zinc'],
  [7893356, 'Stone'],
]);

const COLOR_THEME_PRESETS: Record<string, string> = {
  default: 'Slate (default)',
  black: 'Black',
  ...Object.fromEntries(
    Array.from(HIGHLIGHT_COLOR_PRESETS.values()).map((name) => [
      name.toLowerCase(),
      name,
    ])
  ),
};

export const GeneralSettings = () => {
  const { bridge, currentDashboard, onDashboardUpdated } = useDashboard();
  const [settings, setSettings] = useState<GeneralSettingsType>({
    fontType: currentDashboard?.generalSettings?.fontType ?? 'lato',
    fontSize: currentDashboard?.generalSettings?.fontSize ?? 'sm',
    fontWeight: currentDashboard?.generalSettings?.fontWeight ?? 'normal',
    colorPalette: currentDashboard?.generalSettings?.colorPalette ?? 'default',
    highlightColor: currentDashboard?.generalSettings?.highlightColor ?? 960745,
    skipTaskbar: currentDashboard?.generalSettings?.skipTaskbar ?? true,
    disableHardwareAcceleration:
      currentDashboard?.generalSettings?.disableHardwareAcceleration ?? false,
    enableAutoStart:
      currentDashboard?.generalSettings?.enableAutoStart ?? false,
    startMinimized: currentDashboard?.generalSettings?.startMinimized ?? false,
    compactMode: currentDashboard?.generalSettings?.compactMode ?? false,
    overlayAlwaysOnTop:
      currentDashboard?.generalSettings?.overlayAlwaysOnTop ?? true,
    enableNetworkAccess:
      currentDashboard?.generalSettings?.enableNetworkAccess ?? false,
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

  const FONT_SIZE_VALUES: (keyof typeof FONT_SIZE_PRESETS)[] = [
    'xs',
    'sm',
    'md',
    'lg',
    'xl',
    '2xl',
    '3xl',
    '4xl',
    '5xl',
    '6xl',
    '7xl',
    '8xl',
    '9xl'
  ];

  const getSliderValue = (size: string | undefined): number => {
    const index = FONT_SIZE_VALUES.indexOf(
      size as keyof typeof FONT_SIZE_PRESETS
    );
    return index >= 0 ? index : 1; // Default to 1 (sm) if not found
  };

  const getSizeFromSliderValue = (
    value: number
  ): keyof typeof FONT_SIZE_PRESETS => {
    return FONT_SIZE_VALUES[value] || 'sm';
  };

  const handleFontChange = (
    newFont: 'lato' | 'notosans' | 'roboto'
  ) => {
    const newSettings = { ...settings, fontType: newFont };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleFontSizeChange = (
    newSize: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl' | '6xl' | '7xl' | '8xl' | '9xl'
  ) => {
    const newSettings = { ...settings, fontSize: newSize };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleFontWeightChange = (
    newWeight: 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  ) => {
    const newSettings = { ...settings, fontWeight: newWeight };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleSliderChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const sliderValue = parseInt(event.target.value);
    const newSize = getSizeFromSliderValue(sliderValue);
    handleFontSizeChange(newSize);
  };

  const handleColorThemeChange = (
    newTheme: GeneralSettingsType['colorPalette']
  ) => {
    const newSettings = { ...settings, colorPalette: newTheme };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleHighlightColorChange = (newColor: number) => {
    const newSettings = { ...settings, highlightColor: newColor };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleSkipTaskbarChange = (enabled: boolean) => {
    const newSettings = { ...settings, skipTaskbar: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleDisableHardwareAccelerationChange = (enabled: boolean) => {
    const newSettings = { ...settings, disableHardwareAcceleration: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleAutoStartChange = (enabled: boolean) => {
    const newSettings = { ...settings, enableAutoStart: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
    bridge.setAutoStart(enabled);
  };

  const handleStartMinimizedChange = (enabled: boolean) => {
    const newSettings = { ...settings, startMinimized: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleCompactModeChange = (enabled: boolean) => {
    const newSettings = { ...settings, compactMode: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleOverlayAlwaysOnTopChange = (enabled: boolean) => {
    const newSettings = { ...settings, overlayAlwaysOnTop: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleNetworkAccessChange = (enabled: boolean) => {
    const newSettings = { ...settings, enableNetworkAccess: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 bg-slate-700 rounded">
        <h2 className="text-xl mb-4">General</h2>
        <p className="text-slate-400 mb-4">
          Configure general application settings and preferences.
        </p>
      </div>

      

      <div className="flex-1 overflow-y-auto min-h-0 space-y-6 p-4 mt-4">

        {/* Font Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-200">Font</h3>
          </div>
          {/* Font Weight Dropdown */}
          <div className="mt-4">
            <select
              value={settings.fontType ?? 'lato'}
              onChange={(e) =>
                handleFontChange(
                  e.target.value as NonNullable<
                    GeneralSettingsType['fontType']
                  >
                )
              }
              className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(FONT_PRESETS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Font Size Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-200">Font Size</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">
                {FONT_SIZE_PRESETS[settings.fontSize ?? 'sm']}
              </span>
            </div>
          </div>

          {/* Font Size Slider */}
          <div className="mt-4">
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={getSliderValue(settings.fontSize)}
              onChange={handleSliderChange}
              className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider accent-blue-500"
            />
          </div>
        </div>

        {/* Font Weight Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-200">Font Weight</h3>
          </div>
          {/* Font Weight Dropdown */}
          <div className="mt-4">
            <select
              value={settings.fontWeight ?? 'normal'}
              onChange={(e) =>
                handleFontWeightChange(
                  e.target.value as NonNullable<
                    GeneralSettingsType['fontWeight']
                  >
                )
              }
              className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(FONT_WEIGHT_PRESETS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Compact Mode Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Compact Mode
              </h3>
              <p className="text-sm text-slate-400">
                When enabled, visual spacing is minimized, reducing the vertical
                space between drivers and class headers in the standings and
                relatives.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.compactMode ?? false}
                onChange={(e) => handleCompactModeChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Color Theme Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-200">Color Theme</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">
                {COLOR_THEME_PRESETS[settings.colorPalette ?? 'default']}
              </span>
              {settings.colorPalette &&
                settings.colorPalette !== 'default' &&
                settings.colorPalette !== 'black' && (
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
              onChange={(e) =>
                handleColorThemeChange(
                  e.target.value as GeneralSettingsType['colorPalette']
                )
              }
              className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Object.entries(COLOR_THEME_PRESETS).map(([key, value]) => (
                <option key={key} value={key}>
                  {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Highlight Color Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-slate-200">
              Highlight Color
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-300">
                {HIGHLIGHT_COLOR_PRESETS.get(settings.highlightColor ?? 960745)}
              </span>
              <span
                className={`bg-${HIGHLIGHT_COLOR_PRESETS.get(settings.highlightColor ?? 960745)?.toLowerCase()}-800 rounded border-2 border-${HIGHLIGHT_COLOR_PRESETS.get(settings.highlightColor ?? 960745)?.toLowerCase()}-500`}
                style={{ width: '20px', height: '20px' }}
              ></span>
            </div>
          </div>

          {/* Highlight Color Dropdown */}
          <div className="mt-4">
            <select
              value={settings.highlightColor ?? 960745}
              onChange={(e) =>
                handleHighlightColorChange(parseInt(e.target.value))
              }
              className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(
                ([key, value]) => (
                  <option key={key} value={key}>
                    {value}
                  </option>
                )
              )}
            </select>
          </div>
        </div>

        {/* Hide from Taskbar Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Hide Overlays from Taskbar
              </h3>
              <p className="text-sm text-slate-400">
                When enabled, overlay windows won&apos;t appear in the taskbar.
                The app is still accessible via the system tray. (requires
                restart)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.skipTaskbar ?? true}
                onChange={(e) => handleSkipTaskbarChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Overlay Always On Top Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Keep Overlays Always On Top
              </h3>
              <p className="text-sm text-slate-400">
                When enabled, overlay windows will always stay on top of other
                applications. (requires restart)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.overlayAlwaysOnTop ?? true}
                onChange={(e) =>
                  handleOverlayAlwaysOnTopChange(e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Network Access Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Enable Network Access
              </h3>
              <p className="text-sm text-slate-400">
                When enabled, the component server binds to all network
                interfaces (0.0.0.0), allowing other devices on your network to
                access the dashboard. When disabled, only localhost connections
                are allowed. (requires restart)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableNetworkAccess ?? false}
                onChange={(e) => handleNetworkAccessChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Disable Hardware Acceleration Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Disable Hardware Acceleration
              </h3>
              <p className="text-sm text-slate-400">
                When enabled, disables GPU hardware acceleration and uses
                software rendering instead. This may help with compatibility
                issues on some systems. (requires restart)
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.disableHardwareAcceleration ?? false}
                onChange={(e) =>
                  handleDisableHardwareAccelerationChange(e.target.checked)
                }
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Autostart Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Start on system startup
              </h3>
              <p className="text-sm text-slate-400">
                If enabled, irDashies will start automatically on system start
                up.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.enableAutoStart ?? true}
                onChange={(e) => handleAutoStartChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        {/* Start Minimized Setting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-medium text-slate-200">
                Start minimized
              </h3>
              <p className="text-sm text-slate-400">
                If enabled, the main settings window will start minimized to the
                system tray.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={settings.startMinimized ?? false}
                onChange={(e) => handleStartMinimizedChange(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
