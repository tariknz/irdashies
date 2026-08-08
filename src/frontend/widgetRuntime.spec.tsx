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
      rendererNeedsLegacyTelemetry([widget('fuel'), widget('input')])
    ).toBe(true);
    expect(rendererNeedsLegacyTelemetry([widget('instance', 'unknown')])).toBe(
      true
    );
  });

  it('declares lap-time channels without prematurely removing legacy data', () => {
    expect(getWidgetRuntimeDefinition('standings')).toMatchObject({
      legacyTelemetry: true,
      channels: [
        'lap-times.snapshot',
        'reference-laps.snapshot',
        'standings.snapshot',
      ],
    });
    expect(getWidgetRuntimeDefinition('relative')).toMatchObject({
      legacyTelemetry: true,
      channels: [
        'lap-times.snapshot',
        'relative-gaps.snapshot',
        'standings.snapshot',
      ],
    });
  });

  it('declares car-speed consumers at the processor rate', () => {
    expect(getWidgetRuntimeDefinition('battle')).toMatchObject({
      legacyTelemetry: true,
      channels: [
        'car-speeds.snapshot',
        'relative-gaps.snapshot',
        'standings.snapshot',
      ],
      channelRates: { 'car-speeds.snapshot': 10 },
    });
    expect(getWidgetRuntimeDefinition('slowcarahead')).toMatchObject({
      legacyTelemetry: true,
      channels: ['car-speeds.snapshot'],
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
