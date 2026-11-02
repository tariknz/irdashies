import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'rejoin',
  component: lazyWidget(() =>
    import('./RejoinIndicator').then((module) => ({
      default: module.RejoinIndicator,
    }))
  ),
} satisfies WidgetModule;
