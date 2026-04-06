import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';

export const FasterCarsFromBehindSettings = () => {
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('fastercarsfrombehind');

  return (
    <BaseSettingsSection
      title="Faster Cars From Behind"
      description="Configure settings for the faster cars detection widget."
      widgetType={'fastercarsfrombehind'}
      settings={settings}
      onSettingsChange={setSettings}
    >
      {(handleConfigChange, handleVisibilityConfigChange) => (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="display"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Display
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
            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <SettingsSection title="Display">
                {/* Distance Threshold */}
                <SettingSliderRow
                  title="Distance Threshold"
                  description="Minimum gap to a faster car before it is displayed. Smaller values
                    show cars that are closer behind you."
                  value={Math.abs(settings.config.distanceThreshold)}
                  units="seconds"
                  min={0.3}
                  max={20}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ distanceThreshold: v })}
                />

                {/* Show Distance Section */}
                <SettingToggleRow
                  title="Show Distance"
                  description="Display the distance to the faster car."
                  enabled={settings.config.showDistance ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showDistance: newValue })
                  }
                />

                {/* Show Name Section */}
                <SettingToggleRow
                  title="Show Name"
                  description="Display the driver name in the faster cars widget."
                  enabled={settings.config.showName ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showName: newValue })
                  }
                />

                {settings.config.showName && (
                  <SettingsSection>
                    <SettingToggleRow
                      title="Remove Numbers From Names"
                      description="Remove numbers from the displayed driver name."
                      enabled={settings.config.removeNumbersFromName ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({ removeNumbersFromName: newValue })
                      }
                    />
                  </SettingsSection>
                )}

                {/* Show Badge Section */}
                <SettingToggleRow
                  title="Show Driver Badge"
                  description="Display the driver license and iRating badge."
                  enabled={settings.config.showBadge ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ showBadge: newValue })
                  }
                />

                {/* Badge Format Selector */}
                {settings.config.showBadge && (
                  <div className="mt-3">
                    <div className="flex flex-wrap gap-3 justify-end">
                      {(
                        [
                          'license-color-fullrating-combo',
                          'fullrating-color-no-license',
                          'rating-color-no-license',
                          'license-color-fullrating-bw',
                          'license-color-rating-bw',
                          'rating-only-color-rating-bw',
                          'license-color-rating-bw-no-license',
                          'license-bw-rating-bw',
                          'rating-only-bw-rating-bw',
                          'license-bw-rating-bw-no-license',
                          'rating-bw-no-license',
                          'fullrating-bw-no-license',
                        ] as const
                      ).map((format) => (
                        <BadgeFormatPreview
                          key={format}
                          format={format}
                          selected={settings.config.badgeFormat === format}
                          onClick={() => {
                            handleConfigChange({
                              badgeFormat: format,
                            });
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}

                <SettingSelectRow
                  title="Drivers Behind"
                  value={(settings.config.numberDriversBehind ?? 1).toString()}
                  options={Array.from({ length: 10 }, (_, i) => {
                    const num = i + 1;
                    return { label: num.toString(), value: num.toString() };
                  })}
                  onChange={(v) =>
                    handleConfigChange({ numberDriversBehind: parseInt(v) })
                  }
                />

                <SettingSelectRow<'Top' | 'Bottom'>
                  title="Align Driver Boxes"
                  value={settings.config.alignDriverBoxes ?? 'Top'}
                  options={[
                    { label: 'Align to Top of Widget', value: 'Top' },
                    { label: 'Align to Bottom of Widget', value: 'Bottom' },
                  ]}
                  onChange={(v) => handleConfigChange({ alignDriverBoxes: v })}
                />

                <SettingSelectRow<'Top' | 'Reverse'>
                  title="Closest Driver"
                  value={settings.config.closestDriverBox ?? 'Top'}
                  options={[
                    { label: 'Closest Driver at Top', value: 'Top' },
                    { label: 'Closest Driver at Bottom', value: 'Reverse' },
                  ]}
                  onChange={(v) => handleConfigChange({ closestDriverBox: v })}
                />

                {/* Only Show Faster Classes Section */}
                <SettingToggleRow
                  title="Only show faster classes"
                  description="If enabled, only cars from faster classes will be shown.
                      Same-class competitors will be hidden."
                  enabled={settings.config.onlyShowFasterClasses ?? false}
                  onToggle={(newValue) =>
                    handleConfigChange({ onlyShowFasterClasses: newValue })
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
