import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { FlagWidgetSettings, SessionVisibilitySettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SessionVisibility } from '../components/SessionVisibility';

const SETTING_ID = 'flag';

const defaultConfig: FlagWidgetSettings['config'] = {
  enabled: true,
  showOnlyWhenOnTrack: false,
  showLabel: true,
  animate: false,
  blinkPeriod: 0.5,
  matrixMode: '16x16',
  showNoFlagState: true,
  sessionVisibility: { 
    race: true, 
    loneQualify: true, 
    openQualify: true, 
    practice: true, 
    offlineTesting: true 
  }
};

const migrateConfig = (savedConfig: unknown): FlagWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    enabled: (config.enabled as boolean) ?? defaultConfig.enabled,
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? defaultConfig.showOnlyWhenOnTrack,
    showLabel: (config.showLabel as boolean) ?? defaultConfig.showLabel,
    animate: (config.animate as boolean) ?? defaultConfig.animate,
    blinkPeriod: (config.blinkPeriod as number) ?? defaultConfig.blinkPeriod,
    showNoFlagState: (config.showNoFlagState as boolean) ?? defaultConfig.showNoFlagState,
    matrixMode: (config.matrixMode as '8x8' | '16x16' | 'uniform') ?? defaultConfig.matrixMode,
    sessionVisibility: (config.sessionVisibility as SessionVisibilitySettings) ?? defaultConfig.sessionVisibility,
  };
};

export const FlagSettings = () => {
  const { currentDashboard } = useDashboard();
  
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as FlagWidgetSettings | undefined;

  const [settings, setSettings] = useState<FlagWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? true,
    config: migrateConfig(savedSettings?.config),
  });

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Flag"
      description="Display track flags (Yellow, Blue, Green, etc.)"
      settings={settings as FlagWidgetSettings}
      onSettingsChange={(s) => setSettings(s as FlagWidgetSettings)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Matrix Mode</h4>
              <p className="text-sm text-slate-400">Choose between 8x8, 16x16, or uniform color rendering.</p>
            </div>
            <div>
              <select
                className="rounded-md bg-slate-800 text-slate-200 px-3 py-1 text-center"
                value={settings.config.matrixMode ?? '16x16'}
                onChange={(e) => handleConfigChange({ matrixMode: e.target.value as '8x8' | '16x16' | 'uniform' })}
              >
                <option value="8x8">8x8</option>
                <option value="16x16">16x16</option>
                <option value="uniform">Uniform (1x1)</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Animate Flag</h4>
              <p className="text-sm text-slate-400">When enabled the flag will blink on/off every 0.5s.</p>
            </div>
            <ToggleSwitch
              enabled={settings.config.animate ?? false}
              onToggle={(enabled) => handleConfigChange({ animate: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Blink Period (s)</h4>
              <p className="text-sm text-slate-400">Set how many seconds between on/off when animation is enabled.</p>
            </div>
            <input
              type="number"
              step="0.1"
              min="0.1"
              className="w-24 rounded-md bg-slate-800 text-slate-200 px-2 py-1 text-right"
              value={settings.config.blinkPeriod ?? 0.5}
              disabled={!settings.config.animate}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) handleConfigChange({ blinkPeriod: v });
              }}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Show Flag Label</h4>
              <p className="text-sm text-slate-400">Toggle display of the flag name text.</p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showLabel ?? true}
              onToggle={(enabled) => handleConfigChange({ showLabel: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Show No Flag State</h4>
              <p className="text-sm text-slate-400">Display 'no flag' (grey leds) when no flags are waved.</p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showNoFlagState ?? true}
              onToggle={(enabled) => handleConfigChange({ showNoFlagState: enabled })}
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-md font-medium text-slate-300">Show Only When On Track</h4>
              <p className="text-sm text-slate-400">Hide widget while in the garage.</p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(enabled) => handleConfigChange({ showOnlyWhenOnTrack: enabled })}
            />
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-slate-200">Session Visibility</h3>
            <SessionVisibility
              sessionVisibility={settings.config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};