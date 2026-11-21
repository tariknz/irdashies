import { useStoredTab } from '../hooks/useStoredTab';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  FasterCarsFromBehindWidgetSettings,
  type StandingsBadgeFormat,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { BadgeFormatPreview } from '../components/BadgeFormatPreview';
import { FormatSelect } from '../components/FormatSelect';
import { DraggableSettingItem } from '../components/DraggableSettingItem';
import { SettingActionButton } from '../components/SettingActionButton';
import { SortableList } from '../../SortableList';
import { useDashboard } from '@irdashies/context';
import { useFasterCarsSettings } from '../../FasterCarsFromBehind/hooks/useFasterCarsSettings';
import {
  FASTER_CARS_DISPLAY_ITEMS,
  normalizeFasterCarsDisplayOrder,
  type FasterCarsDisplayItem,
} from '../../FasterCarsFromBehind/displayOrder';
import { TabButton } from '../components/TabButton';
import { SettingsTabBar } from '../components/SettingsTabBar';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'fastercarsfrombehind';
const SettingProp = settingPropFor(SETTING_ID);

type FasterCarsConfig = FasterCarsFromBehindWidgetSettings['config'];

const IRACING_BADGE_FORMATS = [
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
] as const satisfies readonly StandingsBadgeFormat[];

type IRacingBadgeFormat = (typeof IRACING_BADGE_FORMATS)[number];

interface DisplayItemSetting {
  id: FasterCarsDisplayItem;
  label: string;
  configKey: 'showName' | 'showBadge' | 'showDistance';
}

const DISPLAY_ITEM_SETTINGS: Record<FasterCarsDisplayItem, DisplayItemSetting> =
  {
    driverName: {
      id: 'driverName',
      label: 'Driver Name',
      configKey: 'showName',
    },
    badge: { id: 'badge', label: 'Rating', configKey: 'showBadge' },
    distance: { id: 'distance', label: 'Distance', configKey: 'showDistance' },
  };

interface DisplaySettingsListProps {
  config: FasterCarsConfig;
  handleConfigChange: (changes: Partial<FasterCarsConfig>) => void;
}

const DisplaySettingsList = ({
  config,
  handleConfigChange,
}: DisplaySettingsListProps) => {
  const items = normalizeFasterCarsDisplayOrder(config.displayOrder).map(
    (id) => DISPLAY_ITEM_SETTINGS[id]
  );

  return (
    <SortableList
      items={items}
      onReorder={(newItems) =>
        handleConfigChange({ displayOrder: newItems.map((item) => item.id) })
      }
      renderItem={(setting, sortableProps) => {
        const isEnabled = !!config[setting.configKey];

        return (
          <DraggableSettingItem
            key={setting.id}
            label={setting.label}
            enabled={isEnabled}
            onToggle={(enabled) =>
              handleConfigChange({ [setting.configKey]: enabled })
            }
            sortableProps={sortableProps}
          >
            {setting.id === 'driverName' && isEnabled && (
              <SettingProp path="removeNumbersFromName" variant="compact" />
            )}
            {setting.id === 'badge' && isEnabled && (
              <div className="mt-2 flex flex-wrap items-center gap-4 pl-8">
                <FormatSelect
                  label="iRacing"
                  value={config.badgeFormat as IRacingBadgeFormat}
                  options={IRACING_BADGE_FORMATS}
                  renderOption={(format) => (
                    <BadgeFormatPreview format={format} />
                  )}
                  onChange={(badgeFormat) =>
                    handleConfigChange({ badgeFormat })
                  }
                />
              </div>
            )}
          </DraggableSettingItem>
        );
      }}
    />
  );
};

export const FasterCarsFromBehindSettings = () => {
  const { currentDashboard } = useDashboard();
  const fasterCarsSettings = useFasterCarsSettings();
  const settings: FasterCarsFromBehindWidgetSettings = {
    enabled:
      currentDashboard?.widgets.find((w) => w.id === SETTING_ID)?.enabled ??
      false,
    config: fasterCarsSettings as FasterCarsFromBehindWidgetSettings['config'],
  };

  const [activeTab, setActiveTab] = useStoredTab('fasterCarsFromBehindTab', [
    'display',
    'visibility',
  ]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Faster Cars From Behind"
      description="Configure settings for the faster cars detection widget."
      settings={settings}
      widgetId="fastercarsfrombehind"
    >
      {(handleConfigChange) => (
        <SettingProps
          widget={SETTING_ID}
          config={settings.config}
          onChange={handleConfigChange}
        >
          <div className="space-y-4">
            {/* Tabs */}
            <SettingsTabBar>
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
            </SettingsTabBar>

            <div>
              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <>
                  <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                    <h4 className="text-md font-medium text-slate-200">
                      Display Order
                    </h4>
                    <DisplaySettingsList
                      config={settings.config}
                      handleConfigChange={handleConfigChange}
                    />

                    <SettingActionButton
                      label="Reset to Default Order"
                      onClick={() =>
                        handleConfigChange({
                          displayOrder: [...FASTER_CARS_DISPLAY_ITEMS],
                        })
                      }
                    />

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
                      onChange={(v) =>
                        handleConfigChange({ distanceThreshold: v })
                      }
                    />

                    <SettingProp path="numberDriversBehind" />

                    <SettingProp path="alignDriverBoxes" />

                    <SettingProp path="closestDriverBox" />

                    {/* Only Show Faster Classes Section */}
                    <SettingProp path="onlyShowFasterClasses" />
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
                </SettingsSection>
              )}
            </div>
          </div>
        </SettingProps>
      )}
    </BaseSettingsSection>
  );
};
