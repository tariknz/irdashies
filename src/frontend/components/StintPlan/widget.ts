import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'stintplan',
  component: lazyWidget(() =>
    import('./StintPlan').then((module) => ({ default: module.StintPlan }))
  ),
} satisfies WidgetModule;
