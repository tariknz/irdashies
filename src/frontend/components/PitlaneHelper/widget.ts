import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'pitlanehelper',
  component: lazyWidget(() =>
    import('./PitlaneHelper').then((module) => ({
      default: module.PitlaneHelper,
    }))
  ),
} satisfies WidgetModule;
