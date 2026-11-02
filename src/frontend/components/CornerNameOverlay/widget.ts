import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'cornername',
  component: lazyWidget(() =>
    import('./').then((module) => ({ default: module.CornerNameOverlay }))
  ),
} satisfies WidgetModule;
