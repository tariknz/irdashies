import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'flag',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.Flag }))
  ),
} satisfies WidgetModule;
