import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { getTailwindStyle, colorNumToHex } from './colors';

describe('colors', () => {
  describe('getTailwindColor', () => {
    it.each([16767577, 3395327, 16734344, 11430911, 16777215])(
      'should return the correct colors for iracing defined colour: %s',
      (color) => {
        expect(getTailwindStyle(color)).toBeDefined();
      }
    );

    it('should return the default colors for an unknown color', () => {
      // mock computed style
      vi.stubGlobal('getComputedStyle', () => ({
        getPropertyValue: () => '#123456',
      }));

      expect(getTailwindStyle(0x123456)).toEqual({
        driverIcon: 'bg-sky-800 border-sky-500',
        classHeader: 'bg-sky-500 border-sky-500',
        fill: 'fill-sky-500',
        canvasFill: '#123456',
        borderColor: 'border-sky-500',
      });

      vi.unstubAllGlobals();
    });
  });

  describe('getTailwindStyle in multiclass', () => {
    beforeEach(() => {
      vi.stubGlobal('getComputedStyle', () => ({
        getPropertyValue: () => '#123456',
      }));
    });
    afterEach(() => vi.unstubAllGlobals());

    // The class colour lookup only runs in multiclass mode. Single class
    // sessions fall through to the highlight colour instead, which is why a
    // class split that leaves the sim reporting one class renders untinted.
    it('gives each iracing class colour a distinct style', () => {
      const styles = [16767577, 3395327, 16734344, 11430911, 5504887, 13849600]
        .map((color) => getTailwindStyle(color, undefined, true))
        .map((style) => style.classHeader);

      expect(new Set(styles).size).toBe(styles.length);
    });

    it('falls back when the colour is not a known class colour', () => {
      const style = getTailwindStyle(0x00ff00, undefined, true);

      expect(style.classHeader).toBe('bg-stone-500 border-stone-500');
    });

    it('uses the highlight colour outside multiclass', () => {
      const highlighted = getTailwindStyle(undefined, 0xffda59, false);

      expect(highlighted.classHeader).toBe('bg-yellow-500 border-yellow-500');
    });

    it('ignores the highlight colour in multiclass', () => {
      // Class identity wins over the player highlight, otherwise every row
      // would take the player's colour in a multiclass field.
      const style = getTailwindStyle(16734344, 0xffda59, true);

      expect(style.classHeader).not.toBe('bg-yellow-500 border-yellow-500');
    });
  });

  describe('colorNumToHex', () => {
    it('returns undefined for no colour', () => {
      expect(colorNumToHex(undefined)).toBeUndefined();
      expect(colorNumToHex(null as unknown as number)).toBeUndefined();
    });

    it('formats a colour as six hex digits', () => {
      expect(colorNumToHex(0xff5888)).toBe('#ff5888');
    });

    it('pads short values rather than emitting a short hex', () => {
      // #00000f, not #f — a truncated value is not a valid CSS colour.
      expect(colorNumToHex(0x0f)).toBe('#00000f');
    });

    it('drops anything above the low 24 bits', () => {
      // iRacing packs flags into the high byte of some colour fields.
      expect(colorNumToHex(0xff123456)).toBe('#123456');
    });

    it('handles black', () => {
      expect(colorNumToHex(0)).toBe('#000000');
    });
  });
});
