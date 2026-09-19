import { useDashboard } from '@irdashies/context';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusIcon } from '@phosphor-icons/react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import {
  InputWidgetSettings,
  LayoutNode,
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
import { LayoutVisualizer } from './LayoutVisualizer';
import {
  INPUT_ELEMENTS,
  buildDefaultInputTree,
  hasLayoutTree,
} from '../../Input/layout';

const WIDGET_TYPE = 'input';
const TABS: SettingsTabType[] = ['layout', 'options', 'visibility'];

const defaultConfig = getWidgetDefaultConfig('input');

const DEFAULT_SHIFT_FLASH: NonNullable<
  InputWidgetSettings['config']['shiftFlash']
> = {
  enabled: false,
  source: 'redline',
  color: '#9333ea',
};

const generateId = () => Math.random().toString(36).substring(2, 9);

// Configs saved before the layout editor have no tree. Seed one from the
// enabled flags so the editor shows what the overlay draws today.
const withLayoutTree = (
  config: InputWidgetSettings['config']
): InputWidgetSettings['config'] => {
  if (hasLayoutTree(config.layoutTree)) return config;
  const tree = buildDefaultInputTree(config);
  const isEmpty = tree.type === 'split' && tree.children.length === 0;
  return {
    ...config,
    layoutTree: isEmpty ? buildDefaultInputTree(defaultConfig) : tree,
  };
};

export const InputSettings = ({ widgetId }: { widgetId?: string }) => {
  const id = widgetId ?? WIDGET_TYPE;
  return <SingleInputWidgetSettings key={id} widgetId={id} />;
};

const SingleInputWidgetSettings = ({ widgetId }: { widgetId: string }) => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const navigate = useNavigate();

  const inputWidgets =
    currentDashboard?.widgets.filter((w) => (w.type || w.id) === WIDGET_TYPE) ??
    [];

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === widgetId
  ) as InputWidgetSettings | undefined;
  const [settings, setSettings] = useState<InputWidgetSettings>(() => ({
    enabled: savedSettings?.enabled ?? false,
    config: withLayoutTree(
      (savedSettings?.config as InputWidgetSettings['config']) ?? defaultConfig
    ),
  }));

  const currentTree = useMemo(
    () => withLayoutTree(settings.config).layoutTree as LayoutNode,
    [settings.config]
  );

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(() => {
    const saved = localStorage.getItem('inputTab') as SettingsTabType | null;
    return saved && TABS.includes(saved) ? saved : 'layout';
  });

  useEffect(() => {
    localStorage.setItem('inputTab', activeTab);
  }, [activeTab]);

  const handleWidgetChange = (newId: string) => {
    navigate(`/settings/${newId}`);
  };

  const handleAddWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;
    const newId = `${WIDGET_TYPE}-${generateId()}`;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: [
        ...currentDashboard.widgets,
        {
          id: newId,
          type: WIDGET_TYPE,
          enabled: true,
          layout: { x: 50, y: 50, width: 400, height: 120 },
          config: defaultConfig as unknown as Record<string, unknown>,
        },
      ],
    });
    handleWidgetChange(newId);
  };

  const handleDeleteWidget = () => {
    if (!currentDashboard || !onDashboardUpdated) return;
    if (widgetId === WIDGET_TYPE) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.filter((w) => w.id !== widgetId),
    });
    handleWidgetChange(WIDGET_TYPE);
  };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const isDefaultWidget = widgetId === WIDGET_TYPE;

  return (
    <BaseSettingsSection
      title={isDefaultWidget ? 'Input Traces' : `Input Traces - ${widgetId}`}
      description="Configure the input traces display settings for throttle, brake, and clutch."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={widgetId}
    >
      {(handleConfigChange) => {
        const handleTreeUpdate = (newTree: LayoutNode) => {
          handleConfigChange({ layoutTree: newTree });
        };

        const config = settings.config;
        const shiftFlash = { ...DEFAULT_SHIFT_FLASH, ...config.shiftFlash };

        return (
          <div className="space-y-4">
            {/* Instance manager */}
            <div className="bg-slate-800 p-3 rounded flex items-center justify-between border border-slate-700">
              <div className="flex items-center gap-3">
                <span className="text-sm font-bold text-slate-200">
                  Editing Widget:
                </span>
                <select
                  value={widgetId}
                  onChange={(e) => handleWidgetChange(e.target.value)}
                  className="bg-slate-900 border border-slate-600 text-white text-sm rounded px-2 py-1"
                >
                  {inputWidgets.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.id}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleDeleteWidget}
                  disabled={isDefaultWidget}
                  title={
                    isDefaultWidget
                      ? 'Default widget cannot be deleted. Disable it instead.'
                      : 'Delete this input widget'
                  }
                  className={`px-3 py-1 text-xs rounded border transition-colors ${
                    isDefaultWidget
                      ? 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed opacity-50'
                      : 'bg-red-900/50 hover:bg-red-900 text-red-200 border-red-800'
                  }`}
                >
                  {isDefaultWidget ? 'Default (Locked)' : 'Delete Widget'}
                </button>
                <button
                  onClick={handleAddWidget}
                  className="flex items-center gap-1 px-3 py-1 bg-green-700 hover:bg-green-600 text-white text-xs rounded transition-colors"
                >
                  <PlusIcon /> New Input Widget
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-700/50">
              <TabButton
                id="layout"
                activeTab={activeTab}
                setActiveTab={setActiveTab}
              >
                Layout
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

            <div>
              {/* LAYOUT TAB */}
              {activeTab === 'layout' && (
                <SettingsSection title="Layout Editor">
                  <LayoutVisualizer
                    tree={currentTree}
                    onChange={handleTreeUpdate}
                    availableWidgets={INPUT_ELEMENTS}
                  />

                  <SettingActionButton
                    label="Reset to Default Layout"
                    onClick={() =>
                      handleTreeUpdate(buildDefaultInputTree(defaultConfig))
                    }
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

                  {/* Shift Flash Settings */}
                  <SettingsSection title="Shift Flash">
                    <SettingToggleRow
                      title="Flash Layout at Shift Point"
                      description="Flash the whole layout background when it is time to shift"
                      enabled={shiftFlash.enabled}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          shiftFlash: { ...shiftFlash, enabled },
                        })
                      }
                    />

                    {shiftFlash.enabled && (
                      <SettingsSection>
                        <SettingButtonGroupRow<'redline' | 'shiftPoints'>
                          title="Flash At"
                          description="Shift Points uses the custom shift points set for this car in the Tachometer settings. Gears without one use the redline."
                          value={shiftFlash.source}
                          options={[
                            { label: 'Redline', value: 'redline' },
                            { label: 'Shift Points', value: 'shiftPoints' },
                          ]}
                          onChange={(source) =>
                            handleConfigChange({
                              shiftFlash: { ...shiftFlash, source },
                            })
                          }
                        />

                        <div className="flex items-center justify-between">
                          <span className="text-md text-slate-300">
                            Flash Color
                          </span>
                          <input
                            type="color"
                            value={shiftFlash.color}
                            onChange={(e) =>
                              handleConfigChange({
                                shiftFlash: {
                                  ...shiftFlash,
                                  color: e.target.value,
                                },
                              })
                            }
                            className="h-8 w-12 rounded bg-slate-700 cursor-pointer"
                          />
                        </div>
                      </SettingsSection>
                    )}
                  </SettingsSection>

                  {/* Trace Settings */}
                  <SettingsSection title="Trace">
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

                    {config.trace.includeAbs && (
                      <SettingSelectRow<'overlay' | 'bar'>
                        title="ABS Style"
                        description="How ABS is shown in the trace"
                        value={config.trace.absStyle ?? 'overlay'}
                        options={[
                          {
                            label: 'Overlay',
                            value: 'overlay',
                          },
                          {
                            label: 'Bar (fill under curve)',
                            value: 'bar',
                          },
                        ]}
                        onChange={(v) =>
                          handleConfigChange({
                            trace: {
                              ...config.trace,
                              absStyle: v,
                            },
                          })
                        }
                      />
                    )}

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

                  {/* Bar Settings */}
                  <SettingsSection title="Bar">
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

                  {/* Steer Settings */}
                  <SettingsSection title="Steer">
                    <SettingSelectRow<
                      | 'default'
                      | 'formula'
                      | 'lmp'
                      | 'nascar'
                      | 'ushape'
                      | 'ring'
                    >
                      title="Wheel Style"
                      value={config.steer.config.style ?? 'default'}
                      options={[
                        { label: 'Default', value: 'default' },
                        { label: 'Formula', value: 'formula' },
                        { label: 'LMP', value: 'lmp' },
                        { label: 'NASCAR', value: 'nascar' },
                        { label: 'U-Shape', value: 'ushape' },
                        { label: 'Ring (gear inside)', value: 'ring' },
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

                  {/* Gear Settings */}
                  <SettingsSection title="Gear">
                    <SettingSliderRow
                      title="Gear Display Scale"
                      description="Relative size of the gear number display"
                      value={settings.config.gear.size ?? 100}
                      units="%"
                      min={50}
                      max={150}
                      step={1}
                      onChange={(v) =>
                        handleConfigChange({
                          gear: { ...config.gear, size: v },
                        })
                      }
                    />

                    <SettingToggleRow
                      title="Show Speed"
                      description="Show the current speed beneath the gear number"
                      enabled={config.gear.showspeed}
                      onToggle={(newValue) =>
                        handleConfigChange({
                          gear: { ...config.gear, showspeed: newValue },
                        })
                      }
                    />

                    {config.gear.showspeed && (
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

                        <SettingToggleRow
                          title="Show Speed Unit Label"
                          enabled={config.gear.showspeedunit}
                          onToggle={(newValue) =>
                            handleConfigChange({
                              gear: {
                                ...config.gear,
                                showspeedunit: newValue,
                              },
                            })
                          }
                        />

                        <SettingToggleRow
                          title="Swap Speed & Unit"
                          enabled={config.gear.swapSpeedUnit ?? false}
                          onToggle={(newValue) =>
                            handleConfigChange({
                              gear: {
                                ...config.gear,
                                swapSpeedUnit: newValue,
                              },
                            })
                          }
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
