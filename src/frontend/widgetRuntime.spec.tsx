import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DashboardWidget } from '@irdashies/types';
import {
  getWidgetRuntimeDefinition,
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
