import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { InputWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'input';

const defaultConfig: InputWidgetSettings['config'] = {
  trace: {
    enabled: true,
    includeThrottle: true,
    includeBrake: true,
  },
  bar: {
    enabled: true,
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
  },
  gear: {
    enabled: true,
    unit: 'auto',
  },
  steer: {
    enabled: true,
    config: {
      style: 'default',
      color: 'light',
    },
  },
};

// Migration function to handle missing properties in the new config format
const migrateConfig = (
  savedConfig: unknown,
): InputWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;

  return {
    trace: {
      enabled:
        (config.trace as { enabled?: boolean })?.enabled ??
        defaultConfig.trace.enabled,
      includeThrottle:
        (config.trace as { includeThrottle?: boolean })?.includeThrottle ??
        defaultConfig.trace.includeThrottle,
      includeBrake:
        (config.trace as { includeBrake?: boolean })?.includeBrake ??
        defaultConfig.trace.includeBrake,
    },
    bar: {
      enabled:
        (config.bar as { enabled?: boolean })?.enabled ?? defaultConfig.bar.enabled,
      includeClutch:
        (config.bar as { includeClutch?: boolean })?.includeClutch ??
        defaultConfig.bar.includeClutch,
      includeBrake:
        (config.bar as { includeBrake?: boolean })?.includeBrake ??
        defaultConfig.bar.includeBrake,
      includeThrottle:
        (config.bar as { includeThrottle?: boolean })?.includeThrottle ??
        defaultConfig.bar.includeThrottle,
    },
    gear: {
      enabled:
        (config.gear as { enabled?: boolean })?.enabled ??
        defaultConfig.gear.enabled,
      unit:
        (config.gear as { unit?: 'mph' | 'km/h' | 'auto' })?.unit ??
        defaultConfig.gear.unit,
    },
    steer: {
      enabled:
        (config.steer as { enabled?: boolean })?.enabled ??
        defaultConfig.steer.enabled,
      config: {
        style:
          ((config.steer as { config?: { style?: 'formula' | 'lmp' | 'nascar' | 'round' | 'ushape' | 'default' } })?.config?.style) ??
          defaultConfig.steer.config.style,
        color:
          ((config.steer as { config?: { color?: 'dark' | 'light' } })?.config?.color) ??
          defaultConfig.steer.config.color,
      },
    },
  };
};

export const InputSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID,
  );
  const [settings, setSettings] = useState<InputWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const config = settings.config;

  return (
    <BaseSettingsSection
      title="Input Traces Settings"
      description="Configure the input traces display settings for throttle, brake, and clutch."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="input"
    >
      {(handleConfigChange) => (
        <div className="space-y-8">
          {/* Trace Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Trace Settings</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">Enable Trace Display</span>
                <ToggleSwitch
                  enabled={config.trace.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ trace: { ...config.trace, enabled } })
                  }
                />
              </div>
            </div>
            {config.trace.enabled && (
              <div className="space-y-2 pl-4 pt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.trace.includeThrottle}
                    onChange={(e) =>
                      handleConfigChange({
                        trace: { ...config.trace, includeThrottle: e.target.checked },
                      })
                    }
                    className="form-checkbox h-4 w-4 text-blue-500 rounded border-slate-500 bg-slate-700"
                  />
                  <span className="text-sm text-slate-200">Show Throttle Trace</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.trace.includeBrake}
                    onChange={(e) =>
                      handleConfigChange({
                        trace: { ...config.trace, includeBrake: e.target.checked },
                      })
                    }
                    className="form-checkbox h-4 w-4 text-blue-500 rounded border-slate-500 bg-slate-700"
                  />
                  <span className="text-sm text-slate-200">Show Brake Trace</span>
                </label>
              </div>
            )}
          </div>

          {/* Bar Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Bar Settings</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">Enable Bar Display</span>
                <ToggleSwitch
                  enabled={config.bar.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ bar: { ...config.bar, enabled } })
                  }
                />
              </div>
            </div>
            {config.bar.enabled && (
              <div className="space-y-2 pl-4 pt-2">
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.bar.includeClutch}
                    onChange={(e) =>
                      handleConfigChange({
                        bar: { ...config.bar, includeClutch: e.target.checked },
                      })
                    }
                    className="form-checkbox h-4 w-4 text-blue-500 rounded border-slate-500 bg-slate-700"
                  />
                  <span className="text-sm text-slate-200">Show Clutch Bar</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.bar.includeBrake}
                    onChange={(e) =>
                      handleConfigChange({
                        bar: { ...config.bar, includeBrake: e.target.checked },
                      })
                    }
                    className="form-checkbox h-4 w-4 text-blue-500 rounded border-slate-500 bg-slate-700"
                  />
                  <span className="text-sm text-slate-200">Show Brake Bar</span>
                </label>
                <label className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    checked={config.bar.includeThrottle}
                    onChange={(e) =>
                      handleConfigChange({
                        bar: { ...config.bar, includeThrottle: e.target.checked },
                      })
                    }
                    className="form-checkbox h-4 w-4 text-blue-500 rounded border-slate-500 bg-slate-700"
                  />
                  <span className="text-sm text-slate-200">Show Throttle Bar</span>
                </label>
              </div>
            )}
          </div>

          {/* Steer Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">
                Steer Settings
              </h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">
                  Enable Steer Display
                </span>
                <ToggleSwitch
                  enabled={config.steer.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ steer: { ...config.steer, enabled } })
                  }
                />
              </div>
            </div>
            {config.steer.enabled && (
              <div className="space-y-3 pl-4 pt-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-200">Wheel Style:</label>
                  <select
                    value={config.steer.config.style}
                    onChange={(e) =>
                      handleConfigChange({
                        steer: {
                          ...config.steer,
                          config: {
                            ...config.steer.config,
                            style: e.target.value as 'formula' | 'lmp' | 'nascar' | 'round' | 'ushape' | 'default',
                          },
                        },
                      })
                    }
                    className="bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="default">Default</option>
                    <option value="formula">Formula</option>
                    <option value="lmp">LMP</option>
                    <option value="nascar">NASCAR</option>
                    <option value="ushape">U-Shape</option>
                  </select>
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-200">Wheel Color:</label>
                  <select
                    value={config.steer.config.color}
                    onChange={(e) =>
                      handleConfigChange({
                        steer: {
                          ...config.steer,
                          config: {
                            ...config.steer.config,
                            color: e.target.value as 'dark' | 'light',
                          },
                        },
                      })
                    }
                    className="bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="light">Light</option>
                    <option value="dark">Dark</option>
                  </select>
                </div>
              </div>
            )}
          </div>

          {/* Gear Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Gear Settings</h3>
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">Enable Gear Display</span>
                <ToggleSwitch
                  enabled={config.gear.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ gear: { ...config.gear, enabled } })
                  }
                />
              </div>
            </div>
            {config.gear.enabled && (
              <div className="space-y-3 pl-4 pt-2">
                <div className="flex items-center gap-3">
                  <label className="text-sm text-slate-200">Speed Unit:</label>
                  <select
                    value={config.gear.unit}
                    onChange={(e) =>
                      handleConfigChange({
                        gear: {
                          ...config.gear,
                          unit: e.target.value as 'mph' | 'km/h' | 'auto',
                        },
                      })
                    }
                    className="bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="auto">auto</option>
                    <option value="mph">mph</option>
                    <option value="km/h">km/h</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
