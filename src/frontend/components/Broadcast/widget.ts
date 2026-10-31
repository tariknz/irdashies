import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'broadcast',
  component: lazyWidget(() =>
    import('./Broadcast').then((module) => ({ default: module.Broadcast }))
  ),
} satisfies WidgetModule;
