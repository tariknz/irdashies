import { t } from '@irdashies/frontend/i18n';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useState, useEffect, useId } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  ShiftLightWidgetSettings,
  getWidgetDefaultConfig,
  SettingsTabType,
} from '@irdashies/types';
import { useDashboard, useSessionStore } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SessionVisibility } from '../components/SessionVisibility';
import { getAvailableCars } from '../../../utils/carData';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { TabButton } from '../components/TabButton';
import logger from '@irdashies/utils/logger';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'shiftlight';
const SettingProp = settingPropFor(SETTING_ID);

// Constants for shift points
const DEFAULT_SHIFT_RPM_RATIO = 0.9;
const MIN_SHIFT_RPM = 1000;

// TypeScript interfaces for GitHub API responses
interface CarListItem {
  carId: string;
  carName: string;
  ledNumber: number;
  ledRpm: object[];
}

interface CurrentModelCar {
  carId: string;
  redlineRpm: number;
  gearCount: number;
  shiftRpm: number;
}

/**
 * The car being driven, when the sim names it by model.
 *
 * The car list comes from the bundled iRacing car data, so an LMU car can
 * never be picked from it. LMU sets CarModel, which is also the key the widget
 * looks custom shift points up by there (see useTachometerData), and the
 * session already holds what a new entry needs: the rev limit, the gear count
 * and the shift point the bridge settled on for that car.
 */
const useCurrentModelCar = (): CurrentModelCar | undefined => {
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

/**
 * Custom shift points configuration section
 */
const CustomShiftPointsSection = ({
  config,
  handleConfigChange,
}: {
  config: ShiftLightWidgetSettings['config'];
  handleConfigChange: (
    changes: Partial<ShiftLightWidgetSettings['config']>
  ) => void;
}) => {
  const fieldId = useId();
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const [availableCars, setAvailableCars] = useState<CarListItem[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>(
    {}
  );

  const customShiftPoints = config.shiftPointSettings;
  const currentModelCar = useCurrentModelCar();

  const updateCustomShiftPoints = (
    updates: Partial<typeof customShiftPoints>
  ) => {
    handleConfigChange({
      shiftPointSettings: {
        ...customShiftPoints,
        ...updates,
      },
    });
  };

  useEffect(() => {
    const loadAvailableCars = () => {
      if (!customShiftPoints.enabled || availableCars.length > 0) return;

      setLoading(true);
      try {
        const allCars = getAvailableCars();
        const cars: CarListItem[] = allCars
          .map((car) => ({
            carId: car.carId,
            carName: car.carName,
            ledNumber: car.ledNumber,
            ledRpm: car.ledRpm,
          }))
          .sort((a, b) => a.carName.localeCompare(b.carName));

        setAvailableCars(cars);
      } catch (err) {
        logger.error('Failed to load cars:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load car data'
        );
      } finally {
        setLoading(false);
      }
    };

    loadAvailableCars();
  }, [customShiftPoints.enabled, availableCars.length]);

  const addCurrentModelCar = (car: CurrentModelCar) => {
    const gearShiftPoints: Record<string, { shiftRpm: number }> = {};
    for (let i = 1; i <= car.gearCount; i++) {
      gearShiftPoints[i.toString()] = { shiftRpm: car.shiftRpm };
    }
    updateCustomShiftPoints({
      carConfigs: {
        ...customShiftPoints.carConfigs,
        [car.carId]: {
          enabled: true,
          carId: car.carId,
          carName: car.carId,
          gearCount: car.gearCount,
          redlineRpm: car.redlineRpm,
          gearShiftPoints,
        },
      },
    });
    setSelectedCarId('');
  };

  const addCar = () => {
    if (currentModelCar && selectedCarId === currentModelCar.carId) {
      addCurrentModelCar(currentModelCar);
      return;
    }
    const selectedCar = availableCars.find((c) => c.carId === selectedCarId);
    if (!selectedCar) return;

    const ledRpmData = (selectedCar.ledRpm?.[0] || {}) as Record<
      string,
      number[]
    >;

    logger.info(JSON.stringify(selectedCar));

    let redlineRpm = 8000;
    if (selectedCar.ledRpm?.[0]) {
      const allRpms = Object.values(ledRpmData).flat();
      redlineRpm = Math.max(...allRpms);
    }

    const gearKeys = Object.keys(ledRpmData).filter(
      (key) =>
        key !== 'N' && key !== 'R' && !isNaN(Number(key)) && Number(key) > 0
    );

    const gearCount =
      gearKeys.length > 0 ? Math.max(...gearKeys.map(Number)) : 6;
    const gearShiftPoints: Record<string, { shiftRpm: number }> = {};
    const defaultShiftRpm = Math.round(redlineRpm * DEFAULT_SHIFT_RPM_RATIO);

    for (let i = 1; i <= gearCount; i++) {
      const gearKey = i.toString();
      const gearData = ledRpmData[gearKey];

      gearShiftPoints[gearKey] = {
        shiftRpm: gearData
          ? Math.max(...gearData)
          : Math.max(MIN_SHIFT_RPM, defaultShiftRpm),
      };
    }

    updateCustomShiftPoints({
      carConfigs: {
        ...customShiftPoints.carConfigs,
        [selectedCarId]: {
          enabled: true,
          carId: selectedCarId,
          carName: selectedCar.carName,
          gearCount,
          redlineRpm,
          gearShiftPoints,
        },
      },
    });

    setSelectedCarId('');
  };

  const toggleCar = (carId: string, enabled: boolean) => {
    updateCustomShiftPoints({
      carConfigs: {
        ...customShiftPoints.carConfigs,
        [carId]: {
          ...customShiftPoints.carConfigs[carId],
          enabled,
        },
      },
    });
  };

  const updateShiftPoint = (carId: string, gear: string, shiftRpm: number) => {
    const car = customShiftPoints.carConfigs[carId];
    if (!car) return;

    updateCustomShiftPoints({
      carConfigs: {
        ...customShiftPoints.carConfigs,
        [carId]: {
          ...car,
          gearShiftPoints: {
            ...car.gearShiftPoints,
            [gear]: { shiftRpm },
          },
        },
      },
    });
  };

  const deleteCar = (carId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [carId]: _removed, ...rest } = customShiftPoints.carConfigs;
    updateCustomShiftPoints({
      carConfigs: rest,
    });
  };

  const configuredCars = Object.values(customShiftPoints.carConfigs);
  const availableToAdd = availableCars.filter(
    (c) => !customShiftPoints.carConfigs[c.carId]
  );
  const canAddCurrentModelCar =
    !!currentModelCar && !customShiftPoints.carConfigs[currentModelCar.carId];

  return (
    <div className="space-y-3">
      <SettingToggleRow
        title={t('Enable Custom Shift Points')}
        description={t('If enabled, custom shift points will be displayed')}
        enabled={customShiftPoints.enabled ?? false}
        onToggle={(enabled) => updateCustomShiftPoints({ enabled })}
      />

      {configuredCars.length > 0 && (
        <div className="text-md text-slate-300">
          ({configuredCars.length} {t('cars)')}
        </div>
      )}

      {customShiftPoints.enabled && (
        <div className="space-y-4 border-slate-700 pl-4">
          {/* Demo Mode Info */}
          <div className="bg-slate-800/40 border border-slate-700 rounded p-3 text-xs">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-slate-200 mb-1">{t('Demo Mode Car')}</p>
                <p className="text-slate-400">
                  {t('Demo mode uses the')} <strong>{t('BMW M4 GT4')}</strong>{' '}
                  {t(
                    '(bmwm4gt4). Configure custom shift points for this car to test in demo mode.'
                  )}
                </p>
              </div>
            </div>
          </div>

          {/* Indicator Settings */}
          <div className="space-y-2">
            <label
              htmlFor={`${fieldId}-type`}
              className="text-sm text-slate-300"
            >
              {t('Indicator Type')}
            </label>
            <select
              id={`${fieldId}-type`}
              value={customShiftPoints.indicatorType}
              onChange={(e) =>
                updateCustomShiftPoints({
                  indicatorType: e.target.value as 'glow' | 'pulse' | 'border',
                })
              }
              className="settings-field w-full"
            >
              <option value="glow">{t('Glow')}</option>
              <option value="pulse">{t('Pulse')}</option>
              <option value="border">{t('Border')}</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${fieldId}-color`}
              className="text-sm text-slate-300"
            >
              {t('Indicator Color')}
            </label>
            <input
              type="color"
              id={`${fieldId}-color`}
              value={customShiftPoints.indicatorColor}
              onChange={(e) =>
                updateCustomShiftPoints({ indicatorColor: e.target.value })
              }
              className="h-9 w-14 rounded border border-settings-boundary bg-settings-control cursor-pointer"
            />
          </div>

          {/* Add Car */}
          <div className="space-y-2">
            <label
              htmlFor={`${fieldId}-car`}
              className="text-sm text-slate-300"
            >
              {t('Add Car')}
            </label>
            <div className="flex gap-2">
              <select
                id={`${fieldId}-car`}
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="settings-field flex-1"
                disabled={loading}
              >
                <option value="">{t('Select a car...')}</option>
                {canAddCurrentModelCar && (
                  <option value={currentModelCar.carId}>
                    {currentModelCar.carId} {t('(current car)')}
                  </option>
                )}
                {availableToAdd.map((car) => (
                  <option key={car.carId} value={car.carId}>
                    {car.carName}
                  </option>
                ))}
              </select>
              <button
                onClick={addCar}
                disabled={!selectedCarId || loading}
                className="settings-button-primary"
              >
                {t('Add')}
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Configured Cars */}
          {configuredCars.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-slate-400">
                {t('Configured Cars')}
              </label>
              <div className="space-y-2">
                {configuredCars.map((car) => (
                  <div
                    key={car.carId}
                    className="rounded-md border border-slate-700 p-3 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() =>
                            setExpandedCarId(
                              expandedCarId === car.carId ? null : car.carId
                            )
                          }
                          type="button"
                          aria-label={t('Shift points for {carName}', {
                            carName: car.carName,
                          })}
                          aria-expanded={expandedCarId === car.carId}
                          aria-controls={`${fieldId}-${car.carId}`}
                          className="settings-button h-9 w-9 shrink-0 p-0"
                        >
                          <span aria-hidden="true">
                            {expandedCarId === car.carId ? (
                              <CaretDownIcon size={16} />
                            ) : (
                              <CaretRightIcon size={16} />
                            )}
                          </span>
                        </button>
                        <span className="text-sm text-white">
                          {car.carName}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          ariaLabel={t(
                            'Enable custom shift points for {carName}',
                            { carName: car.carName }
                          )}
                          enabled={car.enabled}
                          onToggle={(enabled) => toggleCar(car.carId, enabled)}
                        />
                        <button
                          aria-label={t('Delete shift points for {carName}', {
                            carName: car.carName,
                          })}
                          onClick={() => deleteCar(car.carId)}
                          className="settings-button-danger"
                        >
                          {t('Delete')}
                        </button>
                      </div>
                    </div>

                    {expandedCarId === car.carId && (
                      <div
                        id={`${fieldId}-${car.carId}`}
                        className="space-y-3 pt-3 border-t border-slate-700"
                      >
                        <p className="text-xs text-slate-400">
                          {t('Redline:')} {car.redlineRpm} {t('RPM')}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(car.gearShiftPoints).map(
                            ([gear, { shiftRpm }]) => (
                              <div
                                key={gear}
                                className="flex items-center gap-2"
                              >
                                <label className="text-xs text-slate-400 w-12">
                                  {t('Gear')} {gear}:
                                </label>
                                <input
                                  aria-label={t(
                                    '{carName}, gear {gear} shift RPM',
                                    { carName: car.carName, gear }
                                  )}
                                  type="number"
                                  value={
                                    editingValues[`${car.carId}-${gear}`] ??
                                    shiftRpm
                                  }
                                  onChange={(e) => {
                                    const key = `${car.carId}-${gear}`;
                                    setEditingValues({
                                      ...editingValues,
                                      [key]: e.target.value,
                                    });
                                  }}
                                  onBlur={(e) => {
                                    const value = parseInt(e.target.value);
                                    if (
                                      !isNaN(value) &&
                                      value >= MIN_SHIFT_RPM
                                    ) {
                                      updateShiftPoint(car.carId, gear, value);
                                    }
                                    const key = `${car.carId}-${gear}`;
                                    setEditingValues(
                                      Object.fromEntries(
                                        Object.entries(editingValues).filter(
                                          ([k]) => k !== key
                                        )
                                      )
                                    );
                                  }}
                                  className="settings-field flex-1"
                                  min={MIN_SHIFT_RPM}
                                  max={car.redlineRpm}
                                />
                              </div>
                            )
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const defaultConfig = getWidgetDefaultConfig('shiftlight');

export const ShiftLightSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as ShiftLightWidgetSettings | undefined;
  const [settings, setSettings] = useState<ShiftLightWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as ShiftLightWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('shiftlightTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('shiftlightTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>{t('Loading...')}</>;
  }

  return (
    <BaseSettingsSection
      title={t('Shift Light')}
      description={t(
        "Configure the Shift Light. Hint: enable 'Show RPM Text' to see where the box is."
      )}
      settings={settings}
      onSettingsChange={setSettings}
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
              <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
                <TabButton
                  id="display"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  {t('Display')}
                </TabButton>
                <TabButton
                  id="options"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  {t('Custom Shift Points')}
                </TabButton>
                <TabButton
                  id="visibility"
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                >
                  {t('Visibility')}
                </TabButton>
              </div>

              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <>
                  <SettingsSection
                    title={t('Display')}
                    scaleWidgetId="shiftlight"
                  >
                    <SettingProp path="background.opacity" />

                    <SettingProp path="showRpmText" />
                  </SettingsSection>
                </>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title={t('Custom Shift Points')}>
                  <CustomShiftPointsSection
                    config={config}
                    handleConfigChange={handleConfigChange}
                  />
                </SettingsSection>
              )}

              {/* VISIBILITY TAB */}
              {activeTab === 'visibility' && (
                <SettingsSection title={t('Session Visibility')}>
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
