import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@irdashies/types';
import {
  getWidgetRuntimeDefinition,
  rendererNeedsChannel,
  rendererNeedsTelemetryInspector,
  useWidgetChannelRate,
  WidgetRuntimeProvider,
} from './widgetRuntime';

const widget = (id: string, type?: string): DashboardWidget => ({
  id,
  type,
  enabled: true,
  layout: { x: 0, y: 0, width: 100, height: 100 },
});

describe('widget runtime metadata', () => {
  it('discovers Fuel as a channel-only widget', () => {
    expect(getWidgetRuntimeDefinition('fuel')).toMatchObject({
      channels: ['fuel.projection'],
    });
    expect(rendererNeedsTelemetryInspector([widget('fuel')])).toBe(false);
  });

  it('does not opt unknown widgets into diagnostic telemetry', () => {
    expect(rendererNeedsTelemetryInspector([widget('fuel')])).toBe(false);
    expect(
      rendererNeedsTelemetryInspector([widget('instance', 'unknown')])
    ).toBe(false);
  });

  it('reserves raw telemetry for the explicit Telemetry Inspector path', () => {
    const normalWidgets = [
      'standings',
      'input',
      'relative',
      'map',
      'flatmap',
      'weather',
      'wind',
      'fastercarsfrombehind',
      'fuel',
      'blindspotmonitor',
      'garagecover',
      'rejoin',
      'pitlanehelper',
      'tachometer',
      'flag',
      'twitchchat',
      'laptimelog',
      'infobar',
      'slowcarahead',
      'sectordelta',
      'heartrate',
      'cornername',
      'battle',
    ];
    expect(
      rendererNeedsTelemetryInspector(normalWidgets.map((id) => widget(id)))
    ).toBe(false);
    expect(
      rendererNeedsTelemetryInspector([widget('telemetryinspector')])
    ).toBe(true);
    for (const id of ['cornername', 'flag', 'garagecover', 'sectordelta']) {
      expect(rendererNeedsChannel([widget(id)], 'track-state.snapshot')).toBe(
        true
      );
    }
  });

  it('discovers Input and Tachometer as driver-control channel consumers', () => {
    expect(getWidgetRuntimeDefinition('input')).toMatchObject({
      sessionData: true,
      channels: ['driver-controls.snapshot', 'track-state.snapshot'],
      channelRates: { 'driver-controls.snapshot': 60 },
    });
    expect(getWidgetRuntimeDefinition('tachometer')).toMatchObject({
      sessionData: true,
      channels: ['driver-controls.snapshot', 'track-state.snapshot'],
    });
    expect(
      rendererNeedsTelemetryInspector([widget('input'), widget('tachometer')])
    ).toBe(false);
  });

  it('requests a dedicated 25 Hz blind-spot snapshot', () => {
    expect(getWidgetRuntimeDefinition('blindspotmonitor')).toMatchObject({
      channels: ['blind-spot.snapshot'],
      channelRates: { 'blind-spot.snapshot': 25 },
    });
  });

  it('declares standings and relative as channel-only consumers', () => {
    expect(getWidgetRuntimeDefinition('standings')).toMatchObject({
      channels: [
        'lap-times.snapshot',
        'reference-laps.snapshot',
        'radio.snapshot',
        'session-timing.snapshot',
        'session-bar.snapshot',
        'standings.snapshot',
        'track-state.snapshot',
      ],
      channelRates: { 'radio.snapshot': 25 },
    });
    expect(getWidgetRuntimeDefinition('relative')).toMatchObject({
      channels: [
        'lap-times.snapshot',
        'radio.snapshot',
        'session-timing.snapshot',
        'session-bar.snapshot',
        'relative-gaps.snapshot',
        'standings.snapshot',
        'track-state.snapshot',
      ],
      channelRates: { 'radio.snapshot': 25 },
    });
  });

  it('declares car-speed consumers at the processor rate', () => {
    expect(getWidgetRuntimeDefinition('battle')).toMatchObject({
      channels: [
        'car-speeds.snapshot',
        'relative-gaps.snapshot',
        'standings.snapshot',
        'track-state.snapshot',
      ],
      channelRates: { 'car-speeds.snapshot': 10, 'standings.snapshot': 5 },
    });
    expect(getWidgetRuntimeDefinition('slowcarahead')).toMatchObject({
      channels: ['car-speeds.snapshot', 'track-state.snapshot'],
      channelRates: { 'car-speeds.snapshot': 10 },
    });
  });

  it('activates reference laps only for consumers', () => {
    expect(
      rendererNeedsChannel([widget('relative')], 'reference-laps.snapshot')
    ).toBe(false);
    expect(
      rendererNeedsChannel([widget('standings')], 'reference-laps.snapshot')
    ).toBe(true);
    expect(
      rendererNeedsChannel([widget('input')], 'reference-laps.snapshot')
    ).toBe(false);
    expect(
      rendererNeedsChannel([widget('relative')], 'relative-gaps.snapshot')
    ).toBe(true);
  });

  it('maps the Fuel rate preset to its channel subscription', () => {
    const { result } = renderHook(
      () => useWidgetChannelRate('fuel.projection'),
      {
        wrapper: ({ children }) => (
          <WidgetRuntimeProvider widgetType="fuel">
            {children}
          </WidgetRuntimeProvider>
        ),
      }
    );

    expect(result.current).toBe(5);
  });
});
