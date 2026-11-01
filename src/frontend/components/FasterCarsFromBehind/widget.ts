import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'fastercarsfrombehind',
  component: lazyWidget(() =>
    import('./FasterCarsFromBehind').then((module) => ({
      default: module.FasterCarsFromBehind,
    }))
  ),
} satisfies WidgetModule;
