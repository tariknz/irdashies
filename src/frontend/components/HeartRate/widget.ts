import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'heartrate',
  preview: lazyWidget(() =>
    import('./HeartRatePreview').then((module) => ({
      default: module.HeartRatePreview,
    }))
  ),
  component: lazyWidget(() =>
    import('./HeartRate').then((module) => ({ default: module.HeartRate }))
  ),
} satisfies WidgetModule;
