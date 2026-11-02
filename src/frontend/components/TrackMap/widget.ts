import { lazyWidget } from '@irdashies/domain/lazyWidget';
import type { WidgetModule } from '@irdashies/domain';

export default [
  {
    id: 'map',
    component: lazyWidget(() =>
      import('./TrackMap').then((module) => ({ default: module.TrackMap }))
    ),
  },
  {
    id: 'flatmap',
    component: lazyWidget(() =>
      import('./FlatTrackMap').then((module) => ({
        default: module.FlatTrackMap,
      }))
    ),
  },
] satisfies WidgetModule[];
