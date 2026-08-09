import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'fastercarsfrombehind',
  sessionData: true,
  channels: [
    'relative-gaps.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'gapTiming',
} satisfies WidgetRuntimeDefinition;
