import type { ElementType } from 'react';
import { WIDGET_MANIFESTS, type WidgetId } from '@irdashies/types';

export type { WidgetId };

/**
 * Default export of each `components/<Folder>/widget.ts`: one module, or an
 * array when a folder hosts several widgets.
 */
export interface WidgetModule {
  id: WidgetId;
  component: ElementType;
}

const discoveredWidgets = import.meta.glob<{
  default: WidgetModule | readonly WidgetModule[];
}>('./components/*/widget.ts', { eager: true });

const order = new Map(WIDGET_MANIFESTS.map((m, index) => [m.id, index]));

// Completeness (every WidgetId has a component) is checked by
// widgetRegistry.spec.ts, not by the type: the map is built from a glob.
// Keys follow the manifest order, which lists such as the site preview use.
export const WIDGET_MAP = Object.fromEntries(
  Object.values(discoveredWidgets)
    .flatMap(({ default: m }) => (Array.isArray(m) ? m : [m]))
    .sort(
      (a, b) =>
        (order.get(a.id) ?? order.size) - (order.get(b.id) ?? order.size)
    )
    .map((m: WidgetModule) => [m.id, m.component])
) as Record<WidgetId, ElementType>;

/**
 * Looks up a widget component by id. Accepts a raw string because dashboard
 * config is user-supplied and may contain unknown ids; returns undefined
 * when no widget is registered for that id.
 *
 * Uses Object.hasOwn so prototype-chain keys (e.g. "__proto__", "toString")
 * never resolve to truthy non-component values that React would try to render.
 */
export const getWidget = (id: string) =>
  Object.hasOwn(WIDGET_MAP, id)
    ? (WIDGET_MAP[id as WidgetId] as (typeof WIDGET_MAP)[WidgetId])
    : undefined;
