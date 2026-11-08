import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'fuel',
  preview: lazyWidget(() =>
    import('./FuelPreview').then((module) => ({ default: module.FuelPreview }))
  ),
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.FuelCalculator }))
  ),
} satisfies WidgetModule;
