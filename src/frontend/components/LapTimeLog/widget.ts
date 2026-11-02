import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'laptimelog',
  component: lazyWidget(() =>
    import('./LapTimeLog').then((module) => ({ default: module.LapTimeLog }))
  ),
} satisfies WidgetModule;
