import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default {
  id: 'shiftlight',
  component: lazyWidget(() =>
    import('./ShiftLight').then((module) => ({ default: module.ShiftLight }))
  ),
} satisfies WidgetModule;
