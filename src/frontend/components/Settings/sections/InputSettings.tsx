import { useDashboard } from '@irdashies/context';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { getAvailableCars } from '../../../utils/carData';
import { useSortableList } from '../../SortableList';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { TabButton } from '../components/TabButton';
import {
  InputWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SettingDivider } from '../components/SettingDivider';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingActionButton } from '../components/SettingActionButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';

const SETTING_ID = 'input';

interface SortableSetting {
  id: string;
  label: string;
  configKey: keyof InputWidgetSettings['config'];
}

const sortableSettings: SortableSetting[] = [
  { id: 'trace', label: 'Trace', configKey: 'trace' },
  { id: 'bar', label: 'Bar', configKey: 'bar' },
  { id: 'gear', label: 'Gear', configKey: 'gear' },
  { id: 'abs', label: 'ABS', configKey: 'abs' },
  { id: 'steer', label: 'Steer', configKey: 'steer' },
];

const defaultConfig = getWidgetDefaultConfig('input');

interface DisplaySettingsListProps {
  itemsOrder: string[];
  onReorder: (newOrder: string[]) => void;
  settings: InputWidgetSettings;
  handleConfigChange: (changes: Partial<InputWidgetSettings['config']>) => void;
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

  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder: (newItems) => onReorder(newItems.map((i) => i.id)),
    getItemId: (item) => item.id,
  });

  return (
    <div className="space-y-3">
      {displayItems.map((setting) => {
        const { dragHandleProps, itemProps } = getItemProps(setting);
        const configValue = settings.config[setting.configKey];
        const isEnabled = (configValue as { enabled: boolean }).enabled;

        return (
          <div key={setting.id} {...itemProps}>
            <div className="flex items-center justify-between group">
              <div className="flex items-center gap-2 flex-1">
                <div
                  {...dragHandleProps}
                  className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
                >
                  <DotsSixVerticalIcon size={16} className="text-slate-400" />
                </div>
                <span className="text-sm text-slate-300">{setting.label}</span>
              </div>
              <ToggleSwitch
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
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

/**
 * Custom shift points configuration section
 *
 * Car data is sourced from the lovely-car-data project:
 * https://github.com/Lovely-Sim-Racing/lovely-car-data
 */
const CustomShiftPointsSection = ({
  config,
  handleConfigChange,
}: {
  config: InputWidgetSettings['config'];
  handleConfigChange: (changes: Partial<InputWidgetSettings['config']>) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const [availableCars, setAvailableCars] = useState<CarListItem[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>(
    {}
  );

  // Get values from config
  const customShiftPoints = config.tachometer.customShiftPoints ?? {
    enabled: false,
    indicatorType: 'glow' as const,
    indicatorColor: '#00ff00',
    carConfigs: {},
  };

  const updateCustomShiftPoints = (
    updates: Partial<typeof customShiftPoints>
  ) => {
    handleConfigChange({
      tachometer: {
        ...config.tachometer,
        customShiftPoints: {
          ...customShiftPoints,
          ...updates,
        },
      },
    });
  };

  useEffect(() => {
    const loadAvailableCars = () => {
      if (!expanded || availableCars.length > 0) return;

      setLoading(true);
      try {
        const allCars = getAvailableCars();
        const cars: CarListItem[] = allCars
          .map((car) => ({
            carId: car.carId,
            carName: car.carName,
            ledNumber: 0,
            ledRpm: [{}],
          }))
          .sort((a, b) => a.carName.localeCompare(b.carName));

        setAvailableCars(cars);
      } catch (err) {
        console.error('Failed to load cars:', err);
        setError(
          err instanceof Error ? err.message : 'Failed to load car data'
        );
      } finally {
        setLoading(false);
      }
    };

    loadAvailableCars();
  }, [expanded, availableCars.length]);

  const addCar = async () => {
    const selectedCar = availableCars.find((c) => c.carId === selectedCarId);
    if (!selectedCar) return;

    try {
      const response = await fetch(
        `https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/${selectedCarId}.json`
      );
      if (!response.ok) throw new Error('Car data not found');

      const carData: CarDataResponse = await response.json();

      let redlineRpm = 8000;
      if (carData.ledRpm?.[0]) {
        const allRpms = Object.values(carData.ledRpm[0]).flat() as number[];
        redlineRpm = Math.max(...allRpms);
      } else if (carData.redlineRpm) {
        redlineRpm = carData.redlineRpm;
      }

      const gearKeys = Object.keys(carData.ledRpm?.[0] || {}).filter(
        (key) =>
          key !== 'N' && key !== 'R' && !isNaN(Number(key)) && Number(key) > 0
      );
      const gearCount =
        gearKeys.length > 0 ? Math.max(...gearKeys.map(Number)) : 6;

      const gearShiftPoints: Record<string, { shiftRpm: number }> = {};
      const defaultShiftRpm = Math.round(redlineRpm * DEFAULT_SHIFT_RPM_RATIO);
      for (let i = 1; i <= gearCount; i++) {
        gearShiftPoints[i.toString()] = {
          shiftRpm: Math.max(MIN_SHIFT_RPM, defaultShiftRpm),
        };
      }

      updateCustomShiftPoints({
        carConfigs: {
          ...customShiftPoints.carConfigs,
          [selectedCarId]: {
            enabled: true,
            carId: selectedCarId,
            carName: carData.carName || selectedCar.carName,
            gearCount,
            redlineRpm,
            gearShiftPoints,
          },
        },
      });
    } catch {
      const gearShiftPoints: Record<string, { shiftRpm: number }> = {};
      for (let i = 1; i <= 6; i++) {
        gearShiftPoints[i.toString()] = { shiftRpm: 8000 };
      }

      updateCustomShiftPoints({
        carConfigs: {
          ...customShiftPoints.carConfigs,
          [selectedCarId]: {
            enabled: true,
            carId: selectedCarId,
            carName: selectedCar.carName,
            gearCount: 6,
            redlineRpm: 8000,
            gearShiftPoints,
          },
        },
      });
    }

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
    if (expandedCarId === carId) {
      setExpandedCarId(null);
    }
  };

  return (
    <div className="border-t border-slate-600 pt-3 mt-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-300">Custom Shift Points</span>
        <button
          onClick={() => setExpanded(!expanded)}
          className={`px-3 py-1 text-xs rounded transition-colors ${
            expanded
              ? 'bg-blue-600 text-white'
              : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
          }`}
        >
          {expanded ? 'Collapse' : 'Expand'}
        </button>
      </div>

      {expanded && (
        <div className="space-y-4 pl-4 pt-3">
          {/* Main Enable Toggle */}
          <div className="flex items-center gap-3 pb-3 border-b border-slate-600">
            <label className="text-sm text-slate-200">
              Enable Custom Shift Points:
            </label>
            <ToggleSwitch
              enabled={customShiftPoints.enabled}
              onToggle={(enabled) => updateCustomShiftPoints({ enabled })}
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-200">Indicator Type:</label>
            <select
              value={customShiftPoints.indicatorType}
              onChange={(e) =>
                updateCustomShiftPoints({
                  indicatorType: e.target.value as 'glow' | 'pulse' | 'border',
                })
              }
              className="bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="glow">Glow Effect</option>
              <option value="pulse">Pulse Effect</option>
              <option value="border">Border Glow</option>
            </select>

            <label className="text-sm text-slate-200 ml-4">Color:</label>
            <input
              type="color"
              value={customShiftPoints.indicatorColor}
              onChange={(e) =>
                updateCustomShiftPoints({ indicatorColor: e.target.value })
              }
              className="w-12 h-8 bg-slate-700 border border-slate-600 rounded cursor-pointer"
            />
            <span className="text-xs text-slate-500">
              {customShiftPoints.indicatorColor}
            </span>
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 p-2 rounded">
              {error}
              <button
                onClick={() => {
                  setError(null);
                  setAvailableCars([]);
                }}
                className="ml-2 text-xs underline hover:no-underline"
              >
                Retry
              </button>
            </div>
          )}

          {availableCars.length > 0 && (
            <div className="text-xs text-slate-400 mb-2">
              Loaded {availableCars.length} cars from lovely-car-data
            </div>
          )}
          <div className="flex gap-2">
            <select
              value={selectedCarId}
              onChange={(e) => setSelectedCarId(e.target.value)}
              className="flex-1 bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm"
              disabled={loading}
            >
              <option value="">
                {loading
                  ? 'Loading cars...'
                  : availableCars.length === 0
                    ? 'No cars loaded'
                    : (() => {
                        const unselectedCount = availableCars.filter(
                          (car) => !customShiftPoints.carConfigs[car.carId]
                        ).length;
                        return `Select from ${unselectedCount} car${unselectedCount !== 1 ? 's' : ''}...`;
                      })()}
              </option>
              {availableCars
                .filter((car) => !customShiftPoints.carConfigs[car.carId])
                .map((car) => (
                  <option key={car.carId} value={car.carId}>
                    {car.carName}
                  </option>
                ))}
            </select>
            <button
              onClick={addCar}
              disabled={!selectedCarId}
              className="px-3 py-1 text-sm bg-green-600 hover:bg-green-500 disabled:bg-slate-600 text-white rounded"
            >
              Add Car
            </button>
          </div>

          {Object.entries(customShiftPoints.carConfigs).map(([carId, car]) => (
            <div key={carId} className="bg-slate-700 p-3 rounded">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm text-slate-200">{car.carName}</div>
                  <div className="text-xs text-slate-500">
                    {car.gearCount} gears • {car.redlineRpm} RPM redline
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setExpandedCarId(expandedCarId === carId ? null : carId)
                    }
                    className={`px-2 py-1 text-xs rounded transition-colors ${
                      expandedCarId === carId
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                    }`}
                  >
                    {expandedCarId === carId ? 'Collapse' : 'Expand'}
                  </button>
                  <ToggleSwitch
                    enabled={car.enabled}
                    onToggle={(enabled) => toggleCar(carId, enabled)}
                  />
                  <button
                    onClick={() => deleteCar(carId)}
                    className="px-2 py-1 text-xs bg-red-600 hover:bg-red-500 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {car.enabled && expandedCarId === carId && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-600">
                  {Array.from({ length: car.gearCount }, (_, i) => {
                    const gear = (i + 1).toString();
                    const rpm =
                      car.gearShiftPoints[gear]?.shiftRpm || car.redlineRpm;
                    const editKey = `${carId}-${gear}`;
                    const displayValue =
                      editingValues[editKey] !== undefined
                        ? editingValues[editKey]
                        : rpm.toString();

                    return (
                      <div key={gear} className="flex items-center gap-2">
                        <label className="text-xs text-slate-200 w-8">
                          G{gear}:
                        </label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={displayValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty or numeric input only
                            if (value === '' || /^\d+$/.test(value)) {
                              setEditingValues({
                                ...editingValues,
                                [editKey]: value,
                              });
                            }
                          }}
                          onBlur={() => {
                            // Only update if the user actually edited the value
                            const value = editingValues[editKey];
                            if (value === undefined) return;

                            // Validate and commit to config
                            const numValue = parseInt(value) || MIN_SHIFT_RPM;
                            const clampedValue = Math.max(
                              MIN_SHIFT_RPM,
                              Math.min(numValue, car.redlineRpm)
                            );
                            updateShiftPoint(carId, gear, clampedValue);
                            // Clear editing state by filtering out the editKey
                            const newEditingValues = Object.fromEntries(
                              Object.entries(editingValues).filter(
                                ([key]) => key !== editKey
                              )
                            );
                            setEditingValues(newEditingValues);
                          }}
                          className="flex-1 bg-slate-600 text-slate-200 rounded px-1 py-1 text-xs"
                        />
                        <span className="text-xs text-slate-500">RPM</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {Object.keys(customShiftPoints.carConfigs).length === 0 && (
            <div className="text-xs text-slate-500">
              No cars configured. Select a car above to add custom shift points.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const InputSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as InputWidgetSettings | undefined;
  const [settings, setSettings] = useState<InputWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as InputWidgetSettings['config']) ?? defaultConfig,
  });
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('inputTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('inputTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Input Traces"
      description="Configure the input traces display settings for throttle, brake, and clutch."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="input"
    >
      {(handleConfigChange) => {
        const handleDisplayOrderChange = (newOrder: string[]) => {
          setItemsOrder(newOrder);
          handleConfigChange({ displayOrder: newOrder });
        };

        const config = settings.config;

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
              <TabButton
                id="visibility"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Visibility
              </TabButton>
            </div>

            <div className="pt-4 space-y-4">
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
                  <SettingsSection title="Options">
                    <SettingToggleRow
                      title="Use Raw Inputs"
                      description="Disables iRacing's automated input processing, showing direct pedal telemetry without assists like auto-clutch or anti-stall."
                      enabled={config.useRawValues}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          useRawValues: enabled,
                        })
                      }
                    />
                    <SettingSliderRow
                      title="Background Opacity"
                      value={settings.config.background.opacity ?? 40}
                      units="%"
                      min={0}
                      max={100}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({ background: { opacity: v } })
                      }
                    />
                  </SettingsSection>

                  {/* Trace Settings */}
                  <SettingsSection title="Trace">
                    <SettingToggleRow
                      title="Enable Trace Display"
                      enabled={config.trace.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          trace: { ...config.trace, enabled },
                        })
                      }
                    />

                    {config.trace.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Clutch Trace"
                          enabled={config.trace.includeClutch}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeClutch: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Throttle Trace"
                          enabled={config.trace.includeThrottle}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeThrottle: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Brake Trace"
                          enabled={config.trace.includeBrake}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeBrake: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show ABS"
                          enabled={config.trace.includeAbs}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeAbs: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Steering Trace"
                          enabled={config.trace.includeSteer ?? true}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                includeSteer: enabled,
                              },
                            })
                          }
                        />

                        <SettingSliderRow
                          title="Stroke Width"
                          value={config.trace.strokeWidth ?? 3}
                          units="px"
                          min={0}
                          max={10}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                strokeWidth: v,
                              },
                            })
                          }
                        />

                        <SettingSliderRow
                          title="Max Samples"
                          value={config.trace.maxSamples ?? 40}
                          units=" samples"
                          min={40}
                          max={1000}
                          step={1}
                          onChange={(v) =>
                            handleConfigChange({
                              trace: {
                                ...config.trace,
                                maxSamples: v,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Bar Settings */}
                  <SettingsSection title="Bar">
                    <SettingToggleRow
                      title="Enable Bar Display"
                      enabled={config.bar.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({ bar: { ...config.bar, enabled } })
                      }
                    />

                    {config.bar.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show Clutch Bar"
                          enabled={config.bar.includeClutch}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeClutch: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Throttle Bar"
                          enabled={config.bar.includeThrottle}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeThrottle: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show Brake Bar"
                          enabled={config.bar.includeBrake}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeBrake: enabled,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Show ABS Indicator"
                          enabled={config.bar.includeAbs}
                          onToggle={(enabled) =>
                            handleConfigChange({
                              bar: {
                                ...config.bar,
                                includeAbs: enabled,
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* ABS Settings */}
                  <SettingsSection title="ABS Indicator">
                    <SettingToggleRow
                      title="Enable ABS Indicator"
                      enabled={config.abs?.enabled ?? false}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          abs: { ...config.abs, enabled: newValue },
                        })
                      }
                    />
                  </SettingsSection>

                  {/* Steer Settings */}
                  <SettingsSection title="Steer">
                    <SettingToggleRow
                      title="Enable Steer Display"
                      enabled={config.steer.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          steer: { ...config.steer, enabled: newValue },
                        })
                      }
                    />

                    {config.steer.enabled && (
                      <SettingsSection>
                        <SettingSelectRow<
                          'default' | 'formula' | 'lmp' | 'nascar' | 'ushape'
                        >
                          title="Wheel Style"
                          value={config.steer.config.style ?? 'default'}
                          options={[
                            { label: 'Default', value: 'default' },
                            { label: 'Formula', value: 'formula' },
                            { label: 'LMP', value: 'lmp' },
                            { label: 'NASCAR', value: 'nascar' },
                            { label: 'U-Shape', value: 'ushape' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              steer: {
                                ...config.steer,
                                config: { ...config.steer.config, style: v },
                              },
                            })
                          }
                        />

                        <SettingSelectRow<'dark' | 'light'>
                          title="Wheel Color"
                          value={config.steer.config.color ?? 'light'}
                          options={[
                            { label: 'Light', value: 'light' },
                            { label: 'Dark', value: 'dark' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              steer: {
                                ...config.steer,
                                config: { ...config.steer.config, color: v },
                              },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Gear Settings */}
                  <SettingsSection title="Gear">
                    <SettingToggleRow
                      title="Enable Gear Display"
                      enabled={config.gear.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          gear: { ...config.gear, enabled: newValue },
                        })
                      }
                    />

                    {config.gear.enabled && (
                      <SettingsSection>
                        <SettingButtonGroupRow<'auto' | 'mph' | 'km/h'>
                          title="Speed Unit"
                          value={config.gear.unit ?? 'auto'}
                          options={[
                            { label: 'Auto', value: 'auto' },
                            { label: 'MPH', value: 'mph' },
                            { label: 'KM/H', value: 'km/h' },
                          ]}
                          onChange={(v) =>
                            handleConfigChange({
                              gear: { ...config.gear, unit: v },
                            })
                          }
                        />
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Tachometer Settings */}
                  <SettingsSection title="Tachometer">
                    <SettingToggleRow
                      title="Enable Tachometer Display"
                      enabled={config.tachometer.enabled}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          tachometer: {
                            ...config.tachometer,
                            enabled: newValue,
                          },
                        })
                      }
                    />

                    {config.tachometer.enabled && (
                      <SettingsSection>
                        <SettingToggleRow
                          title="Show RPM Text"
                          enabled={config.tachometer.showRpmText}
                          onToggle={(newValue) =>
                            handleConfigChange({
                              tachometer: {
                                ...config.tachometer,
                                showRpmText: newValue,
                              },
                            })
                          }
                        />

                        <CustomShiftPointsSection
                          config={config}
                          handleConfigChange={handleConfigChange}
                        />
                      </SettingsSection>
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

                  <SettingToggleRow
                    title="Show only when on track"
                    description="If enabled, inputs will only be shown when driving"
                    enabled={settings.config.showOnlyWhenOnTrack ?? false}
                    onToggle={(newValue) =>
                      handleConfigChange({ showOnlyWhenOnTrack: newValue })
                    }
                  />
                </SettingsSection>
              )}
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
