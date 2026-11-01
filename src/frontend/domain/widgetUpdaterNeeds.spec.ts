import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@irdashies/types';
import { widgetUpdaterNeeds } from './widgetUpdaterNeeds';

const widget = (
  type: string,
  config?: Record<string, unknown>
): DashboardWidget => ({
  id: `${type}-second-instance`,
  type,
  enabled: true,
  config,
  layout: { x: 0, y: 0, width: 300, height: 200 },
});

describe('individual-widget updater needs', () => {
  it.each(['flag', 'fuel', 'radar', 'input', 'blindspotmonitor'])(
    'does not run table updaters in a %s window',
    (type) => {
      expect(
        widgetUpdaterNeeds(
          widget(type, {
            pushToPass: { enabled: true },
            pitStatus: { enabled: true },
            stint: { enabled: true },
          })
        )
      ).toEqual({ sectorTiming: false, pushToPass: false, pitLap: false });
    }
  );
  it.each(['standings', 'relative'])(
    'uses only the %s instance configuration',
    (type) => {
      expect(
        widgetUpdaterNeeds(
          widget(type, {
            pushToPass: { enabled: true },
            pitStatus: { enabled: true },
          })
        )
      ).toMatchObject({ pushToPass: true, pitLap: true });
      expect(widgetUpdaterNeeds(widget(type))).toMatchObject({
        pushToPass: false,
        pitLap: false,
      });
    }
  );
  it.each(['map', 'flatmap', 'sectordelta'])(
    'keeps sector timing for %s',
    (type) => {
      expect(widgetUpdaterNeeds(widget(type)).sectorTiming).toBe(true);
    }
  );
  it('keeps Battle stint tracking and rejects malformed enable flags', () => {
    expect(
      widgetUpdaterNeeds(widget('battle', { stint: { enabled: true } })).pitLap
    ).toBe(true);
    expect(
      widgetUpdaterNeeds(
        widget('relative', { pitStatus: true, pushToPass: { enabled: 'true' } })
      )
    ).toMatchObject({ pitLap: false, pushToPass: false });
  });
});
