import { useStoredTab } from '../hooks/useStoredTab';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  ShiftLightWidgetSettings,
  getWidgetDefaultConfig,
  type ShiftPointSettings,
} from '@irdashies/types';
import { useDashboard, useSessionStore } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { TabButton } from '../components/TabButton';
import { SettingsTabBar } from '../components/SettingsTabBar';
import { SettingProps, settingPropFor } from '../components/SettingProp';
import {
  CustomShiftPointsSection,
  DEFAULT_SHIFT_RPM_RATIO,
} from '../components/CustomShiftPointsSection';

const SETTING_ID = 'shiftlight';
const SettingProp = settingPropFor(SETTING_ID);

/**
 * The car being driven, when the sim names it by model.
 *
 * The car list comes from the bundled iRacing car data, so an LMU car can
 * never be picked from it. LMU sets CarModel, which is also the key the widget
 * looks custom shift points up by there (see useTachometerData), and the
 * session already holds what a new entry needs: the rev limit, the gear count
 * and the shift point the bridge settled on for that car.
 */
const useCurrentModelCar = () => {
  const carId = useSessionStore((state) => {
    const info = state.session?.DriverInfo;
    return info?.Drivers?.find((d) => d.CarIdx === info.DriverCarIdx)?.CarModel;
  });
  const redlineRpm = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarRedLine
  );
  const gearCount = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarGearNumForward
  );
  const shiftRpm = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarSLShiftRPM
  );
  if (!carId) return undefined;
  const redline = redlineRpm || 8000;
  return {
    carId,
    redlineRpm: redline,
    gearCount: gearCount || 6,
    shiftRpm: shiftRpm || Math.round(redline * DEFAULT_SHIFT_RPM_RATIO),
  };
};

const ShiftLightShiftPoints = ({
  shiftPoints,
  onChange,
}: {
  shiftPoints: ShiftPointSettings;
  onChange: (shiftPoints: ShiftPointSettings) => void;
}) => {
  const currentModelCar = useCurrentModelCar();
  return (
    <CustomShiftPointsSection
      shiftPoints={shiftPoints}
      onChange={onChange}
      enableDescription="If enabled, custom shift points will be displayed"
      currentModelCar={currentModelCar}
    />
  );
};

const defaultConfig = getWidgetDefaultConfig('shiftlight');

export const ShiftLightSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as ShiftLightWidgetSettings | undefined;
  const settings: ShiftLightWidgetSettings = {
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as ShiftLightWidgetSettings['config']) ??
      defaultConfig,
  };

  const [activeTab, setActiveTab] = useStoredTab('shiftlightTab', [
    'display',
    'options',
    'visibility',
  ]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Shift Light"
      description="Configure the Shift Light. Hint: enable 'Show RPM Text' to see where the box is."
      settings={settings}
      widgetId="shiftlight"
    >
      {(handleConfigChange) => {
        const config = settings.config;

        return (
          <SettingProps
            widget={SETTING_ID}
            config={settings.config}
            onChange={handleConfigChange}
          >
            <div className="space-y-6">
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
                  id="options"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Custom Shift Points
                </TabButton>
                <TabButton
                  id="visibility"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  Visibility
                </TabButton>
              </SettingsTabBar>

              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <>
                  <SettingsSection title="Display" scaleWidgetId="shiftlight">
                    <SettingProp path="background.opacity" />

                    <SettingProp path="showRpmText" />
                  </SettingsSection>
                </>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Custom Shift Points">
                  <ShiftLightShiftPoints
                    shiftPoints={config.shiftPointSettings}
                    onChange={(shiftPointSettings) =>
                      handleConfigChange({ shiftPointSettings })
                    }
                  />
                </SettingsSection>
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
          </SettingProps>
        );
      }}
    </BaseSettingsSection>
  );
};
