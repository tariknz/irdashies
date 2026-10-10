import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  InformationBarWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SettingsSection } from '../components/SettingSection';
import { SettingActionButton } from '../components/SettingActionButton';
import {
  SessionBarItemsList,
  SessionBarItemConfig,
} from '../components/SessionBarItemsList';
import { SessionVisibility } from '../components/SessionVisibility';
import { DEFAULT_SESSION_BAR_DISPLAY_ORDER } from '../sessionBarConstants';
import { SettingDivider } from '../components/SettingDivider';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'infobar';
const defaultConfig = getWidgetDefaultConfig('infobar');

export const InformationBarSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as InformationBarWidgetSettings | undefined;

  const [settings, setSettings] = useState<InformationBarWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as InformationBarWidgetSettings['config']) ??
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('infobarTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('infobarTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Information Bar"
      description="A standalone bar displaying session and timing information."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="infobar"
    >
      {(handleConfigChange) => (
        <SettingProps
          widget="infobar"
          config={settings.config}
          onChange={handleConfigChange}
        >
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
                  <SettingProp path="background.opacity" />
                  <SettingProp path="foreground.opacity" />
                </SettingsSection>
              )}

              {activeTab === 'visibility' && (
                <SettingsSection title="Session Visibility">
                  <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />

                  <SettingDivider />

                  <SettingProp path="showOnlyWhenOnTrack" />
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
