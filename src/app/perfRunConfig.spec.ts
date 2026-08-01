import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import { createPerfDashboard, getPerfRunConfig } from './perfRunConfig';

const dashboard: DashboardLayout = {
  widgets: [
    {
      id: 'standings-1',
      type: 'standings',
      enabled: true,
      layout: { x: 0, y: 0, width: 100, height: 100 },
    },
    {
      id: 'relative',
      enabled: true,
      layout: { x: 100, y: 0, width: 100, height: 100 },
    },
  ],
};

describe('performance run configuration', () => {
  it('allowlists overlay modes and widget names', () => {
    expect(
      getPerfRunConfig({
        PERF_METRICS: '1',
        PERF_OVERLAY_MODE: 'observer',
        PERF_WIDGET_TYPES: 'standings, ../bad,relative',
        PERF_DURATION_SECONDS: '60',
        PERF_TELEMETRY_DELIVERY: 'off',
        PERF_TELEMETRY_PAYLOAD: 'raw',
      })
    ).toMatchObject({
      enabled: true,
      overlayMode: 'observer',
      widgetTypes: ['standings', 'relative'],
      durationSeconds: 60,
      telemetryDelivery: 'off',
      telemetryPayload: 'raw',
    });

    expect(
      getPerfRunConfig({
        PERF_METRICS: '1',
        PERF_OVERLAY_MODE: 'invalid',
      }).overlayMode
    ).toBe('full');
  });

  it('creates an empty dashboard without mutating the source', () => {
    const result = createPerfDashboard(dashboard, {
      enabled: true,
      overlayMode: 'empty',
      widgetTypes: [],
      scenario: 'empty',
      durationSeconds: 0,
      telemetryDelivery: 'on',
      telemetryPayload: 'allowlisted',
    });

    expect(result.widgets.every((widget) => !widget.enabled)).toBe(true);
    expect(dashboard.widgets.every((widget) => widget.enabled)).toBe(true);
  });

  it('isolates selected widget types', () => {
    const result = createPerfDashboard(dashboard, {
      enabled: true,
      overlayMode: 'full',
      widgetTypes: ['standings'],
      scenario: 'standings',
      durationSeconds: 0,
      telemetryDelivery: 'on',
      telemetryPayload: 'allowlisted',
    });

    expect(result.widgets.map((widget) => widget.enabled)).toEqual([
      true,
      false,
    ]);
  });
});
