import { describe, expect, it } from 'vitest';
import type { DashboardLayout } from '@irdashies/types';
import {
  activePerfWidgetTypes,
  createPerfDashboard,
  getPerfRunConfig,
  parsePerfVisibilityPhases,
  perfRunSimulator,
} from './perfRunConfig';

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
  it('makes replay widgets visible only in benchmark memory', () => {
    const source: DashboardLayout = {
      widgets: ['fuel', 'radar', 'flag'].map((id) => ({
        id,
        enabled: true,
        layout: { x: 0, y: 0, width: 300, height: 300 },
        config: {
          showOnlyWhenOnTrack: true,
          autoHide: true,
          hideInPit: true,
          hideInPitBox: true,
          showNoFlagState: false,
        },
      })),
    };
    const result = createPerfDashboard(
      source,
      getPerfRunConfig({ PERF_METRICS: '1', PERF_REPLAY_VISIBLE_WIDGETS: '1' })
    );
    expect(result.widgets[0].config?.showOnlyWhenOnTrack).toBe(false);
    expect(result.widgets[1].config).toMatchObject({
      showOnlyWhenOnTrack: false,
      autoHide: false,
      hideInPit: false,
      hideInPitBox: false,
    });
    expect(result.widgets[2].config?.showNoFlagState).toBe(true);
    expect(source.widgets.every((w) => w.config?.showOnlyWhenOnTrack)).toBe(
      true
    );
    expect(
      createPerfDashboard(
        source,
        getPerfRunConfig({ PERF_REPLAY_VISIBLE_WIDGETS: '1' })
      )
    ).toBe(source);
    expect(createPerfDashboard(source, getPerfRunConfig({}))).toBe(source);
  });
  it('overrides window topology in memory only and ignores invalid modes', () => {
    for (const mode of ['display', 'widget'] as const) {
      const config = getPerfRunConfig({
        PERF_METRICS: '1',
        PERF_WINDOW_MODE: mode,
      });
      const result = createPerfDashboard(dashboard, config);
      expect(result.generalSettings?.overlayWindowMode).toBe(mode);
      expect(result.widgets).toBe(dashboard.widgets);
      expect(dashboard.generalSettings).toBeUndefined();
    }
    expect(
      getPerfRunConfig({ PERF_WINDOW_MODE: 'invalid' }).windowMode
    ).toBeUndefined();
    expect(
      createPerfDashboard(
        dashboard,
        getPerfRunConfig({ PERF_WINDOW_MODE: 'widget' })
      )
    ).toBe(dashboard);
  });

  it('allowlists overlay modes and widget names', () => {
    expect(
      getPerfRunConfig({
        PERF_METRICS: '1',
        PERF_OVERLAY_MODE: 'observer',
        PERF_WIDGET_TYPES: 'standings, ../bad,relative',
        PERF_DURATION_SECONDS: '60',
        PERF_TELEMETRY_DELIVERY: 'off',
        PERF_TELEMETRY_PAYLOAD: 'raw',
        PERF_CHANNEL_DELIVERY: 'off',
        PERF_VISIBILITY_PHASES: 'visible:120,hidden:90,bad:10,visible:0',
      })
    ).toMatchObject({
      enabled: true,
      overlayMode: 'observer',
      widgetTypes: ['standings', 'relative'],
      durationSeconds: 60,
      telemetryDelivery: 'off',
      telemetryPayload: 'raw',
      channelDelivery: 'off',
      visibilityPhases: [
        { visibility: 'visible', durationSeconds: 120 },
        { visibility: 'hidden', durationSeconds: 90 },
      ],
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
      channelDelivery: 'on',
      visibilityPhases: [],
    });

    expect(result.widgets.every((widget) => !widget.enabled)).toBe(true);
    expect(dashboard.widgets.every((widget) => widget.enabled)).toBe(true);
  });

  it('rejects visibility phases outside the shared duration bounds', () => {
    expect(
      parsePerfVisibilityPhases(
        'visible:9,visible:10,hidden:86400,hidden:86401'
      )
    ).toEqual([
      { visibility: 'visible', durationSeconds: 10 },
      { visibility: 'hidden', durationSeconds: 86_400 },
    ]);
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
      channelDelivery: 'on',
      visibilityPhases: [],
    });

    expect(result.widgets.map((widget) => widget.enabled)).toEqual([
      true,
      false,
    ]);
    expect(activePerfWidgetTypes(result)).toEqual(['standings']);
  });
});

describe('perfRunSimulator', () => {
  it('pins iRacing for replay runs and reports a different choice', () => {
    expect(perfRunSimulator(undefined, true)).toEqual({ simulator: 'iracing' });
    expect(perfRunSimulator('', true)).toEqual({ simulator: 'iracing' });
    expect(perfRunSimulator('iracing', true)).toEqual({ simulator: 'iracing' });
    expect(perfRunSimulator('lmu', true)).toEqual({
      simulator: 'iracing',
      overridden: 'lmu',
    });
  });

  it('passes the caller choice through for live runs', () => {
    expect(perfRunSimulator('lmu', false)).toEqual({ simulator: 'lmu' });
    expect(perfRunSimulator(undefined, false)).toEqual({});
  });
});
