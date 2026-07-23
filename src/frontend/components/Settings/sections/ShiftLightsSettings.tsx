import { useEffect, useMemo, useState } from 'react';
import { CaretDownIcon, CaretRightIcon } from '@phosphor-icons/react';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  type SettingsTabType,
  type ShiftLightsConfig,
  type ShiftLightsWidgetSettings,
  type ShiftPointSettings,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { getAvailableCars } from '@irdashies/utils/carData';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { TabButton } from '../components/TabButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { ToggleSwitch } from '../components/ToggleSwitch';

const defaultConfig = getWidgetDefaultConfig('shiftlights');
const MIN_SHIFT_RPM = 1000;

interface CustomShiftPointsProps {
  settings: ShiftPointSettings;
  onChange: (settings: ShiftPointSettings) => void;
}

const CustomShiftPoints = ({ settings, onChange }: CustomShiftPointsProps) => {
  const [selectedCarId, setSelectedCarId] = useState('');
  const [expandedCarId, setExpandedCarId] = useState<string | null>(null);
  const availableCars = useMemo(
    () => getAvailableCars().sort((a, b) => a.carName.localeCompare(b.carName)),
    []
  );
  const configuredCars = Object.values(settings.carConfigs);
  const availableToAdd = availableCars.filter(
    (car) => !settings.carConfigs[car.carId]
  );

  const update = (changes: Partial<ShiftPointSettings>) =>
    onChange({ ...settings, ...changes });

  const addCar = () => {
    const car = availableCars.find(
      (candidate) => candidate.carId === selectedCarId
    );
    if (!car) return;
    const ledRpm = (car.ledRpm?.[0] ?? {}) as Record<string, number[]>;
    const gears = Object.keys(ledRpm)
      .map(Number)
      .filter((gear) => Number.isInteger(gear) && gear > 0);
    const gearCount = gears.length > 0 ? Math.max(...gears) : 6;
    const allRpms = Object.values(ledRpm).flat().filter(Number.isFinite);
    const redlineRpm = allRpms.length > 0 ? Math.max(...allRpms) : 8000;
    const gearShiftPoints = Object.fromEntries(
      Array.from({ length: gearCount }, (_, index) => {
        const gear = String(index + 1);
        const thresholds = ledRpm[gear];
        return [
          gear,
          {
            shiftRpm:
              thresholds && thresholds.length > 0
                ? Math.max(...thresholds)
                : Math.max(MIN_SHIFT_RPM, Math.round(redlineRpm * 0.9)),
          },
        ];
      })
    );

    update({
      carConfigs: {
        ...settings.carConfigs,
        [car.carId]: {
          enabled: true,
          carId: car.carId,
          carName: car.carName,
          gearCount,
          redlineRpm,
          gearShiftPoints,
        },
      },
    });
    setSelectedCarId('');
  };

  const updateCar = (
    carId: string,
    changes: Partial<ShiftPointSettings['carConfigs'][string]>
  ) => {
    const car = settings.carConfigs[carId];
    if (!car) return;
    update({
      carConfigs: {
        ...settings.carConfigs,
        [carId]: { ...car, ...changes },
      },
    });
  };

  const deleteCar = (carId: string) => {
    const remaining = Object.fromEntries(
      Object.entries(settings.carConfigs).filter(([id]) => id !== carId)
    );
    update({ carConfigs: remaining });
  };

  return (
    <div className="space-y-4">
      <SettingToggleRow
        title="Enable Custom Shift Points"
        description="Show a dedicated SHIFT indicator at configured per-gear thresholds."
        enabled={settings.enabled}
        onToggle={(enabled) => update({ enabled })}
      />
      {settings.enabled && (
        <>
          <div className="space-y-2">
            <label className="text-xs text-slate-400">Indicator Type</label>
            <select
              value={settings.indicatorType}
              onChange={(event) =>
                update({
                  indicatorType: event.target.value as
                    'glow' | 'pulse' | 'border',
                })
              }
              className="w-full rounded bg-slate-700 px-3 py-2 text-sm text-white"
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
              value={settings.indicatorColor}
              onChange={(event) =>
                update({ indicatorColor: event.target.value })
              }
              className="h-10 w-full cursor-pointer rounded bg-slate-700"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={selectedCarId}
              onChange={(event) => setSelectedCarId(event.target.value)}
              className="flex-1 rounded bg-slate-700 px-3 py-2 text-sm text-white"
            >
              <option value="">Select a car...</option>
              {availableToAdd.map((car) => (
                <option key={car.carId} value={car.carId}>
                  {car.carName}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!selectedCarId}
              onClick={addCar}
              className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-600"
            >
              Add
            </button>
          </div>
          {configuredCars.map((car) => {
            const expanded = expandedCarId === car.carId;
            return (
              <div
                key={car.carId}
                className="space-y-2 rounded bg-slate-700 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    aria-label={`${expanded ? 'Collapse' : 'Expand'} ${car.carName}`}
                    onClick={() =>
                      setExpandedCarId(expanded ? null : car.carId)
                    }
                    className="flex min-w-0 items-center gap-2 text-left text-sm text-white"
                  >
                    {expanded ? (
                      <CaretDownIcon size={16} />
                    ) : (
                      <CaretRightIcon size={16} />
                    )}
                    <span className="truncate">{car.carName}</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <ToggleSwitch
                      enabled={car.enabled}
                      onToggle={(enabled) => updateCar(car.carId, { enabled })}
                    />
                    <button
                      type="button"
                      onClick={() => deleteCar(car.carId)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-300"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                {expanded && (
                  <div className="grid grid-cols-2 gap-2 border-t border-slate-600 pt-2">
                    {Object.entries(car.gearShiftPoints).map(
                      ([gear, point]) => (
                        <label
                          key={gear}
                          className="flex items-center gap-2 text-xs text-slate-400"
                        >
                          Gear {gear}
                          <input
                            type="number"
                            value={point.shiftRpm}
                            min={MIN_SHIFT_RPM}
                            max={car.redlineRpm}
                            onChange={(event) =>
                              updateCar(car.carId, {
                                gearShiftPoints: {
                                  ...car.gearShiftPoints,
                                  [gear]: {
                                    shiftRpm: Number(event.target.value),
                                  },
                                },
                              })
                            }
                            className="min-w-0 flex-1 rounded bg-slate-600 px-2 py-1 text-white"
                          />
                        </label>
                      )
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </>
      )}
    </div>
  );
};

export const ShiftLightsSettings = () => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => (widget.type ?? widget.id) === 'shiftlights'
  );
  const [settings, setSettings] = useState<ShiftLightsWidgetSettings>({
    enabled: saved?.enabled ?? false,
    config: deepMergeConfig(
      defaultConfig as unknown as Record<string, unknown>,
      saved?.config
    ) as unknown as ShiftLightsConfig,
  });
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('shiftLightsTab') as SettingsTabType) ?? 'display'
  );

  useEffect(
    () => localStorage.setItem('shiftLightsTab', activeTab),
    [activeTab]
  );
  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Shift Lights"
      description="Configure the LED bar and custom shift indicator."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId="shiftlights"
    >
      {(handleConfigChange) => {
        const config = settings.config;
        return (
          <div className="space-y-6">
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

            {activeTab === 'display' && (
              <SettingsSection title="Display">
                <SettingSliderRow
                  title="Background Opacity"
                  value={config.background.opacity}
                  units="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(opacity) =>
                    handleConfigChange({ background: { opacity } })
                  }
                />
              </SettingsSection>
            )}

            {activeTab === 'options' && (
              <SettingsSection title="Custom Shift Points">
                <CustomShiftPoints
                  settings={config.shiftPointSettings}
                  onChange={(shiftPointSettings) =>
                    handleConfigChange({ shiftPointSettings })
                  }
                />
              </SettingsSection>
            )}

            {activeTab === 'visibility' && (
              <SettingsSection title="Session Visibility">
                <SessionVisibility
                  sessionVisibility={config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
                <SettingDivider />
                <SettingToggleRow
                  title="Show only when on track"
                  enabled={config.showOnlyWhenOnTrack}
                  onToggle={(showOnlyWhenOnTrack) =>
                    handleConfigChange({ showOnlyWhenOnTrack })
                  }
                />
              </SettingsSection>
            )}
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
