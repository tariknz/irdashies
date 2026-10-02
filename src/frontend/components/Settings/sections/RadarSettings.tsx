import { useEffect, useMemo, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard, useSessionDrivers } from '@irdashies/context';
import { typicalCarSize, type CarSize } from '@irdashies/domain/radar/carSizes';
import {
  RadarWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { HIGHLIGHT_COLOR_PRESETS } from './GeneralSettings';
import { paler } from '../../Radar/radarColors';

const SETTING_ID = 'radar';

const defaultConfig = getWidgetDefaultConfig('radar');

const COLOR_OPTIONS = [
  { label: 'White', value: '16777215' },
  ...Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(([value, label]) => ({
    label,
    value: String(value),
  })),
];

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const ColorRow = ({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <span
      className="rounded border-2 border-slate-600 shrink-0"
      style={{ width: 20, height: 20, backgroundColor: hex(value) }}
    />
    <div className="flex-1">
      <SettingSelectRow
        title={title}
        description={description}
        value={String(value)}
        options={COLOR_OPTIONS}
        onChange={(v) => onChange(parseInt(v, 10))}
      />
    </div>
  </div>
);

/** Free colour pick; until one is made, a paler shade of our own car. */
const CustomColorRow = ({
  value,
  playerColor,
  onChange,
}: {
  value: number | null;
  playerColor: number;
  onChange: (value: number | null) => void;
}) => {
  const shown = value === null ? paler(hex(playerColor)) : hex(value);
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-slate-300">Rival Fill</div>
        <div className="text-xs text-slate-500">
          {value === null ? 'A paler shade of your car.' : 'Your own pick.'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value !== null && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => onChange(null)}
          >
            Reset
          </button>
        )}
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))}
          className="w-10 h-8 bg-slate-700 rounded cursor-pointer"
        />
      </div>
    </div>
  );
};

interface SessionClass {
  name: string;
  color: number;
  carName: string;
}

/**
 * One row per class in the current session, so sizes can be tuned for the
 * field actually on track. Outside a session there is nothing to list.
 */
const ClassSizeRows = ({
  classSizes,
  fallback,
  onChange,
}: {
  classSizes: Record<string, CarSize>;
  fallback: CarSize;
  onChange: (classSizes: Record<string, CarSize>) => void;
}) => {
  const drivers = useSessionDrivers();
  const classes = useMemo(() => {
    const byName = new Map<string, SessionClass>();
    for (const driver of drivers ?? []) {
      if (driver.CarIsPaceCar === 1 || !driver.CarClassShortName) continue;
      if (!byName.has(driver.CarClassShortName)) {
        byName.set(driver.CarClassShortName, {
          name: driver.CarClassShortName,
          color: driver.CarClassColor,
          carName: driver.CarScreenName,
        });
      }
    }
    return [...byName.values()];
  }, [drivers]);

  if (classes.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Join a session to adjust the size of each class in it.
      </p>
    );
  }

  const setSize = (name: string, size: CarSize | undefined) => {
    const others = Object.fromEntries(
      Object.entries(classSizes).filter(([key]) => key !== name)
    );
    onChange(size ? { ...others, [name]: size } : others);
  };

  return (
    <div className="space-y-3">
      {classes.map((carClass) => {
        const saved = classSizes[carClass.name];
        const size =
          saved ?? typicalCarSize(carClass.name, carClass.carName) ?? fallback;
        return (
          <div
            key={carClass.name}
            className="rounded border border-slate-700/60 p-2 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="rounded-sm shrink-0"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: hex(carClass.color),
                }}
              />
              <span className="text-sm text-slate-200 flex-1">
                {carClass.name}
              </span>
              {saved ? (
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => setSize(carClass.name, undefined)}
                >
                  Reset
                </button>
              ) : (
                <span className="text-xs text-slate-500">typical</span>
              )}
            </div>
            <SettingSliderRow
              title="Length"
              value={size.length}
              units="m"
              min={3}
              max={6}
              step={0.05}
              onChange={(length) => setSize(carClass.name, { ...size, length })}
            />
            <SettingSliderRow
              title="Width"
              value={size.width}
              units="m"
              min={1.4}
              max={2.4}
              step={0.05}
              onChange={(width) => setSize(carClass.name, { ...size, width })}
            />
          </div>
        );
      })}
    </div>
  );
};

export const RadarSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RadarWidgetSettings | undefined;
  const [settings, setSettings] = useState<RadarWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('radarTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('radarTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const config = settings.config;

  return (
    <BaseSettingsSection
      title="Radar"
      description="A close-range radar centred on your car. The road turns with you, so the cars around you sit where they are on track."
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

          {activeTab === 'display' && (
            <SettingsSection title="Display">
              <SettingSliderRow
                title="Range"
                description="Metres from your car to the edge of the radar."
                value={config.range}
                units="m"
                min={10}
                max={100}
                step={5}
                onChange={(v) => handleConfigChange({ range: v })}
              />
              <SettingSliderRow
                title="Background Opacity"
                value={config.background.opacity}
                units="%"
                min={0}
                max={100}
                step={5}
                onChange={(v) =>
                  handleConfigChange({ background: { opacity: v } })
                }
              />
              <SettingSliderRow
                title="Edge Fade"
                description="How much of the radar fades out towards the edge, so cars ease in and out. 0% for a hard edge."
                value={config.edgeFade}
                units="%"
                min={0}
                max={100}
                step={5}
                onChange={(v) => handleConfigChange({ edgeFade: v })}
              />
              <SettingDivider />
              <SettingToggleRow
                title="Show Road"
                description="Draw the track under the cars, turning with your car."
                enabled={config.showTrackMap}
                onToggle={(v) => handleConfigChange({ showTrackMap: v })}
              />
              {config.showTrackMap && (
                <>
                  <SettingSliderRow
                    title="Road Opacity"
                    value={config.mapOpacity}
                    units="%"
                    min={5}
                    max={100}
                    step={5}
                    onChange={(v) => handleConfigChange({ mapOpacity: v })}
                  />
                  <SettingSliderRow
                    title="Road Width"
                    description="The track drawings carry no width, so pick one that looks right."
                    value={config.trackWidth}
                    units="m"
                    min={6}
                    max={25}
                    step={1}
                    onChange={(v) => handleConfigChange({ trackWidth: v })}
                  />
                </>
              )}
              <SettingToggleRow
                title="Distance Rings"
                enabled={config.showRings}
                onToggle={(v) => handleConfigChange({ showRings: v })}
              />
              {config.showRings && (
                <SettingSliderRow
                  title="Ring Spacing"
                  value={config.ringSpacing}
                  units="m"
                  min={5}
                  max={50}
                  step={5}
                  onChange={(v) => handleConfigChange({ ringSpacing: v })}
                />
              )}
              <SettingDivider />
              <SettingToggleRow
                title="Car Numbers"
                enabled={config.showCarNumbers}
                onToggle={(v) => handleConfigChange({ showCarNumbers: v })}
              />
              <SettingSelectRow
                title="Rival Colour"
                description="Colour rivals by licence (as on the rating badge), by car class, or all the same."
                value={config.rivalColorMode}
                options={[
                  { label: 'Licence (safety rating)', value: 'safety' },
                  { label: 'Car class', value: 'class' },
                  { label: 'Custom', value: 'custom' },
                ]}
                onChange={(v) => handleConfigChange({ rivalColorMode: v })}
              />
              {config.rivalColorMode === 'custom' && (
                <CustomColorRow
                  value={config.rivalCustomColor}
                  playerColor={config.playerColor}
                  onChange={(v) => handleConfigChange({ rivalCustomColor: v })}
                />
              )}
              <ColorRow
                title="Your Car"
                value={config.playerColor}
                onChange={(v) => handleConfigChange({ playerColor: v })}
              />
            </SettingsSection>
          )}

          {activeTab === 'options' && (
            <SettingsSection title="Options">
              <SettingToggleRow
                title="Auto Hide"
                description="Only show the radar while a car is close."
                enabled={config.autoHide}
                onToggle={(v) => handleConfigChange({ autoHide: v })}
              />
              {config.autoHide && (
                <>
                  <SettingSliderRow
                    title="Show Within"
                    description="The radar appears when a car comes this close."
                    value={config.showDistance}
                    units="m"
                    min={5}
                    max={100}
                    step={1}
                    onChange={(v) =>
                      handleConfigChange({
                        showDistance: v,
                        hideDistance: Math.max(config.hideDistance, v),
                      })
                    }
                  />
                  <SettingSliderRow
                    title="Hide Beyond"
                    description="The radar leaves once every car is further than this. Keep it above Show Within so it does not blink."
                    value={config.hideDistance}
                    units="m"
                    min={config.showDistance}
                    max={120}
                    step={1}
                    onChange={(v) => handleConfigChange({ hideDistance: v })}
                  />
                </>
              )}
              <SettingSliderRow
                title="Fade Time"
                value={config.fadeSeconds}
                units="s"
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => handleConfigChange({ fadeSeconds: v })}
              />
              <SettingDivider />
              <SettingToggleRow
                title="Warnings"
                description="Arcs on the rim and outlines on the car: amber when a car is close, pulsing red when it is alongside."
                enabled={config.showWarnings}
                onToggle={(v) => handleConfigChange({ showWarnings: v })}
              />
              {config.showWarnings && (
                <SettingSliderRow
                  title="Close Within"
                  description="Bumper-to-bumper gap at which a car turns amber."
                  value={config.cautionDistance}
                  units="m"
                  min={2}
                  max={20}
                  step={1}
                  onChange={(v) => handleConfigChange({ cautionDistance: v })}
                />
              )}
              <SettingDivider />
              <SettingSliderRow
                title="Default Car Length"
                description="iRacing does not report car sizes. Used for classes the radar does not recognise."
                value={config.carLength}
                units="m"
                min={3}
                max={6}
                step={0.1}
                onChange={(v) => handleConfigChange({ carLength: v })}
              />
              <SettingSliderRow
                title="Default Car Width"
                value={config.carWidth}
                units="m"
                min={1.4}
                max={2.4}
                step={0.1}
                onChange={(v) => handleConfigChange({ carWidth: v })}
              />
              <SettingToggleRow
                title="Size Cars by Class"
                description="Draw prototypes, stock cars and formula cars at their own typical size instead of the default. Sizes also decide when a car counts as alongside or close."
                enabled={config.sizeByClass}
                onToggle={(v) => handleConfigChange({ sizeByClass: v })}
              />
              {config.sizeByClass && (
                <ClassSizeRows
                  classSizes={config.classSizes}
                  fallback={{
                    length: config.carLength,
                    width: config.carWidth,
                  }}
                  onChange={(classSizes) => handleConfigChange({ classSizes })}
                />
              )}
              <SettingDivider />
              <SettingToggleRow
                title="Hide Cars Across the Pit Wall"
                description="On track, hide cars on pit road; on pit road, hide cars on track."
                enabled={config.hideInPit}
                onToggle={(v) => handleConfigChange({ hideInPit: v })}
              />
              <SettingToggleRow
                title="Hide in Pit Box"
                description="Keep the radar off screen while your car is parked in its pit box."
                enabled={config.hideInPitBox}
                onToggle={(v) => handleConfigChange({ hideInPitBox: v })}
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
                description="Hide the radar while you are not driving."
                enabled={config.showOnlyWhenOnTrack}
                onToggle={(v) => handleConfigChange({ showOnlyWhenOnTrack: v })}
              />
            </SettingsSection>
          )}
        </div>
      )}
    </BaseSettingsSection>
  );
};
