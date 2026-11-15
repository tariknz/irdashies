import { useState } from 'react';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { useAvailableSimulators, useDashboard } from '@irdashies/context';
import { SIMULATOR_IDS, SIMULATOR_LABELS } from '@irdashies/types';
import type { GeneralSettingsType } from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';

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
  const [devToolError, setDevToolError] = useState<string>();
  const [settings, setSettings] = useState<GeneralSettingsType>({
    devTool: currentDashboard?.generalSettings?.devTool ?? false,
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
    return <>Loading...</>;
  }

  const updateDashboard = (newSettings: GeneralSettingsType) => {
    const updatedDashboard = {
      ...currentDashboard,
      generalSettings: { ...currentDashboard.generalSettings, ...newSettings },
    };
    onDashboardUpdated(updatedDashboard);
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
          General
        </h2>
        <p className="text-sm text-slate-400">
          Configure general application settings and preferences.
        </p>
      </header>

      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto pt-5 pr-1 [scrollbar-gutter:stable]">
        <section className="space-y-5 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-200">
              Overlay appearance
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              These preferences apply to racing overlays. Settings keeps its own
              readable text size.
            </p>
          </div>
          {/* Font Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-slate-200">Font</h4>
            </div>
            {/* Font Weight Dropdown */}
            <div className="min-w-0">
              <select
                aria-label="Overlay font"
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
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Font Weight Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-slate-200">
                Font Weight
              </h4>
            </div>
            {/* Font Weight Dropdown */}
            <div className="min-w-0">
              <select
                aria-label="Overlay font weight"
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
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Font Size Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-md font-medium text-slate-200">Font Size</h4>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-300">
                  {FONT_SIZE_PRESETS[settings.fontSize ?? 'sm']}
                </span>
              </div>
            </div>

            {/* Font Size Slider */}
            <div className="min-w-0">
              <input
                aria-label="Overlay font size"
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
            aria-label="Overlay font sample"
            className="space-y-2 border-y border-slate-700 py-3"
          >
            <figcaption className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-slate-400">
              <span>Overlay font sample</span>
              <span>
                {FONT_PRESETS[settings.fontType ?? 'lato']} /{' '}
                {FONT_WEIGHT_PRESETS[resolvedFontWeight]} /{' '}
                {FONT_SIZE_PRESETS[settings.fontSize ?? 'sm']}
              </span>
            </figcaption>
            <p
              className={`overlay-window overlay-theme-${settings.fontSize ?? 'sm'} overlay-theme-font-face-${settings.fontType ?? 'lato'} overlay-theme-font-weight-${resolvedFontWeight} text-base break-words text-slate-200`}
            >
              irDashies overlay text 0123456789
            </p>
          </figure>

          {/* Compact Mode Setting */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-md font-medium text-slate-200">
                Compact Mode
              </h4>
            </div>
            <div className="min-w-0">
              <select
                aria-label="Overlay compact mode"
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
                <option value="off">Off</option>
                <option value="compact">Compact</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
          </div>

          {/* Color Theme Settings */}
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <h4 className="text-md font-medium text-slate-200">Color Theme</h4>
            <select
              aria-label="Overlay color theme"
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
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] items-center gap-x-5 gap-y-2">
            <h4 className="text-md font-medium text-slate-200">
              Highlight Color
            </h4>
            <select
              aria-label="Overlay highlight color"
              value={settings.highlightColor ?? 960745}
              onChange={(e) =>
                handleHighlightColorChange(parseInt(e.target.value))
              }
              className="settings-field w-full"
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
        </section>
        {/* Edit Mode Settings */}
        <BaseSettingsSection
          title="Edit Mode"
          description="Controls for positioning and sizing widgets while editing the overlay layout."
        >
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4
                id="show-edit-mode-pixel-distances-label"
                className="text-md font-medium text-slate-300"
              >
                Show Pixel Distances
              </h4>
              <p className="text-sm text-slate-500 pr-8">
                Shows the pixel distance from widgets to each edge of the
                viewport.
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
                Snap Widgets to Grid
              </h4>
              <p className="text-sm text-slate-500 pr-8">
                Snaps widget movement and resizing to the pixel grid. Hold
                &apos;Shift&apos; while dragging or resizing to temporarily
                disable snapping.
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
            More settings are available in the desktop app, including taskbar
            visibility, startup options, and hardware acceleration.
          </div>
        )}

        {!previewMode && (
          <section className="space-y-6 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
            <h3 className="text-lg font-semibold text-slate-200">
              Application &amp; connectivity
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="dev-tool-label"
                    className="text-md font-medium text-slate-200"
                  >
                    Dev Tool
                  </h4>
                  <p className="text-sm text-slate-400">
                    Enable IBT Inspector to replay iRacing recordings in your
                    current overlays and collect performance data.
                  </p>
                  {settings.devTool && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-sky-400 hover:text-sky-300"
                      onClick={() => {
                        void window.ibtInspectorBridge
                          ?.open()
                          .catch((error) => setDevToolError(String(error)));
                      }}
                    >
                      Open IBT Inspector
                    </button>
                  )}
                  {devToolError && (
                    <p role="alert" className="text-sm text-red-300">
                      {devToolError}
                    </p>
                  )}
                </div>
                <ToggleSwitch
                  enabled={settings.devTool ?? false}
                  ariaLabelledBy="dev-tool-label"
                  onToggle={(enabled) => {
                    const next = { ...settings, devTool: enabled };
                    setSettings(next);
                    updateDashboard(next);
                  }}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <h4
                    id="individual-overlay-windows-label"
                    className="text-md font-medium text-slate-200"
                  >
                    Individual Overlay Windows
                  </h4>
                  <p className="text-sm text-slate-400">
                    Give each widget its own window, allowing it to span
                    monitors. Applies immediately. Edit Layout temporarily uses
                    shared screen windows and restarts local chart history and
                    any in-progress Lap Trace recording.
                  </p>
                  <p className="text-sm text-amber-300">
                    Warning: increases CPU usage compared with shared display
                    windows.
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
                    Hide Overlays from Taskbar
                  </h4>
                  <p className="text-sm text-slate-400">
                    When enabled, overlay windows won&apos;t appear in the
                    taskbar. The app is still accessible via the system tray.
                    (requires restart)
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
                    Keep Overlays Always On Top
                  </h4>
                  <p className="text-sm text-slate-400">
                    When enabled, overlay windows will always stay on top of
                    other applications. (requires restart)
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
                    Enable Web Server
                  </h4>
                  <p className="text-sm text-slate-400">
                    Runs the built-in web server that exposes your overlays as
                    browser sources for OBS. When disabled, the app listens on
                    no ports at all &mdash; freeing port 3000 &mdash; and the
                    OBS browser source URLs stop working. Leave enabled if you
                    stream or record. (requires restart)
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
                    Enable Network Access
                  </h4>
                  <p className="text-sm text-slate-400">
                    When enabled, the component server binds to all network
                    interfaces (0.0.0.0), allowing other devices on your network
                    to access the dashboard. When disabled, only localhost
                    connections are allowed. (requires restart)
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
                    Hardware Acceleration
                  </h4>
                  <p className="text-sm text-slate-400">
                    Uses GPU hardware acceleration for rendering. Only disable
                    this if you are experiencing compatibility issues, as it
                    will significantly impact performance. (requires restart)
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
                    Start on system startup
                  </h4>
                  <p className="text-sm text-slate-400">
                    If enabled, irDashies will start automatically on system
                    start up.
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
                    Start minimized
                  </h4>
                  <p className="text-sm text-slate-400">
                    If enabled, the main settings window will start minimized to
                    the system tray.
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
                    Close to tray
                  </h4>
                  <p className="text-sm text-slate-400">
                    If enabled, closing the app will minimise to the system tray
                    rather than quitting.
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
                    Simulator
                  </h4>
                  <p className="text-sm text-slate-400">
                    Which simulator to read telemetry from. Auto picks whichever
                    supported simulator is running.
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
                  <option value="auto">Auto</option>
                  {SIMULATOR_IDS.map((id) => {
                    // Listed but disabled when this build has no source for it,
                    // which says more than omitting it would: the option
                    // silently vanishing reads as the feature being gone.
                    const unavailable = !availableSimulators.includes(id);
                    return (
                      <option key={id} value={id} disabled={unavailable}>
                        {SIMULATOR_LABELS[id]}
                        {unavailable ? ' (not available in this build)' : ''}
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
