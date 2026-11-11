import type { WidgetId } from '@irdashies/types';

/**
 * Widgets registered in the app but deliberately kept out of the live
 * preview: they need real-app state or are internal tools. Remove an id here to
 * surface that widget in the preview toolbar.
 */
export const EXCLUDED_WIDGETS = new Set<WidgetId>([
  'garagecover', // only renders while in the garage
  'telemetryinspector', // debug tool, not a showcase overlay
]);
