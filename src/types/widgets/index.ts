import type { WidgetId } from '../widgetId';
import type { WidgetManifest } from './types';

export * from './types';
export * from './properties';

/**
 * Order of the built-in widgets wherever they are listed: the default
 * dashboard (array position is the overlay stacking order, and Relative sits
 * over the bottom of Standings), WIDGET_MAP and the site preview. Widgets not
 * listed here come after these, by id; a new widget does not need an entry.
 */
export const WIDGET_ORDER: readonly WidgetId[] = [
  'standings',
  'flag',
  'input',
  'tachometer',
  'shiftlight',
  'relative',
  'map',
  'flatmap',
  'weather',
  'wind',
  'fastercarsfrombehind',
  'fuel',
  'blindspotmonitor',
  'radar',
  'garagecover',
  'rejoin',
  'laptimelog',
  'slowcarahead',
  'battle',
  'broadcast',
  'broadcastweather',
  'broadcastpodium',
  'broadcastticker',
  'broadcastevents',
  'telemetryinspector',
  'pitlanehelper',
  'twitchchat',
  'infobar',
  'sectordelta',
  'carsystems',
  'deltaspeed',
  'heartrate',
  'cornername',
  'laptrace',
  'gantry',
];

const rank = (id: string) => {
  const index = (WIDGET_ORDER as readonly string[]).indexOf(id);
  return index === -1 ? WIDGET_ORDER.length : index;
};

// import.meta.glob ties this module to Vite (the renderer, main, preload and
// Vitest builds), like main.ts and sims/registry.ts. Scripts run with tsx may
// only import types from @irdashies/types.
const discovered = import.meta.glob<{ default?: WidgetManifest }>(
  ['./*.ts', '!./index.ts', '!./types.ts', '!./properties.ts', '!./*.spec.ts'],
  { eager: true }
);

export const WIDGET_MANIFESTS: readonly WidgetManifest[] = Object.values(
  discovered
)
  .map((module) => module.default)
  // A helper module without a manifest is not a widget.
  .filter(
    (manifest): manifest is WidgetManifest => typeof manifest?.id === 'string'
  )
  .sort((a, b) => rank(a.id) - rank(b.id) || a.id.localeCompare(b.id));

/** Accepts a raw string; unknown and prototype keys return undefined. */
export const getWidgetManifest = (id: string): WidgetManifest | undefined =>
  WIDGET_MANIFESTS.find((manifest) => manifest.id === id);
