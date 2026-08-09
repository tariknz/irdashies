import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'flatmap',
  sessionData: true,
  channels: [
    'reference-laps.snapshot',
    'sector-timing.snapshot',
    'standings.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'static',
} satisfies WidgetRuntimeDefinition;
