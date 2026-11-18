import { afterEach, describe, expect, it, vi } from 'vitest';
import { RadarRingsLayer, drawRadarRings } from './radarDrawRings';
import { radarStyleFrom } from './radarStyle';
import { getWidgetDefaultConfig } from '@irdashies/types';
const context = () =>
  ({
    save: vi.fn(),
    restore: vi.fn(),
    setTransform: vi.fn(),
    drawImage: vi.fn(),
    setLineDash: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
  }) as unknown as CanvasRenderingContext2D;
const style = () => ({
  ...radarStyleFrom(
    getWidgetDefaultConfig('radar'),
    { length: 4.5, width: 1.9 },
    true
  ),
  ringSpacing: 10,
  range: 50,
});
afterEach(() => vi.restoreAllMocks());
describe('static Radar rings layer', () => {
  it('renders rings/text once and only blits on later movement frames', () => {
    const cached = context(),
      target = context();
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => cached,
    } as unknown as HTMLCanvasElement;
    const layer = new RadarRingsLayer(1.875, () => canvas);
    const look = style();
    for (let i = 0; i < 60; i++) layer.draw(target, 301, look);
    expect(cached.fillText).toHaveBeenCalledTimes(4);
    expect(target.fillText).not.toHaveBeenCalled();
    expect(target.drawImage).toHaveBeenCalledTimes(60);
    expect(canvas.width).toBe(Math.round(301 * 1.875));
    expect(cached.setTransform).toHaveBeenCalledWith(1.875, 0, 0, 1.875, 0, 0);
    layer.draw(target, 301, { ...look, backgroundOpacity: 10 });
    expect(cached.fillText).toHaveBeenCalledTimes(4);
    for (const next of [
      { ...look, metric: !look.metric },
      { ...look, ringSpacing: 5 },
      { ...look, range: 60 },
    ]) {
      const before = vi.mocked(cached.fillText).mock.calls.length;
      layer.draw(target, 301, next);
      expect(vi.mocked(cached.fillText).mock.calls.length).toBeGreaterThan(
        before
      );
    }
    const beforeResize = vi.mocked(cached.fillText).mock.calls.length;
    layer.draw(target, 302, look);
    expect(vi.mocked(cached.fillText).mock.calls.length).toBeGreaterThan(
      beforeResize
    );
    const blits = vi.mocked(target.drawImage).mock.calls.length;
    layer.draw(target, 302, { ...look, ringSpacing: 0 });
    expect(target.drawImage).toHaveBeenCalledTimes(blits);
    layer.dispose();
  });
  it('preserves the text state and falls back when a cache context is unavailable', () => {
    const reference = context(),
      target = context(),
      look = style();
    drawRadarRings(reference, 150, 149, look, 149 / look.range);
    const layer = new RadarRingsLayer(
      1,
      () => ({ getContext: () => null }) as unknown as HTMLCanvasElement
    );
    layer.draw(target, 300, look);
    expect(target.fillText).toHaveBeenCalledTimes(4);
    expect(target.font).toBe(reference.font);
    expect(target.textBaseline).toBe(reference.textBaseline);
    expect(target.strokeStyle).toBe(reference.strokeStyle);
    layer.dispose();
  });
  it('invalidates after font loading and removes font listeners on disposal', () => {
    const fonts = new EventTarget();
    const previous = Object.getOwnPropertyDescriptor(document, 'fonts');
    Object.defineProperty(document, 'fonts', {
      value: fonts,
      configurable: true,
    });
    const remove = vi.spyOn(fonts, 'removeEventListener');
    const cached = context(),
      target = context();
    const layer = new RadarRingsLayer(
      1,
      () => ({ getContext: () => cached }) as unknown as HTMLCanvasElement
    );
    layer.draw(target, 300, style());
    fonts.dispatchEvent(new Event('loadingdone'));
    layer.draw(target, 300, style());
    expect(cached.fillText).toHaveBeenCalledTimes(8);
    try {
      layer.dispose();
      expect(remove).toHaveBeenCalledTimes(2);
    } finally {
      if (previous) Object.defineProperty(document, 'fonts', previous);
      else Reflect.deleteProperty(document, 'fonts');
    }
  });
});
