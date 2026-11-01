import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'tachometer',
  component: lazyWidget(() =>
    import('./Tachometer').then((module) => ({ default: module.Tachometer }))
  ),
} satisfies WidgetModule;
