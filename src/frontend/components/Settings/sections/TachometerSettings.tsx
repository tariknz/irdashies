import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TachometerWidgetSettings, SessionVisibilitySettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SessionVisibility } from '../components/SessionVisibility';
import { getAvailableCars } from '../../../utils/carData';

const SETTING_ID = 'tachometer';

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

const defaultConfig: TachometerWidgetSettings['config'] = {
  enabled: true,
  showRpmText: false,
  shiftPointSettings: {
    enabled: false,
    indicatorType: 'glow',
    indicatorColor: '#00ff00',
    carConfigs: {},
  },
  background: { opacity: 80 },
  showOnlyWhenOnTrack: true,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const normalizeConfig = (config: Partial<TachometerWidgetSettings['config']>): TachometerWidgetSettings['config'] => {
  return {
    enabled: config.enabled ?? defaultConfig.enabled,
    showRpmText: config.showRpmText ?? defaultConfig.showRpmText,
    shiftPointSettings: config.shiftPointSettings ?? defaultConfig.shiftPointSettings,
    background: {
      opacity: (config.background as { opacity?: number })?.opacity ?? 80,
    },
    showOnlyWhenOnTrack: config.showOnlyWhenOnTrack ?? true,
    sessionVisibility: (config.sessionVisibility as SessionVisibilitySettings) ?? defaultConfig.sessionVisibility,
  };
};

/**
 * Custom shift points configuration section
 */
const CustomShiftPointsSection = ({ config, handleConfigChange }: { config: TachometerWidgetSettings['config'], handleConfigChange: (changes: Partial<TachometerWidgetSettings['config']>) => void }) => {
  const [expanded, setExpanded] = useState(false);
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const [availableCars, setAvailableCars] = useState<CarListItem[]>([]);
  const [selectedCarId, setSelectedCarId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const customShiftPoints = config.shiftPointSettings ?? defaultConfig.shiftPointSettings ?? {
    enabled: false,
    indicatorType: 'glow' as const,
    indicatorColor: '#00ff00',
    carConfigs: {},
  };

  const updateCustomShiftPoints = (updates: Partial<typeof customShiftPoints>) => {
    handleConfigChange({
      shiftPointSettings: {
        ...customShiftPoints,
        ...updates,
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
  };

  const configuredCars = Object.values(customShiftPoints.carConfigs);
  const availableToAdd = availableCars.filter(c => !customShiftPoints.carConfigs[c.carId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2"
        >
          <span>{expanded ? '▼' : '▶'}</span>
          <span>Custom Shift Points</span>
          {configuredCars.length > 0 && (
            <span className="text-xs text-slate-500">({configuredCars.length} cars)</span>
          )}
        </button>
        <ToggleSwitch
          enabled={customShiftPoints.enabled}
          onToggle={(enabled) => updateCustomShiftPoints({ enabled })}
        />
      </div>

      {expanded && (
        <div className="ml-4 space-y-4 border-l-2 border-slate-700 pl-4">
          {/* Demo Mode Info */}
          <div className="bg-blue-900/30 border border-blue-700/50 rounded p-3 text-xs">
            <div className="flex items-start gap-2">
              <span className="text-blue-400">ℹ️</span>
              <div className="flex-1">
                <p className="text-blue-200 font-medium mb-1">Demo Mode Car</p>
                <p className="text-blue-300">
                  Demo mode uses the <strong>BMW M4 GT4</strong> (bmwm4gt4).
                  Configure custom shift points for this car to test in demo mode.
                </p>
              </div>
            </div>
          </div>

          {/* Indicator Settings */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Indicator Type</label>
            <select
              value={customShiftPoints.indicatorType}
              onChange={(e) => updateCustomShiftPoints({ indicatorType: e.target.value as 'glow' | 'pulse' | 'border' })}
              className="w-full bg-slate-700 text-white px-3 py-2 rounded text-sm"
            >
              <option value="glow">Glow</option>
              <option value="pulse">Pulse</option>
              <option value="border">Border</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-slate-400">Indicator Color</label>
            <input
              type="color"
              value={customShiftPoints.indicatorColor}
              onChange={(e) => updateCustomShiftPoints({ indicatorColor: e.target.value })}
              className="w-full h-10 bg-slate-700 rounded cursor-pointer"
            />
          </div>

          {/* Add Car */}
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Add Car</label>
            <div className="flex gap-2">
              <select
                value={selectedCarId}
                onChange={(e) => setSelectedCarId(e.target.value)}
                className="flex-1 bg-slate-700 text-white px-3 py-2 rounded text-sm"
                disabled={loading}
              >
                <option value="">Select a car...</option>
                {availableToAdd.map(car => (
                  <option key={car.carId} value={car.carId}>{car.carName}</option>
                ))}
              </select>
              <button
                onClick={addCar}
                disabled={!selectedCarId || loading}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded text-sm transition-colors"
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
                {configuredCars.map(car => (
                  <div key={car.carId} className="bg-slate-700 rounded p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedCarId(expandedCarId === car.carId ? null : car.carId)}
                          className="text-slate-400 hover:text-white"
                        >
                          <span>{expandedCarId === car.carId ? '▼' : '▶'}</span>
                        </button>
                        <span className="text-sm text-white">{car.carName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <ToggleSwitch
                          enabled={car.enabled}
                          onToggle={(enabled) => toggleCar(car.carId, enabled)}
                        />
                        <button
                          onClick={() => deleteCar(car.carId)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1"
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    {expandedCarId === car.carId && (
                      <div className="ml-6 space-y-2 pt-2 border-t border-slate-600">
                        <p className="text-xs text-slate-400">Redline: {car.redlineRpm} RPM</p>
                        <div className="grid grid-cols-2 gap-2">
                          {Object.entries(car.gearShiftPoints).map(([gear, { shiftRpm }]) => (
                            <div key={gear} className="flex items-center gap-2">
                              <label className="text-xs text-slate-400 w-12">Gear {gear}:</label>
                              <input
                                type="number"
                                value={editingValues[`${car.carId}-${gear}`] ?? shiftRpm}
                                onChange={(e) => {
                                  const key = `${car.carId}-${gear}`;
                                  setEditingValues({ ...editingValues, [key]: e.target.value });
                                }}
                                onBlur={(e) => {
                                  const value = parseInt(e.target.value);
                                  if (!isNaN(value) && value >= MIN_SHIFT_RPM) {
                                    updateShiftPoint(car.carId, gear, value);
                                  }
                                  const key = `${car.carId}-${gear}`;
                                  setEditingValues(
                                    Object.fromEntries(
                                      Object.entries(editingValues).filter(([k]) => k !== key)
                                    )
                                  );
                                }}
                                className="flex-1 bg-slate-600 text-white px-2 py-1 rounded text-xs"
                                min={MIN_SHIFT_RPM}
                                max={car.redlineRpm}
                              />
                            </div>
                          ))}
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

export const TachometerSettings = () => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets?.find((w) => w.id === SETTING_ID);
  const [settings, setSettings] = useState<TachometerWidgetSettings>({
    enabled: widget?.enabled ?? false,
    config: normalizeConfig(widget?.config ?? {}),
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Tachometer"
      description="Configure the tachometer display."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-6">
          {/* Show RPM Text */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-300">Show RPM Text</label>
            <ToggleSwitch
              enabled={settings.config.showRpmText}
              onToggle={(showRpmText) => handleConfigChange({ showRpmText })}
            />
          </div>

          {/* Custom Shift Points */}
          <CustomShiftPointsSection
            config={settings.config}
            handleConfigChange={handleConfigChange}
          />

          {/* Background Opacity */}
          <div className="space-y-2">
            <label className="text-sm text-slate-300">
              Background Opacity: {settings.config.background.opacity}%
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
              className="w-full"
            />
          </div>

          {/* Show Only When On Track */}
          <div className="flex items-center justify-between">
            <label className="text-sm text-slate-300">Show Only When On Track</label>
            <ToggleSwitch
              enabled={settings.config.showOnlyWhenOnTrack}
              onToggle={(showOnlyWhenOnTrack) => handleConfigChange({ showOnlyWhenOnTrack })}
            />
          </div>

          {/* Session Visibility */}
          <SessionVisibility
            sessionVisibility={settings.config.sessionVisibility}
            handleConfigChange={handleConfigChange}
          />
        </div>
      )}
    </BaseSettingsSection>
  );
};
