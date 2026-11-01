import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'broadcastevents',
  component: lazyWidget(() =>
    import('./BroadcastEvents').then((module) => ({
      default: module.BroadcastEvents,
    }))
  ),
} satisfies WidgetModule;
