import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'telemetryinspector',
  component: lazyWidget(() =>
    import('./TelemetryInspector').then((module) => ({
      default: module.TelemetryInspector,
    }))
  ),
} satisfies WidgetModule;
