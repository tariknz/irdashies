import { useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  SettingsTabType,
  getWidgetDefaultConfig,
  type RadarWidgetSettings,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { RADAR_SHOW_RANGE_MARGIN_M } from '../../Radar/radarFade';
import { normaliseRadarConfig } from '../../Radar/hooks/useRadarSettings';

const SETTING_ID = 'radar';

const defaultConfig = getWidgetDefaultConfig('radar');

const ColorField = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) => (
  <label className="flex items-center gap-2 text-xs text-slate-400">
    <input
      type="color"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-6 w-8 flex-none cursor-pointer rounded bg-slate-700"
    />
    <span className="truncate">{label}</span>
  </label>
);

export const RadarSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === SETTING_ID
  ) as RadarWidgetSettings | undefined;
  const [settings, setSettings] = useState<RadarWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config: normaliseRadarConfig(
      (savedSettings?.config as RadarWidgetSettings['config']) ?? defaultConfig
    ),
  });

  // useState only reads its initialiser on the first render, and the Loading
  // return below does not re-run it. Mounting before the dashboard has loaded —
  // or switching profile — would otherwise leave this holding defaults, and
  // BaseSettingsSection persists the whole settings object, so the next edit to
  // any one control would write those defaults over the saved config. Re-seed
  // whenever the saved widget changes, using the same guarded
  // set-during-render sync as BaseSettingsSection so there is no stale paint.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) {
      setSettings({
        id: SETTING_ID,
        enabled: savedSettings.enabled ?? false,
        config: normaliseRadarConfig(
          (savedSettings.config as RadarWidgetSettings['config']) ??
            defaultConfig
        ),
      });
    } else {
      setSettings({
        id: SETTING_ID,
        enabled: false,
        config: normaliseRadarConfig(defaultConfig),
      });
    }
  }

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('radarTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('radarTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Radar"
      description="Proximity radar showing the cars around you, placed by their real distance along the track."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
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

          <div>
            {activeTab === 'display' && (
              <SettingsSection title="Display">
                <SettingSliderRow
                  title="Background Opacity"
                  value={settings.config.background?.opacity ?? 30}
                  units="%"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v } })
                  }
                />
                <SettingDivider />
                <SettingSelectRow
                  title="View mode"
                  description="Use the normal top-down radar or a rear-facing camera tilt."
                  value={settings.config.viewMode}
                  options={[
                    { label: 'Top-down', value: 'top' },
                    { label: 'Rear camera', value: 'rear' },
                  ]}
                  onChange={(v) => handleConfigChange({ viewMode: v })}
                />
                <SettingSelectRow
                  title="Side indicator"
                  description="Choose how left and right overlap signals are drawn."
                  value={settings.config.sideIndicatorStyle}
                  options={[
                    { label: 'Double arc', value: 'double-arc' },
                    { label: 'Following sector', value: 'follow-sector' },
                  ]}
                  onChange={(v) =>
                    handleConfigChange({ sideIndicatorStyle: v })
                  }
                />
                <SettingToggleRow
                  title="Side indicator"
                  description="Show the selected overlap/following sector indicator."
                  enabled={settings.config.sideIndicatorEnabled}
                  onToggle={(v) =>
                    handleConfigChange({ sideIndicatorEnabled: v })
                  }
                />
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <ColorField
                    label="Side indicator"
                    value={settings.config.sideIndicatorColor}
                    onChange={(v) =>
                      handleConfigChange({ sideIndicatorColor: v })
                    }
                  />
                  <SettingSliderRow
                    title="Side indicator opacity"
                    value={settings.config.sideIndicatorOpacity}
                    units="%"
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) =>
                      handleConfigChange({ sideIndicatorOpacity: v })
                    }
                  />
                </div>
                {settings.config.viewMode === 'rear' && (
                  <SettingSliderRow
                    title="Rear camera tilt"
                    description="Tilts the camera behind the car for a following perspective."
                    value={settings.config.rearCameraTilt}
                    units="°"
                    min={15}
                    max={75}
                    step={5}
                    onChange={(v) => handleConfigChange({ rearCameraTilt: v })}
                  />
                )}
                <SettingSelectRow
                  title="Opponent colour"
                  description="Use the iRacing class colour, the driver badge colour, or one custom colour for every opponent."
                  value={settings.config.rivalColorMode}
                  options={[
                    { label: 'Class colour (multi-class)', value: 'class' },
                    { label: 'Driver badge', value: 'badge' },
                    { label: 'Custom', value: 'custom' },
                  ]}
                  onChange={(v) => handleConfigChange({ rivalColorMode: v })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <ColorField
                    label="Your car"
                    value={settings.config.colorPlayer}
                    onChange={(v) => handleConfigChange({ colorPlayer: v })}
                  />
                  {settings.config.rivalColorMode === 'custom' && (
                    <ColorField
                      label="Opponents"
                      value={settings.config.colorRival}
                      onChange={(v) => handleConfigChange({ colorRival: v })}
                    />
                  )}
                </div>
                <SettingToggleRow
                  title="Track map"
                  description="Show the track map inside the radar."
                  enabled={settings.config.showTrackMap}
                  onToggle={(v) => handleConfigChange({ showTrackMap: v })}
                />
                {settings.config.showTrackMap && (
                  <>
                    <SettingDivider />
                    <div>
                      <h3 className="text-sm font-medium text-slate-200">
                        Road
                      </h3>
                      <p className="mt-1 text-xs text-slate-400">
                        Border is the outer edge of the road. Fill is the inner
                        road surface. They are independent layers.
                      </p>
                      <div className="mt-3 space-y-3">
                        <div className="rounded bg-slate-900/50 p-2">
                          <ColorField
                            label="Road border"
                            value={settings.config.mapBorderColor}
                            onChange={(v) =>
                              handleConfigChange({ mapBorderColor: v })
                            }
                          />
                          <SettingSliderRow
                            title="Border opacity"
                            value={settings.config.mapBorderOpacity}
                            units="%"
                            min={0}
                            max={100}
                            step={5}
                            onChange={(v) =>
                              handleConfigChange({ mapBorderOpacity: v })
                            }
                          />
                        </div>
                        <div className="rounded bg-slate-900/50 p-2">
                          <ColorField
                            label="Road surface"
                            value={settings.config.mapFillColor}
                            onChange={(v) =>
                              handleConfigChange({ mapFillColor: v })
                            }
                          />
                          <SettingSliderRow
                            title="Surface opacity"
                            value={settings.config.mapFillOpacity}
                            units="%"
                            min={0}
                            max={100}
                            step={5}
                            onChange={(v) =>
                              handleConfigChange({ mapFillOpacity: v })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </>
                )}
                <SettingToggleRow
                  title="Show only when a car is near"
                  description="Keep the radar off screen until a car comes within the near range. Nothing is drawn while the track around you is clear."
                  enabled={settings.config.showWhenNearby}
                  onToggle={(v) => handleConfigChange({ showWhenNearby: v })}
                />
                {settings.config.showWhenNearby && (
                  <SettingSliderRow
                    title="Near Range"
                    description="How close a car has to be to bring the radar on screen, in metres, with the maximum kept inside the visible field so the panel never waits for an unseen car."
                    value={Math.min(
                      settings.config.showRange,
                      settings.config.radarRange - RADAR_SHOW_RANGE_MARGIN_M
                    )}
                    units="m"
                    min={2}
                    max={settings.config.radarRange - RADAR_SHOW_RANGE_MARGIN_M}
                    step={0.5}
                    onChange={(v) => handleConfigChange({ showRange: v })}
                  />
                )}
                <SettingSliderRow
                  title="Fade Duration"
                  description="Seconds the radar takes to appear and disappear. 0 makes it instant."
                  value={settings.config.fadeSeconds}
                  units="s"
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ fadeSeconds: v })}
                />
                <SettingDivider />
                <SettingToggleRow
                  title="Car numbers on blips"
                  description="Label each car with its number, so you know who is alongside."
                  enabled={settings.config.showCarNumbers}
                  onToggle={(v) => handleConfigChange({ showCarNumbers: v })}
                />
              </SettingsSection>
            )}

            {activeTab === 'options' && (
              <SettingsSection title="Options">
                <SettingSliderRow
                  title="Radar Range"
                  description="How far from your car cars are still shown, in metres."
                  value={settings.config.radarRange}
                  units="m"
                  min={10}
                  max={25}
                  step={1}
                  onChange={(v) => handleConfigChange({ radarRange: v })}
                />
                <SettingDivider />
                <SettingNumberRow
                  title="Car Width"
                  description="Opponent car width in metres. The sim reports no per-car size, so blips use this."
                  value={settings.config.vehicleWidth}
                  min={1}
                  max={2.5}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ vehicleWidth: v })}
                />
                <SettingNumberRow
                  title="Car Length"
                  description="Opponent car length in metres."
                  value={settings.config.vehicleLength}
                  min={3}
                  max={6}
                  step={0.1}
                  onChange={(v) => handleConfigChange({ vehicleLength: v })}
                />
                <SettingDivider />
                <SettingToggleRow
                  title="Hide cars in pit"
                  description="Cars on pit road sit on the same centreline as the track, so they would show as cars on the racing line."
                  enabled={settings.config.hideInPit}
                  onToggle={(v) => handleConfigChange({ hideInPit: v })}
                />
              </SettingsSection>
            )}

            {activeTab === 'visibility' && (
              <SettingsSection title="Session Visibility">
                <SessionVisibility
                  sessionVisibility={settings.config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />

                <SettingDivider />

                <SettingToggleRow
                  title="Show only when on track"
                  description="If enabled, the radar is only shown when driving."
                  enabled={settings.config.showOnlyWhenOnTrack}
                  onToggle={(v) =>
                    handleConfigChange({ showOnlyWhenOnTrack: v })
                  }
                />
              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
