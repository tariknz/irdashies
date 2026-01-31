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
    showNoFlagState: (config.showNoFlagState as boolean) ?? defaultConfig.showNoFlagState,
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
              <h4 className="text-md font-medium text-slate-300">Show Only When On Track</h4>
              <p className="text-sm text-slate-400">Hide widget while in the garage.</p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(enabled) => handleConfigChange({ showOnlyWhenOnTrack: enabled })}
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
              <p className="text-sm text-slate-400">Display grey indicator when no flags are waved.</p>
            </div>
            <ToggleSwitch
              enabled={settings.config.showNoFlagState ?? true}
              onToggle={(enabled) => handleConfigChange({ showNoFlagState: enabled })}
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