import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  RelativeWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { TabButton } from '../components/TabButton';
import { SortableList } from '../../SortableList';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { DEFAULT_SESSION_BAR_DISPLAY_ORDER } from '../sessionBarConstants';
import { SessionVisibility } from '../components/SessionVisibility';
import { DriverNamePreview } from '../components/DriverNamePreview';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingProp, SettingProps } from '../components/SettingProp';
import {
  SessionBarItemsList,
  SessionBarItemConfig,
} from '../components/SessionBarItemsList';

const SETTING_ID = 'relative';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof RelativeWidgetSettings['config'];
  hasSubSetting?: boolean;
}

const sortableSettings: SortableSetting[] = [
  { id: 'position', label: 'Position', configKey: 'position' },
  { id: 'carNumber', label: 'Car Number', configKey: 'carNumber' },
  { id: 'countryFlags', label: 'Country Flags', configKey: 'countryFlags' },
  {
    id: 'driverName',
    label: 'Driver Name',
    configKey: 'driverName',
    hasSubSetting: true,
  },
  { id: 'teamName', label: 'Team Name', configKey: 'teamName' },
  {
    id: 'pitStatus',
    label: 'Pit Status',
    configKey: 'pitStatus',
    hasSubSetting: true,
  },
  {
    id: 'carManufacturer',
    label: 'Car Manufacturer',
    configKey: 'carManufacturer',
    hasSubSetting: true,
  },
  { id: 'driverTag', label: 'Driver Tag', configKey: 'driverTag' },
  { id: 'badge', label: 'Driver Badge', configKey: 'badge' },
  { id: 'iratingChange', label: 'iRating Change', configKey: 'iratingChange' },
  {
    id: 'positionChange',
    label: 'Position Change',
    configKey: 'positionChange',
  },
  { id: 'delta', label: 'Relative', configKey: 'delta' },
  { id: 'fastestTime', label: 'Best Time', configKey: 'fastestTime' },
  { id: 'lastTime', label: 'Last Time', configKey: 'lastTime' },
  { id: 'compound', label: 'Tire Compound', configKey: 'compound' },
  {
    id: 'lapTimeDeltas',
    label: 'Lap Delta',
    configKey: 'lapTimeDeltas',
    hasSubSetting: true,
  },
  { id: 'pushToPass', label: 'Push to Pass', configKey: 'pushToPass' },
];

const defaultConfig = getWidgetDefaultConfig('relative');

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: RelativeWidgetSettings;
  handleConfigChange: (
    changes: Partial<RelativeWidgetSettings['config']>
  ) => void;
}

const DisplaySettingsList = ({
  itemsOrder,
  onReorder,
  settings,
  handleConfigChange,
}: DisplaySettingsListProps) => {
  const items = itemsOrder
    .map((id) => {
      const setting = sortableSettings.find((s) => s.id === id);
      return setting ? { ...setting } : null;
    })
    .filter((s): s is SortableSetting => s !== null);

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
            {setting.configKey === 'badge' &&
              (configValue as { enabled: boolean }).enabled && (
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
                        selected={
                          (
                            configValue as {
                              enabled: boolean;
                              badgeFormat: string;
                            }
                          ).badgeFormat === format
                        }
                        onClick={() => {
                          const cv = settings.config[setting.configKey] as {
                            enabled: boolean;
                            badgeFormat: string;
                            [key: string]: unknown;
                          };
                          handleConfigChange({
                            [setting.configKey]: { ...cv, badgeFormat: format },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {setting.configKey === 'driverName' &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-3 justify-end">
                    {(
                      [
                        'name-middlename-surname',
                        'name-m.-surname',
                        'name-surname',
                        'n.-surname',
                        'surname-n.',
                        'surname',
                      ] as const
                    ).map((format) => (
                      <DriverNamePreview
                        key={format}
                        format={format}
                        selected={
                          (
                            configValue as {
                              enabled: boolean;
                              nameFormat: string;
                            }
                          ).nameFormat === format
                        }
                        onClick={() => {
                          const cv = settings.config[setting.configKey] as {
                            enabled: boolean;
                            nameFormat: string;
                            [key: string]: unknown;
                          };
                          handleConfigChange({
                            [setting.configKey]: { ...cv, nameFormat: format },
                          });
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            {(setting.configKey === 'fastestTime' ||
              setting.configKey === 'lastTime') &&
              (configValue as { enabled: boolean }).enabled && (
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-slate-300"></span>
                  <select
                    value={
                      (configValue as { enabled: boolean; timeFormat: string })
                        .timeFormat
                    }
                    onChange={(e) => {
                      const cv = settings.config[setting.configKey] as {
                        enabled: boolean;
                        timeFormat: string;
                        [key: string]: unknown;
                      };
                      handleConfigChange({
                        [setting.configKey]: {
                          ...cv,
                          timeFormat: e.target.value as
                            | 'full'
                            | 'mixed'
                            | 'minutes'
                            | 'seconds-full'
                            | 'seconds-mixed'
                            | 'seconds',
                        },
                      });
                    }}
                    className="bg-slate-700 text-white rounded-md px-2 py-1"
                  >
                    <option value="full">1:42.123</option>
                    <option value="mixed">1:42.1</option>
                    <option value="minutes">1:42</option>
                    <option value="seconds-full">42.123</option>
                    <option value="seconds-mixed">42.1</option>
                    <option value="seconds">42</option>
                  </select>
                </div>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'pitStatus' &&
              settings.config.pitStatus.enabled && (
                <>
                  <SettingProp path="pitStatus.showPitTime" variant="compact" />
                  <SettingProp
                    path="pitStatus.pitLapDisplayMode"
                    variant="compact"
                  />
                </>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'driverName' &&
              settings.config.driverName.enabled && (
                <>
                  <SettingProp
                    path="driverName.removeNumbersFromName"
                    variant="compact"
                  />
                  <SettingProp
                    path="driverName.showStatusBadges"
                    variant="compact"
                  />
                </>
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'carManufacturer' &&
              settings.config.carManufacturer.enabled && (
                <SettingProp
                  path="carManufacturer.hideIfSingleMake"
                  variant="compact"
                />
              )}
            {setting.hasSubSetting &&
              setting.configKey === 'lapTimeDeltas' &&
              settings.config.lapTimeDeltas.enabled && (
                <>
                  <SettingProp path="lapTimeDeltas.numLaps" variant="compact" />
                  <SettingProp
                    path="lapTimeDeltas.decimalPlaces"
                    variant="compact"
                  />
                </>
              )}
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const RelativeSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RelativeWidgetSettings | undefined;
  const [settings, setSettings] = useState<RelativeWidgetSettings>({
    enabled: savedSettings?.enabled ?? true,
    config:
      (savedSettings?.config as RelativeWidgetSettings['config']) ??
      defaultConfig,
  });
  const [itemsOrder, setItemsOrder] = useState(() => {
    const validIds = new Set(sortableSettings.map((s) => s.id));
    const saved = settings.config.displayOrder ?? [];
    const filtered = saved.filter((id) => validIds.has(id));
    const present = new Set(filtered);
    const missing = sortableSettings
      .filter((s) => !present.has(s.id))
      .map((s) => s.id);
    return [...filtered, ...missing];
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('relativeTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('relativeTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Relative"
      description="Configure the relative timing display settings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="relative"
    >
      {(handleConfigChange) => {
        const handleDisplayOrderChange = (newOrder: string[]) => {
          setItemsOrder(newOrder);
          handleConfigChange({ displayOrder: newOrder });
        };

        return (
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
                  id="header"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Header
                </TabButton>
                <TabButton
                  id="footer"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Footer
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

              <div>
                {/* DISPLAY TAB */}
                {activeTab === 'display' && (
                  <SettingsSection title="Display Order">
                    <DisplaySettingsList
                      itemsOrder={itemsOrder}
                      onReorder={handleDisplayOrderChange}
                      settings={settings}
                      handleConfigChange={handleConfigChange}
                    />

                    <SettingActionButton
                      label="Reset to Default Order"
                      onClick={() => {
                        const defaultOrder = sortableSettings.map((s) => s.id);
                        setItemsOrder(defaultOrder);
                        handleConfigChange({ displayOrder: defaultOrder });
                      }}
                    />
                  </SettingsSection>
                )}

                {/* OPTIONS TAB */}
                {activeTab === 'options' && (
                  <>
                    <SettingsSection title="Driver Standings">
                      <SettingProp path="buffer" />
                      <SettingProp path="useLivePosition" />
                      <SettingProp path="radio.persistenceSeconds" />
                    </SettingsSection>

                    <SettingDivider />

                    <SettingsSection title="Title Bar">
                      <SettingProp path="titleBar.enabled" />

                      {settings.config.titleBar.enabled && (
                        <SettingsSection>
                          <SettingProp path="titleBar.progressBar.enabled" />
                        </SettingsSection>
                      )}
                    </SettingsSection>

                    <SettingDivider />

                    <SettingsSection title="Background">
                      <SettingProp path="background.opacity" />
                      <SettingProp path="foreground.opacity" />
                    </SettingsSection>

                    <SettingDivider />

                    <SettingsSection title="Relative Time">
                      <SettingProp path="delta.precision" />
                    </SettingsSection>
                  </>
                )}

                {/* HEADER TAB */}
                {activeTab === 'header' && (
                  <SettingsSection title="Header Bar">
                    <SettingProp path="headerBar.enabled" />

                    {settings.config.headerBar.enabled && (
                      <SettingsSection>
                        <SessionBarItemsList
                          items={settings.config.headerBar.displayOrder}
                          onReorder={(newOrder) => {
                            handleConfigChange({
                              headerBar: {
                                ...settings.config.headerBar,
                                displayOrder: newOrder,
                              },
                            });
                          }}
                          getItemConfig={(id) => {
                            const item =
                              settings.config.headerBar[
                                id as keyof typeof settings.config.headerBar
                              ];
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
                              settings.config.headerBar[
                                id as keyof typeof settings.config.headerBar
                              ];
                            if (
                              typeof item === 'object' &&
                              item !== null &&
                              'enabled' in item
                            ) {
                              handleConfigChange({
                                headerBar: {
                                  ...settings.config.headerBar,
                                  [id]: {
                                    ...(item as SessionBarItemConfig),
                                    ...config,
                                  },
                                },
                              });
                            }
                          }}
                        />

                        <SettingActionButton
                          label="Reset to Default Order"
                          onClick={() => {
                            handleConfigChange({
                              headerBar: {
                                ...settings.config.headerBar,
                                displayOrder: [
                                  ...DEFAULT_SESSION_BAR_DISPLAY_ORDER,
                                ],
                              },
                            });
                          }}
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>
                )}

                {/* FOOTER TAB */}
                {activeTab === 'footer' && (
                  <SettingsSection title="Footer Bar">
                    <SettingProp path="footerBar.enabled" />

                    {settings.config.footerBar.enabled && (
                      <SettingsSection>
                        <SessionBarItemsList
                          items={settings.config.footerBar.displayOrder}
                          onReorder={(newOrder) => {
                            handleConfigChange({
                              footerBar: {
                                ...settings.config.footerBar,
                                displayOrder: newOrder,
                              },
                            });
                          }}
                          getItemConfig={(id) => {
                            const item =
                              settings.config.footerBar[
                                id as keyof typeof settings.config.footerBar
                              ];
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
                              settings.config.footerBar[
                                id as keyof typeof settings.config.footerBar
                              ];
                            if (
                              typeof item === 'object' &&
                              item !== null &&
                              'enabled' in item
                            ) {
                              handleConfigChange({
                                footerBar: {
                                  ...settings.config.footerBar,
                                  [id]: {
                                    ...(item as SessionBarItemConfig),
                                    ...config,
                                  },
                                },
                              });
                            }
                          }}
                        />

                        <SettingActionButton
                          label="Reset to Default Order"
                          onClick={() => {
                            handleConfigChange({
                              footerBar: {
                                ...settings.config.footerBar,
                                displayOrder: [
                                  ...DEFAULT_SESSION_BAR_DISPLAY_ORDER,
                                ],
                              },
                            });
                          }}
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>
                )}

                {/* STYLING TAB */}
                {activeTab === 'styling' && (
                  <>
                    <SettingsSection title="Driver Position">
                      <SettingProp path="stylingOptions.driverPosition.background" />
                    </SettingsSection>

                    <SettingDivider />

                    <SettingsSection title="Car Number">
                      <SettingProp path="stylingOptions.driverNumber.background" />
                      <SettingProp path="stylingOptions.driverNumber.border" />
                    </SettingsSection>

                    <SettingDivider />

                    <SettingsSection title="Badges">
                      <SettingProp path="stylingOptions.badge" />
                      <SettingProp path="stylingOptions.statusBadges" />
                    </SettingsSection>

                    <SettingDivider />

                    <SettingsSection title="Flag Contour">
                      <SettingProp path="stylingOptions.flagContour.enabled" />
                      {settings.config.stylingOptions?.flagContour?.enabled && (
                        <SettingProp path="stylingOptions.flagContour.borderWidth" />
                      )}
                    </SettingsSection>
                  </>
                )}

                {/* VISIBILITY TAB */}
                {activeTab === 'visibility' && (
                  <SettingsSection title="Session Visibility">
                    <SessionVisibility
                      sessionVisibility={settings.config.sessionVisibility}
                      handleConfigChange={handleConfigChange}
                    />

                    <SettingDivider />

                    <SettingProp path="showOnlyWhenOnTrack" />

                    <SettingProp path="hideDriversInPitStall" />
                  </SettingsSection>
                )}
              </div>
            </div>
          </SettingProps>
        );
      }}
    </BaseSettingsSection>
  );
};
