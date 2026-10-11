import { Standings } from './Standings';
import { Relative } from './Relative';
import type { WidgetModule } from '../../WidgetIndex';

export default [
  { id: 'standings', component: Standings },
  { id: 'relative', component: Relative },
] satisfies WidgetModule[];
