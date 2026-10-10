import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  BattleWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingProp, SettingProps } from '../components/SettingProp';

const SETTING_ID = 'battle';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof BattleWidgetSettings['config'];
  hasSubSetting?: boolean;
}

const sortableSettings: SortableSetting[] = [
  { id: 'position', label: 'Position', configKey: 'position' },
  { id: 'carNumber', label: 'Car Number', configKey: 'carNumber' },
  { id: 'driverName', label: 'Driver Name', configKey: 'driverName' },
  { id: 'stint', label: 'Stint', configKey: 'stint' },
  {
    id: 'lastTime',
    label: 'Last Time',
    configKey: 'lastTime',
    hasSubSetting: true,
  },
  {
    id: 'speed',
    label: 'Speed',
    configKey: 'speed',
    hasSubSetting: true,
  },
  {
    id: 'gap',
    label: 'Gap / Prev / Delta',
    configKey: 'gap',
    hasSubSetting: true,
  },
];

const defaultConfig = getWidgetDefaultConfig('battle');

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: BattleWidgetSettings;
  handleConfigChange: (
    changes: Partial<BattleWidgetSettings['config']>
  ) => void;
}

const DisplaySettingsList = ({
  itemsOrder,
  onReorder,
  settings,
  handleConfigChange,
}: DisplaySettingsListProps) => {
  const items = itemsOrder
    .map((id) => sortableSettings.find((s) => s.id === id))
    .filter((s): s is SortableSetting => s != null);

  return (
    <SortableList
      items={items}
      onReorder={(newItems) => onReorder(newItems.map((i) => i.id))}
      renderItem={(setting, sortableProps) => {
        const configValue = settings.config[setting.configKey];
        const isEnabled = (configValue as { enabled: boolean }).enabled;

        return (
          <DraggableSettingItem
            key={setting.id}
            label={setting.label}
            enabled={isEnabled}
            onToggle={(enabled) => {
              const cv = settings.config[setting.configKey] as {
                enabled: boolean;
                [key: string]: unknown;
              };
              handleConfigChange({
                [setting.configKey]: { ...cv, enabled },
              });
            }}
            sortableProps={sortableProps}
          >
            {setting.hasSubSetting &&
              setting.configKey === 'lastTime' &&
              settings.config.lastTime.enabled && (
                <div className="pl-8 mt-2">
                  <SettingProp path="lastTime.timeFormat" />
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'speed' &&
              settings.config.speed.enabled && (
                <div className="pl-8 mt-2">
                  <SettingProp path="speed.unit" />
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'gap' &&
              settings.config.gap.enabled && (
                <div className="pl-8 mt-2">
                  <SettingProp path="gap.decimalPlaces" />
                </div>
              )}
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const BattleSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BattleWidgetSettings | undefined;

  const [settings, setSettings] = useState<BattleWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as BattleWidgetSettings['config']) ??
      defaultConfig,
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('battleTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('battleTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Battle"
      description="Shows the cars immediately ahead and behind the player with gap information"
      settings={settings as BattleWidgetSettings}
      onSettingsChange={(s) => setSettings(s as BattleWidgetSettings)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
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
              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <SettingsSection title="Columns">
                  <DisplaySettingsList
                    itemsOrder={
                      settings.config.displayOrder ?? defaultConfig.displayOrder
                    }
                    onReorder={(newOrder) =>
                      handleConfigChange({ displayOrder: newOrder })
                    }
                    settings={settings}
                    handleConfigChange={handleConfigChange}
                  />
                </SettingsSection>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Options">
                  <SettingProp path="background.opacity" />

                  <SettingDivider />

                  <SettingProp path="showOnlyWhenOnTrack" />
                </SettingsSection>
              )}

              {/* VISIBILITY TAB */}
              {activeTab === 'visibility' && (
                <SettingsSection title="Session Visibility">
                  <SessionVisibility
                    sessionVisibility={settings.config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
