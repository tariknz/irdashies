import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'sectordelta',
  component: lazyWidget(() =>
    import('./SectorDelta').then((module) => ({ default: module.SectorDelta }))
  ),
} satisfies WidgetModule;
