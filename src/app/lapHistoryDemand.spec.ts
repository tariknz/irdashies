import { describe, expect, it } from 'vitest';
import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import { needsLapHistory } from './lapHistoryDemand';

const widget = (
  id: string,
  enabled: boolean,
  extra: Partial<DashboardWidget> = {}
): DashboardWidget => ({
  id,
  enabled,
  layout: { x: 0, y: 0, width: 100, height: 100 },
  ...extra,
});

const layout = (...widgets: DashboardWidget[]): DashboardLayout => ({
  widgets,
});

describe('needsLapHistory', () => {
  it('is false with no layout or no consumers', () => {
    expect(needsLapHistory(undefined)).toBe(false);
    expect(needsLapHistory(layout())).toBe(false);
    expect(needsLapHistory(layout(widget('relative', true)))).toBe(false);
    expect(needsLapHistory(layout(widget('unknown', true)))).toBe(false);
  });

  it('is true for an enabled Gantry', () => {
    expect(needsLapHistory(layout(widget('gantry', true)))).toBe(true);
    expect(needsLapHistory(layout(widget('gantry', false)))).toBe(false);
  });

  it('is true for an enabled Battle without the Gantry', () => {
    expect(
      needsLapHistory(layout(widget('battle', true), widget('gantry', false)))
    ).toBe(true);
    expect(needsLapHistory(layout(widget('battle', false)))).toBe(false);
  });

  it('matches a widget copy by its type', () => {
    const copy = widget('battle-2', true, { type: 'battle' });
    expect(needsLapHistory(layout(copy))).toBe(true);
  });
});
