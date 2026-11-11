import { describe, it, expect } from 'vitest';
import {
  PATH_BINS,
  lapPieces,
  spanTileAt,
  tileContent,
  tileLayout,
  tileTranslatePct,
  type LapPiece,
} from './lapTraceTiles';
import { xForMetres } from './lapTraceWindow';

/** Window settings across the range the widget offers. */
const WINDOWS: [number, number][] = [
  [50, 50],
  [200, 200],
  [600, 50],
  [100, 600],
  [600, 600],
];
const TRACKS = [400, 799, 1200, 3602, 5000, 6413.5, 25378];

describe('tileLayout', () => {
  it('is null when there is nothing to tile', () => {
    expect(tileLayout(0, 200, 200)).toBeNull();
    expect(tileLayout(5000, 0, 0)).toBeNull();
    expect(tileLayout(Number.NaN, 200, 200)).toBeNull();
  });

  it.each(TRACKS)(
    'cuts a %f m lap into tiles at least a window wide that repeat with the lap',
    (trackLengthM) => {
      for (const [behind, ahead] of WINDOWS) {
        const layout = tileLayout(trackLengthM, behind, ahead);
        if (!layout) throw new Error('no layout');
        const windowM = behind + ahead;
        expect(layout.tileM).toBeGreaterThanOrEqual(windowM - 1e-9);
        // Less than two windows, so a span's layer stays a sensible size.
        expect(layout.tileM).toBeLessThan(2 * windowM);
        expect(layout.spanM).toBeCloseTo(2 * layout.tileM, 9);
        if (trackLengthM >= windowM) {
          // A whole number of tiles per lap: the tile after the last is the
          // first again, and the grid is unbroken at start/finish.
          expect(layout.tileCount * layout.tileM).toBeCloseTo(trackLengthM, 6);
        } else {
          // One tile spanning whole laps.
          expect(layout.tileCount).toBe(1);
          const laps = layout.tileM / trackLengthM;
          expect(laps).toBeCloseTo(Math.round(laps), 9);
        }
      }
    }
  );

  it.each(TRACKS)(
    'bins a %f m lap no coarser than before, and exactly',
    (trackLengthM) => {
      for (const [behind, ahead] of WINDOWS) {
        const layout = tileLayout(trackLengthM, behind, ahead);
        if (!layout) throw new Error('no layout');
        expect(layout.binM).toBeLessThanOrEqual((behind + ahead) / PATH_BINS);
        // Bins divide the lap, so the lap before and after bins the same.
        const perLap = trackLengthM / layout.binM;
        expect(perLap).toBeCloseTo(Math.round(perLap), 6);
      }
    }
  );
});

describe('tileContent', () => {
  it('wraps unwrapped tiles onto the lap, including behind the line', () => {
    const layout = tileLayout(5000, 200, 200);
    if (!layout) throw new Error('no layout');
    const n = layout.tileCount;
    expect(tileContent(0, layout)).toBe(0);
    expect(tileContent(n, layout)).toBe(0);
    expect(tileContent(-1, layout)).toBe(n - 1);
    expect(tileContent(n + 2, layout)).toBe(2);
  });
});

describe('spanTileAt', () => {
  it.each(TRACKS)(
    'always puts the whole window inside one span, on a %f m lap',
    (trackLengthM) => {
      for (const [behind, ahead] of WINDOWS) {
        const layout = tileLayout(trackLengthM, behind, ahead);
        if (!layout) throw new Error('no layout');
        for (let car = 0; car < trackLengthM; car += trackLengthM / 997) {
          const start = spanTileAt(car, behind, layout) * layout.tileM;
          expect(car - behind).toBeGreaterThanOrEqual(start - 1e-6);
          expect(car + ahead).toBeLessThanOrEqual(start + layout.spanM + 1e-6);
        }
      }
    }
  );
});

describe('tileTranslatePct', () => {
  it('lines a span up with the window the way xForMetres does', () => {
    const behind = 150;
    const ahead = 250;
    const spanM = 900;
    const car = 1234.5;
    const start = 900;
    // Span x of a point, plus the span's offset, must equal its window x.
    const point = 1300;
    const spanX = ((point - start) / (behind + ahead)) * 1000;
    const offset =
      (tileTranslatePct(start, spanM, car, behind) / 100) *
      ((spanM / (behind + ahead)) * 1000);
    expect(spanX + offset).toBeCloseTo(
      xForMetres(point, car, behind, ahead),
      9
    );
  });
});

describe('lapPieces', () => {
  it('cuts a range at each lap it crosses, unwrapping each piece', () => {
    const out: LapPiece[] = [];
    expect(lapPieces(-30, 50, 1000, out)).toBe(2);
    expect(out[0]).toEqual({ fromM: 970, toM: 1000, offsetM: -1000 });
    expect(out[1]).toEqual({ fromM: 0, toM: 50, offsetM: 0 });
  });

  it('spans several laps on a short track, growing its output', () => {
    const out: LapPiece[] = [];
    expect(lapPieces(-10, 1210, 400, out)).toBe(5);
    expect(out.map((p) => p.offsetM)).toEqual([-400, 0, 400, 800, 1200]);
    expect(out[0]).toEqual({ fromM: 390, toM: 400, offsetM: -400 });
    expect(out[4]).toEqual({ fromM: 0, toM: 10, offsetM: 1200 });
  });

  it('writes nothing for an empty range', () => {
    expect(lapPieces(10, 10, 400, [])).toBe(0);
    expect(lapPieces(0, 10, 0, [])).toBe(0);
  });

  it('reuses the pieces it already has', () => {
    const out: LapPiece[] = [];
    lapPieces(-30, 50, 1000, out);
    const first = out[0];
    lapPieces(100, 900, 1000, out);
    expect(out[0]).toBe(first);
  });

  // The whole point of the pieces: x must keep increasing across the seam
  // while the data wraps, or the path snaps back on itself.
  it.each([-200, -1, 2500, 4799, 4999])(
    'tiles a span starting at %f m across start/finish',
    (fromM) => {
      const trackLengthM = 5000;
      const toM = fromM + 800;
      const out: LapPiece[] = [];
      const count = lapPieces(fromM, toM, trackLengthM, out);
      expect(count).toBeGreaterThan(0);
      let previousEnd: number | null = null;
      for (let i = 0; i < count; i++) {
        const piece = out[i];
        expect(piece.toM).toBeGreaterThan(piece.fromM);
        expect(piece.fromM).toBeGreaterThanOrEqual(0);
        expect(piece.toM).toBeLessThanOrEqual(trackLengthM);
        // Adjacent pieces meet exactly: no gap, no overlap.
        if (previousEnd !== null) {
          expect(piece.fromM + piece.offsetM).toBe(previousEnd);
        }
        previousEnd = piece.toM + piece.offsetM;
      }
      // The pieces cover the whole span.
      expect(out[0].fromM + out[0].offsetM).toBe(fromM);
      expect(previousEnd).toBe(toM);
    }
  );
});
