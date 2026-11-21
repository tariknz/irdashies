import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'brakepressure',
  sessionData: true,
  channels: ['car-dynamics.snapshot', 'track-state.snapshot'],
  ratePreset: 'driverFocused',
} satisfies WidgetRuntimeDefinition;
