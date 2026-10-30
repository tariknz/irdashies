import { describe, expect, it, vi } from 'vitest';
import { drawPoleSideNotice } from './radarDrawNotice';

const fakeContext = () => {
  const texts: string[] = [];
  const ctx = {
    save: vi.fn(),
    restore: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn((text: string) => texts.push(text)),
    measureText: () => ({ width: 80 }),
    font: '',
    fillStyle: '',
    textAlign: '',
    textBaseline: '',
  } as unknown as CanvasRenderingContext2D;
  return { ctx, texts };
};

describe('drawPoleSideNotice', () => {
  it.each([
    ['left', 'POLE LEFT'],
    ['right', 'POLE RIGHT'],
  ] as const)('names the %s side', (side, label) => {
    const { ctx, texts } = fakeContext();
    drawPoleSideNotice(ctx, 300, side);
    expect(texts).toEqual([label]);
    expect(ctx.fillRect).toHaveBeenCalledTimes(1);
  });

  it('restores the canvas state it changed', () => {
    const { ctx } = fakeContext();
    drawPoleSideNotice(ctx, 300, 'left');
    expect(ctx.save).toHaveBeenCalledTimes(1);
    expect(ctx.restore).toHaveBeenCalledTimes(1);
  });
});
