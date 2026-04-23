import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';

export const FlagSettings = () => {
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('flag');

  return (
    <BaseSettingsSection
      title="Flag"
      description="Display track flags"
      widgetType={'flag'}
      settings={settings}
      onSettingsChange={setSettings}
    >
      {(handleConfigChange, handleVisibilityConfigChange) => (
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

          <div>
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
                  description="Display 'no flag' (grey leds) when no flags are waved"
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
              <SettingVisibilitySection
                config={settings.visibilityConfig}
                handleConfigChange={handleVisibilityConfigChange}
              />
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
