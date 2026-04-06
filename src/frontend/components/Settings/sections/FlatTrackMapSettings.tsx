import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';

export const FlatTrackMapSettings = () => {
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('flatmap');

  return (
    <BaseSettingsSection
      title="Flat Track Map"
      description="Configure flat track map visualization settings."
      widgetType={'flatmap'}
      settings={settings}
      onSettingsChange={setSettings}
    >
      {(handleConfigChange, handleVisibilityConfigChange) => (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="track"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Track
            </TabButton>
            <TabButton
              id="drivers"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Drivers
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
            {/* TRACK TAB */}
            {activeTab === 'track' && (
              <SettingsSection title="Track Settings">
                <SettingSliderRow
                  title="Track Line Width"
                  description="Thickness of the track line (matches curved track map scale)"
                  value={settings.config.trackLineWidth ?? 20}
                  units="px"
                  min={5}
                  max={40}
                  step={1}
                  onChange={(v) => handleConfigChange({ trackLineWidth: v })}
                />

                <SettingSliderRow
                  title="Track Outline Width"
                  description="Thickness of the outline around the track"
                  value={settings.config.trackOutlineWidth ?? 40}
                  units="px"
                  min={10}
                  max={80}
                  step={1}
                  onChange={(v) => handleConfigChange({ trackOutlineWidth: v })}
                />

                <SettingToggleRow
                  title="Invert Track Colors"
                  description="Swap black and white colors for the track"
                  enabled={settings.config.invertTrackColors ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ invertTrackColors: newValue })
                  }
                />
              </SettingsSection>
            )}

            {/* DRIVERS TAB */}
            {activeTab === 'drivers' && (
              <SettingsSection title="Driver Circles">
                <SettingToggleRow
                  title="Show Car Numbers"
                  description="Display car numbers on driver circles"
                  enabled={settings.config.showCarNumbers ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showCarNumbers: newValue })
                  }
                />

                {settings.config.showCarNumbers && (
                  <SettingsSection>
                    <SettingButtonGroupRow<
                      'carNumber' | 'sessionPosition' | 'livePosition'
                    >
                      title="Display Mode"
                      value={settings.config.displayMode}
                      options={[
                        { label: 'Car Number', value: 'carNumber' },
                        { label: 'Session Position', value: 'sessionPosition' },
                        { label: 'Live Position', value: 'livePosition' },
                      ]}
                      onChange={(v) => handleConfigChange({ displayMode: v })}
                    />
                  </SettingsSection>
                )}

                <SettingSliderRow
                  title="Driver Circle Size"
                  description="Size of the circle for other drivers (matches curved track map scale)"
                  value={settings.config.driverCircleSize ?? 40}
                  units="px"
                  min={10}
                  max={80}
                  step={1}
                  onChange={(v) => handleConfigChange({ driverCircleSize: v })}
                />

                <SettingSliderRow
                  title="Player Circle Size"
                  description="Size of the circle for your car (matches curved track map scale)"
                  value={settings.config.playerCircleSize ?? 40}
                  units="px"
                  min={10}
                  max={100}
                  step={1}
                  onChange={(v) => handleConfigChange({ playerCircleSize: v })}
                />

                <SettingSliderRow
                  title="Relative Font Size"
                  description="Relative size of the font within the trackmap"
                  value={settings.config.trackmapFontSize ?? 100}
                  units="%"
                  min={50}
                  max={150}
                  step={1}
                  onChange={(v) => handleConfigChange({ trackmapFontSize: v })}
                />

                <SettingToggleRow
                  title="Use Highlight Color for Player"
                  description="Use your custom highlight color for the player car instead of
                      class color"
                  enabled={settings.config.useHighlightColor ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ useHighlightColor: newValue })
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
