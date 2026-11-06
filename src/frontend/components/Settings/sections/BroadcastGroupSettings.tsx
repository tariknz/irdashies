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
    <div className="h-full space-y-5 overflow-y-auto pr-1 [scrollbar-gutter:stable]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-700 pb-5 pt-1">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Broadcast
        </h2>
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
            className="absolute -left-2 -top-0.5 flex h-6 w-6 items-center justify-center rounded group"
            onClick={() => setTransition('random')}
          >
            <span className="h-2 w-2 rounded-full bg-accent-400 group-hover:bg-accent-300" />
          </button>
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
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_288px]">
        <nav
          aria-label="Broadcast modules"
          className="flex flex-wrap gap-1 border-b border-slate-700 pb-1 xl:col-span-2"
        >
          <div className="sr-only">Modules</div>
          {MODULES.map(({ type, label }) => (
            <Link
              key={type}
              to={`/settings/${type}`}
              aria-current={type === active ? 'page' : undefined}
              className={`flex min-h-9 items-center gap-2 rounded-md border-b-2 px-3 py-2 text-sm font-medium transition-colors ${
                type === active
                  ? 'border-accent-400 bg-accent-400/10 text-accent-200'
                  : 'border-transparent text-slate-400 hover:bg-settings-hover hover:text-slate-200'
              }`}
            >
              <span
                title={isEnabled(type) ? 'On' : 'Off'}
                className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                  isEnabled(type) ? 'bg-green-400' : 'bg-settings-control'
                }`}
              />
              <span className="flex-1">{label}</span>
              {isChanged(type) && (
                <span
                  title="Changed"
                  className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent-400"
                />
              )}
            </Link>
          ))}
        </nav>
        <div className="min-w-0 space-y-3">
          {isChanged(active) && (
            <div className="flex flex-none justify-end pb-2">
              <button
                type="button"
                className="settings-button"
                onClick={resetModule}
              >
                Reset section
              </button>
            </div>
          )}
          <div className="min-w-0">
            <Section key={`${active}-${resets}`} />
          </div>
        </div>
        <div className="w-full max-w-72 justify-self-center overflow-hidden rounded-md xl:sticky xl:top-0">
          <BroadcastPreview module={active} />
        </div>
      </div>
    </div>
  );
};

const isModuleType = (type: string | undefined): type is BroadcastModuleType =>
  MODULE_TYPES.includes(type ?? '');

/**
 * The settings page for all five broadcast widgets. One component type for
 * every tab, so switching tabs updates `active` instead of remounting the page
 * (which reset the detected component-server port and its OBS URL).
 */
export const BroadcastSettingsPage = ({
  widgetType,
}: {
  widgetType?: string;
}) => (
  <BroadcastGroupSettings
    active={isModuleType(widgetType) ? widgetType : 'broadcast'}
  />
);
