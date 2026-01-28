import { useDashboard } from '@irdashies/context';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { getAvailableCars } from '../../../utils/carData';
import { mergeDisplayOrder } from '../../../utils/displayOrder';
import { useSortableList } from '../../SortableList';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { InputWidgetSettings, SessionVisibilitySettings } from '../types';

const SETTING_ID = 'input';

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

interface CarDataResponse {
  carName: string;
  carId: string;
  ledNumber: number;
  ledRpm?: Record<string, number[]>[];
  redlineRpm?: number;
}

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

const defaultConfig: InputWidgetSettings['config'] = {
  trace: {
    enabled: true,
    includeThrottle: true,
    includeBrake: true,
    includeClutch: false,
    includeAbs: true,
    includeSteer: true,
    strokeWidth: 3,
    maxSamples: 400,
  },
  bar: {
    enabled: true,
    includeClutch: true,
    includeBrake: true,
    includeThrottle: true,
    includeAbs: true,
  },
  gear: {
    enabled: true,
    unit: 'auto',
  },
  abs: {
    enabled: true,
  },
  steer: {
    enabled: true,
    config: {
      style: 'default',
      color: 'light',
    },
  },
  tachometer: {
    enabled: true,
    showRpmText: false,
    customShiftPoints: {
      enabled: false,
      indicatorType: 'glow',
      indicatorColor: '#00ff00',
      carConfigs: {},
    },
  },
  background: { opacity: 0 },
  displayOrder: sortableSettings.map((s) => s.id),
  showOnlyWhenOnTrack: true,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (savedConfig: unknown): InputWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;

  return {
    trace: {
      enabled:
        (config.trace as { enabled?: boolean })?.enabled ??
        defaultConfig.trace.enabled,
      includeThrottle:
        (config.trace as { includeThrottle?: boolean })?.includeThrottle ??
        defaultConfig.trace.includeThrottle,
      includeBrake:
        (config.trace as { includeBrake?: boolean })?.includeBrake ??
        defaultConfig.trace.includeBrake,
      includeClutch:
        (config.trace as { includeClutch?: boolean })?.includeClutch ??
        defaultConfig.trace.includeClutch,
      includeAbs:
        (config.trace as { includeAbs?: boolean })?.includeAbs ??
        defaultConfig.trace.includeAbs,
      includeSteer:
        (config.trace as { includeSteer?: boolean })?.includeSteer ??
        defaultConfig.trace.includeSteer,
      strokeWidth:
        (config.trace as { strokeWidth?: number })?.strokeWidth ??
        defaultConfig.trace.strokeWidth,
      maxSamples:
        (config.trace as { maxSamples?: number })?.maxSamples ??
        defaultConfig.trace.maxSamples,
    },
    bar: {
      enabled:
        (config.bar as { enabled?: boolean })?.enabled ??
        defaultConfig.bar.enabled,
      includeClutch:
        (config.bar as { includeClutch?: boolean })?.includeClutch ??
        defaultConfig.bar.includeClutch,
      includeBrake:
        (config.bar as { includeBrake?: boolean })?.includeBrake ??
        defaultConfig.bar.includeBrake,
      includeThrottle:
        (config.bar as { includeThrottle?: boolean })?.includeThrottle ??
        defaultConfig.bar.includeThrottle,
      includeAbs:
        (config.bar as { includeAbs?: boolean })?.includeAbs ??
        defaultConfig.bar.includeAbs,
    },
    gear: {
      enabled:
        (config.gear as { enabled?: boolean })?.enabled ??
        defaultConfig.gear.enabled,
      unit:
        (config.gear as { unit?: 'mph' | 'km/h' | 'auto' })?.unit ??
        defaultConfig.gear.unit,
    },
    abs: {
      enabled:
        (config.abs as { enabled?: boolean })?.enabled ??
        defaultConfig.abs.enabled,
    },
    steer: {
      enabled:
        (config.steer as { enabled?: boolean })?.enabled ??
        defaultConfig.steer.enabled,
      config: {
        style:
          (
            config.steer as {
              config?: {
                style?: 'formula' | 'lmp' | 'nascar' | 'ushape' | 'default';
              };
            }
          )?.config?.style ?? defaultConfig.steer.config.style,
        color:
          (config.steer as { config?: { color?: 'dark' | 'light' } })?.config
            ?.color ?? defaultConfig.steer.config.color,
      },
    },
    tachometer: {
      enabled:
        (config.tachometer as { enabled?: boolean })?.enabled ??
        defaultConfig.tachometer.enabled,
      showRpmText:
        (config.tachometer as { showRpmText?: boolean })?.showRpmText ??
        defaultConfig.tachometer.showRpmText,
      customShiftPoints: (config.tachometer as { customShiftPoints?: InputWidgetSettings['config']['tachometer']['customShiftPoints'] })?.customShiftPoints ??
        defaultConfig.tachometer.customShiftPoints,
    },
    background: {
      opacity: (config.background as { opacity?: number })?.opacity ?? 0,
    },
    displayOrder: mergeDisplayOrder(
      sortableSettings.map((s) => s.id),
      config.displayOrder as string[]
    ),
    showOnlyWhenOnTrack: (config.showOnlyWhenOnTrack as boolean) ?? true,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

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
const CustomShiftPointsSection = ({ config, handleConfigChange }: { config: InputWidgetSettings['config'], handleConfigChange: (changes: Partial<InputWidgetSettings['config']>) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const [availableCars, setAvailableCars] = useState<CarListItem[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  // Get values from config
  const customShiftPoints = config.tachometer.customShiftPoints ?? {
    enabled: false,
    indicatorType: 'glow' as const,
    indicatorColor: '#00ff00',
    carConfigs: {},
  };

  const updateCustomShiftPoints = (updates: Partial<typeof customShiftPoints>) => {
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
            ledRpm: [{}]
          }))
          .sort((a, b) => a.carName.localeCompare(b.carName));
        
        setAvailableCars(cars);
      } catch (err) {
        console.error('Failed to load cars:', err);
        setError(err instanceof Error ? err.message : 'Failed to load car data');
      } finally {
        setLoading(false);
      }
    };

    loadAvailableCars();
  }, [expanded, availableCars.length]);

  const addCar = async () => {
    const selectedCar = availableCars.find(c => c.carId === selectedCarId);
    if (!selectedCar) return;
    
    try {
      const response = await fetch(`https://raw.githubusercontent.com/Lovely-Sim-Racing/lovely-car-data/main/data/IRacing/${selectedCarId}.json`);
      if (!response.ok) throw new Error('Car data not found');
      
      const carData: CarDataResponse = await response.json();
      
      let redlineRpm = 8000;
      if (carData.ledRpm?.[0]) {
        const allRpms = Object.values(carData.ledRpm[0]).flat() as number[];
        redlineRpm = Math.max(...allRpms);
      } else if (carData.redlineRpm) {
        redlineRpm = carData.redlineRpm;
      }
      
      const gearKeys = Object.keys(carData.ledRpm?.[0] || {}).filter(key => 
        key !== 'N' && key !== 'R' && !isNaN(Number(key)) && Number(key) > 0
      );
      const gearCount = gearKeys.length > 0 ? Math.max(...gearKeys.map(Number)) : 6;
      
      const gearShiftPoints: Record<string, {shiftRpm: number}> = {};
      const defaultShiftRpm = Math.round(redlineRpm * DEFAULT_SHIFT_RPM_RATIO);
      for (let i = 1; i <= gearCount; i++) {
        gearShiftPoints[i.toString()] = { 
          shiftRpm: Math.max(MIN_SHIFT_RPM, defaultShiftRpm)
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
            gearShiftPoints
          }
        }
      });
    } catch {
      const gearShiftPoints: Record<string, {shiftRpm: number}> = {};
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
            gearShiftPoints
          }
        }
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
          enabled
        }
      }
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
            [gear]: { shiftRpm }
          }
        }
      }
    });
  };

  const deleteCar = (carId: string) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { [carId]: _removed, ...rest } = customShiftPoints.carConfigs;
    updateCustomShiftPoints({
      carConfigs: rest
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
            <label className="text-sm text-slate-200">Enable Custom Shift Points:</label>
            <ToggleSwitch
              enabled={customShiftPoints.enabled}
              onToggle={(enabled) => updateCustomShiftPoints({ enabled })}
            />
          </div>
          
          <div className="flex items-center gap-3">
            <label className="text-sm text-slate-200">Indicator Type:</label>
            <select
              value={customShiftPoints.indicatorType}
              onChange={(e) => updateCustomShiftPoints({ indicatorType: e.target.value as 'glow' | 'pulse' | 'border' })}
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
              onChange={(e) => updateCustomShiftPoints({ indicatorColor: e.target.value })}
              className="w-12 h-8 bg-slate-700 border border-slate-600 rounded cursor-pointer"
            />
            <span className="text-xs text-slate-400">{customShiftPoints.indicatorColor}</span>
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
                {loading ? 'Loading cars...' : 
                 availableCars.length === 0 ? 'No cars loaded' :
                 (() => {
                   const unselectedCount = availableCars.filter(car => !customShiftPoints.carConfigs[car.carId]).length;
                   return `Select from ${unselectedCount} car${unselectedCount !== 1 ? 's' : ''}...`;
                 })()}
              </option>
              {availableCars
                .filter(car => !customShiftPoints.carConfigs[car.carId])
                .map(car => (
                  <option key={car.carId} value={car.carId}>{car.carName}</option>
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
                  <div className="text-xs text-slate-400">{car.gearCount} gears • {car.redlineRpm} RPM redline</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpandedCarId(expandedCarId === carId ? null : carId)}
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
                    const rpm = car.gearShiftPoints[gear]?.shiftRpm || car.redlineRpm;
                    const editKey = `${carId}-${gear}`;
                    const displayValue = editingValues[editKey] !== undefined ? editingValues[editKey] : rpm.toString();
                    
                    return (
                      <div key={gear} className="flex items-center gap-2">
                        <label className="text-xs text-slate-200 w-8">G{gear}:</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={displayValue}
                          onChange={(e) => {
                            const value = e.target.value;
                            // Allow empty or numeric input only
                            if (value === '' || /^\d+$/.test(value)) {
                              setEditingValues({ ...editingValues, [editKey]: value });
                            }
                          }}
                          onBlur={() => {
                            // Only update if the user actually edited the value
                            const value = editingValues[editKey];
                            if (value === undefined) return;
                            
                            // Validate and commit to config
                            const numValue = parseInt(value) || MIN_SHIFT_RPM;
                            const clampedValue = Math.max(MIN_SHIFT_RPM, Math.min(numValue, car.redlineRpm));
                            updateShiftPoint(carId, gear, clampedValue);
                            // Clear editing state by filtering out the editKey
                            const newEditingValues = Object.fromEntries(
                              Object.entries(editingValues).filter(([key]) => key !== editKey)
                            );
                            setEditingValues(newEditingValues);
                          }}
                          className="flex-1 bg-slate-600 text-slate-200 rounded px-1 py-1 text-xs"
                        />
                        <span className="text-xs text-slate-400">RPM</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
          
          {Object.keys(customShiftPoints.carConfigs).length === 0 && (
            <div className="text-sm text-slate-400">
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
    config: migrateConfig(savedSettings?.config),
  });
  const [itemsOrder, setItemsOrder] = useState(settings.config.displayOrder);

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
          <div className="space-y-8">
            {/* Display Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Display</h3>
                <button
                  onClick={() => {
                    const defaultOrder = sortableSettings.map((s) => s.id);
                    setItemsOrder(defaultOrder);
                    handleConfigChange({ displayOrder: defaultOrder });
                  }}
                  className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
                >
                  Reset to Default Order
                </button>
              </div>
              <div className="pl-4">
                <DisplaySettingsList
                  itemsOrder={itemsOrder}
                  onReorder={handleDisplayOrderChange}
                  settings={settings}
                  handleConfigChange={handleConfigChange}
                />
              </div>
            </div>

            {/* Background Settings */}
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-200">
                Background Opacity:
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.config.background.opacity}
                onChange={(e) =>
                  handleConfigChange({
                    background: { opacity: parseInt(e.target.value) },
                  })
                }
                className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
              />
              <input
                type="number"
                min="0"
                max="100"
                value={settings.config.background.opacity}
                onChange={(e) =>
                  handleConfigChange({
                    background: { opacity: parseInt(e.target.value) },
                  })
                }
                className="w-20 bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* Show Only When On Track Settings */}
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-md font-medium text-slate-300">
                  Show Only When On Track
                </h4>
                <p className="text-sm text-slate-400">
                  If enabled, inputs will only be shown when you are driving.
                </p>
              </div>
              <ToggleSwitch
                enabled={settings.config.showOnlyWhenOnTrack ?? true}
                onToggle={(enabled) =>
                  handleConfigChange({ showOnlyWhenOnTrack: enabled })
                }
              />
            </div>

            {/* Trace Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Trace</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    Enable Trace Display
                  </span>
                  <ToggleSwitch
                    enabled={config.trace.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        trace: { ...config.trace, enabled },
                      })
                    }
                  />
                </div>
              </div>
              {config.trace.enabled && (
                <div className="space-y-2 pl-4 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Clutch Trace
                    </span>
                    <ToggleSwitch
                      enabled={config.trace.includeClutch}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            includeClutch: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Throttle Trace
                    </span>
                    <ToggleSwitch
                      enabled={config.trace.includeThrottle}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            includeThrottle: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Brake Trace
                    </span>
                    <ToggleSwitch
                      enabled={config.trace.includeBrake}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            includeBrake: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">Show ABS</span>
                    <ToggleSwitch
                      enabled={config.trace.includeAbs}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            includeAbs: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Steering Trace
                    </span>
                    <ToggleSwitch
                      enabled={config.trace.includeSteer ?? true}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            includeSteer: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center gap-3 pt-2">
                    <label className="text-sm text-slate-200">
                      Stroke Width:
                    </label>
                    <input
                      type="range"
                      min="1"
                      max="10"
                      value={config.trace.strokeWidth ?? 3}
                      onChange={(e) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            strokeWidth: parseInt(e.target.value),
                          },
                        })
                      }
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={config.trace.strokeWidth ?? 3}
                      onChange={(e) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            strokeWidth: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-20 bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-200">
                      Max Samples:
                    </label>
                    <input
                      type="range"
                      min="50"
                      max="1000"
                      step="50"
                      value={config.trace.maxSamples}
                      onChange={(e) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            maxSamples: parseInt(e.target.value),
                          },
                        })
                      }
                      className="flex-1 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer slider"
                    />
                    <input
                      type="number"
                      min="50"
                      max="1000"
                      value={config.trace.maxSamples}
                      onChange={(e) =>
                        handleConfigChange({
                          trace: {
                            ...config.trace,
                            maxSamples: parseInt(e.target.value),
                          },
                        })
                      }
                      className="w-20 bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Bar Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Bar</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    Enable Bar Display
                  </span>
                  <ToggleSwitch
                    enabled={config.bar.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({ bar: { ...config.bar, enabled } })
                    }
                  />
                </div>
              </div>
              {config.bar.enabled && (
                <div className="space-y-2 pl-4 pt-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Clutch Bar
                    </span>
                    <ToggleSwitch
                      enabled={config.bar.includeClutch}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          bar: {
                            ...config.bar,
                            includeClutch: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Brake Bar
                    </span>
                    <ToggleSwitch
                      enabled={config.bar.includeBrake}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          bar: {
                            ...config.bar,
                            includeBrake: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show Throttle Bar
                    </span>
                    <ToggleSwitch
                      enabled={config.bar.includeThrottle}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          bar: {
                            ...config.bar,
                            includeThrottle: newValue,
                          },
                        })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">
                      Show ABS Indicator
                    </span>
                    <ToggleSwitch
                      enabled={config.bar.includeAbs}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          bar: {
                            ...config.bar,
                            includeAbs: newValue,
                          },
                        })
                      }
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ABS Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">ABS</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    Enable ABS Indicator
                  </span>
                  <ToggleSwitch
                    enabled={config.abs.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({ abs: { ...config.abs, enabled } })
                    }
                  />
                </div>
              </div>
            </div>

            {/* Steer Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Steer</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    Enable Steer Display
                  </span>
                  <ToggleSwitch
                    enabled={config.steer.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        steer: { ...config.steer, enabled },
                      })
                    }
                  />
                </div>
              </div>
              {config.steer.enabled && (
                <div className="space-y-3 pl-4 pt-2">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-200">
                      Wheel Style:
                    </label>
                    <select
                      value={config.steer.config.style}
                      onChange={(e) =>
                        handleConfigChange({
                          steer: {
                            ...config.steer,
                            config: {
                              ...config.steer.config,
                              style: e.target.value as
                                | 'formula'
                                | 'lmp'
                                | 'nascar'
                                | 'ushape'
                                | 'default',
                            },
                          },
                        })
                      }
                      className="bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="default">Default</option>
                      <option value="formula">Formula</option>
                      <option value="lmp">LMP</option>
                      <option value="nascar">NASCAR</option>
                      <option value="ushape">U-Shape</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-slate-200">
                      Wheel Color:
                    </label>
                    <select
                      value={config.steer.config.color}
                      onChange={(e) =>
                        handleConfigChange({
                          steer: {
                            ...config.steer,
                            config: {
                              ...config.steer.config,
                              color: e.target.value as 'dark' | 'light',
                            },
                          },
                        })
                      }
                      className="bg-slate-700 text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Gear Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">Gear</h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    Enable Gear Display
                  </span>
                  <ToggleSwitch
                    enabled={config.gear.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({ gear: { ...config.gear, enabled } })
                    }
                  />
                </div>
              </div>
              {config.gear.enabled && (
                <div className="space-y-3 pl-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-200">Speed Unit</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          handleConfigChange({
                            gear: {
                              ...config.gear,
                              unit: 'auto',
                            },
                          })
                        }
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          config.gear.unit === 'auto'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        auto
                      </button>
                      <button
                        onClick={() =>
                          handleConfigChange({
                            gear: {
                              ...config.gear,
                              unit: 'mph',
                            },
                          })
                        }
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          config.gear.unit === 'mph'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        mph
                      </button>
                      <button
                        onClick={() =>
                          handleConfigChange({
                            gear: {
                              ...config.gear,
                              unit: 'km/h',
                            },
                          })
                        }
                        className={`px-3 py-1 rounded text-sm transition-colors ${
                          config.gear.unit === 'km/h'
                            ? 'bg-blue-600 text-white'
                            : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
                        }`}
                      >
                        km/h
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Tachometer Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Tachometer
                </h3>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-slate-300">
                    Enable Tachometer Display
                  </span>
                  <ToggleSwitch
                    enabled={config.tachometer.enabled}
                    onToggle={(enabled) =>
                      handleConfigChange({
                        tachometer: { ...config.tachometer, enabled },
                      })
                    }
                  />
                </div>
              </div>
              {config.tachometer.enabled && (
                <div className="space-y-3 pl-4 pt-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-slate-300">
                      Show RPM Text
                    </span>
                    <ToggleSwitch
                      enabled={config.tachometer.showRpmText}
                      onToggle={(showRpmText) =>
                        handleConfigChange({
                          tachometer: { ...config.tachometer, showRpmText },
                        })
                      }
                    />
                  </div>
                  
                  <CustomShiftPointsSection config={config} handleConfigChange={handleConfigChange} />

                </div>
              )}
            </div>
            {/* Session Visibility Settings */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium text-slate-200">
                  Session Visibility
                </h3>
              </div>
              <div className="space-y-3 pl-4">
                <SessionVisibility
                  sessionVisibility={settings.config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
              </div>
            </div>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
