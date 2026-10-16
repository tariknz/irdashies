import type { WidgetId } from '@irdashies/types';

/**
 * Widgets registered in the app but deliberately kept out of the live
 * preview: they need external input or real-app state that the mock bridge
 * can't provide, so they'd render empty or broken. Remove an id here to
 * surface that widget in the preview toolbar.
 */
export const EXCLUDED_WIDGETS = new Set<WidgetId>([
  'garagecover', // only renders while in the garage
  'telemetryinspector', // debug tool, not a showcase overlay
  'twitchchat', // needs a real Twitch channel to display anything
  'heartrate', // embeds HypeRate, needs a session id
]);
