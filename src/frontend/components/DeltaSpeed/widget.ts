import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'deltaspeed',
  preview: lazyWidget(() =>
    import('./DeltaSpeedPreview').then((module) => ({
      default: module.DeltaSpeedPreview,
    }))
  ),
  component: lazyWidget(() =>
    import('./DeltaSpeed').then((module) => ({ default: module.DeltaSpeed }))
  ),
} satisfies WidgetModule;
