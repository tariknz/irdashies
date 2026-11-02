import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'broadcastticker',
  component: lazyWidget(() =>
    import('./BroadcastTicker').then((module) => ({
      default: module.BroadcastTicker,
    }))
  ),
} satisfies WidgetModule;
