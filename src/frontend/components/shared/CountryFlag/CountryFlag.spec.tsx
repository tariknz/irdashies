import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { CountryFlag, FLAIR_ID_TO_COUNTRY_CODE } from './CountryFlag';
import { FLAG_GRID, FLAG_POSITIONS } from './flagSpritePositions';

const flag = (props: Parameters<typeof CountryFlag>[0]) =>
  render(<CountryFlag {...props} />).container;

describe('CountryFlag sprite coverage', () => {
  it('has a cell for every country iRacing can report', () => {
    // iRacing arrives as a flair id, mapped to an ISO code, looked up in the
    // sheet. If the sheet were built from a narrower set than that table, some
    // iRacing nationalities would silently fall back to the generic flag.
    const missing = Object.values(FLAIR_ID_TO_COUNTRY_CODE).filter(
      (code) => !FLAG_POSITIONS[code.toLowerCase()]
    );

    expect(missing).toEqual([]);
  });

  it('covers the GB subdivisions iRacing reports separately', () => {
    // England, Scotland, Wales and Northern Ireland are their own flair ids
    // and their own files, and would be easy to lose by keying on two letters.
    for (const code of ['gb-eng', 'gb-sct', 'gb-wls', 'gb-nir']) {
      expect(FLAG_POSITIONS[code]).toBeDefined();
    }
  });

  it('places every cell inside the sheet', () => {
    for (const [code, [col, row]] of Object.entries(FLAG_POSITIONS)) {
      expect(col, code).toBeLessThan(FLAG_GRID.cols);
      expect(row, code).toBeLessThan(FLAG_GRID.rows);
      expect(col, code).toBeGreaterThanOrEqual(0);
      expect(row, code).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('CountryFlag', () => {
  it('draws an iRacing flair id from the sheet', () => {
    // 223 is the United States.
    const sprite = flag({ flairId: 223 }).querySelector('[role="img"]');
    expect(sprite).not.toBeNull();
    expect(sprite?.getAttribute('aria-label')).toBe('us');
    expect((sprite as HTMLElement).style.backgroundImage).toContain('url(');
  });

  it('prefers a country code, which is how LMU reports it', () => {
    const sprite = flag({ flairId: 223, countryCode: 'FR' }).querySelector(
      '[role="img"]'
    );
    expect(sprite?.getAttribute('aria-label')).toBe('fr');
  });

  it('positions different countries at different offsets', () => {
    const at = (countryCode: string) =>
      (
        flag({ flairId: 0, countryCode }).querySelector(
          '[role="img"]'
        ) as HTMLElement
      ).style.backgroundPosition;

    expect(at('FR')).not.toBe(at('DE'));
  });

  it('falls back to the generic flag for an unknown flair id', () => {
    const container = flag({ flairId: 99999 });
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('falls back for a country the sheet does not carry', () => {
    // A sim naming something outside ISO 3166-1 should not render a blank box.
    const container = flag({ flairId: 0, countryCode: 'ZZ' });
    expect(container.querySelector('[role="img"]')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
