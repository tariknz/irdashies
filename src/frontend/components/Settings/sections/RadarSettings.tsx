import { useEffect, useMemo, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard, useSessionStore } from '@irdashies/context';
import type {
  RadarConfig,
  RadarTuning,
  RadarWidgetSettings,
} from '@irdashies/types';
import {
  applyProfileChange,
  isOvalTrack,
  profileView,
  type RadarProfileId,
} from '@irdashies/domain/radar/radarProfile';
import { withRadarDefaults } from '../../Radar/hooks/useRadarSettings';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { RadarPreview } from './RadarSettings/RadarPreview';
import {
  RADAR_PRESETS,
  RADAR_SECTIONS,
  isChanged,
  matchesQuery,
  matchingPreset,
  presetChange,
  resetChange,
  type ItemContext,
  type SettingsLevel,
} from './RadarSettings/radarSettingsItems';

const SETTING_ID = 'radar';
const LEVEL_KEY = 'radarSettingsLevel';

const LEVELS: { level: SettingsLevel; label: string; active: string }[] = [
  { level: 0, label: 'Basic', active: 'bg-slate-600 text-white' },
  { level: 1, label: 'Advanced', active: 'bg-teal-700 text-white' },
  { level: 2, label: 'Dev', active: 'bg-amber-600 text-white' },
];

const readLevel = (): SettingsLevel => {
  const saved = Number(localStorage.getItem(LEVEL_KEY));
  return saved === 1 || saved === 2 ? saved : 0;
};

const Segmented = <T extends string | number>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string; active?: string }[];
  onChange: (value: T) => void;
}) => (
  <div className="inline-flex rounded-md bg-slate-900 p-0.5 gap-0.5">
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        aria-pressed={option.value === value}
        onClick={() => onChange(option.value)}
        className={`px-3 py-1 rounded text-sm transition-colors ${
          option.value === value
            ? (option.active ?? 'bg-slate-600 text-white')
            : 'text-slate-400 hover:text-slate-200'
        }`}
      >
        {option.label}
      </button>
    ))}
  </div>
);

const LevelBadge = ({ level }: { level: SettingsLevel }) =>
  level === 0 ? null : (
    <span
      className={`text-[10px] uppercase tracking-wider border rounded px-1 ${
        level === 1
          ? 'text-teal-300 border-teal-300/60'
          : 'text-amber-300 border-amber-300/60'
      }`}
    >
      {level === 1 ? 'Adv' : 'Dev'}
    </span>
  );

export const RadarSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RadarWidgetSettings | undefined;
  const [settings, setSettings] = useState<RadarWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: withRadarDefaults(savedSettings?.config),
  });
  // Re-seed when the saved widget changes (late load, profile switch), as
  // DeltaSpeedSettings does; otherwise the next edit would save defaults.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) {
      setSettings({
        enabled: savedSettings.enabled ?? false,
        config: withRadarDefaults(savedSettings.config),
      });
    }
  }
  const trackType = useSessionStore(
    (state) => state.session?.WeekendInfo?.TrackType
  );
  const trackName = useSessionStore(
    (state) => state.session?.WeekendInfo?.TrackDisplayName
  );

  const [level, setLevel] = useState<SettingsLevel>(readLevel);
  useEffect(() => {
    localStorage.setItem(LEVEL_KEY, String(level));
  }, [level]);
  const [query, setQuery] = useState('');
  const [profile, setProfile] = useState<RadarProfileId>(() =>
    isOvalTrack(trackType) ? 'oval' : 'road'
  );

  const config = settings.config;
  const view = useMemo(() => profileView(config, profile), [config, profile]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const search = query.trim().toLowerCase();
  const preset = matchingPreset(view);

  return (
    <BaseSettingsSection
      title="Radar"
      description="A close-range radar centred on your car. The road turns with you, so the cars around you sit where they are on track."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const set = (change: Partial<RadarConfig>) =>
          handleConfigChange(applyProfileChange(config, profile, change));
        const setTuning = (change: Partial<RadarTuning>) =>
          handleConfigChange({ tuning: { ...config.tuning, ...change } });
        const ctx: ItemContext = { view, set, setTuning };

        const sections = RADAR_SECTIONS.map((section) => ({
          section,
          items: section.items.filter((item) =>
            search
              ? matchesQuery(item, section, search)
              : item.level <= level && !item.hidden?.(view)
          ),
        })).filter(({ items }) => items.length > 0);

        return (
          <div className="space-y-4">
            <div className="px-4 space-y-3 pb-4 border-b border-slate-700/50">
              <div className="flex flex-wrap gap-4 items-start">
                <RadarPreview config={view} />
                <div className="flex-1 min-w-0 space-y-3">
                  <div className="space-y-1">
                    <div className="text-xs uppercase tracking-wider text-slate-500">
                      Profile
                    </div>
                    <Segmented
                      value={profile}
                      options={[
                        { value: 'road', label: 'Road' },
                        { value: 'oval', label: 'Oval' },
                      ]}
                      onChange={setProfile}
                    />
                    <p className="text-xs text-slate-500">
                      Look, distances and warnings are kept per profile; the
                      rest is shared.
                    </p>
                  </div>
                  <SettingToggleRow
                    title="Pick by Track"
                    description={
                      trackType
                        ? `Now: ${trackName ?? 'this track'} (${trackType}), ${
                            config.autoProfile && isOvalTrack(trackType)
                              ? 'oval'
                              : 'road'
                          } profile.`
                        : 'Use the oval profile on ovals.'
                    }
                    enabled={config.autoProfile}
                    onToggle={(autoProfile) =>
                      handleConfigChange({ autoProfile })
                    }
                  />
                </div>
              </div>

              <div className="space-y-1">
                <div className="text-xs uppercase tracking-wider text-slate-500">
                  Preset
                </div>
                <div className="flex flex-wrap gap-2">
                  {RADAR_PRESETS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={preset?.id === option.id}
                      onClick={() => set(presetChange(option))}
                      className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                        preset?.id === option.id
                          ? 'border-blue-500 bg-blue-600/20 text-white'
                          : 'border-transparent bg-slate-700 text-slate-200 hover:border-slate-500'
                      }`}
                    >
                      {option.title}
                      <span className="ml-1 text-xs text-slate-400">
                        {option.description}
                      </span>
                    </button>
                  ))}
                  {!preset && (
                    <span className="px-3 py-1 rounded-full text-sm border border-dashed border-slate-600 text-slate-400">
                      Custom
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-3 items-center">
                <Segmented
                  value={level}
                  options={LEVELS.map(({ level: value, label, active }) => ({
                    value,
                    label,
                    active,
                  }))}
                  onChange={setLevel}
                />
                <input
                  type="search"
                  aria-label="Find a setting"
                  placeholder="Find a setting…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="flex-1 min-w-40 rounded-md bg-slate-900 border border-slate-700 text-slate-200 px-2 py-1 text-sm"
                />
              </div>
            </div>

            {sections.length === 0 && (
              <p className="px-4 text-sm text-slate-400">
                No setting matches. The search looks through every level, Dev
                included.
              </p>
            )}

            {sections.map(({ section, items }) => {
              const changed = section.items.filter((item) =>
                isChanged(item, view)
              );
              return (
                <section key={section.id} className="space-y-4 px-4 pt-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-medium text-slate-200 flex items-center gap-2">
                      {section.title}
                      {section.dev && <LevelBadge level={2} />}
                    </h3>
                    {changed.length > 0 && (
                      <button
                        type="button"
                        className="text-xs text-blue-400 hover:text-blue-300"
                        onClick={() => set(resetChange(changed, view))}
                      >
                        Reset section
                      </button>
                    )}
                  </div>
                  {section.dev &&
                    level === 2 &&
                    section.id === 'processing' && (
                      <p className="text-sm rounded-md border border-amber-500/40 bg-amber-500/10 text-amber-200 px-3 py-2">
                        Internals the radar was tuned on. Odd values break lanes
                        and warnings; Reset section puts them back.
                      </p>
                    )}
                  <div className="space-y-4">
                    {items.map((item) => (
                      <div
                        key={item.id}
                        className={`relative ${
                          item.level > 0 && !section.dev
                            ? 'pl-3 border-l-2 border-teal-400/40'
                            : ''
                        }`}
                      >
                        {isChanged(item, view) && (
                          <button
                            type="button"
                            title="Changed: click to reset"
                            aria-label={`Reset ${item.title}`}
                            className="absolute -left-3 top-2 w-2 h-2 rounded-full bg-blue-400 hover:bg-blue-300"
                            onClick={() => set(resetChange([item], view))}
                          />
                        )}
                        {item.render(ctx)}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
