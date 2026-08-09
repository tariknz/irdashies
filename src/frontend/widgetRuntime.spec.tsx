import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@irdashies/types';
import {
  getWidgetRuntimeDefinition,
  rendererNeedsChannel,
  rendererNeedsLegacyTelemetry,
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
      legacyTelemetry: false,
      channels: ['fuel.projection'],
    });
    expect(rendererNeedsLegacyTelemetry([widget('fuel')])).toBe(false);
  });

  it('keeps unknown and unmigrated widgets on the legacy path', () => {
    expect(
      rendererNeedsLegacyTelemetry([widget('fuel'), widget('pitlanehelper')])
    ).toBe(false);
    expect(rendererNeedsLegacyTelemetry([widget('instance', 'unknown')])).toBe(
      true
    );
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
    expect(rendererNeedsLegacyTelemetry(normalWidgets.map((id) => widget(id))))
      .toBe(false);
    expect(rendererNeedsLegacyTelemetry([widget('telemetryinspector')])).toBe(
      true
    );
  });

  it('discovers Input and Tachometer as driver-control channel consumers', () => {
    expect(getWidgetRuntimeDefinition('input')).toMatchObject({
      legacyTelemetry: false,
      sessionData: true,
      channels: ['driver-controls.snapshot', 'track-state.snapshot'],
      channelRates: { 'driver-controls.snapshot': 60 },
    });
    expect(getWidgetRuntimeDefinition('tachometer')).toMatchObject({
      legacyTelemetry: false,
      sessionData: true,
      channels: ['driver-controls.snapshot', 'track-state.snapshot'],
    });
    expect(
      rendererNeedsLegacyTelemetry([widget('input'), widget('tachometer')])
    ).toBe(false);
  });

  it('declares standings and relative as channel-only consumers', () => {
    expect(getWidgetRuntimeDefinition('standings')).toMatchObject({
      legacyTelemetry: false,
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
      legacyTelemetry: false,
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
      legacyTelemetry: false,
      channels: [
        'car-speeds.snapshot',
        'relative-gaps.snapshot',
        'standings.snapshot',
        'track-state.snapshot',
      ],
      channelRates: { 'car-speeds.snapshot': 10, 'standings.snapshot': 5 },
    });
    expect(getWidgetRuntimeDefinition('slowcarahead')).toMatchObject({
      legacyTelemetry: false,
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
