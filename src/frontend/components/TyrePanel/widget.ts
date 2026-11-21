import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'tyrepanel',
  component: lazyWidget(() =>
    import('./TyrePanel').then((module) => ({ default: module.TyrePanel }))
  ),
} satisfies WidgetModule;
