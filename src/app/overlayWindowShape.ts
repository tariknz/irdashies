import type { WidgetLayout } from '@irdashies/types';

type Rectangle = Pick<WidgetLayout, 'x' | 'y' | 'width' | 'height'>;

/**
 * Native window regions use window-local logical pixels. The origin must
 * match containerBoundsInfo.expected, which is what useContainerOffset reads;
 * the size is the actual client size. Electron applies display DPI scaling.
 */
export const buildOverlayWindowShape = (
  layouts: readonly Rectangle[],
  bounds: Rectangle,
  padding: number
): Rectangle[] => {
  const rectangles: Rectangle[] = [];
  for (const layout of layouts) {
    if (
      ![layout.x, layout.y, layout.width, layout.height].every(
        Number.isFinite
      ) ||
      layout.width <= 0 ||
      layout.height <= 0
    ) {
      continue;
    }
    const x = Math.max(0, Math.floor(layout.x - bounds.x - padding));
    const y = Math.max(0, Math.floor(layout.y - bounds.y - padding));
    const right = Math.min(
      bounds.width,
      Math.ceil(layout.x + layout.width - bounds.x + padding)
    );
    const bottom = Math.min(
      bounds.height,
      Math.ceil(layout.y + layout.height - bounds.y + padding)
    );
    if (right > x && bottom > y) {
      rectangles.push({ x, y, width: right - x, height: bottom - y });
    }
  }
  // Widget ordering affects stacking, not the union of the native regions.
  return rectangles.sort(
    (a, b) => a.x - b.x || a.y - b.y || a.width - b.width || a.height - b.height
  );
};

interface ShapeWindow {
  setShape(rectangles: Rectangle[]): void;
}

/** Cache by window lifetime: closed/replaced windows do not retain state. */
export class OverlayWindowShape {
  private readonly applied = new WeakMap<ShapeWindow, Rectangle[]>();
  private readonly failed = new WeakSet<ShapeWindow>();

  constructor(
    private readonly platform: NodeJS.Platform,
    private readonly onError: (error: unknown) => void
  ) {}

  apply(window: ShapeWindow, rectangles: Rectangle[]): void {
    if (
      (this.platform !== 'win32' && this.platform !== 'linux') ||
      this.failed.has(window)
    ) {
      return;
    }
    const previous = this.applied.get(window);
    if (
      previous?.length === rectangles.length &&
      previous.every((rect, i) => {
        const next = rectangles[i];
        return (
          rect.x === next.x &&
          rect.y === next.y &&
          rect.width === next.width &&
          rect.height === next.height
        );
      })
    ) {
      return;
    }
    try {
      window.setShape(rectangles);
      this.applied.set(window, rectangles);
    } catch (error) {
      // A driver/platform failure must leave the existing overlay usable.
      // An empty list restores the rectangular window, rather than hiding it.
      this.failed.add(window);
      this.applied.delete(window);
      try {
        window.setShape([]);
      } catch {
        // The native window may already be going away.
      }
      this.onError(error);
    }
  }
}
