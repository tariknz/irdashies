export const MIN_PANEL_PERCENT = 15;
const STORAGE_PREFIX = 'gantryDockPanelWidths:';

export const equalWidths = (count: number): number[] =>
  Array.from({ length: count }, () => 100 / count);

const sum = (values: readonly number[]) =>
  values.reduce((total, value) => total + value, 0);

export const readPanelWidths = (key: string, count: number): number[] => {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_PREFIX + key) ?? 'null'
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === count &&
      parsed.every((value) => Number.isFinite(value) && value > 0)
    ) {
      const total = sum(parsed as number[]);
      return (parsed as number[]).map((value) => (value / total) * 100);
    }
  } catch {
    return equalWidths(count);
  }
  return equalWidths(count);
};

export const writePanelWidths = (
  key: string,
  widths: readonly number[]
): boolean => {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(widths));
    return true;
  } catch {
    return false;
  }
};

export const dividerPosition = (
  widths: readonly number[],
  index: number
): number => sum(widths.slice(0, index + 1));

export const moveDivider = (
  widths: readonly number[],
  index: number,
  deltaPercent: number,
  min = MIN_PANEL_PERCENT
): number[] => {
  const fixed = sum(widths.slice(0, index));
  const oldBoundary = fixed + widths[index];
  const restCount = widths.length - index - 1;
  const boundary = Math.min(
    100 - min * restCount,
    Math.max(fixed + min, oldBoundary + deltaPercent)
  );
  const oldRest = 100 - oldBoundary;
  const newRest = 100 - boundary;
  return widths.map((width, i) => {
    if (i < index) return width;
    if (i === index) return boundary - fixed;
    return oldRest > 0 ? (width / oldRest) * newRest : newRest / restCount;
  });
};
