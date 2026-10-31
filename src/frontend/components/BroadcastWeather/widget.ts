import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'broadcastweather',
  component: lazyWidget(() =>
    import('./BroadcastWeather').then((module) => ({
      default: module.BroadcastWeather,
    }))
  ),
} satisfies WidgetModule;
