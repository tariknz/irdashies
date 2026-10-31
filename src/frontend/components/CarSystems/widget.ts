import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'carsystems',
  component: lazyWidget(() =>
    import('./CarSystems').then((module) => ({ default: module.CarSystems }))
  ),
} satisfies WidgetModule;
