import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import { useState, useEffect, useId } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  TachometerWidgetSettings,
  getWidgetDefaultConfig,
  SettingsTabType,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SessionVisibility } from '../components/SessionVisibility';
import { getAvailableCars } from '../../../utils/carData';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { TabButton } from '../components/TabButton';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import logger from '@irdashies/utils/logger';
import { SettingProps, settingPropFor } from '../components/SettingProp';

const SETTING_ID = 'tachometer';
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

/**
 * Custom shift points configuration section
 */
const CustomShiftPointsSection = ({
  config,
  handleConfigChange,
}: {
  config: TachometerWidgetSettings['config'];
  handleConfigChange: (
    changes: Partial<TachometerWidgetSettings['config']>
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

  const addCar = () => {
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

  return (
    <div className="space-y-3">
      <SettingToggleRow
        title="Enable Custom Shift Points"
        description="If enabled, custom shift points will be displayed on the tachometer"
        enabled={customShiftPoints.enabled ?? false}
        onToggle={(enabled) => updateCustomShiftPoints({ enabled })}
      />

      {configuredCars.length > 0 && (
        <div className="text-md text-slate-300">
          ({configuredCars.length} cars)
        </div>
      )}

      {customShiftPoints.enabled && (
        <div className="space-y-4 border-slate-700 pl-4">
          {/* Demo Mode Info */}
          <div className="bg-slate-800/40 border border-slate-700 rounded p-3 text-xs">
            <div className="flex items-start gap-2">
              <div className="flex-1">
                <p className="text-slate-200 mb-1">Demo Mode Car</p>
                <p className="text-slate-400">
                  Demo mode uses the <strong>BMW M4 GT4</strong> (bmwm4gt4).
                  Configure custom shift points for this car to test in demo
                  mode.
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
              Indicator Type
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
              <option value="glow">Glow</option>
              <option value="pulse">Pulse</option>
              <option value="border">Border</option>
            </select>
          </div>

          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${fieldId}-color`}
              className="text-sm text-slate-300"
            >
              Indicator Color
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
              Add Car
            </label>
            <div className="flex gap-2">
              <select
                id={`${fieldId}-car`}
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="settings-field flex-1"
                disabled={loading}
              >
                <option value="">Select a car...</option>
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
                Add
              </button>
            </div>
            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* Configured Cars */}
          {configuredCars.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs text-slate-400">Configured Cars</label>
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
                          aria-label={`Shift points for ${car.carName}`}
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
                          ariaLabel={`Enable custom shift points for ${car.carName}`}
                          enabled={car.enabled}
                          onToggle={(enabled) => toggleCar(car.carId, enabled)}
                        />
                        <button
                          aria-label={`Delete shift points for ${car.carName}`}
                          onClick={() => deleteCar(car.carId)}
                          className="settings-button-danger"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {expandedCarId === car.carId && (
                      <div
                        id={`${fieldId}-${car.carId}`}
                        className="space-y-3 pt-3 border-t border-slate-700"
                      >
                        <p className="text-xs text-slate-400">
                          Redline: {car.redlineRpm} RPM
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(car.gearShiftPoints).map(
                            ([gear, { shiftRpm }]) => (
                              <div
                                key={gear}
                                className="flex items-center gap-2"
                              >
                                <label className="text-xs text-slate-400 w-12">
                                  Gear {gear}:
                                </label>
                                <input
                                  aria-label={`${car.carName}, gear ${gear} shift RPM`}
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

const defaultConfig = getWidgetDefaultConfig('tachometer');

export const TachometerSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as TachometerWidgetSettings | undefined;
  const [settings, setSettings] = useState<TachometerWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as TachometerWidgetSettings['config']) ??
      defaultConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('tachometerTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('tachometerTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Tachometer"
      description="Configure the tachometer."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="tachometer"
    >
      {(handleConfigChange) => {
        const config = settings.config;
        // Defaulted temp display state so the toggle and the position section
        // stay in sync on existing dashboards where these are still undefined.
        const oilTempEnabled = config.oilTemp?.enabled ?? true;
        const oilTempPosition = config.oilTemp?.position ?? 'top';
        const oilTempEdgeOffset = config.oilTemp?.edgeOffset ?? 0;
        const waterTempEnabled = config.waterTemp?.enabled ?? true;
        const waterTempPosition = config.waterTemp?.position ?? 'top';
        const waterTempEdgeOffset = config.waterTemp?.edgeOffset ?? 0;
        const tempSwapSides = config.tempLayout?.swapSides ?? false;
        const anyTempEnabled = oilTempEnabled || waterTempEnabled;
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
              </div>

              {/* DISPLAY TAB */}
              {activeTab === 'display' && (
                <>
                  <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                    <SettingProp path="background.opacity" />

                    <SettingProp path="showRpmText" />

                    {config.showRpmText && (
                      <SettingsSection>
                        <SettingProp path="rpmOrientation" />
                      </SettingsSection>
                    )}
                    <SettingDivider />

                    <SettingToggleRow
                      title="Show Oil Temperature"
                      enabled={oilTempEnabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          oilTemp: {
                            enabled: newValue,
                            position: oilTempPosition,
                            edgeOffset: oilTempEdgeOffset,
                          },
                        })
                      }
                    />

                    {oilTempEnabled && (
                      <SettingsSection>
                        <SettingButtonGroupRow<'top' | 'bottom'>
                          title="Oil Position"
                          value={oilTempPosition}
                          options={[
                            { label: 'Top', value: 'top' },
                            { label: 'Bottom', value: 'bottom' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              oilTemp: {
                                enabled: oilTempEnabled,
                                position: v,
                                edgeOffset: oilTempEdgeOffset,
                              },
                            })
                          }
                        />
                        <SettingSliderRow
                          title="Oil Edge Offset"
                          value={oilTempEdgeOffset}
                          units="%"
                          min={0}
                          max={100}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              oilTemp: {
                                enabled: oilTempEnabled,
                                position: oilTempPosition,
                                edgeOffset: v,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}

                    <SettingToggleRow
                      title="Show Water Temperature"
                      enabled={waterTempEnabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          waterTemp: {
                            enabled: newValue,
                            position: waterTempPosition,
                            edgeOffset: waterTempEdgeOffset,
                          },
                        })
                      }
                    />

                    {waterTempEnabled && (
                      <SettingsSection>
                        <SettingButtonGroupRow<'top' | 'bottom'>
                          title="Water Position"
                          value={waterTempPosition}
                          options={[
                            { label: 'Top', value: 'top' },
                            { label: 'Bottom', value: 'bottom' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              waterTemp: {
                                enabled: waterTempEnabled,
                                position: v,
                                edgeOffset: waterTempEdgeOffset,
                              },
                            })
                          }
                        />
                        <SettingSliderRow
                          title="Water Edge Offset"
                          value={waterTempEdgeOffset}
                          units="%"
                          min={0}
                          max={100}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              waterTemp: {
                                enabled: waterTempEnabled,
                                position: waterTempPosition,
                                edgeOffset: v,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}

                    {anyTempEnabled && (
                      <SettingToggleRow
                        title="Swap Oil/Water Sides"
                        enabled={tempSwapSides}
                        onToggle={(newValue) =>
                          handleConfigChange({
                            tempLayout: { swapSides: newValue },
                          })
                        }
                      />
                    )}
                  </SettingsSection>
                </>
              )}

              {/* OPTIONS TAB */}
              {activeTab === 'options' && (
                <SettingsSection title="Custom Shift Points">
                  <CustomShiftPointsSection
                    config={config}
                    handleConfigChange={handleConfigChange}
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
