import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'input',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.Input }))
  ),
} satisfies WidgetModule;
