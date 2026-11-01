import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'blindspotmonitor',
  component: lazyWidget(() =>
    import('./BlindSpotMonitor').then((module) => ({
      default: module.BlindSpotMonitor,
    }))
  ),
} satisfies WidgetModule;
