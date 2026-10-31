import type { DashboardWidget } from '@irdashies/types';

const SECTOR_WIDGETS = new Set(['sectordelta', 'map', 'flatmap']);
const TABLE_WIDGETS = new Set(['standings', 'relative']);

/** Supporting renderer state belongs to the widget in this window, not the profile. */
export function widgetUpdaterNeeds(widget: DashboardWidget) {
  const type = widget.type ?? widget.id;
  const enabled = (property: string) => {
    const value = widget.config?.[property];
    return (
      typeof value === 'object' &&
      value !== null &&
      'enabled' in value &&
      value.enabled === true
    );
  };
  return {
    sectorTiming: SECTOR_WIDGETS.has(type),
    pushToPass: TABLE_WIDGETS.has(type) && enabled('pushToPass'),
    pitLap:
      (TABLE_WIDGETS.has(type) && enabled('pitStatus')) ||
      (type === 'battle' && enabled('stint')),
  };
}
