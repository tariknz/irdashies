import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default [
  {
    id: 'standings',
    component: lazyWidget(() =>
      import('./Standings').then((module) => ({ default: module.Standings }))
    ),
  },
  {
    id: 'relative',
    component: lazyWidget(() =>
      import('./Relative').then((module) => ({ default: module.Relative }))
    ),
  },
] satisfies WidgetModule[];
