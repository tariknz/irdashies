import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'radar',
  component: lazyWidget(() =>
    import('./Radar').then((module) => ({ default: module.Radar }))
  ),
} satisfies WidgetModule;
