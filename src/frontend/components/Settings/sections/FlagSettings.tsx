import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  FlagWidgetSettings,
  SessionVisibilitySettings,
  SettingsTabType,
} from '../types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSelectRow } from '../components/SettingSelectRow';

const SETTING_ID = 'flag';

const defaultConfig: FlagWidgetSettings['config'] = {
  enabled: true,
  showOnlyWhenOnTrack: true,
  showLabel: true,
  animate: true,
  blinkPeriod: 0.5,
  matrixMode: '16x16',
  showNoFlagState: true,
  enableGlow: true,
  doubleFlag: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (savedConfig: unknown): FlagWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    enabled: (config.enabled as boolean) ?? defaultConfig.enabled,
    showOnlyWhenOnTrack:
      (config.showOnlyWhenOnTrack as boolean) ??
      defaultConfig.showOnlyWhenOnTrack,
    showLabel: (config.showLabel as boolean) ?? defaultConfig.showLabel,
    animate: (config.animate as boolean) ?? defaultConfig.animate,
    blinkPeriod: (config.blinkPeriod as number) ?? defaultConfig.blinkPeriod,
    showNoFlagState:
      (config.showNoFlagState as boolean) ?? defaultConfig.showNoFlagState,
    matrixMode:
      (config.matrixMode as '8x8' | '16x16' | 'uniform') ??
      defaultConfig.matrixMode,
    enableGlow: (config.enableGlow as boolean) ?? defaultConfig.enableGlow,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
    doubleFlag: (config.doubleFlag as boolean) ?? defaultConfig.doubleFlag,
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

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('flagTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('flagTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Flag"
      description="Display track flags"
      settings={settings as FlagWidgetSettings}
      onSettingsChange={(s) => setSettings(s as FlagWidgetSettings)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="options"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Options
            </TabButton>
            <TabButton
              id="visibility"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Visibility
            </TabButton>
          </div>

          <div className="pt-4">
            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <SettingsSection title="Display">

                <SettingToggleRow
                  title="Double Flag"
                  description="When enabled two flags will be displayed"
                  enabled={settings.config.doubleFlag ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({ doubleFlag: enabled })
                  }
                />
           
                <SettingSelectRow<'8x8' | '16x16' | 'uniform'>
                  title="Matrix Mode"
                  description="Choose between 8x8, 16x16, or uniform color rendering."
                  value={settings.config.matrixMode ?? '16x16'}
                  options={[
                    { label: '8x8', value: '8x8' },
                    { label: '16x16', value: '16x16' },
                    { label: 'Uniform (1x1)', value: 'uniform' },
                  ]}
                  onChange={(v) => handleConfigChange({ matrixMode: v })}
                />

                <SettingToggleRow
                  title="Animate Flag"
                  description="When enabled the flag will blink on/off"
                  enabled={settings.config.animate ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({ animate: enabled })
                  }
                />

                <SettingNumberRow
                  title="Blink Period (s)"
                  description="Set how many seconds between on/off when animation is enabled. Min 0.1s, Max 3s."
                  value={settings.config.blinkPeriod ?? 0.5}
                  min={0.1}
                  max={3}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ blinkPeriod: v })}
                />

                <SettingToggleRow
                  title="Show Flag Label"
                  description="Toggle display of the flag name text"
                  enabled={settings.config.showLabel ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({ showLabel: enabled })
                  }
                />

                <SettingToggleRow
                  title="Show No Flag State"
                  description="Display &apos;no flag&apos; (grey leds) when no flags are waved"
                  enabled={settings.config.showNoFlagState ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({ showNoFlagState: enabled })
                  }
                />

                <SettingToggleRow
                  title="Enable Glow Effect"
                  description="Add a glow effect around the matrix lights"
                  enabled={settings.config.enableGlow ?? false}
                  onToggle={(enabled) =>
                    handleConfigChange({ enableGlow: enabled })
                  }
                />

              </SettingsSection>
            )}

            {/* VISIBILITY TAB */}
            {activeTab === 'visibility' && (
              <SettingsSection title="Session Visibility">

                <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />

                <SettingDivider />

                <SettingToggleRow
                  title="Show only when on track"
                  description="If enabled, flags will only be shown when driving"
                  enabled={settings.config.showOnlyWhenOnTrack ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showOnlyWhenOnTrack: newValue })
                  }
                />

              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
