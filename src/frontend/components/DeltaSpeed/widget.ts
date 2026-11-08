import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'deltaspeed',
  component: lazyWidget(() =>
    import('./DeltaSpeed').then((module) => ({ default: module.DeltaSpeed }))
  ),
} satisfies WidgetModule;
