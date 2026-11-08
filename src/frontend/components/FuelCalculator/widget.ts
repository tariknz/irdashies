import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'fuel',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.FuelCalculator }))
  ),
} satisfies WidgetModule;
