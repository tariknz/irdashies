import { describe, expect, it } from 'vitest';
import { defaultDashboard, WIDGET_MANIFESTS } from '@irdashies/types';
import {
  previewDashboard,
  previewFitScale,
  resolvePreviewWidget,
} from './presentation';

describe('widget preview presentation', () => {
  it.each(WIDGET_MANIFESTS.map((manifest) => [manifest.id]))(
    'resolves %s without enabling or changing the saved widget',
    (id) => {
      const before = structuredClone(defaultDashboard);
      const widget = resolvePreviewWidget(defaultDashboard, id);
      expect(widget?.enabled).toBe(true);
      expect(widget?.layout).toEqual(
        defaultDashboard.widgets.find((saved) => saved.id === id)?.layout
      );
      expect(defaultDashboard).toEqual(before);
    }
  );

  it('uses manifest defaults when the profile does not contain the widget', () => {
    expect(
      resolvePreviewWidget({ ...defaultDashboard, widgets: [] }, 'radar')
        ?.layout
    ).toEqual(WIDGET_MANIFESTS.find((widget) => widget.id === 'radar')?.layout);
    expect(resolvePreviewWidget(defaultDashboard, '__proto__')).toBeUndefined();
  });

  it('uses the selected instance’s configuration and scale for legacy hooks', () => {
    const input = defaultDashboard.widgets.find(
      (widget) => widget.id === 'input'
    );
    if (!input) throw new Error('Missing input fixture');
    const instance = {
      ...input,
      id: 'input-2',
      type: 'input',
      scale: 150,
      config: {
        ...input.config,
        background: { opacity: 23 },
        sessionVisibility: { race: false },
      },
    };
    const original = {
      ...defaultDashboard,
      widgets: [...defaultDashboard.widgets, instance],
    };
    const widget = resolvePreviewWidget(original, instance.id);
    if (!widget) throw new Error('Missing instance preview');
    const preview = previewDashboard(original, widget);
    expect(preview.widgets.filter((item) => item.id === 'input')).toHaveLength(
      1
    );
    expect(preview.widgets[0]).toMatchObject({
      scale: 150,
      config: { background: { opacity: 23 } },
    });
    expect(preview.widgets[0].config?.sessionVisibility).toBeUndefined();
    expect(original.widgets.at(-1)?.config.sessionVisibility).toEqual({
      race: false,
    });
  });

  it('fits square, tall, and wide frames proportionally without enlarging small widgets', () => {
    expect(previewFitScale(300, 300, 800, 208)).toBeCloseTo(208 / 300);
    expect(previewFitScale(560, 774, 800, 208)).toBeCloseTo(208 / 774);
    expect(previewFitScale(1920, 72, 800, 208)).toBeCloseTo(800 / 1920);
    expect(previewFitScale(160, 40, 800, 208)).toBe(1);
    expect(previewFitScale(300, 300, 0, 0)).toBe(1);
  });
});
