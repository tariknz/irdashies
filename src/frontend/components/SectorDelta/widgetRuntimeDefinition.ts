import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'sectordelta',
  sessionData: true,
  channels: [
    'reference-laps.snapshot',
    'sector-timing.snapshot',
    'track-state.snapshot',
  ],
  ratePreset: 'static',
  channelRates: { 'track-state.snapshot': 25 },
} satisfies WidgetRuntimeDefinition;
