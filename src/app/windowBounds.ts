/**
 * Validation for window bounds restored from disk.
 *
 * Saved bounds outlive the display arrangement that produced them: a window
 * moved onto a monitor at x=-1920 keeps those coordinates after that monitor
 * is unplugged or rearranged, and is then restored somewhere no display
 * covers — visible to the window manager but unreachable by the user.
 *
 * Deliberately free of Electron imports so it can be unit tested directly.
 * Callers pass display rectangles in the same coordinate space as the saved
 * bounds; Electron's `screen` API reports DIP for both, so pass `workArea`
 * (which excludes the taskbar) rather than `bounds`.
 */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * A restored window must expose at least this much of itself on some display.
 * Roughly a grabbable strip of title bar — enough to drag the window back into
 * view, without rejecting a window the user deliberately parked mostly
 * off-screen.
 */
export const MIN_VISIBLE_WIDTH = 120;
export const MIN_VISIBLE_HEIGHT = 40;

const isPositiveFinite = (n: number): boolean => Number.isFinite(n) && n > 0;

export const isValidRect = (rect: unknown): rect is Rect =>
  typeof rect === 'object' &&
  rect !== null &&
  !Array.isArray(rect) &&
  'x' in rect &&
  'y' in rect &&
  'width' in rect &&
  'height' in rect &&
  typeof rect.x === 'number' &&
  typeof rect.y === 'number' &&
  typeof rect.width === 'number' &&
  typeof rect.height === 'number' &&
  Number.isFinite(rect.x) &&
  Number.isFinite(rect.y) &&
  isPositiveFinite(rect.width) &&
  isPositiveFinite(rect.height);

/** Default outer window rectangle, in Electron's logical pixels (DIP). */
export const defaultSettingsWindowBounds = (primaryWorkArea: Rect): Rect => {
  const width = Math.max(
    1,
    Math.min(1280, Math.floor(primaryWorkArea.width * 0.9))
  );
  const height = Math.max(
    1,
    Math.min(800, Math.floor(primaryWorkArea.height * 0.9))
  );
  return {
    width,
    height,
    x: Math.round(primaryWorkArea.x + (primaryWorkArea.width - width) / 2),
    y: Math.round(primaryWorkArea.y + (primaryWorkArea.height - height) / 2),
  };
};

/**
 * The overlapping rectangle between two rectangles, or null when they do not
 * intersect. Rectangles that merely share an edge do not intersect.
 */
export const intersection = (a: Rect, b: Rect): Rect | null => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const width = Math.min(a.x + a.width, b.x + b.width) - x;
  const height = Math.min(a.y + a.height, b.y + b.height) - y;
  if (width <= 0 || height <= 0) return null;
  return { x, y, width, height };
};

/**
 * True when the rectangle overlaps some display by at least the minimum
 * grabbable strip.
 *
 * Both dimensions are checked rather than the overlap area: a 10px-wide strip
 * of a tall window clears any reasonable area threshold while being useless to
 * grab. The requirement is capped by the window's own size so a window smaller
 * than the minimum is not rejected outright.
 */
export const isReachable = (bounds: Rect, displays: Rect[]): boolean => {
  const requiredWidth = Math.min(MIN_VISIBLE_WIDTH, bounds.width);
  const requiredHeight = Math.min(MIN_VISIBLE_HEIGHT, bounds.height);
  return displays.some((display) => {
    const overlap = intersection(bounds, display);
    return (
      !!overlap &&
      overlap.width >= requiredWidth &&
      overlap.height >= requiredHeight
    );
  });
};

/**
 * Move a rectangle wholly inside a target display, shrinking it first if it is
 * larger than the target.
 */
const fitWithin = (bounds: Rect, target: Rect): Rect => {
  const width = Math.min(bounds.width, target.width);
  const height = Math.min(bounds.height, target.height);
  return {
    width,
    height,
    x: Math.round(target.x + (target.width - width) / 2),
    y: Math.round(target.y + (target.height - height) / 2),
  };
};

/**
 * Validate bounds restored from disk against the displays connected right now.
 *
 * Returns the saved bounds unchanged when the window would still be reachable,
 * a rectangle centred on the primary display when it would not, and
 * `undefined` when there is nothing usable to restore — letting the caller fall
 * back to its own defaults.
 */
export const sanitizeWindowBounds = (
  saved: unknown,
  displays: Rect[],
  primary: Rect | undefined
): Rect | undefined => {
  if (!saved || !isValidRect(saved)) return undefined;
  if (displays.length > 0 && isReachable(saved, displays)) return saved;
  if (!primary || !isValidRect(primary)) return undefined;
  return fitWithin(saved, primary);
};
