import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'broadcastpodium',
  component: lazyWidget(() =>
    import('./BroadcastPodium').then((module) => ({
      default: module.BroadcastPodium,
    }))
  ),
} satisfies WidgetModule;
