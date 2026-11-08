import type { ElementType } from 'react';
import type { WidgetId } from '@irdashies/types';

/**
 * Default export of each `components/<Folder>/widget.ts`: one module, or an
 * array when a folder hosts several widgets. It lives here rather than in
 * WidgetIndex so widget folders import it from an allowed lower layer (R1.1).
 */
export interface WidgetModule {
  id: WidgetId;
  component: ElementType;
}
