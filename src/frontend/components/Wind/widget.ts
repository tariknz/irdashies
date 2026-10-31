import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'wind',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.Wind }))
  ),
} satisfies WidgetModule;
