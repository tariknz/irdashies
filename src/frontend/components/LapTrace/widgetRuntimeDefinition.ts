import type { WidgetRuntimeDefinition } from '../../widgetRuntime';

export default {
  id: 'laptrace',
  sessionData: true,
  // lap-trace.sample feeds the recorder and the plot's car position at the
  // sim's native rate; track-state stays for the corner panel's crossing
  // detection and the driving-state gate.
  channels: ['lap-trace.sample', 'track-state.snapshot'],
  channelRates: { 'lap-trace.sample': 60 },
} satisfies WidgetRuntimeDefinition;
