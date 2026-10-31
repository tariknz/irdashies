import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'weather',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.Weather }))
  ),
} satisfies WidgetModule;
