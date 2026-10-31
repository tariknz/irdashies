import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'garagecover',
  component: lazyWidget(() =>
    import('./GarageCover').then((module) => ({ default: module.GarageCover }))
  ),
} satisfies WidgetModule;
