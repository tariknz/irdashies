import { beforeEach, describe, expect, it } from 'vitest';
import {
  dividerPosition,
  equalWidths,
  moveDivider,
  readPanelWidths,
  writePanelWidths,
} from './panelWidths';

const rounded = (widths: number[]) => widths.map((w) => Math.round(w));

describe('panel widths', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('splits evenly by default', () => {
    expect(equalWidths(1)).toEqual([100]);
    expect(equalWidths(2)).toEqual([50, 50]);
    expect(rounded(equalWidths(3))).toEqual([33, 33, 33]);
  });

  it('widens or narrows the panels after the first divider together', () => {
    const next = moveDivider(equalWidths(3), 0, -13);
    expect(rounded(next)).toEqual([20, 40, 40]);
    expect(next.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it('only moves the two panels either side of a later divider', () => {
    const next = moveDivider([20, 40, 40], 1, 15);
    expect(rounded(next)).toEqual([20, 55, 25]);
  });

  it('keeps every panel at least the minimum width', () => {
    expect(rounded(moveDivider([50, 50], 0, -80))).toEqual([15, 85]);
    expect(rounded(moveDivider([20, 40, 40], 0, 70))).toEqual([70, 15, 15]);
  });

  it('never shrinks an unequal remaining panel below the minimum', () => {
    const atMin = moveDivider([20, 65, 15], 0, 10);
    expect(rounded(atMin)).toEqual([20, 65, 15]);

    const roomy = moveDivider([20, 50, 30], 0, 20);
    expect(Math.min(...roomy.slice(1))).toBeGreaterThanOrEqual(15 - 1e-9);
    expect(roomy.reduce((a, b) => a + b, 0)).toBeCloseTo(100);
  });

  it('still lets the remaining panels grow when one is at the minimum', () => {
    expect(rounded(moveDivider([20, 65, 15], 0, -5))).toEqual([15, 69, 16]);
  });

  it('reports each divider as a share of the whole row', () => {
    expect(dividerPosition([20, 55, 25], 0)).toBe(20);
    expect(dividerPosition([20, 55, 25], 1)).toBe(75);
  });

  it('remembers widths per set of panels and ignores bad entries', () => {
    writePanelWidths('a,b', [30, 70]);
    expect(readPanelWidths('a,b', 2)).toEqual([30, 70]);
    expect(readPanelWidths('a,b,c', 3)).toEqual(equalWidths(3));
    expect(readPanelWidths('a,b', 3)).toEqual(equalWidths(3));

    localStorage.setItem('gantryDockPanelWidths:x,y', '[1, "wide"]');
    expect(readPanelWidths('x,y', 2)).toEqual([50, 50]);
    localStorage.setItem('gantryDockPanelWidths:x,y', 'not json');
    expect(readPanelWidths('x,y', 2)).toEqual([50, 50]);
  });
});
