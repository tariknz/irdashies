import { TrackMap } from './TrackMap';
import { FlatTrackMap } from './FlatTrackMap';
import type { WidgetModule } from '../../WidgetIndex';

export default [
  { id: 'map', component: TrackMap },
  { id: 'flatmap', component: FlatTrackMap },
] satisfies WidgetModule[];
