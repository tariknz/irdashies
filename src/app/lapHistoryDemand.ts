import { getWidgetManifest } from '@irdashies/types';
import type { DashboardLayout } from '@irdashies/types';

/**
 * True when an enabled widget's manifest declares `usesLapHistory`. Recording
 * is skipped otherwise, so a user who uses none of them pays no frame cost.
 */
export const needsLapHistory = (layout: DashboardLayout | undefined): boolean =>
  layout?.widgets.some(
    (widget) =>
      widget.enabled &&
      getWidgetManifest(widget.type || widget.id)?.usesLapHistory === true
  ) ?? false;
