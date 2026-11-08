import { describe, expect, it } from 'vitest';
import { resizeWidgetLayout, type ResizeDirection } from './resizeWidget';

const start = { x: 20, y: 30, width: 400, height: 200 };
describe('widget resize geometry', () => {
  it.each<ResizeDirection>(['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'])(
    'moves only the requested %s edges and preserves opposite edges',
    (direction) => {
      const result = resizeWidgetLayout(start, direction, 40, 20);
      expect(result.x).toBe(direction.includes('w') ? 60 : 20);
      expect(result.y).toBe(direction.includes('n') ? 50 : 30);
      expect(result.width).toBe(
        direction.includes('w') ? 360 : direction.includes('e') ? 440 : 400
      );
      expect(result.height).toBe(
        direction.includes('n') ? 180 : direction.includes('s') ? 220 : 200
      );
      expect(start).toEqual({ x: 20, y: 30, width: 400, height: 200 });
    }
  );
  it('clamps at the website minimum while retaining the opposite corner', () => {
    const result = resizeWidgetLayout(start, 'nw', 1000, 1000);
    expect(result).toEqual({ x: 320, y: 180, width: 100, height: 50 });
    expect(result.x + result.width).toBe(start.x + start.width);
    expect(result.y + result.height).toBe(start.y + start.height);
  });
});
