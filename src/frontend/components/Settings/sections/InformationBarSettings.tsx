import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingActionButton } from '../components/SettingActionButton';
import {
  SessionBarItemsList,
  SessionBarItemConfig,
} from '../components/SessionBarItemsList';
import { DEFAULT_SESSION_BAR_DISPLAY_ORDER } from '../sessionBarConstants';
import { SettingVisibilitySection } from '../components/SettingVisibilitySection';
import { useWidgetSettingsSection } from '../hooks/useWidgetSettingsSection';

export const InformationBarSettings = () => {
  const { settings, setSettings, activeTab, setActiveTab } =
    useWidgetSettingsSection('infobar');

  return (
    <BaseSettingsSection
      title="Information Bar"
      description="A standalone bar displaying session and timing information."
      settings={settings}
      onSettingsChange={setSettings}
      widgetType="infobar"
    >
      {(handleConfigChange, handleVisibilityConfigChange) => (
        <div className="space-y-4">
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="display"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Display
            </TabButton>
            <TabButton
              id="styling"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Styling
            </TabButton>
            <TabButton
              id="visibility"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Visibility
            </TabButton>
          </div>

          <div className="pt-4 space-y-4">
            {activeTab === 'display' && (
              <SettingsSection title="Display Order">
                <p className="text-xs text-slate-400 px-4 mb-4">
                  Enable and reorder items for the information bar.
                </p>
                <SessionBarItemsList
                  items={settings.config.displayOrder}
                  onReorder={(newOrder) =>
                    handleConfigChange({ displayOrder: newOrder })
                  }
                  getItemConfig={(id) => {
                    const item =
                      settings.config[id as keyof typeof settings.config];
                    if (
                      typeof item === 'object' &&
                      item !== null &&
                      'enabled' in item
                    ) {
                      return item as SessionBarItemConfig;
                    }
                    return undefined;
                  }}
                  updateItemConfig={(id, config) => {
                    const item =
                      settings.config[id as keyof typeof settings.config];
                    if (
                      typeof item === 'object' &&
                      item !== null &&
                      'enabled' in item
                    ) {
                      handleConfigChange({
                        [id]: {
                          ...(item as SessionBarItemConfig),
                          ...config,
                        },
                      });
                    }
                  }}
                />
                <div className="mt-4">
                  <SettingActionButton
                    label="Reset to Default Order"
                    onClick={() =>
                      handleConfigChange({
                        displayOrder: [...DEFAULT_SESSION_BAR_DISPLAY_ORDER],
                      })
                    }
                  />
                </div>
              </SettingsSection>
            )}

            {activeTab === 'styling' && (
              <SettingsSection title="Background">
                <SettingSliderRow
                  title="Background Opacity"
                  value={settings.config.background?.opacity ?? 70}
                  units="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v } })
                  }
                />
              </SettingsSection>
            )}

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
