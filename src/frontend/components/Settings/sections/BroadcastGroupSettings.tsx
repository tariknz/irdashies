import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { BroadcastSettings } from './BroadcastSettings';
import { BroadcastTickerSettings } from './BroadcastTickerSettings';
import { BroadcastEventsSettings } from './BroadcastEventsSettings';
import { BroadcastWeatherSettings } from './BroadcastWeatherSettings';
import { BroadcastPodiumSettings } from './BroadcastPodiumSettings';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastTransition } from '@irdashies/types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { differsFromDefault } from '../components/ChangedMark';
import { BroadcastPreview } from './BroadcastPreview';

/**
 * The broadcast modules stay separate widgets, so each keeps its own place in
 * Edit Layout and its own /widget URL; only their settings share one page,
 * laid out like the Radar's: a module rail, the open module, a live preview.
 * Each rail entry is a route, so "open settings" on any module lands on it.
 */
const MODULES = [
  { type: 'broadcast', label: 'Tower', Section: BroadcastSettings },
  {
    type: 'broadcastticker',
    label: 'Ticker',
    Section: BroadcastTickerSettings,
  },
  {
    type: 'broadcastevents',
    label: 'Events',
    Section: BroadcastEventsSettings,
  },
  {
    type: 'broadcastweather',
    label: 'Weather',
    Section: BroadcastWeatherSettings,
  },
  {
    type: 'broadcastpodium',
    label: 'Podium',
    Section: BroadcastPodiumSettings,
  },
] as const;

type BroadcastModuleType = (typeof MODULES)[number]['type'];
const MODULE_TYPES: readonly string[] = MODULES.map((m) => m.type);

/**
 * A module's defaults. The tower's also hold the shared transition, which
 * belongs to the whole page, so a tower reset leaves it alone.
 */
const moduleDefaults = (type: BroadcastModuleType): Record<string, unknown> => {
  const defaults: Record<string, unknown> = { ...getWidgetDefaultConfig(type) };
  if (type === 'broadcast') delete defaults.pageTransition;
  return defaults;
};

const TRANSITION_OPTIONS: { label: string; value: BroadcastTransition }[] = [
  { label: 'Random', value: 'random' },
  { label: 'Slide Left', value: 'slide-left' },
  { label: 'Slide Right', value: 'slide-right' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Fade', value: 'fade-in' },
  { label: 'Flip', value: 'flip' },
  { label: 'Wipe', value: 'wipe' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Checker', value: 'checker' },
];

export const BroadcastGroupSettings = ({
  active,
}: {
  active: BroadcastModuleType;
}) => {
  const { currentDashboard, currentProfile, bridge, onDashboardUpdated } =
    useDashboard();
  const [serverPort, setServerPort] = useState(3000);
  useEffect(() => {
    void bridge?.getComponentServerPort?.().then(setServerPort);
  }, [bridge]);
  // Bumped by Reset section: the module's form keeps its own copy of the
  // config, so it is remounted to read the defaults back.
  const [resets, setResets] = useState(0);
  const obsUrl = `http://localhost:${serverPort}/widget/${active}${
    currentProfile ? `?profile=${currentProfile.id}` : ''
  }`;
  const widgetOf = (type: string) =>
    currentDashboard?.widgets.find((w) => (w.type ?? w.id) === type);
  const isEnabled = (type: string) => widgetOf(type)?.enabled ?? false;
  const isChanged = (type: BroadcastModuleType) =>
    differsFromDefault(widgetOf(type)?.config, moduleDefaults(type));
  const updateWidgets = (
    change: (w: NonNullable<ReturnType<typeof widgetOf>>) => typeof w
  ) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map(change),
    });
  };
  // The master switch turns every module on or off at once; each module keeps
  // its own switch for running just some of them.
  const anyEnabled = MODULE_TYPES.some(isEnabled);
  const setAllEnabled = (enabled: boolean) =>
    updateWidgets((w) =>
      MODULE_TYPES.includes(w.type ?? w.id) ? { ...w, enabled } : w
    );
  // One transition for every module. It is kept in the tower config, where it
  // started out, so saved dashboards need no migration.
  const transition =
    (widgetOf('broadcast')?.config?.pageTransition as
      BroadcastTransition | undefined) ?? 'random';
  const setTransition = (pageTransition: BroadcastTransition) =>
    updateWidgets((w) =>
      w.id === 'broadcast'
        ? { ...w, config: { ...w.config, pageTransition } }
        : w
    );
  const resetModule = () => {
    updateWidgets((w) =>
      w.id === active
        ? { ...w, config: { ...w.config, ...moduleDefaults(active) } }
        : w
    );
    setResets((n) => n + 1);
  };
  const { Section } = MODULES.find((m) => m.type === active) ?? MODULES[0];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-none items-center justify-between">
        <h2 className="text-xl">Broadcast</h2>
        <ToggleSwitch
          label="All modules"
          enabled={anyEnabled}
          onToggle={setAllEnabled}
        />
      </div>
      <div className="relative mb-2 flex-none pl-4">
        {transition !== 'random' && (
          <button
            type="button"
            title="Changed: click to reset"
            aria-label="Reset transition"
            className="absolute left-1 top-2 h-2 w-2 rounded-full bg-blue-400 hover:bg-blue-300"
            onClick={() => setTransition('random')}
          />
        )}
        <SettingSelectRow<BroadcastTransition>
          title="Transition"
          description="How every module animates: tower page changes, ticker views, and events, weather and podium cards popping up. Random never uses the same one twice in a row."
          value={transition}
          options={TRANSITION_OPTIONS}
          onChange={setTransition}
        />
      </div>
      <p className="mb-4 flex-none border-b border-slate-700/50 pb-4 text-sm text-slate-400">
        Add each module to OBS as its own Browser Source, so each gets its own
        size and place on the stream:{' '}
        <span className="select-all font-mono text-slate-300">{obsUrl}</span>
      </p>
      <div className="flex min-h-0 flex-1 flex-wrap items-start gap-4">
        <nav
          aria-label="Broadcast modules"
          className="w-36 shrink-0 space-y-0.5"
        >
          <div className="px-2 pt-1 pb-0.5 text-[10.5px] uppercase tracking-wider text-slate-500">
            Modules
          </div>
          {MODULES.map(({ type, label }) => (
            <Link
              key={type}
              to={`/settings/${type}`}
              aria-current={type === active ? 'page' : undefined}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors ${
                type === active
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:bg-slate-700/40 hover:text-slate-200'
              }`}
            >
              <span
                title={isEnabled(type) ? 'On' : 'Off'}
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isEnabled(type) ? 'bg-green-400' : 'bg-slate-600'
                }`}
              />
              <span className="flex-1">{label}</span>
              {isChanged(type) && (
                <span
                  title="Changed"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400"
                />
              )}
            </Link>
          ))}
        </nav>
        <div className="flex h-full min-w-64 flex-1 flex-col pl-3">
          {isChanged(active) && (
            <div className="flex flex-none justify-end pb-2">
              <button
                type="button"
                className="text-xs text-blue-400 hover:text-blue-300"
                onClick={resetModule}
              >
                Reset section
              </button>
            </div>
          )}
          <div className="min-h-0 flex-1">
            <Section key={`${active}-${resets}`} />
          </div>
        </div>
        <div className="sticky top-2 w-72 shrink-0">
          <BroadcastPreview module={active} />
        </div>
      </div>
    </div>
  );
};
