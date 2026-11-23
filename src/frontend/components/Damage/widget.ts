import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'damage',
  component: lazyWidget(() =>
    import('./Damage').then((module) => ({ default: module.Damage }))
  ),
} satisfies WidgetModule;
