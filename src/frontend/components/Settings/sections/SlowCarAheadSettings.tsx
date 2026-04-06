import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';

export const SlowCarAheadSettings = () => {
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('slowcarahead');

  return (
    <BaseSettingsSection
      title="Slow Car Ahead"
      description="Display indicator for slow cars ahead"
      widgetType={'slowcarahead'}
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
                <SettingNumberRow
                  title="Maximum Distance (m)"
                  description="The maximum distance the slow car can be for the widget to be visible."
                  value={settings.config.maxDistance}
                  min={100}
                  max={999}
                  step={1}
                  onChange={(v) => handleConfigChange({ maxDistance: v })}
                />

                <SettingNumberRow
                  title="Slow Speed Threshold (km/h)"
                  description="The threshold for when a car is considered slow, and the widget will appear."
                  value={settings.config.slowSpeedThreshold}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ slowSpeedThreshold: v })
                  }
                />

                <SettingNumberRow
                  title="Stopped Speed Threshold (km/h)"
                  description="The threshold for when a car is considered stopped, and the bar will turn red."
                  value={settings.config.stoppedSpeedThreshold}
                  min={1}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ stoppedSpeedThreshold: v })
                  }
                />

                <SettingSliderRow
                  title="Bar Thickness"
                  description="The thickness of the colored bar of the widget (px)."
                  value={settings.config.barThickness}
                  units="px"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) => handleConfigChange({ barThickness: v })}
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
