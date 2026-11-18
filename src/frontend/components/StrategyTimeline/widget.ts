import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'strategytimeline',
  component: lazyWidget(() =>
    import('./StrategyTimeline').then((module) => ({
      default: module.StrategyTimeline,
    }))
  ),
} satisfies WidgetModule;
