import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'heartrate',
  component: lazyWidget(() =>
    import('./HeartRate').then((module) => ({ default: module.HeartRate }))
  ),
} satisfies WidgetModule;
