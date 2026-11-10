import { t } from '@irdashies/frontend/i18n';
import { useState } from 'react';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useAvailableSimulators, useDashboard } from '@irdashies/context';
import { SIMULATOR_IDS, SIMULATOR_LABELS } from '@irdashies/types';
import { DEFAULT_APP_LANGUAGE } from '@irdashies/types';
import type { AppLanguage, GeneralSettingsType } from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { LanguageSettings } from './LanguageSettings';

const FONT_PRESETS = {
  lato: 'Lato',
  notosans: 'Noto Sans',
  figtree: 'Figtree',
  inter: 'Inter',
  roboto: 'Roboto',
};

const FONT_SIZE_PRESETS = {
  '4xs': 'Tiny',
  '3xs': '3x Small',
  '2xs': '2x Small',
  xs: 'Extra Small',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
  xl: 'Extra Large',
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
  light: 'Light',
  normal: 'Normal',
  medium: 'Medium',
  semibold: 'Semibold',
  bold: 'Bold',
  extrabold: 'Extrabold',
};

const FONT_WEIGHT_RESTRICTIONS: Record<string, string[]> = {
  lato: ['medium', 'semibold'],
};

export const HIGHLIGHT_COLOR_PRESETS = new Map([
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
  zinc: 'Zinc',
  stone: 'Stone',
};

interface GeneralSettingsProps {
  previewMode?: boolean;
}

export const GeneralSettings = ({ previewMode }: GeneralSettingsProps = {}) => {
  const { bridge, currentDashboard, onDashboardUpdated } = useDashboard();
  const availableSimulators = useAvailableSimulators();
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
    closeToTray: currentDashboard?.generalSettings?.closeToTray ?? true,
    simulator: currentDashboard?.generalSettings?.simulator ?? 'auto',
    compactMode: currentDashboard?.generalSettings?.compactMode ?? 'off',
    overlayAlwaysOnTop:
      currentDashboard?.generalSettings?.overlayAlwaysOnTop ?? true,
    overlayWindowMode:
      currentDashboard?.generalSettings?.overlayWindowMode === 'widget'
        ? 'widget'
        : 'display',
    enableNetworkAccess:
      currentDashboard?.generalSettings?.enableNetworkAccess ?? false,
    enableWebServer: currentDashboard?.generalSettings?.enableWebServer ?? true,
    editMode: {
      pixelDistances:
        currentDashboard?.generalSettings?.editMode?.pixelDistances ?? false,
      snapToGrid:
        currentDashboard?.generalSettings?.editMode?.snapToGrid ?? false,
    },
  });

  if (!currentDashboard || !onDashboardUpdated) {
    return <>{t('Loading...')}</>;
  }

  const updateDashboard = (newSettings: GeneralSettingsType) => {
    const updatedDashboard = {
      ...currentDashboard,
      generalSettings: { ...currentDashboard.generalSettings, ...newSettings },
    };
    onDashboardUpdated(updatedDashboard);
  };

  const handleLanguageChange = (language: AppLanguage) => {
    const newSettings = { ...settings, language };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const FONT_SIZE_VALUES: (keyof typeof FONT_SIZE_PRESETS)[] = [
    '4xs',
    '3xs',
    '2xs',
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
    '9xl',
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
    newFont: 'lato' | 'notosans' | 'figtree' | 'inter' | 'roboto'
  ) => {
    const newSettings = { ...settings, fontType: newFont };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleFontSizeChange = (
    newSize:
      | '4xs'
      | '3xs'
      | '2xs'
      | 'xs'
      | 'sm'
      | 'md'
      | 'lg'
      | 'xl'
      | '2xl'
      | '3xl'
      | '4xl'
      | '5xl'
      | '6xl'
      | '7xl'
      | '8xl'
      | '9xl'
  ) => {
    const newSettings = { ...settings, fontSize: newSize };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleFontWeightChange = (
    newWeight: 'light' | 'normal' | 'medium' | 'semibold' | 'bold' | 'extrabold'
  ) => {
    const newSettings = { ...settings, fontWeight: newWeight };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const restrictedWeights =
    FONT_WEIGHT_RESTRICTIONS[settings.fontType ?? ''] ?? [];

  const filteredWeights = Object.fromEntries(
    Object.entries(FONT_WEIGHT_PRESETS).filter(
      ([key]) => !restrictedWeights.includes(key)
    )
  );

  const resolvedFontWeight =
    settings.fontWeight && filteredWeights[settings.fontWeight]
      ? settings.fontWeight
      : 'normal';

  if (settings.fontWeight != resolvedFontWeight) {
    handleFontWeightChange(resolvedFontWeight);
  }

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

  const handleCloseToTrayChange = (enabled: boolean) => {
    const newSettings = { ...settings, closeToTray: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleSimulatorChange = (
    selectedSimulator: NonNullable<GeneralSettingsType['simulator']>
  ) => {
    const newSettings = { ...settings, simulator: selectedSimulator };
    setSettings(newSettings);
    updateDashboard(newSettings);
    // Rebuild the bridge in place rather than asking for a restart, so the
    // change is not a setting that appears to do nothing until relaunch.
    bridge.notifySimulatorPreferenceChanged?.();
  };

  const handleCompactModeChange = (
    selectedCompactMode: NonNullable<GeneralSettingsType['compactMode']>
  ) => {
    const newSettings = { ...settings, compactMode: selectedCompactMode };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleOverlayAlwaysOnTopChange = (enabled: boolean) => {
    const newSettings = { ...settings, overlayAlwaysOnTop: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleIndividualWindowsChange = (enabled: boolean) => {
    const newSettings: GeneralSettingsType = {
      ...settings,
      overlayWindowMode: enabled ? 'widget' : 'display',
    };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleNetworkAccessChange = (enabled: boolean) => {
    const newSettings = { ...settings, enableNetworkAccess: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleWebServerChange = (enabled: boolean) => {
    const newSettings = { ...settings, enableWebServer: enabled };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleShowEditModePixelDistancesChange = (enabled: boolean) => {
    const newSettings = {
      ...settings,
      editMode: {
        ...settings.editMode,
        pixelDistances: enabled,
      },
    };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  const handleSnapEditModeWidgetsToGridChange = (enabled: boolean) => {
    const newSettings = {
      ...settings,
      editMode: {
        ...settings.editMode,
        snapToGrid: enabled,
      },
    };
    setSettings(newSettings);
    updateDashboard(newSettings);
  };

  return (
    <div className="flex min-h-0 h-full flex-col">
      <header className="flex-none border-b border-slate-700 px-1 pb-5 pt-1">
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-white">
          {t('General')}
        </h2>
        <p className="text-sm text-slate-400">
          {t('Configure general application settings and preferences.')}
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pt-5 pr-1 [scrollbar-gutter:stable]">
        <LanguageSettings
          value={
            currentDashboard.generalSettings?.language ?? DEFAULT_APP_LANGUAGE
          }
          onChange={handleLanguageChange}
        />
        <section className="space-y-5 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">
              {t('Overlay appearance')}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              {t(
                'These preferences apply to racing overlays. Settings keeps its own readable text size.'
              )}
            </p>
          </div>
          {/* Font Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-slate-200">
                {t('Font')}
              </h4>
            </div>
            {/* Font Weight Dropdown */}
            <div className="min-w-0">
              <select
                aria-label={t('Overlay font')}
                value={settings.fontType ?? 'lato'}
                onChange={(e) =>
                  handleFontChange(
                    e.target.value as NonNullable<
                      GeneralSettingsType['fontType']
                    >
                  )
                }
                className="settings-field w-full"
              >
                {Object.entries(FONT_PRESETS).map(([key, value]) => (
                  <option key={key} value={key}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Font Weight Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-slate-200">
                {t('Font Weight')}
              </h4>
            </div>
            {/* Font Weight Dropdown */}
            <div className="min-w-0">
              <select
                aria-label={t('Overlay font weight')}
                value={resolvedFontWeight}
                onChange={(e) =>
                  handleFontWeightChange(
                    e.target.value as NonNullable<
                      GeneralSettingsType['fontWeight']
                    >
                  )
                }
                className="settings-field w-full"
              >
                {Object.entries(filteredWeights).map(([key, value]) => (
                  <option key={key} value={key}>
                    {t(value)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Font Size Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-md font-medium text-slate-200">
                {t('Font Size')}
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">
                  {t(FONT_SIZE_PRESETS[settings.fontSize ?? 'sm'])}
                </span>
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="min-w-0">
              <input
                aria-label={t('Overlay font size')}
                type="range"
                min="0"
                max="15"
                step="1"
                value={getSliderValue(settings.fontSize)}
                onChange={handleSliderChange}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider accent-accent-500"
              />
            </div>
          </div>

          <figure
            aria-label={t('Overlay font sample')}
            className="space-y-2 border-y border-slate-700 py-3"
          >
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-400">
              <span>{t('Overlay font sample')}</span>
              <span>
                {t(FONT_PRESETS[settings.fontType ?? 'lato'])} /{' '}
                {t(FONT_WEIGHT_PRESETS[resolvedFontWeight])} /{' '}
                {t(FONT_SIZE_PRESETS[settings.fontSize ?? 'sm'])}
              </span>
            </figcaption>
            <p
              className={`overlay-window overlay-theme-${settings.fontSize ?? 'sm'} overlay-theme-font-face-${settings.fontType ?? 'lato'} overlay-theme-font-weight-${resolvedFontWeight} text-base break-words text-slate-200`}
            >
              {t('irDashies overlay text 0123456789')}
            </p>
          </figure>

          {/* Compact Mode Setting */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-slate-200">
                {t('Compact Mode')}
              </h4>
            </div>
            <div className="min-w-0">
              <select
                aria-label={t('Overlay compact mode')}
                value={settings.compactMode ?? 'off'}
                onChange={(e) =>
                  handleCompactModeChange(
                    e.target.value as NonNullable<
                      GeneralSettingsType['compactMode']
                    >
                  )
                }
                className="settings-field w-full"
              >
                <option value="off">{t('Off')}</option>
                <option value="compact">{t('Compact')}</option>
                <option value="ultra">{t('Ultra')}</option>
              </select>
            </div>
          </div>

          {/* Color Theme Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <h4 className="text-md font-medium text-slate-200">
              {t('Color Theme')}
            </h4>
            <select
              aria-label={t('Overlay color theme')}
              value={settings.colorPalette ?? 'default'}
              onChange={(e) =>
                handleColorThemeChange(
                  e.target.value as GeneralSettingsType['colorPalette']
                )
              }
              className="settings-field w-full"
            >
              {Object.entries(COLOR_THEME_PRESETS).map(([key, value]) => (
                <option key={key} value={key}>
                  {t(value)}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <h4 className="text-md font-medium text-slate-200">
              {t('Highlight Color')}
            </h4>
            <select
              aria-label={t('Overlay highlight color')}
              value={settings.highlightColor ?? 960745}
              onChange={(e) =>
                handleHighlightColorChange(parseInt(e.target.value))
              }
              className="settings-field w-full"
            >
              {Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(
                ([key, value]) => (
                  <option key={key} value={key}>
                    {t(value)}
                  </option>
                )
              )}
            </select>
          </div>
        </section>
        {/* Edit Mode Settings */}
        <BaseSettingsSection
          title={t('Edit Mode')}
          description={t(
            'Controls for positioning and sizing widgets while editing the overlay layout.'
          )}
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4
                id="show-edit-mode-pixel-distances-label"
                className="text-md font-medium text-slate-300"
              >
                {t('Show Pixel Distances')}
              </h4>
              <p className="text-sm text-slate-500 pr-8">
                {t(
                  'Shows the pixel distance from widgets to each edge of the viewport.'
                )}
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.editMode?.pixelDistances ?? false}
              onToggle={(checked) =>
                handleShowEditModePixelDistancesChange(checked)
              }
              ariaLabelledBy="show-edit-mode-pixel-distances-label"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <h4
                id="snap-edit-mode-widgets-to-grid-label"
                className="text-md font-medium text-slate-300"
              >
                {t('Snap Widgets to Grid')}
              </h4>
              <p className="text-sm text-slate-500 pr-8">
                {t(
                  "Snaps widget movement and resizing to the pixel grid. Hold 'Shift' while dragging or resizing to temporarily disable snapping."
                )}
              </p>
            </div>
            <ToggleSwitch
              enabled={settings.editMode?.snapToGrid ?? false}
              onToggle={(checked) =>
                handleSnapEditModeWidgetsToGridChange(checked)
              }
              ariaLabelledBy="snap-edit-mode-widgets-to-grid-label"
            />
          </div>
        </BaseSettingsSection>

        {previewMode && (
          <div className="p-3 bg-slate-700/50 rounded text-sm text-slate-400">
            {t(
              'More settings are available in the desktop app, including taskbar visibility, startup options, and hardware acceleration.'
            )}
          </div>
        )}

        {!previewMode && (
          <section className="space-y-6 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="text-lg font-semibold text-slate-200">
              {t('Application & connectivity')}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="individual-overlay-windows-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Individual Overlay Windows')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'Give each widget its own window, allowing it to span monitors. Applies immediately. Edit Layout temporarily uses shared screen windows and restarts local chart history and any in-progress Lap Trace recording.'
                    )}
                  </p>
                  <p className="text-sm text-amber-300">
                    {t(
                      'Warning: increases CPU usage compared with shared display windows.'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.overlayWindowMode === 'widget'}
                  onToggle={handleIndividualWindowsChange}
                  ariaLabelledBy="individual-overlay-windows-label"
                />
              </div>
            </div>

            {/* Hide from Taskbar Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="skip-taskbar-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Hide Overlays from Taskbar')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      "When enabled, overlay windows won't appear in the taskbar. The app is still accessible via the system tray. (requires restart)"
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.skipTaskbar ?? true}
                  onToggle={(checked) => handleSkipTaskbarChange(checked)}
                  ariaLabelledBy="skip-taskbar-label"
                />
              </div>
            </div>

            {/* Overlay Always On Top Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="overlay-always-on-top-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Keep Overlays Always On Top')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'When enabled, overlay windows will always stay on top of other applications. (requires restart)'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.overlayAlwaysOnTop ?? true}
                  onToggle={(checked) =>
                    handleOverlayAlwaysOnTopChange(checked)
                  }
                  ariaLabelledBy="overlay-always-on-top-label"
                />
              </div>
            </div>

            {/* Web Server Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="enable-web-server-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Enable Web Server')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'Runs the built-in web server that exposes your overlays as browser sources for OBS. When disabled, the app listens on no ports at all — freeing port 3000 — and the OBS browser source URLs stop working. Leave enabled if you stream or record. (requires restart)'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.enableWebServer ?? true}
                  onToggle={(checked) => handleWebServerChange(checked)}
                  ariaLabelledBy="enable-web-server-label"
                />
              </div>
            </div>

            {/* Network Access Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="enable-network-access-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Enable Network Access')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'When enabled, the component server binds to all network interfaces (0.0.0.0), allowing other devices on your network to access the dashboard. When disabled, only localhost connections are allowed. (requires restart)'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.enableNetworkAccess ?? false}
                  onToggle={(checked) => handleNetworkAccessChange(checked)}
                  ariaLabelledBy="enable-network-access-label"
                />
              </div>
            </div>

            {/* Hardware Acceleration Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="hardware-acceleration-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Hardware Acceleration')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'Uses GPU hardware acceleration for rendering. Only disable this if you are experiencing compatibility issues, as it will significantly impact performance. (requires restart)'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={!(settings.disableHardwareAcceleration ?? false)}
                  onToggle={(checked) =>
                    handleDisableHardwareAccelerationChange(!checked)
                  }
                  ariaLabelledBy="hardware-acceleration-label"
                />
              </div>
            </div>

            {/* Autostart Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="auto-start-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Start on system startup')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'If enabled, irDashies will start automatically on system start up.'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.enableAutoStart ?? true}
                  onToggle={(checked) => handleAutoStartChange(checked)}
                  ariaLabelledBy="auto-start-label"
                />
              </div>
            </div>

            {/* Start Minimized Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="start-minimized-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Start minimized')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'If enabled, the main settings window will start minimized to the system tray.'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.startMinimized ?? false}
                  onToggle={(checked) => handleStartMinimizedChange(checked)}
                  ariaLabelledBy="start-minimized-label"
                />
              </div>
            </div>

            {/* Close To Tray Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="close-to-tray-label"
                    className="text-md font-medium text-slate-200"
                  >
                    {t('Close to tray')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'If enabled, closing the app will minimise to the system tray rather than quitting.'
                    )}
                  </p>
                </div>
                <ToggleSwitch
                  enabled={settings.closeToTray ?? true}
                  onToggle={(checked) => handleCloseToTrayChange(checked)}
                  ariaLabelledBy="close-to-tray-label"
                />
              </div>
            </div>

            {/* Simulator Setting */}
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4 className="text-md font-medium text-slate-200">
                    {t('Simulator')}
                  </h4>
                  <p className="text-sm text-slate-400">
                    {t(
                      'Which simulator to read telemetry from. Auto picks whichever supported simulator is running.'
                    )}
                  </p>
                </div>
                <select
                  value={settings.simulator ?? 'auto'}
                  onChange={(e) =>
                    handleSimulatorChange(
                      e.target.value as NonNullable<
                        GeneralSettingsType['simulator']
                      >
                    )
                  }
                  className="settings-field shrink-0"
                >
                  <option value="auto">{t('Auto')}</option>
                  {SIMULATOR_IDS.map((id) => {
                    // Listed but disabled when this build has no source for it,
                    // which says more than omitting it would: the option
                    // silently vanishing reads as the feature being gone.
                    const unavailable = !availableSimulators.includes(id);
                    return (
                      <option key={id} value={id} disabled={unavailable}>
                        {SIMULATOR_LABELS[id]}
                        {unavailable ? t(' (not available in this build)') : ''}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
