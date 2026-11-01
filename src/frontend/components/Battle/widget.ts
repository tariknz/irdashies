import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'battle',
  component: lazyWidget(() =>
    import('./Battle').then((module) => ({ default: module.Battle }))
  ),
} satisfies WidgetModule;
