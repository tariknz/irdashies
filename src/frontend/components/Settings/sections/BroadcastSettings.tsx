import { Fragment, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { changeMarker } from '../components/ChangedMark';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { DriverNamePreview } from '../components/DriverNamePreview';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { SettingSelectRow } from '../components/SettingSelectRow';
import type {
  BroadcastConfig,
  BroadcastHeaderClock,
  BroadcastPage,
  BroadcastTheme,
  BroadcastWidgetSettings,
  NameFormat,
} from '@irdashies/types';

const SETTING_ID = 'broadcast';

const defaultConfig = getWidgetDefaultConfig('broadcast');

const THEME_OPTIONS: { label: string; value: BroadcastTheme }[] = [
  { label: 'IMSA', value: 'imsa' },
  { label: 'WEC', value: 'wec' },
  { label: 'F1', value: 'f1' },
];

const CLOCK_OPTIONS: { label: string; value: BroadcastHeaderClock }[] = [
  { label: 'Session', value: 'session' },
  { label: 'Session + Track Time', value: 'session-track' },
  { label: 'Session + Local Time', value: 'session-local' },
  { label: 'Laps + Time', value: 'laps-time' },
];

const PAGE_MODE_OPTIONS: {
  label: string;
  value: BroadcastConfig['pageMode'];
}[] = [
  { label: 'Rotate', value: 'rotate' },
  { label: 'Static', value: 'static' },
];

const PAGE_OPTIONS: {
  label: string;
  value: BroadcastPage;
  description: string;
}[] = [
  { label: 'Names', value: 'names', description: 'Positions and drivers.' },
  {
    label: 'Intervals',
    value: 'gaps',
    description: 'One page per class, with the closest battle under it.',
  },
  {
    label: '+/- Start',
    value: 'gained',
    description: 'Places gained since the start. Races only.',
  },
  {
    label: 'Last Pit',
    value: 'pits',
    description: 'Lap of the last stop, once someone has pitted.',
  },
  {
    label: 'Tyres',
    value: 'tyres',
    description: 'Current compound, when the car has a choice.',
  },
];

// ponytail: the logo lives inline in the dashboard config so it reaches the
// OBS page for free; the cap keeps config.json small. A file store comes in
// if people want large or many images.
const MAX_LOGO_BYTES = 300 * 1024;

const NAME_FORMATS: readonly NameFormat[] = [
  'name-surname',
  'n.-surname',
  'surname-n.',
  'surname',
];

export const BroadcastSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });
  const [logoError, setLogoError] = useState('');

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const { config } = settings;

  return (
    <BaseSettingsSection
      title="Broadcast"
      description="TV-style timing tower that cycles between names, per-class intervals with close battles, positions gained, pit laps and tyres, plus a card for the car on camera."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const mark = changeMarker(config, defaultConfig, handleConfigChange);
        const markFade = changeMarker(
          config.translucent,
          defaultConfig.translucent,
          (c) =>
            handleConfigChange({ translucent: { ...config.translucent, ...c } })
        );
        const markPages = changeMarker(config.pages, defaultConfig.pages, (c) =>
          handleConfigChange({ pages: { ...config.pages, ...c } })
        );
        return (
          <div className="space-y-4">
            <SettingsSection title="Look">
              {mark(
                ['theme'],
                <SettingButtonGroupRow<BroadcastTheme>
                  title="Theme"
                  value={config.theme}
                  options={THEME_OPTIONS}
                  onChange={(v) => handleConfigChange({ theme: v })}
                />
              )}
              {mark(
                ['logo'],
                <div className="space-y-2 py-2">
                  <div className="text-sm text-slate-300">Series Logo</div>
                  <p className="text-sm text-slate-500">
                    Shown above the tower title. PNG with transparency works
                    best, up to 300 KB.
                  </p>
                  <div className="flex items-center gap-3">
                    {config.logo.startsWith('data:image/') && (
                      <img
                        src={config.logo}
                        alt=""
                        className="max-h-10 rounded bg-slate-900 p-1"
                      />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="text-sm text-slate-300"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (!file) return;
                        if (!file.type.startsWith('image/')) {
                          return setLogoError('Pick an image file.');
                        }
                        if (file.size > MAX_LOGO_BYTES) {
                          return setLogoError('That image is over 300 KB.');
                        }
                        setLogoError('');
                        const reader = new FileReader();
                        reader.onload = () =>
                          handleConfigChange({ logo: String(reader.result) });
                        reader.readAsDataURL(file);
                      }}
                    />
                    {config.logo && (
                      <button
                        type="button"
                        onClick={() => handleConfigChange({ logo: '' })}
                        className="rounded bg-slate-600 px-3 py-1 text-sm text-slate-200 hover:bg-slate-500"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  {logoError && (
                    <p className="text-sm text-red-400">{logoError}</p>
                  )}
                </div>
              )}
            </SettingsSection>

            <SettingsSection title="Options">
              {mark(
                ['background'],
                <SettingSliderRow
                  title="Background Opacity"
                  value={config.background.opacity}
                  units="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v } })
                  }
                />
              )}
              {markFade(
                ['enabled'],
                <SettingToggleRow
                  title="Translucent"
                  description="Fade the whole widget, text included, so it hides less of the stream."
                  enabled={config.translucent.enabled}
                  onToggle={(v) =>
                    handleConfigChange({
                      translucent: { ...config.translucent, enabled: v },
                    })
                  }
                />
              )}
              {config.translucent.enabled &&
                markFade(
                  ['opacity'],
                  <SettingSliderRow
                    title="Widget Opacity"
                    value={config.translucent.opacity}
                    units="%"
                    min={20}
                    max={100}
                    step={5}
                    onChange={(v) =>
                      handleConfigChange({
                        translucent: { ...config.translucent, opacity: v },
                      })
                    }
                  />
                )}
              {mark(
                ['driversPerClass'],
                <SettingSliderRow
                  title="Drivers Per Class"
                  value={config.driversPerClass}
                  min={1}
                  max={30}
                  step={1}
                  onChange={(v) => handleConfigChange({ driversPerClass: v })}
                />
              )}
              {mark(
                ['headerClock'],
                <SettingSelectRow<BroadcastHeaderClock>
                  title="Header Clock"
                  description="The session clock, plus the time of day at the track or on this PC, or laps and time together."
                  value={config.headerClock}
                  options={CLOCK_OPTIONS}
                  onChange={(v) => handleConfigChange({ headerClock: v })}
                />
              )}
              {mark(
                ['pageMode'],
                <SettingButtonGroupRow<BroadcastConfig['pageMode']>
                  title="Pages"
                  description="Rotate through the pages you pick, or keep one page up."
                  value={config.pageMode}
                  options={PAGE_MODE_OPTIONS}
                  onChange={(v) => handleConfigChange({ pageMode: v })}
                />
              )}
              {config.pageMode === 'static' ? (
                mark(
                  ['staticPage'],
                  <SettingSelectRow<BroadcastPage>
                    title="Page"
                    description="Intervals here show every class at once."
                    value={config.staticPage}
                    options={PAGE_OPTIONS}
                    onChange={(v) => handleConfigChange({ staticPage: v })}
                  />
                )
              ) : (
                <>
                  {PAGE_OPTIONS.map(({ label, value, description }) => (
                    <Fragment key={value}>
                      {markPages(
                        [value],
                        <SettingToggleRow
                          title={label}
                          description={description}
                          enabled={config.pages[value]}
                          onToggle={(v) =>
                            handleConfigChange({
                              pages: { ...config.pages, [value]: v },
                            })
                          }
                        />
                      )}
                    </Fragment>
                  ))}
                  {mark(
                    ['pageSeconds'],
                    <SettingSliderRow
                      title="Page Time"
                      value={config.pageSeconds}
                      units="s"
                      min={3}
                      max={30}
                      step={1}
                      onChange={(v) => handleConfigChange({ pageSeconds: v })}
                    />
                  )}
                </>
              )}
              {mark(
                ['title'],
                <div className="space-y-2 py-2">
                  <label className="text-sm text-slate-300">Title</label>
                  <input
                    type="text"
                    value={config.title}
                    placeholder="Track name"
                    onChange={(e) =>
                      handleConfigChange({ title: e.target.value })
                    }
                    className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
                  />
                </div>
              )}
              {mark(
                ['showFocusCard'],
                <SettingToggleRow
                  title="Focus Car Card"
                  description="Show name, team and lap times of the car the camera is on."
                  enabled={config.showFocusCard}
                  onToggle={(v) => handleConfigChange({ showFocusCard: v })}
                />
              )}
              {mark(
                ['phaseScreens'],
                <SettingToggleRow
                  title="Starting Grid"
                  description="Show the starting grid under the tower before the race starts. The podium is its own module."
                  enabled={config.phaseScreens}
                  onToggle={(v) => handleConfigChange({ phaseScreens: v })}
                />
              )}
              {mark(
                ['driverNameFormat'],
                <div className="py-2">
                  <div className="text-sm text-slate-300">Driver Name</div>
                  <div className="flex flex-wrap gap-3 justify-end mt-3">
                    {NAME_FORMATS.map((format) => (
                      <DriverNamePreview
                        key={format}
                        format={format}
                        selected={config.driverNameFormat === format}
                        onClick={() =>
                          handleConfigChange({ driverNameFormat: format })
                        }
                      />
                    ))}
                  </div>
                </div>
              )}
            </SettingsSection>

            <SettingsSection title="Visibility">
              {mark(
                ['sessionVisibility'],
                <SessionVisibility
                  sessionVisibility={config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />
              )}
            </SettingsSection>
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
