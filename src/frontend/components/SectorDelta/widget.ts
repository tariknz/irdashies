import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'sectordelta',
  preview: lazyWidget(() =>
    import('./SectorDeltaPreview').then((module) => ({
      default: module.SectorDeltaPreview,
    }))
  ),
  component: lazyWidget(() =>
    import('./SectorDelta').then((module) => ({ default: module.SectorDelta }))
  ),
} satisfies WidgetModule;
