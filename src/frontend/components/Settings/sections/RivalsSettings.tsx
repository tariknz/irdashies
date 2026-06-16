import { useState, useEffect } from 'react';
import { useDashboard } from '@irdashies/context';
import { RivalsWidgetSettings, SettingsTabType, getWidgetDefaultConfig } from '@irdashies/types';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingDivider } from '../components/SettingDivider';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { RIVAL_COLUMN_IDS, RIVAL_COLUMN_META, RivalColumnId } from '../../Rivals/RivalsRow';

const SETTING_ID = 'rivals';
const defaultConfig = getWidgetDefaultConfig('rivals');

interface SortableSetting {
  id: RivalColumnId;
  label: string;
}

const sortableSettings: SortableSetting[] = [
  { id: 'gap', label: 'Gap' },
  { id: 'lastTime', label: 'Last Lap' },
  { id: 'lastTimeDiff', label: 'Last Lap Delta' },
  { id: 'bestTime', label: 'Best Lap' },
  { id: 'bestTimeDiff', label: 'Best Lap Delta' },
];

export const RivalsSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RivalsWidgetSettings | undefined;

  const [settings, setSettings] = useState<RivalsWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as RivalsWidgetSettings['config']) ?? defaultConfig,
  });

  const [itemsOrder, setItemsOrder] = useState<RivalColumnId[]>(() => {
    const validIds = new Set(RIVAL_COLUMN_IDS);
    const saved = settings.config.displayOrder ?? [];
    const filtered = saved.filter((id): id is RivalColumnId =>
      validIds.has(id as RivalColumnId)
    );
    const present = new Set(filtered);
    const missing = RIVAL_COLUMN_IDS.filter((id) => !present.has(id));
    return [...filtered, ...missing];
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('rivalsTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('rivalsTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Rivals"
      description="Show the nearest same-class car ahead and behind you, with configurable columns."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const config = settings.config;

        const handleDisplayOrderChange = (newOrder: RivalColumnId[]) => {
          setItemsOrder(newOrder);
          handleConfigChange({ displayOrder: newOrder });
        };

        return (
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
            </div>

            <div>
              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <SettingsSection title="Column Order">
                  <SortableList
                    items={itemsOrder.map((id) => ({
                      id,
                      label: RIVAL_COLUMN_META[id].header,
                    }))}
                    onReorder={(newItems) =>
                      handleDisplayOrderChange(
                        newItems.map((i) => i.id as RivalColumnId)
                      )
                    }
                    renderItem={(item, sortableProps) => {
                      const colId = item.id as RivalColumnId;
                      const colConfig = config[colId] as { enabled: boolean };
                      const setting = sortableSettings.find(
                        (s) => s.id === colId
                      );
                      return (
                        <DraggableSettingItem
                          key={colId}
                          label={setting?.label ?? item.label}
                          enabled={colConfig.enabled}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              [colId]: { enabled },
                            })
                          }
                          sortableProps={sortableProps}
                        />
                      );
                    }}
                  />

                  <SettingActionButton
                    label="Reset to Default Order"
                    onClick={() => {
                      const defaultOrder = [...RIVAL_COLUMN_IDS];
                      setItemsOrder(defaultOrder);
                      handleConfigChange({ displayOrder: defaultOrder });
                    }}
                  />
                </SettingsSection>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <>
                  <SettingsSection title="Header">
                    <SettingToggleRow
                      title="Show Header"
                      description="Show column names above the rival rows"
                      enabled={config.showHeader?.enabled ?? false}
                      onToggle={(enabled) =>
                        handleConfigChange({ showHeader: { enabled } })
                      }
                    />
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Sector Deltas">
                    <SettingToggleRow
                      title="Show Sector Deltas"
                      description="Display per-sector time differences below each rival row"
                      enabled={config.sectors?.enabled ?? false}
                      onToggle={(enabled) =>
                        handleConfigChange({ sectors: { enabled } })
                      }
                    />
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Appearance">
                    <SettingSliderRow
                      title="Background Opacity"
                      value={config.background.opacity}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({ background: { opacity: v } })
                      }
                    />
                    <SettingSelectRow
                      title="Time Format"
                      description="Decimal precision for delta and sector delta values."
                      value={config.timeFormat ?? 'seconds-full'}
                      options={[
                        { label: '42.123', value: 'seconds-full' },
                        { label: '42.12', value: 'seconds-2' },
                        { label: '42.1', value: 'seconds-mixed' },
                      ]}
                      onChange={(v) => handleConfigChange({ timeFormat: v })}
                    />
                  </SettingsSection>

                  <SettingDivider />

                  <SettingsSection title="Visibility">
                    <SettingToggleRow
                      title="Show only when on track"
                      enabled={config.showOnlyWhenOnTrack ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({ showOnlyWhenOnTrack: newValue })
                      }
                    />
                    <SessionVisibility
                      sessionVisibility={config.sessionVisibility}
                      handleConfigChange={handleConfigChange}
                    />
                  </SettingsSection>
                </>
              )}
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
