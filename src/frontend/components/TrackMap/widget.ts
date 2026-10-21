import { TrackMap } from './TrackMap';
import { FlatTrackMap } from './FlatTrackMap';
import type { WidgetModule } from '@irdashies/domain';

export default [
  { id: 'map', component: TrackMap },
  { id: 'flatmap', component: FlatTrackMap },
] satisfies WidgetModule[];
