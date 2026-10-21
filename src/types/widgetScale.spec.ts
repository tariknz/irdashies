import { describe, expect, it } from 'vitest';
import { normalizeWidgetScale } from './widgetScale';

describe('normalizeWidgetScale', () => {
  it.each([undefined, null, '125', {}, NaN, Infinity, -Infinity])(
    'defaults invalid input %j to 100%%',
    (value) => expect(normalizeWidgetScale(value)).toBe(100)
  );

  it.each([
    [0, 50],
    [-100, 50],
    [50, 50],
    [123, 123],
    [200, 200],
    [500, 200],
  ])('normalizes %s to %s', (value, expected) => {
    expect(normalizeWidgetScale(value)).toBe(expected);
  });
});
