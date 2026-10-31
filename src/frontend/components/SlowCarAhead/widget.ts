import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'slowcarahead',
  component: lazyWidget(() =>
    import('./SlowCarAhead').then((module) => ({
      default: module.SlowCarAhead,
    }))
  ),
} satisfies WidgetModule;
