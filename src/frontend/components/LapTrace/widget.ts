import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'laptrace',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.LapTrace }))
  ),
} satisfies WidgetModule;
