import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'gantry',
  component: lazyWidget(() =>
    import('./Gantry').then((module) => ({ default: module.Gantry }))
  ),
} satisfies WidgetModule;
