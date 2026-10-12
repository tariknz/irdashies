import type { WidgetLayout } from '../dashboardLayout';
import type { WidgetConfigMap } from '../widgetConfigs';
import type { WidgetId } from '../widgetId';
import type { PropertySpecsOf } from './properties';

/**
 * Main-safe, pure-data description of a widget. One file per widget in
 * `src/types/widgets/<id>.ts`, auto-discovered by `./index.ts`.
 */
export interface WidgetManifest<
  K extends keyof WidgetConfigMap = keyof WidgetConfigMap,
> {
  id: K;
  /** Display name, e.g. in Edit Mode. */
  name: string;
  /** Settings-menu label when it differs from `name`. */
  menuLabel?: string;
  /**
   * Not drawn in the settings widget menu; its settings are reached elsewhere
   * (a tab on another item's page, or the Advanced page). It still gets a
   * label and a place in widget lists such as Key Bindings.
   */
  hideInMenu?: boolean;
  /** Widgets that share this item's settings page; it shows On while any of them is. */
  groupTypes?: WidgetId[];
  enabled: boolean;
  alwaysEnabled?: boolean;
  layout: WidgetLayout;
  config: WidgetConfigMap[K];
  /** Settings described once; drives SettingProp and config validation. */
  properties?: K extends unknown ? PropertySpecsOf<WidgetConfigMap[K]> : never;
}

export const defineWidgetManifest = <K extends keyof WidgetConfigMap>(
  manifest: WidgetManifest<K>
) => manifest;
